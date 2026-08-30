const header = document.querySelector("[data-header]");
const menuButton = document.querySelector("[data-menu-button]");
const nav = document.querySelector("[data-nav]");
const form = document.querySelector("[data-quote-form]");
const note = document.querySelector("[data-form-note]");
const dialog = document.querySelector("[data-dialog]");
const dialogClose = document.querySelector("[data-dialog-close]");

const setHeaderState = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 24);
};

window.addEventListener("scroll", setHeaderState, { passive: true });
setHeaderState();

menuButton.addEventListener("click", () => {
  const open = nav.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(open));
});

nav.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    nav.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  }
});

const today = new Date().toISOString().slice(0, 10);
const dateInput = form.querySelector('input[name="fecha"]');
if (dateInput && !dateInput.value) {
  dateInput.value = today;
}

const CRM_STORAGE_KEY = "roadsSolutionsCrm.v1";
const CRM_STAGE_RECEIVED = "Solicitud recibida";

const loadCrmState = () => {
  try {
    return {
      contacts: [],
      opportunities: [],
      tasks: [],
      notifications: [],
      selectedId: null,
      ...JSON.parse(localStorage.getItem(CRM_STORAGE_KEY))
    };
  } catch {
    return {
      contacts: [],
      opportunities: [],
      tasks: [],
      notifications: [],
      selectedId: null
    };
  }
};

const saveCrmState = (state) => {
  localStorage.setItem(CRM_STORAGE_KEY, JSON.stringify(state));
};

const createCrmId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const crmStamp = () =>
  new Date().toLocaleString("es-CR", {
    dateStyle: "medium",
    timeStyle: "short"
  });

const normalizeCrmText = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const inferCrmService = (selected, detail) => {
  const text = normalizeCrmText(`${selected.join(" ")} ${detail}`);
  if (text.includes("flex") || text.includes("baranda")) return "Flex Beam";
  if (text.includes("asfalt") || text.includes("base") || text.includes("mezcla")) return "Base granular y mezcla asfáltica";
  if (text.includes("demarc") || text.includes("cierre")) return "Demarcación vial y cierres de obra";
  return "Señalización vertical y horizontal";
};

const classifyCrmUrgency = (selected, detail) => {
  const text = normalizeCrmText(`${selected.join(" ")} ${detail}`);
  if (/urgente|inmediato|hoy|manana|mañana|riesgo|cierre|desvio|desvío/.test(text)) return "Alta";
  return "Media";
};

