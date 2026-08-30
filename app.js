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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const selected = Array.from(form.querySelectorAll('input[type="checkbox"]:checked')).map((item) => item.value);
  const summary = [
    `Solicitud preparada para ${data.get("nombre") || "cliente"}.`,
    selected.length ? `Intereses: ${selected.join(", ")}.` : "Sin servicios marcados aun.",
    "Demo lista para conectar a correo, CRM o WhatsApp."
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

const speakFlex = (text) => {
  if (!speech) return;
  speech.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-CR";
  utterance.rate = 0.94;
  speech.speak(utterance);
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

flexForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = flexInput.value.trim();
  if (!message) return;
  flexInput.value = "";
  addFlexMessage("user", message);
  const reply = await askFlex(message);
  flexHistory.push({ role: "assistant", content: reply });
  addFlexMessage("bot", reply);
  speakFlex(reply);
});

flexMic?.addEventListener("click", () => {
  if (!SpeechRecognition) {
    setFlexStatus("El navegador no permite dictado por micrófono en esta sesión.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "es-CR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  setFlexStatus("Escuchando...");
  recognition.start();
  recognition.addEventListener("result", (event) => {
    flexInput.value = event.results[0][0].transcript;
    flexInput.focus();
  });
  recognition.addEventListener("end", () => setFlexStatus("Mensaje dictado. Revise y envíe a Flex."));
  recognition.addEventListener("error", () => setFlexStatus("No pude activar el micrófono. Puede escribir la consulta."));
});