const firstNumber = (value) => {
  const match = String(value || "").replace(",", ".").match(/\d+(\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : 0;
};

const buildCrmTasks = (opportunity) => {
  const taskBase = {
    opportunityId: opportunity.id,
    owner: opportunity.owner,
    done: false,
    createdAt: crmStamp()
  };
  const tasks = [];
  const service = opportunity.service;

  if (!opportunity.quantities.metrosLineales && service !== "Señalización vertical y horizontal") {
    tasks.push({
      ...taskBase,
      id: createCrmId("task"),
      title: "Solicitar información adicional",
      detail: "Confirmar medidas técnicas completas para cotizar.",
      due: opportunity.project.urgency === "Alta" ? today : ""
    });
  }

  if (service === "Flex Beam") {
    tasks.push({
      ...taskBase,
      id: createCrmId("task"),
      title: "Solicitar datos Flex Beam",
      detail: "Longitud, terminales, ubicación exacta y fotografías.",
      due: ""
    });
  }

  if (service === "Base granular y mezcla asfáltica") {
    tasks.push({
      ...taskBase,
      id: createCrmId("task"),
      title: "Solicitar datos de asfalto",
      detail: "Largo, ancho, espesor, superficie y base existente.",
      due: ""
    });
  }

  if (service === "Demarcación vial y cierres de obra") {
    tasks.push({
      ...taskBase,
      id: createCrmId("task"),
      title: "Solicitar esquema vial",
      detail: "Tipo de línea, metros lineales, símbolos, flechas, planos, horarios y duración.",
      due: ""
    });
  }

  tasks.push({
    ...taskBase,
    id: createCrmId("task"),
    title: "Revisión técnica",
    detail: "Revisar solicitud recibida desde el formulario web.",
    due: today
  });

  return tasks;
};

const savePublicQuoteToCrm = (data, selected) => {
  const state = loadCrmState();
  const detail = String(data.get("detalle") || "");
  const service = inferCrmService(selected, detail);
  const urgency = classifyCrmUrgency(selected, detail);
  const roughMeasure = firstNumber(`${data.get("area") || ""} ${data.get("cantidad") || ""}`);
  const now = crmStamp();
  const clientName = String(data.get("nombre") || "Cliente web").trim();
  const phone = String(data.get("telefono") || "").trim();
  const email = String(data.get("correo") || "").trim();

  const contact =
    state.contacts.find((item) => item.email === email || item.phone === phone) ||
    {
      id: createCrmId("contact"),
      name: clientName,
      contactPerson: clientName,
      phone,
      email,
      preference: "Ambos",
      createdAt: now,
      lastContactAt: now
    };

  contact.name = clientName;
  contact.phone = phone;
  contact.email = email;
  contact.lastContactAt = now;

  if (!state.contacts.some((item) => item.id === contact.id)) {
    state.contacts.push(contact);
  }

  const opportunity = {
    id: createCrmId("opp"),
    contactId: contact.id,
    client: {
      name: clientName,
      contactPerson: clientName,
      phone,
      email,
      preference: "Ambos"
    },
    project: {
      location: String(data.get("direccion") || "").trim(),
      province: String(data.get("provincia") || ""),
      canton: "",
      coordinates: "",
      description: [detail, String(data.get("superficie") || ""), String(data.get("cantidad") || "")]
        .filter(Boolean)
        .join(" | "),
      urgency,
      startDate: ""
    },
    service,
    quantities: {
      largo: 0,
      ancho: 0,
      espesorCm: 0,
      metrosLineales: service.includes("Flex") || service.includes("Demarcación") ? roughMeasure : 0,
      senales: service.includes("Señalización") ? roughMeasure : 0,
      m2: service.includes("asfáltica") ? roughMeasure : 0,
      m3: 0
    },
    files: [],
    stage: CRM_STAGE_RECEIVED,
    owner: "Ventas",
    source: "Formulario web",
    entryDate: String(data.get("fecha") || today),
    lastContactDate: today,
    nextAction: "Revisión técnica y respuesta al cliente.",
    estimatedAmount: 0,
    probability: urgency === "Alta" ? 45 : 35,
    lossReason: "",
    createdAt: now,
    updatedAt: now,
    history: [
      {
        stage: CRM_STAGE_RECEIVED,
        date: now,
        owner: "Ventas",
        nextAction: "Revisión técnica y respuesta al cliente."
      }
    ]
  };

  state.opportunities.unshift(opportunity);
  state.tasks.unshift(...buildCrmTasks(opportunity));
  state.notifications.unshift({
    id: createCrmId("note"),
    opportunityId: opportunity.id,
    title: "Solicitud web recibida",
    detail: `${clientName} solicitó ${service}. Responder por correo o WhatsApp lo más pronto posible.`,
    createdAt: now
  });
  state.selectedId = opportunity.id;
  saveCrmState(state);
};

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const selected = Array.from(form.querySelectorAll('input[type="checkbox"]:checked')).map((item) => item.value);
  savePublicQuoteToCrm(data, selected);
  const summary = [
    `Solicitud preparada para ${data.get("nombre") || "cliente"}.`,
    selected.length ? `Intereses: ${selected.join(", ")}.` : "Sin servicios marcados aun.",
    "Guardada en el CRM local para revisión, tareas y seguimiento."
  ].join(" ");

  note.textContent = summary;

  if (dialog?.showModal) {
    dialog.showModal();
  }
});

dialogClose?.addEventListener("click", () => dialog.close());

dialog?.addEventListener("click", (event) => {
  const rect = dialog.getBoundingClientRect();
  const inside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;
  if (!inside) {
    dialog.close();
  }
});

const flexChat = document.querySelector("[data-flex-chat]");
const flexToggle = document.querySelector("[data-flex-toggle]");
const flexClose = document.querySelector("[data-flex-close]");
const flexPanel = document.querySelector("[data-flex-panel]");
const flexForm = document.querySelector("[data-flex-form]");
const flexMessages = document.querySelector("[data-flex-messages]");
const flexStatus = document.querySelector("[data-flex-status]");
const flexMic = document.querySelector("[data-flex-mic]");
const flexInput = flexForm?.querySelector("textarea");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speech = "speechSynthesis" in window ? window.speechSynthesis : null;

const flexHistory = [];
let flexRecognition = null;
let flexListening = false;
let flexTranscript = "";
let flexSpeechQueue = [];

const setFlexStatus = (message) => {
  if (flexStatus) {
    flexStatus.textContent = message;
  }
};

const addFlexMessage = (role, text) => {
  const item = document.createElement("article");
  item.className = `flex-message ${role}`;
  const name = role === "user" ? "Cliente" : "Flex";
  item.innerHTML = `<strong>${name}</strong><p></p>`;
  item.querySelector("p").textContent = text;
  flexMessages?.appendChild(item);
  flexMessages?.scrollTo({ top: flexMessages.scrollHeight, behavior: "smooth" });
};

const splitSpeechText = (text) => {
  const cleanText = text.replace(/\s+/g, " ").trim();
  const sentences = cleanText.match(/[^.!?;:]+[.!?;:]?/g) || [cleanText];
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    const next = `${current} ${sentence}`.trim();
    if (next.length <= 220) {
      current = next;
      continue;
    }
    if (current) {
      chunks.push(current);
    }
    if (sentence.length <= 220) {
      current = sentence.trim();
      continue;
    }
    for (let index = 0; index < sentence.length; index += 200) {
      chunks.push(sentence.slice(index, index + 200).trim());
    }
    current = "";
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.filter(Boolean);
};

const speakNextFlexChunk = () => {
  if (!speech || !flexSpeechQueue.length) return;
  const utterance = new SpeechSynthesisUtterance(flexSpeechQueue.shift());
  utterance.lang = "es-CR";
  const spanishVoice = speech
    .getVoices()
    .find((voice) => voice.lang?.toLowerCase().startsWith("es"));
  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }
  utterance.rate = 0.94;
  utterance.pitch = 0.92;
  utterance.volume = 1;
  utterance.addEventListener("end", speakNextFlexChunk);
  speech.speak(utterance);
};

const speakFlex = (text) => {
  if (!speech) return;
  speech.cancel();
  flexSpeechQueue = splitSpeechText(text);
  speakNextFlexChunk();
};

const localFlexReply = (message) => {
  const lower = message.toLowerCase();
  if (lower.match(/m2|m²|metro cuadrado|area|área/)) {
    return "Para estimar m², multiplique largo por ancho. Por ejemplo, una superficie de 40 m por 6 m equivale a 240 m². Con ese dato, ubicación y condición de la vía, el equipo puede preparar una cotización más precisa.";
  }
  if (lower.match(/m3|m³|metro cubico|metro cúbico|volumen|base/)) {
    return "Para estimar m³ de base, multiplique largo por ancho por espesor en metros. Ejemplo: 50 m x 4 m x 0.15 m = 30 m³. La compactación, humedad y tipo de material pueden ajustar la cantidad final.";
  }
  if (lower.match(/flex|beam|baranda|defensa/)) {
    return "La baranda tipo Flex Beam se cotiza normalmente por metros lineales, terminales, postes, separadores, fijación y condiciones del sitio. Conviene indicar tramo, ubicación, curva o borde de riesgo y si existe plano o visita técnica.";
  }
  if (lower.match(/señal|senal|demarc|cierre|tránsito|transito/)) {
    return "Para señalización, demarcación o cierres de obra se revisan ubicación, flujo vehicular, horario, cantidades, tipo de pintura o señal, reflectividad y control temporal requerido para proteger usuarios y cuadrillas.";
  }
  if (lower.match(/cotiz|whatsapp|correo|crm|respuesta|tiempo/)) {
    return "Puede completar el formulario del sitio con datos de contacto, ubicación, servicio requerido y cantidades aproximadas. El proceso está automatizado con IA para tramitar la solicitud de inmediato y coordinar respuesta por correo o WhatsApp lo más pronto posible. El CRM permite controlar cada pedido con seguimiento y responsabilidad.";
  }
  return "Soy Flex, asistente de Roads & Solutions S.A. Respondo sobre baranda tipo Flex Beam, señalización vertical y horizontal, demarcación vial, apoyo en cierres de obra, base y mezcla asfáltica. Para cotizar, necesito ubicación, servicio, medidas aproximadas, urgencia y datos de contacto.";
};

const askFlex = async (message) => {
  flexHistory.push({ role: "user", content: message });
  setFlexStatus("Flex está revisando la consulta...");

  try {
    const response = await fetch("/api/flex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: flexHistory.slice(-8) })
    });

    if (!response.ok) {
      throw new Error("Flex API unavailable");
    }

    const data = await response.json();
    return data.reply || localFlexReply(message);
  } catch {
    return localFlexReply(message);
  } finally {
    setFlexStatus("Listo para orientar sobre cotizaciones, cantidades y servicios viales.");
  }
};

flexToggle?.addEventListener("click", () => {
  const willOpen = flexPanel.hidden;
  flexPanel.hidden = !willOpen;
  flexToggle.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) {
    flexInput?.focus();
  }
});

flexClose?.addEventListener("click", () => {
  flexPanel.hidden = true;
  flexToggle?.setAttribute("aria-expanded", "false");
});

const submitFlexMessage = async () => {
  const message = flexInput.value.trim();
  if (!message) return;
  flexInput.value = "";
  addFlexMessage("user", message);
  const reply = await askFlex(message);
  flexHistory.push({ role: "assistant", content: reply });
  addFlexMessage("bot", reply);
  speakFlex(reply);
};

flexForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitFlexMessage();
});

const stopFlexListening = () => {
  if (!flexRecognition || !flexListening) return;
  flexRecognition.stop();
};

const createFlexRecognition = () => {
  if (!SpeechRecognition) {
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "es-CR";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.addEventListener("start", () => {
    flexListening = true;
    flexTranscript = "";
    flexMic?.classList.add("is-listening");
    flexMic?.setAttribute("aria-label", "Detener micrófono de Flex");
    setFlexStatus("Escuchando... hable con Flex.");
  });

  recognition.addEventListener("result", (event) => {
    let interim = "";
    let finalText = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;
      if (event.results[index].isFinal) {
        finalText += transcript;
      } else {
        interim += transcript;
      }
    }

    flexTranscript = `${flexTranscript} ${finalText}`.trim();
    flexInput.value = `${flexTranscript} ${interim}`.trim();
    flexInput.focus();
  });

  recognition.addEventListener("end", async () => {
    flexListening = false;
    flexMic?.classList.remove("is-listening");
    flexMic?.setAttribute("aria-label", "Hablar con Flex");

    if (flexInput.value.trim()) {
      setFlexStatus("Mensaje escuchado. Flex está respondiendo...");
      await submitFlexMessage();
      return;
    }

    setFlexStatus("No detecté voz. Toque el micrófono e intente de nuevo.");
  });

  recognition.addEventListener("error", (event) => {
    flexListening = false;
    flexMic?.classList.remove("is-listening");
    flexMic?.setAttribute("aria-label", "Hablar con Flex");
    const messages = {
      "not-allowed": "Active el permiso de micrófono del navegador para hablar con Flex.",
      "no-speech": "No detecté voz. Toque el micrófono e intente de nuevo.",
      "audio-capture": "No encontré un micrófono disponible en este dispositivo."
    };
    setFlexStatus(messages[event.error] || "No pude activar el micrófono. También puede escribir la consulta.");
  });

  return recognition;
};

flexMic?.addEventListener("click", () => {
  if (!SpeechRecognition) {
    setFlexStatus("El navegador no permite dictado por micrófono en esta sesión. Use Chrome o Edge con HTTPS.");
    return;
  }

  if (flexListening) {
    stopFlexListening();
    return;
  }

  speech?.cancel();
  flexRecognition = createFlexRecognition();
  try {
    flexRecognition?.start();
  } catch {
    setFlexStatus("El micrófono ya estaba iniciando. Espere un momento e intente de nuevo.");
  }
});
