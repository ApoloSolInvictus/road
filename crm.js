const STORAGE_KEY = "roadsSolutionsCrm.v1";
const CRM_AI_ENDPOINT = "/api/crm-ai";

const STAGES = [
  "Solicitud recibida",
  "Datos pendientes",
  "Revisión técnica",
  "Visita técnica requerida",
  "Cotización en preparación",
  "Cotización enviada",
  "Seguimiento",
  "Negociación o ajustes",
  "Ganada",
  "Perdida o descartada",
  "Servicio ejecutado"
];

const SERVICE_RULES = {
  "Flex Beam": {
    keywords: ["flex", "beam", "baranda", "defensa", "terminal", "poste"],
    required: ["metros lineales", "ubicación", "fotografías", "cantidad de terminales"],
    task: "Solicitar longitud, cantidad de terminales, ubicación y fotografías.",
    visit: true
  },
  "Señalización vertical y horizontal": {
    keywords: ["señal", "senal", "vertical", "horizontal", "reflectiva", "poste"],
    required: ["cantidad de señales", "ubicación", "tipo de señal"],
    task: "Validar tipo, cantidad, ubicación y lámina reflectiva requerida.",
    visit: false
  },
  "Demarcación vial y cierres de obra": {
    keywords: ["demarc", "línea", "linea", "cierre", "tránsito", "transito", "flecha", "símbolo", "simbolo"],
    required: ["metros lineales", "tipo de línea", "horarios", "esquema vial"],
    task: "Solicitar tipo de línea, metros lineales, símbolos, flechas, planos y horarios.",
    visit: true
  },
  "Base granular y mezcla asfáltica": {
    keywords: ["asfalto", "asfáltica", "asfaltica", "base", "mezcla", "carpeta", "bacheo", "espesor"],
    required: ["largo", "ancho", "espesor", "estado de superficie", "base existente"],
    task: "Solicitar largo, ancho, espesor, estado de superficie y base existente.",
    visit: true
  }
};

const MESSAGE_TEMPLATES = {
  confirmacion: ({ opportunity }) => `Hola ${opportunity.client.contactPerson || opportunity.client.name}, gracias por contactar a Roads & Solutions S.A. Recibimos su solicitud de ${opportunity.service} para ${opportunity.project.location || "la ubicación indicada"}. Nuestro equipo iniciará la revisión y le contactará con los siguientes pasos.`,
  faltantes: ({ opportunity, review }) => `Hola ${opportunity.client.contactPerson || opportunity.client.name}, para continuar con la revisión de ${opportunity.service} necesitamos confirmar: ${review.missing.join(", ") || "el alcance técnico final"}. Quedamos atentos para avanzar.`,
  archivos: ({ opportunity }) => `Hola ${opportunity.client.contactPerson || opportunity.client.name}, ¿podría compartir fotografías actuales del sitio, planos disponibles y cualquier esquema de manejo vial relacionado con ${opportunity.service}? Esto nos ayudará a validar el alcance.`,
  revision: ({ opportunity }) => `Hola ${opportunity.client.contactPerson || opportunity.client.name}, confirmamos que la solicitud de ${opportunity.service} entró a revisión técnica. Le avisaremos si se requiere una visita o información adicional antes de preparar la cotización.`,
  cotizacion: ({ opportunity }) => `Hola ${opportunity.client.contactPerson || opportunity.client.name}, adjuntamos la cotización correspondiente a ${opportunity.service}. La propuesta está sujeta a las condiciones, alcance, vigencia y observaciones indicadas en el documento.`,
  seguimiento: ({ opportunity }) => `Hola ${opportunity.client.contactPerson || opportunity.client.name}, damos seguimiento a la cotización de ${opportunity.service}. ¿Pudieron revisarla? Estamos disponibles para aclarar dudas o ajustar el alcance validado.`,
  recordatorio: ({ opportunity }) => `Hola ${opportunity.client.contactPerson || opportunity.client.name}, le recordamos que seguimos atentos a su respuesta sobre la propuesta de ${opportunity.service}. Con gusto coordinamos una llamada o revisamos los próximos pasos.`,
  cierre: ({ opportunity }) => `Hola ${opportunity.client.contactPerson || opportunity.client.name}, cerraremos o dejaremos en pausa esta solicitud de ${opportunity.service} por el momento. Si el proyecto continúa, podemos reabrir la oportunidad y actualizar la información.`,
};

function createEmptyState() {
  return {
    contacts: [],
    opportunities: [],
    tasks: [],
    notifications: [],
    activities: [],
    quotes: [],
    selectedId: null
  };
}

const form = document.querySelector("[data-opportunity-form]");
const pipeline = document.querySelector("[data-pipeline]");
const selectedPanel = document.querySelector("[data-selected-panel]");
const aiReview = document.querySelector("[data-ai-review]");
const taskList = document.querySelector("[data-task-list]");
const notificationList = document.querySelector("[data-notification-list]");
const searchInput = document.querySelector("[data-search]");
const urgencyFilter = document.querySelector("[data-filter-urgency]");
const ownerFilter = document.querySelector("[data-filter-owner]");
const probabilityInput = document.querySelector("[data-probability-input]");
const probabilityLabel = document.querySelector("[data-probability-label]");
const formNote = document.querySelector("[data-crm-form-note]");
const messageForm = document.querySelector("[data-message-form]");
const messageTemplate = document.querySelector("[data-message-template]");
const messageBody = document.querySelector("[data-message-body]");
const messageNote = document.querySelector("[data-message-note]");
const activityList = document.querySelector("[data-activity-list]");
const quoteForm = document.querySelector("[data-quote-form]");
const quotePreview = document.querySelector("[data-quote-preview]");
const quoteNote = document.querySelector("[data-quote-note]");
const activeContext = document.querySelector("[data-active-context]");
const demoButton = document.querySelector("[data-crm-demo]");
const clearButton = document.querySelector("[data-crm-clear]");
const exportButton = document.querySelector("[data-crm-export]");

let state = loadState();

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...createEmptyState(),
      ...parsed,
      activities: parsed?.activities || [],
      quotes: parsed?.quotes || []
    };
  } catch {
    return createEmptyState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowStamp() {
  return new Date().toLocaleString("es-CR", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function money(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0
  }).format(amount);
}

function getNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function inferService(description, selected) {
  if (selected) return selected;
  const text = normalize(description);
  const found = Object.entries(SERVICE_RULES).find(([, rule]) =>
    rule.keywords.some((keyword) => text.includes(normalize(keyword)))
  );
  return found ? found[0] : "Señalización vertical y horizontal";
}

function classifyUrgency(rawUrgency, description, startDate) {
  const text = normalize(`${rawUrgency} ${description}`);
  if (rawUrgency === "Alta" || /urgente|inmediato|hoy|manana|mañana|accidente|riesgo|cierre/.test(text)) {
    return "Alta";
  }

  if (startDate) {
    const days = Math.ceil((new Date(startDate) - new Date(today())) / 86400000);
    if (days <= 7) return "Alta";
    if (days <= 21) return "Media";
  }

  return rawUrgency || "Media";
}

function calculateQuantities(values) {
  const largo = getNumber(values.largo);
  const ancho = getNumber(values.ancho);
  const espesorCm = getNumber(values.espesor);
  const metrosLineales = getNumber(values.metrosLineales) || largo;
  const m2 = largo && ancho ? largo * ancho : 0;
  const m3 = m2 && espesorCm ? m2 * (espesorCm / 100) : 0;

  return {
    largo,
    ancho,
    espesorCm,
    metrosLineales,
    senales: getNumber(values.senales),
    m2,
    m3
  };
}

function getMissingData(opportunity) {
  const missing = [];
  const project = opportunity.project;
  const quantities = opportunity.quantities;
  const service = opportunity.service;

  if (!opportunity.client.email && opportunity.client.preference !== "WhatsApp") missing.push("correo del cliente");
  if (!project.location) missing.push("ubicación");
  if (!project.description) missing.push("descripción del proyecto");

  if (service === "Flex Beam") {
    if (!quantities.metrosLineales) missing.push("metros lineales");
    if (!opportunity.files.length) missing.push("fotografías");
    missing.push("cantidad de terminales");
  }

  if (service === "Base granular y mezcla asfáltica") {
    if (!quantities.largo) missing.push("largo");
    if (!quantities.ancho) missing.push("ancho");
    if (!quantities.espesorCm) missing.push("espesor");
    missing.push("estado de la superficie y base existente");
  }

  if (service === "Demarcación vial y cierres de obra") {
    if (!quantities.metrosLineales) missing.push("metros lineales");
    missing.push("tipo de línea, símbolos, flechas y esquema de manejo vial");
  }

  if (service === "Señalización vertical y horizontal" && !quantities.senales) {
    missing.push("cantidad de señales");
  }

  return [...new Set(missing)];
}

function requiresVisit(opportunity, missing) {
  const rule = SERVICE_RULES[opportunity.service];
  const hasLocation = Boolean(opportunity.project.location);
  const hasTechnicalMeasures = opportunity.quantities.m2 || opportunity.quantities.m3 || opportunity.quantities.metrosLineales;
  const complexText = /talud|curva|puente|alto transito|tránsito|transito|noche|riesgo|emergencia|interseccion|intersección/.test(
    normalize(opportunity.project.description)
  );
  return Boolean((rule?.visit && hasLocation) || complexText || missing.length >= 4 || hasTechnicalMeasures);
}

function buildLocalAiReview(opportunity) {
  const missing = getMissingData(opportunity);
  const visit = requiresVisit(opportunity, missing);
  const quantities = opportunity.quantities;
  const quantityText = [
    quantities.m2 ? `${quantities.m2.toFixed(2)} m2` : "",
    quantities.m3 ? `${quantities.m3.toFixed(2)} m3` : "",
    quantities.metrosLineales ? `${quantities.metrosLineales.toFixed(2)} ml` : "",
    quantities.senales ? `${quantities.senales} señales` : ""
  ]
    .filter(Boolean)
    .join(", ");

  const summary = `${opportunity.client.name} solicita ${opportunity.service.toLowerCase()} en ${
    opportunity.project.location || "ubicación pendiente"
  }. ${opportunity.project.description || "Descripción pendiente."}`;

  const questions = missing.length
    ? missing.map((item) => `Confirmar ${item}.`)
    : ["Validar alcance técnico final.", "Confirmar fecha disponible para cotización o visita."];

  const draft = missing.length
    ? `Gracias por contactar a Roads & Solutions S.A. Para preparar la cotización de ${opportunity.service}, necesitamos confirmar: ${missing.join(", ")}. Podemos continuar por ${opportunity.client.preference}.`
    : `Gracias por la información. Ya tenemos datos suficientes para iniciar revisión técnica de ${opportunity.service}. El equipo puede responder por ${opportunity.client.preference} con los detalles de la cotización o una visita técnica si aplica.`;

  return {
    service: opportunity.service,
    missing,
    visit,
    summary,
    questions,
    draft,
    urgency: opportunity.project.urgency,
    complexity: visit || missing.length > 2 ? "Media / Alta" : "Baja / Media",
    quantities: quantityText || "Sin cantidades preliminares suficientes.",
    nextAction: missing.length ? "Solicitar información adicional" : opportunity.nextAction,
    recommendedStage: missing.length ? "Datos pendientes" : visit ? "Visita técnica requerida" : "Revisión técnica",
    source: "local"
  };
}

function buildAiReview(opportunity) {
  return opportunity?.aiReview || buildLocalAiReview(opportunity);
}

function normalizeClientReview(review, opportunity, fallback) {
  const validService = Object.keys(SERVICE_RULES).includes(review?.service) ? review.service : fallback.service;
  const validUrgency = ["Alta", "Media", "Baja"].includes(review?.urgency) ? review.urgency : fallback.urgency;
  const validComplexity = ["Baja", "Media", "Alta", "Baja / Media", "Media / Alta"].includes(review?.complexity)
    ? review.complexity
    : fallback.complexity;
  const validStage = STAGES.includes(review?.recommendedStage) ? review.recommendedStage : fallback.recommendedStage;
  const list = (value, fallbackList) => Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8) : fallbackList;

  return {
    service: validService,
    missing: list(review?.missing, fallback.missing),
    visit: typeof review?.visit === "boolean" ? review.visit : fallback.visit,
    summary: String(review?.summary || fallback.summary).trim(),
    questions: list(review?.questions, fallback.questions),
    draft: String(review?.draft || fallback.draft).trim(),
    urgency: validUrgency,
    complexity: validComplexity,
    quantities: String(review?.quantities || fallback.quantities).trim(),
    nextAction: String(review?.nextAction || fallback.nextAction || opportunity.nextAction).trim(),
    recommendedStage: validStage,
    source: review?.source === "openai" ? "openai" : fallback.source
  };
}

async function requestOpenAiReview(opportunity) {
  const fallback = buildLocalAiReview(opportunity);

  try {
    const response = await fetch(CRM_AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunity })
    });

    if (!response.ok) throw new Error(`CRM AI ${response.status}`);
    const data = await response.json();
    return normalizeClientReview(data.review, opportunity, fallback);
  } catch (error) {
    console.warn("CRM AI fallback", error);
    return fallback;
  }
}

function applyAiReview(opportunity, review) {
  opportunity.service = review.service;
  opportunity.project.urgency = review.urgency;
  opportunity.nextAction = review.nextAction || opportunity.nextAction;
  opportunity.aiReview = {
    ...review,
    updatedAt: nowStamp()
  };
}

function createTasks(opportunity, review) {
  const tasks = [];
  const baseTask = {
    opportunityId: opportunity.id,
    owner: opportunity.owner,
    done: false,
    createdAt: nowStamp()
  };

  if (review.missing.length) {
    tasks.push({
      ...baseTask,
      id: createId("task"),
      title: "Solicitar información adicional",
      detail: review.missing.join(", "),
      due: opportunity.project.urgency === "Alta" ? today() : ""
    });
  }

  if (!review.missing.length || (opportunity.project.location && opportunity.project.description)) {
    tasks.push({
      ...baseTask,
      id: createId("task"),
      title: review.visit ? "Coordinar visita técnica" : "Revisión técnica",
      detail: review.visit ? "Validar sitio, alcance, seguridad vial y cantidades." : "Revisar datos recibidos y preparar alcance.",
      due: today()
    });
  }

  tasks.push({
    ...baseTask,
    id: createId("task"),
    title: SERVICE_RULES[opportunity.service]?.task || "Validar datos del servicio solicitado.",
    detail: opportunity.service,
    due: ""
  });

  return tasks;
}

function upsertContact(opportunity) {
  const existing = state.contacts.find(
    (contact) =>
      normalize(contact.email) === normalize(opportunity.client.email) ||
      normalize(contact.phone) === normalize(opportunity.client.phone)
  );

  if (existing) {
    existing.name = opportunity.client.name;
    existing.contactPerson = opportunity.client.contactPerson;
    existing.phone = opportunity.client.phone;
    existing.email = opportunity.client.email;
    existing.preference = opportunity.client.preference;
    existing.lastContactAt = nowStamp();
    return existing.id;
  }

  const contact = {
    id: createId("contact"),
    name: opportunity.client.name,
    contactPerson: opportunity.client.contactPerson,
    phone: opportunity.client.phone,
    email: opportunity.client.email,
    preference: opportunity.client.preference,
    createdAt: nowStamp(),
    lastContactAt: nowStamp()
  };
  state.contacts.push(contact);
  return contact.id;
}

function opportunityFromForm(formData) {
  const raw = Object.fromEntries(formData.entries());
  const files = formData.getAll("adjuntos").filter((file) => file && file.name).map((file) => file.name);
  const service = inferService(raw.descripcion, raw.servicio);
  const urgency = classifyUrgency(raw.urgencia, raw.descripcion, raw.fechaInicio);
  const quantities = calculateQuantities(raw);
  const entryDate = today();

  return {
    id: createId("opp"),
    contactId: "",
    client: {
      name: raw.cliente?.trim() || "Cliente sin nombre",
      contactPerson: raw.contacto?.trim() || raw.cliente?.trim() || "",
      phone: raw.telefono?.trim() || "",
      email: raw.correo?.trim() || "",
      preference: raw.preferencia || "WhatsApp"
    },
    project: {
      location: raw.ubicacion?.trim() || "",
      province: raw.provincia || "",
      canton: raw.canton?.trim() || "",
      coordinates: raw.coordenadas?.trim() || "",
      description: raw.descripcion?.trim() || "",
      urgency,
      startDate: raw.fechaInicio || ""
    },
    service,
    quantities,
    files,
    stage: "Solicitud recibida",
    owner: raw.responsable || "Ventas",
    source: raw.fuente || "Formulario web",
    entryDate,
    lastContactDate: entryDate,
    nextAction: raw.proximaAccion?.trim() || "Revisión técnica",
    estimatedAmount: getNumber(raw.monto),
    probability: Number.parseInt(raw.probabilidad || "35", 10),
    lossReason: "",
    createdAt: nowStamp(),
    updatedAt: nowStamp(),
    history: [
      {
        stage: "Solicitud recibida",
        date: nowStamp(),
        owner: raw.responsable || "Ventas",
        nextAction: raw.proximaAccion?.trim() || "Revisión técnica"
      }
    ]
  };
}

async function saveOpportunity(opportunity) {
  opportunity.contactId = upsertContact(opportunity);
  const review = await requestOpenAiReview(opportunity);
  applyAiReview(opportunity, review);
  const stageFromReview = ["Datos pendientes", "Revisión técnica", "Visita técnica requerida", "Cotización en preparación"].includes(review.recommendedStage)
    ? review.recommendedStage
    : "";
  const nextStage = stageFromReview || (review.missing.length ? "Datos pendientes" : review.visit ? "Visita técnica requerida" : "Revisión técnica");

  opportunity.stage = nextStage;
  opportunity.history.push({
    stage: nextStage,
    date: nowStamp(),
    owner: opportunity.owner,
    nextAction: opportunity.nextAction
  });

  state.opportunities.unshift(opportunity);
  state.tasks.unshift(...createTasks(opportunity, review));
  state.notifications.unshift({
    id: createId("note"),
    opportunityId: opportunity.id,
    title: review.source === "openai" ? "Confirmación al cliente preparada por OpenAI" : "Confirmación al cliente preparada",
    detail: review.draft,
    createdAt: nowStamp()
  });
  state.notifications.unshift({
    id: createId("note"),
    opportunityId: opportunity.id,
    title: "Notificación interna",
    detail: `${opportunity.owner} debe atender ${opportunity.service} para ${opportunity.client.name}. Urgencia: ${opportunity.project.urgency}. Motor IA: ${review.source === "openai" ? "OpenAI" : "reglas locales"}.`,
    createdAt: nowStamp()
  });
  state.selectedId = opportunity.id;
  saveState();
  return opportunity;
}

function getFilteredOpportunities() {
  const search = normalize(searchInput?.value);
  const urgency = urgencyFilter?.value;
  const owner = ownerFilter?.value;

  return state.opportunities.filter((opportunity) => {
    const haystack = normalize(
      `${opportunity.client.name} ${opportunity.service} ${opportunity.project.location} ${opportunity.project.description}`
    );
    return (!search || haystack.includes(search)) && (!urgency || opportunity.project.urgency === urgency) && (!owner || opportunity.owner === owner);
  });
}

function renderStats() {
  const openTasks = state.tasks.filter((task) => !task.done).length;
  const totalAmount = state.opportunities.reduce((sum, opportunity) => sum + (Number(opportunity.estimatedAmount) || 0), 0);
  const avgProbability = state.opportunities.length
    ? Math.round(state.opportunities.reduce((sum, opportunity) => sum + opportunity.probability, 0) / state.opportunities.length)
    : 0;

  document.querySelector("[data-stat-total]").textContent = state.opportunities.length;
  document.querySelector("[data-stat-amount]").textContent = money(totalAmount);
  document.querySelector("[data-stat-tasks]").textContent = openTasks;
  document.querySelector("[data-stat-probability]").textContent = `${avgProbability}%`;
}

function renderPipeline() {
  const opportunities = getFilteredOpportunities();
  pipeline.innerHTML = "";

  STAGES.forEach((stage) => {
    const column = document.createElement("section");
    column.className = "crm-stage";
    column.innerHTML = `
      <header>
        <h3>${stage}</h3>
        <span>${opportunities.filter((opportunity) => opportunity.stage === stage).length}</span>
      </header>
      <div class="crm-stage-list"></div>
    `;

    const list = column.querySelector(".crm-stage-list");
    opportunities
      .filter((opportunity) => opportunity.stage === stage)
      .forEach((opportunity) => {
        const card = document.createElement("article");
        card.className = `crm-card ${opportunity.id === state.selectedId ? "is-selected" : ""}`;
        card.innerHTML = `
          <button type="button" data-id="${opportunity.id}">
            <span>${escapeHtml(opportunity.service)}</span>
            <strong>${escapeHtml(opportunity.client.name)}</strong>
            <small>${escapeHtml(opportunity.project.urgency)} · ${escapeHtml(opportunity.owner)} · ${money(opportunity.estimatedAmount)}</small>
          </button>
        `;
        list.appendChild(card);
      });

    pipeline.appendChild(column);
  });
}

function fieldRow(label, value) {
  return `<p><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "Pendiente")}</strong></p>`;
}

function renderSelected() {
  const opportunity = state.opportunities.find((item) => item.id === state.selectedId);
  if (!opportunity) {
    selectedPanel.innerHTML = `<h2>Oportunidad activa</h2><p class="crm-empty">Seleccione una oportunidad del pipeline para ver su control comercial.</p>`;
    aiReview.innerHTML = `<h3>Sin oportunidad seleccionada</h3><p>Seleccione o cree una oportunidad para ver resumen, datos faltantes, visita técnica recomendada y borrador de respuesta.</p>`;
    return;
  }

  const review = buildAiReview(opportunity);
  selectedPanel.innerHTML = `
    <h2>${escapeHtml(opportunity.client.name)}</h2>
    <div class="crm-detail-list">
      ${fieldRow("Contacto", `${opportunity.client.contactPerson || opportunity.client.name} · ${opportunity.client.phone}`)}
      ${fieldRow("Correo", opportunity.client.email)}
      ${fieldRow("Servicio", opportunity.service)}
      ${fieldRow("Ubicación", `${opportunity.project.location}${opportunity.project.province ? `, ${opportunity.project.province}` : ""}`)}
      ${fieldRow("Próxima acción", opportunity.nextAction)}
      ${fieldRow("Cantidades", review.quantities)}
    </div>
    <form class="crm-stage-form" data-stage-form>
      <label>
        Cambiar etapa
        <select name="stage">
          ${STAGES.map((stage) => `<option ${stage === opportunity.stage ? "selected" : ""}>${stage}</option>`).join("")}
        </select>
      </label>
      <label>
        Responsable
        <select name="owner">
          ${["Ventas", "Ingeniería", "Gerencia"].map((owner) => `<option ${owner === opportunity.owner ? "selected" : ""}>${owner}</option>`).join("")}
        </select>
      </label>
      <label class="full">
        Próxima acción
        <input name="nextAction" value="${escapeHtml(opportunity.nextAction)}" required />
      </label>
      <label class="full">
        Motivo de pérdida
        <input name="lossReason" value="${escapeHtml(opportunity.lossReason || "")}" placeholder="Solo si aplica" />
      </label>
      <button class="button primary full-button" type="submit">Registrar cambio</button>
    </form>
    <div class="crm-history">
      <h3>Historial</h3>
      ${opportunity.history
        .map(
          (item) => `
            <article>
              <strong>${escapeHtml(item.stage)}</strong>
              <span>${escapeHtml(item.date)} · ${escapeHtml(item.owner)}</span>
              <p>${escapeHtml(item.nextAction)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  aiReview.innerHTML = `
    <h3>${escapeHtml(review.service)}</h3>
    <div class="crm-ai-summary">
      ${fieldRow("Resumen", review.summary)}
      ${fieldRow("Motor IA", review.source === "openai" ? "OpenAI" : "Respaldo local")}
      ${fieldRow("Urgencia", review.urgency)}
      ${fieldRow("Complejidad", review.complexity)}
      ${fieldRow("Visita técnica", review.visit ? "Recomendada" : "No indispensable con los datos actuales")}
      ${fieldRow("Cantidades", review.quantities)}
    </div>
    <h4>Datos faltantes</h4>
    <ul>${(review.missing.length ? review.missing : ["Sin faltantes críticos detectados."]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <h4>Preguntas sugeridas</h4>
    <ul>${review.questions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    <h4>Borrador de respuesta</h4>
    <p>${escapeHtml(review.draft)}</p>
  `;
}

function renderTasks() {
  const visibleTasks = state.selectedId ? state.tasks.filter((task) => task.opportunityId === state.selectedId) : state.tasks.slice(0, 8);
  taskList.innerHTML = visibleTasks.length
    ? visibleTasks
        .map((task) => {
          const opportunity = state.opportunities.find((item) => item.id === task.opportunityId);
          return `
            <article class="${task.done ? "is-done" : ""}">
              <label>
                <input type="checkbox" data-task-id="${task.id}" ${task.done ? "checked" : ""} />
                <span>
                  <strong>${escapeHtml(task.title)}</strong>
                  <small>${escapeHtml(opportunity?.client.name || "Oportunidad")} · ${escapeHtml(task.owner)}${task.due ? ` · vence ${escapeHtml(task.due)}` : ""}</small>
                  <em>${escapeHtml(task.detail)}</em>
                </span>
              </label>
            </article>
          `;
        })
        .join("")
    : `<p class="crm-empty">No hay tareas para mostrar.</p>`;
}

function renderNotifications() {
  const visibleNotifications = state.selectedId
    ? state.notifications.filter((note) => note.opportunityId === state.selectedId)
    : state.notifications.slice(0, 8);

  notificationList.innerHTML = visibleNotifications.length
    ? visibleNotifications
        .map(
          (note) => `
            <article>
              <strong>${escapeHtml(note.title)}</strong>
              <span>${escapeHtml(note.createdAt)}</span>
              <p>${escapeHtml(note.detail)}</p>
            </article>
          `
        )
        .join("")
    : `<p class="crm-empty">No hay notificaciones todavía.</p>`;
}

function getActiveOpportunity() {
  return state.opportunities.find((item) => item.id === state.selectedId);
}

function getActiveQuote() {
  return state.quotes.find((quote) => quote.opportunityId === state.selectedId);
}

function renderCommunicationAndQuote() {
  const opportunity = getActiveOpportunity();
  if (!opportunity) {
    if (activeContext) activeContext.textContent = "Seleccione una oportunidad";
    if (messageForm) messageForm.reset();
    if (messageBody) messageBody.value = "";
    if (messageNote) messageNote.textContent = "La comunicación quedará registrada en el historial de la oportunidad.";
    if (activityList) activityList.innerHTML = `<p class="crm-empty">Seleccione una oportunidad para ver su historial.</p>`;
    if (quoteForm) quoteForm.reset();
    if (quotePreview) quotePreview.innerHTML = `<p class="crm-empty">Seleccione una oportunidad para preparar una cotización.</p>`;
    if (quoteNote) quoteNote.textContent = "Sin cotización guardada para esta oportunidad.";
    return;
  }

  if (activeContext) activeContext.textContent = opportunity.client.name;
  const review = buildAiReview(opportunity);
  if (messageBody && messageTemplate) {
    messageBody.value = MESSAGE_TEMPLATES[messageTemplate.value]({ opportunity, review });
  }

  const activities = state.activities.filter((activity) => activity.opportunityId === opportunity.id);
  if (activityList) {
    activityList.innerHTML = activities.length
      ? activities.map((activity) => `<article><strong>${escapeHtml(activity.type)} · ${escapeHtml(activity.channel)}</strong><span>${escapeHtml(activity.createdAt)} · ${escapeHtml(activity.owner)}</span><p>${escapeHtml(activity.message)}</p></article>`).join("")
      : `<p class="crm-empty">No hay comunicaciones registradas todavía.</p>`;
  }

  const quote = getActiveQuote();
  if (quoteForm && quote) {
    ["version", "approvedPrice", "scope", "exclusions", "technicalNotes", "estimatedTerm", "validity"].forEach((name) => {
      if (quoteForm.elements[name]) quoteForm.elements[name].value = quote[name] ?? "";
    });
  }
  if (quoteNote) quoteNote.textContent = quote
    ? `Versión ${quote.version} guardada${quote.sentAt ? ` · enviada ${quote.sentAt}` : " · aún no enviada"}. Precio aprobado: ${quote.approvedPrice ? money(quote.approvedPrice) : "pendiente"}.`
    : "Sin cotización guardada para esta oportunidad.";
  if (quotePreview) {
    quotePreview.innerHTML = quote ? `<div class="quote-document" data-quote-document>
      <p class="eyebrow">Borrador de cotización · versión ${escapeHtml(quote.version)}</p>
      <h4>Roads &amp; Solutions S.A.</h4>
      <p><strong>Cliente:</strong> ${escapeHtml(opportunity.client.name)} · ${escapeHtml(opportunity.client.email || opportunity.client.phone)}</p>
      <p><strong>Proyecto:</strong> ${escapeHtml(opportunity.service)} · ${escapeHtml(opportunity.project.location)}</p>
      <p><strong>Cantidades:</strong> ${escapeHtml(buildAiReview(opportunity).quantities)}</p>
      <p><strong>Alcance:</strong> ${escapeHtml(quote.scope || "Pendiente de completar")}</p>
      <p><strong>Exclusiones:</strong> ${escapeHtml(quote.exclusions || "Pendiente de completar")}</p>
      <p><strong>Observaciones:</strong> ${escapeHtml(quote.technicalNotes || "Pendiente de completar")}</p>
      <p><strong>Plazo:</strong> ${escapeHtml(quote.estimatedTerm || "Pendiente de validación")} · <strong>Vigencia:</strong> ${escapeHtml(quote.validity || "Pendiente")}</p>
      <p class="quote-document-price"><strong>Precio:</strong> ${quote.approvedPrice ? money(quote.approvedPrice) : "Pendiente de aprobación interna"}</p>
    </div>` : `<p class="crm-empty">Guarde una versión para generar la vista de cotización.</p>`;
  }
}

function renderDashboard() {
  const opportunities = state.opportunities;
  const serviceCounts = Object.keys(SERVICE_RULES).map((service) => ({ service, count: opportunities.filter((item) => item.service === service).length }));
  const stageValues = STAGES.map((stage) => ({ stage, value: opportunities.filter((item) => item.stage === stage).reduce((sum, item) => sum + (Number(item.estimatedAmount) || 0), 0) })).filter((item) => item.value);
  const overdue = opportunities.filter((item) => !["Ganada", "Perdida o descartada", "Servicio ejecutado"].includes(item.stage) && (!item.lastContactDate || item.lastContactDate < today()));
  const won = opportunities.filter((item) => item.stage === "Ganada").length;
  const closed = opportunities.filter((item) => ["Ganada", "Perdida o descartada"].includes(item.stage)).length;
  const losses = opportunities.filter((item) => item.lossReason).reduce((map, item) => { map[item.lossReason] = (map[item.lossReason] || 0) + 1; return map; }, {});
  const formatRows = (rows, empty) => rows.length ? rows.map((row) => `<div class="crm-dashboard-row"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></div>`).join("") : `<p class="crm-empty">${empty}</p>`;

  document.querySelector("[data-dashboard-services]").innerHTML = formatRows(serviceCounts.map((item) => ({ label: item.service, value: String(item.count) })), "Sin oportunidades todavía.");
  document.querySelector("[data-dashboard-stages]").innerHTML = formatRows(stageValues.map((item) => ({ label: item.stage, value: money(item.value) })), "Sin montos registrados.");
  document.querySelector("[data-dashboard-alerts]").innerHTML = formatRows([
    { label: "Sin seguimiento", value: String(overdue.length) },
    { label: "Proyectos urgentes", value: String(opportunities.filter((item) => item.project.urgency === "Alta").length) },
    { label: "Cotizaciones pendientes", value: String(opportunities.filter((item) => item.stage === "Cotización en preparación").length) },
    { label: "Cotizaciones enviadas", value: String(opportunities.filter((item) => item.stage === "Cotización enviada").length) }
  ], "Sin alertas.");
  const lossRows = Object.entries(losses).map(([label, value]) => ({ label, value: String(value) }));
  document.querySelector("[data-dashboard-conversion]").innerHTML = formatRows([
    { label: "Tasa de conversión", value: `${closed ? Math.round((won / closed) * 100) : 0}%` },
    { label: "Tiempo promedio respuesta", value: "Por medir" },
    ...lossRows.map((row) => ({ label: `Pérdida: ${row.label}`, value: row.value }))
  ], "Sin cierres registrados.");
}

function renderAll() {
  renderStats();
  renderPipeline();
  renderSelected();
  renderTasks();
  renderNotifications();
  renderCommunicationAndQuote();
  renderDashboard();
}

function updateStage(formData) {
  const opportunity = state.opportunities.find((item) => item.id === state.selectedId);
  if (!opportunity) return;

  opportunity.stage = formData.get("stage");
  opportunity.owner = formData.get("owner");
  opportunity.nextAction = formData.get("nextAction");
  opportunity.lossReason = formData.get("lossReason");
  opportunity.lastContactDate = today();
  opportunity.updatedAt = nowStamp();
  opportunity.history.unshift({
    stage: opportunity.stage,
    date: nowStamp(),
    owner: opportunity.owner,
    nextAction: opportunity.nextAction
  });

  if (opportunity.stage === "Cotización enviada") {
    const hasFollowUp = state.tasks.some((task) => task.opportunityId === opportunity.id && task.title === "Primer seguimiento de cotización" && !task.done);
    if (!hasFollowUp) {
      state.tasks.unshift({
        id: createId("task"),
        opportunityId: opportunity.id,
        title: "Primer seguimiento de cotización",
        detail: "Contactar al cliente y confirmar recepción de la propuesta.",
        owner: opportunity.owner,
        due: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        done: false,
        createdAt: nowStamp()
      });
    }
  }

  state.notifications.unshift({
    id: createId("note"),
    opportunityId: opportunity.id,
    title: "Cambio de etapa registrado",
    detail: `${opportunity.client.name} pasó a ${opportunity.stage}. Próxima acción: ${opportunity.nextAction}.`,
    createdAt: nowStamp()
  });

  saveState();
  renderAll();
}

function registerActivity(type, channel, message) {
  const opportunity = getActiveOpportunity();
  if (!opportunity || !message.trim()) return false;
  state.activities.unshift({
    id: createId("activity"),
    opportunityId: opportunity.id,
    type,
    channel,
    message: message.trim(),
    owner: opportunity.owner,
    createdAt: nowStamp()
  });
  opportunity.lastContactDate = today();
  opportunity.updatedAt = nowStamp();
  state.notifications.unshift({
    id: createId("note"),
    opportunityId: opportunity.id,
    title: `${type} registrada por ${channel}`,
    detail: message.trim(),
    createdAt: nowStamp()
  });
  saveState();
  renderAll();
  return true;
}

function saveQuote(formData) {
  const opportunity = getActiveOpportunity();
  if (!opportunity) return;
  const values = Object.fromEntries(formData.entries());
  const current = getActiveQuote();
  const quote = {
    id: current?.id || createId("quote"),
    opportunityId: opportunity.id,
    version: Math.max(1, Number.parseInt(values.version || "1", 10)),
    approvedPrice: getNumber(values.approvedPrice),
    scope: values.scope?.trim() || "",
    exclusions: values.exclusions?.trim() || "",
    technicalNotes: values.technicalNotes?.trim() || "",
    estimatedTerm: values.estimatedTerm?.trim() || "",
    validity: values.validity?.trim() || "",
    createdAt: current?.createdAt || nowStamp(),
    updatedAt: nowStamp(),
    sentAt: current?.sentAt || ""
  };
  if (current) state.quotes = state.quotes.map((item) => item.id === quote.id ? quote : item);
  else state.quotes.unshift(quote);
  opportunity.nextAction = quote.approvedPrice ? "Validar y enviar cotización aprobada" : "Completar alcance y solicitar aprobación interna";
  opportunity.updatedAt = nowStamp();
  state.notifications.unshift({ id: createId("note"), opportunityId: opportunity.id, title: `Cotización versión ${quote.version} guardada`, detail: quote.approvedPrice ? `Precio aprobado registrado: ${money(quote.approvedPrice)}.` : "La cotización sigue pendiente de aprobación interna.", createdAt: nowStamp() });
  saveState();
  renderAll();
  if (quoteNote) quoteNote.textContent = `Versión ${quote.version} guardada. ${quote.approvedPrice ? "Precio aprobado registrado." : "Precio pendiente de aprobación interna."}`;
}

function registerQuoteSend() {
  const opportunity = getActiveOpportunity();
  const quote = getActiveQuote();
  if (!opportunity || !quote) return;
  if (!quote.approvedPrice) {
    if (quoteNote) quoteNote.textContent = "No se puede registrar el envío: falta la aprobación interna del precio.";
    return;
  }
  quote.sentAt = nowStamp();
  opportunity.stage = "Cotización enviada";
  opportunity.lastContactDate = today();
  opportunity.nextAction = "Dar seguimiento a la cotización en 2 días";
  opportunity.history.unshift({ stage: opportunity.stage, date: quote.sentAt, owner: opportunity.owner, nextAction: opportunity.nextAction });
  state.activities.unshift({ id: createId("activity"), opportunityId: opportunity.id, type: "Cotización enviada", channel: opportunity.client.preference, message: `Se registró el envío aprobado de la versión ${quote.version}.`, owner: opportunity.owner, createdAt: quote.sentAt });
  state.tasks.unshift({ id: createId("task"), opportunityId: opportunity.id, title: "Primer seguimiento de cotización", detail: "Contactar al cliente y confirmar recepción de la propuesta.", owner: opportunity.owner, due: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), done: false, createdAt: nowStamp() });
  saveState();
  renderAll();
}

function resetCrmControls() {
  form?.reset();
  if (probabilityInput) probabilityInput.value = "35";
  if (probabilityLabel) probabilityLabel.textContent = "35%";
  if (formNote) formNote.textContent = "La oportunidad se guardará en el CRM local y generará tareas automáticas.";
  if (searchInput) searchInput.value = "";
  if (urgencyFilter) urgencyFilter.value = "";
  if (ownerFilter) ownerFilter.value = "";
  messageForm?.reset();
  if (messageBody) messageBody.value = "";
  if (messageNote) messageNote.textContent = "La comunicación quedará registrada en el historial de la oportunidad.";
  quoteForm?.reset();
  if (quoteNote) quoteNote.textContent = "Sin cotización guardada para esta oportunidad.";
}

function clearLocalData({ skipConfirm = false } = {}) {
  if (!skipConfirm && !confirm("¿Desea limpiar los datos locales del CRM?")) return false;
  localStorage.removeItem(STORAGE_KEY);
  state = createEmptyState();
  resetCrmControls();
  renderAll();
  return true;
}

function demoDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function demoStamp(offsetDays, hour = 9, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleString("es-CR", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function buildDemoHistory(stage, owner, nextAction) {
  const commercialFlow = [
    "Solicitud recibida",
    "Datos pendientes",
    "Revisión técnica",
    "Visita técnica requerida",
    "Cotización en preparación",
    "Cotización enviada",
    "Seguimiento",
    "Negociación o ajustes"
  ];
  const stages = stage === "Perdida o descartada"
    ? [...commercialFlow, stage]
    : stage === "Servicio ejecutado"
      ? [...commercialFlow, "Ganada", stage]
      : stage === "Ganada"
        ? [...commercialFlow, stage]
        : commercialFlow.slice(0, commercialFlow.indexOf(stage) + 1 || 1);

  return stages
    .map((stageName, index, stages) => ({
      stage: stageName,
      date: demoStamp(index - stages.length - 2, 8 + (index % 7), index % 2 ? 30 : 0),
      owner,
      nextAction: index === stages.length - 1 ? nextAction : `Avanzar a ${stages[index + 1]}.`
    }))
    .reverse();
}

function addDemoActivity(opportunity, { type, channel, message, offset = -1, owner = opportunity.owner }) {
  state.activities.unshift({
    id: createId("activity"),
    opportunityId: opportunity.id,
    type,
    channel,
    message,
    owner,
    createdAt: demoStamp(offset, 10, 15)
  });
}

function addDemoTask(opportunity, { title, detail, owner = opportunity.owner, dueOffset = 1, done = false }) {
  state.tasks.unshift({
    id: createId("task"),
    opportunityId: opportunity.id,
    title,
    detail,
    owner,
    due: demoDate(dueOffset),
    done,
    createdAt: demoStamp(-2, 9, 45)
  });
}

function addDemoNotification(opportunity, title, detail, offset = -1) {
  state.notifications.unshift({
    id: createId("note"),
    opportunityId: opportunity.id,
    title,
    detail,
    createdAt: demoStamp(offset, 11, 0)
  });
}

function addDemoQuote(opportunity, quote) {
  state.quotes.unshift({
    id: createId("quote"),
    opportunityId: opportunity.id,
    version: quote.version || 1,
    approvedPrice: getNumber(quote.approvedPrice),
    scope: quote.scope || "",
    exclusions: quote.exclusions || "",
    technicalNotes: quote.technicalNotes || "",
    estimatedTerm: quote.estimatedTerm || "",
    validity: quote.validity || "15 días naturales",
    createdAt: demoStamp(quote.createdOffset || -3, 10, 0),
    updatedAt: demoStamp(quote.updatedOffset || -1, 15, 30),
    sentAt: quote.sentOffset === undefined ? "" : demoStamp(quote.sentOffset, 16, 0)
  });
}

function enrichDemoOpportunity(opportunity, sample) {
  state.tasks = state.tasks.filter((task) => task.opportunityId !== opportunity.id);
  opportunity.service = sample.servicio;
  opportunity.stage = sample.stage;
  opportunity.owner = sample.responsable;
  opportunity.project.urgency = sample.urgencia;
  opportunity.nextAction = sample.proximaAccion;
  opportunity.lossReason = sample.lossReason || "";
  opportunity.files = sample.files || [];
  opportunity.lastContactDate = demoDate(sample.lastContactOffset ?? -1);
  opportunity.updatedAt = demoStamp(sample.lastContactOffset ?? -1, 14, 0);
  opportunity.history = buildDemoHistory(sample.stage, sample.responsable, sample.proximaAccion);
  opportunity.aiReview = {
    ...buildAiReview(opportunity),
    service: sample.servicio,
    urgency: sample.urgencia,
    recommendedStage: sample.stage,
    nextAction: sample.proximaAccion,
    updatedAt: demoStamp(sample.lastContactOffset ?? -1, 13, 30)
  };

  if (sample.quote) addDemoQuote(opportunity, sample.quote);
  sample.activities?.forEach((activity) => addDemoActivity(opportunity, activity));
  sample.tasks?.forEach((task) => addDemoTask(opportunity, task));
  addDemoNotification(
    opportunity,
    "Automatización lista",
    `${opportunity.client.name}: ${opportunity.nextAction}. Motor IA: ${buildAiReview(opportunity).source === "openai" ? "OpenAI" : "respaldo local"}.`,
    sample.lastContactOffset ?? -1
  );
}

async function seedDemo() {
  clearLocalData({ skipConfirm: true });
  const originalDemoLabel = demoButton?.textContent || "Crear demo";

  const samples = [
    {
      cliente: "Parque Empresarial La Lima",
      contacto: "Daniela Castro",
      telefono: "+506 7100 1840",
      correo: "operaciones@lalimabusiness.cr",
      preferencia: "Ambos",
      fuente: "Formulario web",
      ubicacion: "Entrada norte, Ruta 10, La Lima",
      provincia: "Cartago",
      canton: "Cartago",
      coordenadas: "9.8831, -83.9456",
      servicio: "Señalización vertical y horizontal",
      urgencia: "Media",
      fechaInicio: demoDate(18),
      descripcion: "Solicitud nueva para renovar señalización vertical de acceso, pasos peatonales internos y flechas de circulación en parque empresarial.",
      largo: "240",
      ancho: "7",
      espesor: "",
      metrosLineales: "620",
      senales: "28",
      responsable: "Ventas",
      monto: "6800000",
      probabilidad: "30",
      proximaAccion: "Validar datos recibidos y asignar revisión técnica inicial.",
      stage: "Solicitud recibida",
      files: ["croquis-acceso-la-lima.pdf", "fotos-entrada-norte.zip"],
      lastContactOffset: 0,
      tasks: [
        { title: "Confirmar recepción con cliente", detail: "Enviar confirmación y explicar próximos pasos del flujo comercial.", dueOffset: 0 },
        { title: "Asignar responsable técnico", detail: "Definir si atiende Ingeniería o Ventas técnicas.", owner: "Gerencia", dueOffset: 1 }
      ],
      activities: [
        { type: "Solicitud recibida", channel: "Formulario web", message: "El formulario ingresó con ubicación, cantidades preliminares y adjuntos de referencia.", offset: 0 }
      ]
    },
    {
      cliente: "Condominio Alto del Oeste",
      contacto: "María Jiménez",
      telefono: "+506 8888 1122",
      correo: "maria@altodeloeste.cr",
      preferencia: "WhatsApp",
      fuente: "WhatsApp",
      ubicacion: "Acceso principal y curva interna, Santa Ana",
      provincia: "San José",
      canton: "Santa Ana",
      coordenadas: "9.9320, -84.1820",
      servicio: "Flex Beam",
      urgencia: "Alta",
      fechaInicio: demoDate(6),
      descripcion: "Instalar baranda Flex Beam en curva de ingreso con riesgo por desnivel, tránsito interno activo, jardín lateral y necesidad de terminales seguros.",
      largo: "86",
      ancho: "",
      espesor: "",
      metrosLineales: "86",
      senales: "4",
      responsable: "Ventas",
      monto: "7200000",
      probabilidad: "45",
      proximaAccion: "Solicitar cantidad final de terminales y fotos del talud antes de visita.",
      stage: "Datos pendientes",
      files: ["ubicacion-flex-beam.kmz", "foto-curva-ingreso-1.jpg"],
      lastContactOffset: -1,
      tasks: [
        { title: "Solicitar información adicional", detail: "Confirmar terminales, postes especiales y fotografías del desnivel.", dueOffset: 0 },
        { title: "Preparar agenda de visita", detail: "Reservar espacio tentativo para inspección de curva interna.", owner: "Ingeniería", dueOffset: 1 }
      ],
      activities: [
        { type: "WhatsApp recibido", channel: "WhatsApp", message: "Cliente envió ubicación y video corto; falta confirmar terminales y fotos completas.", offset: -1 },
        { type: "Borrador IA", channel: "WhatsApp", message: "OpenAI preparó preguntas para completar la solicitud de Flex Beam.", offset: -1 }
      ]
    },
    {
      cliente: "Constructora Norte Vial",
      contacto: "Esteban Rojas",
      telefono: "+506 8700 2200",
      correo: "er@cnv.cr",
      preferencia: "Correo",
      fuente: "Referido",
      ubicacion: "Proyecto industrial El Coyol, acceso de carga pesada",
      provincia: "Alajuela",
      canton: "Alajuela",
      coordenadas: "9.9804, -84.2531",
      servicio: "Base granular y mezcla asfáltica",
      urgencia: "Media",
      fechaInicio: demoDate(21),
      descripcion: "Preparar acceso interno con base granular y carpeta asfáltica para ingreso de camiones articulados. La base existente tiene zonas blandas.",
      largo: "120",
      ancho: "5.5",
      espesor: "12",
      metrosLineales: "120",
      senales: "6",
      responsable: "Ingeniería",
      monto: "18500000",
      probabilidad: "60",
      proximaAccion: "Revisar espesores, condición de base existente y cálculo de m3.",
      stage: "Revisión técnica",
      files: ["plano-acceso-coyol.pdf", "levantamiento-medidas.xlsx", "fotos-base-existente.zip"],
      lastContactOffset: -2,
      tasks: [
        { title: "Revisión técnica", detail: "Validar m2, m3, drenajes y zonas blandas reportadas.", owner: "Ingeniería", dueOffset: 0 },
        { title: "Preparar observaciones", detail: "Definir exclusiones para bacheo, nivelación y compactación.", owner: "Ingeniería", dueOffset: 1 }
      ],
      activities: [
        { type: "Correo recibido", channel: "Correo", message: "Constructora compartió planos y tabla preliminar de medidas.", offset: -2 },
        { type: "Nota interna", channel: "CRM", message: "Se recomienda revisión de base y validación de espesor antes de cotizar.", owner: "Ingeniería", offset: -2 }
      ]
    },
    {
      cliente: "Municipalidad de Puntarenas",
      contacto: "Ing. Paola Méndez",
      telefono: "+506 2661 9040",
      correo: "unidadtecnica@puntarenas.go.cr",
      preferencia: "Ambos",
      fuente: "Llamada",
      ubicacion: "Avenida Central y alrededores del mercado municipal",
      provincia: "Puntarenas",
      canton: "Puntarenas",
      coordenadas: "9.9763, -84.8330",
      servicio: "Demarcación vial y cierres de obra",
      urgencia: "Alta",
      fechaInicio: demoDate(9),
      descripcion: "Demarcación de líneas, flechas, pasos peatonales y cierre temporal nocturno durante mantenimiento vial en zona comercial activa.",
      largo: "980",
      ancho: "6.8",
      espesor: "",
      metrosLineales: "1960",
      senales: "18",
      responsable: "Ventas",
      monto: "3900000",
      probabilidad: "55",
      proximaAccion: "Coordinar visita técnica nocturna y validar esquema de manejo vial.",
      stage: "Visita técnica requerida",
      files: ["mapa-intervencion-centro.pdf", "fotos-pasos-peatonales.zip"],
      lastContactOffset: -1,
      tasks: [
        { title: "Coordinar visita técnica", detail: "Confirmar horario nocturno, puntos críticos y seguridad vial.", owner: "Ingeniería", dueOffset: 0 },
        { title: "Solicitar esquema vial", detail: "Pedir plano de cierres, desvíos y horarios autorizados.", dueOffset: 1 }
      ],
      activities: [
        { type: "Llamada registrada", channel: "Teléfono", message: "La municipalidad solicita atención rápida por zona comercial y alto tránsito.", offset: -1 },
        { type: "Solicitud de planos", channel: "Correo", message: "Se pidió esquema de manejo vial y lista de símbolos requeridos.", offset: -1 }
      ]
    },
    {
      cliente: "Zona Franca Global Park",
      contacto: "Roberto Salas",
      telefono: "+506 2293 4455",
      correo: "mantenimiento@globalpark.cr",
      preferencia: "Correo",
      fuente: "Cliente existente",
      ubicacion: "Calles internas del parque, Heredia",
      provincia: "Heredia",
      canton: "Belén",
      coordenadas: "9.9795, -84.1837",
      servicio: "Señalización vertical y horizontal",
      urgencia: "Media",
      fechaInicio: demoDate(14),
      descripcion: "Renovación de señalización horizontal, instalación de señales de alto, límite de velocidad y rutas de evacuación internas.",
      largo: "1500",
      ancho: "7.2",
      espesor: "",
      metrosLineales: "3200",
      senales: "46",
      responsable: "Ingeniería",
      monto: "12400000",
      probabilidad: "70",
      proximaAccion: "Completar alcance y solicitar aprobación interna de precio.",
      stage: "Cotización en preparación",
      files: ["plano-rutas-internas.pdf", "inventario-senales.xlsx", "fotos-parque.zip"],
      lastContactOffset: -3,
      quote: {
        approvedPrice: "0",
        scope: "Suministro e instalación de señalización vertical, pintura vial horizontal, flechas direccionales, pasos peatonales y leyendas de seguridad interna.",
        exclusions: "No incluye obra civil, reparación de carpeta, permisos externos ni trabajos fuera del horario coordinado.",
        technicalNotes: "Cantidades preliminares sujetas a validación de plano final y recorrido técnico.",
        estimatedTerm: "Pendiente de validación",
        validity: "15 días naturales",
        createdOffset: -2,
        updatedOffset: -1
      },
      tasks: [
        { title: "Completar cotización", detail: "Agregar exclusiones, observaciones técnicas y cantidades validadas.", owner: "Ingeniería", dueOffset: 0 },
        { title: "Solicitar aprobación interna", detail: "Gerencia debe aprobar precio antes de registrar envío.", owner: "Gerencia", dueOffset: 1 }
      ],
      activities: [
        { type: "Revisión técnica", channel: "CRM", message: "Se completó recorrido virtual con plano y fotografías.", owner: "Ingeniería", offset: -2 },
        { type: "Borrador de cotización", channel: "CRM", message: "Se creó versión 1 pendiente de precio aprobado.", owner: "Ventas", offset: -1 }
      ]
    },
    {
      cliente: "Universidad Central Campus Este",
      contacto: "Laura Vargas",
      telefono: "+506 2205 8810",
      correo: "infraestructura@universidadcentral.ac.cr",
      preferencia: "Ambos",
      fuente: "Correo",
      ubicacion: "Parqueos y accesos peatonales, Montes de Oca",
      provincia: "San José",
      canton: "Montes de Oca",
      coordenadas: "9.9361, -84.0510",
      servicio: "Demarcación vial y cierres de obra",
      urgencia: "Media",
      fechaInicio: demoDate(12),
      descripcion: "Demarcación de parqueos, flechas, pasos peatonales, zonas de carga y cierre parcial por fases para no interrumpir clases.",
      largo: "760",
      ancho: "8",
      espesor: "",
      metrosLineales: "1840",
      senales: "22",
      responsable: "Ventas",
      monto: "9600000",
      probabilidad: "65",
      proximaAccion: "Dar seguimiento a la cotización enviada en 2 días.",
      stage: "Cotización enviada",
      files: ["plano-campus-parqueos.pdf", "render-circulacion.png", "fotos-campus.zip"],
      lastContactOffset: -1,
      quote: {
        approvedPrice: "9350000",
        scope: "Demarcación horizontal de parqueos, flechas, pasos peatonales, zonas de carga y apoyo de cierre por fases.",
        exclusions: "No incluye reparación de losas, remoción profunda de pintura vieja ni permisos municipales.",
        technicalNotes: "Trabajo recomendado por sectores para mantener circulación interna.",
        estimatedTerm: "4 noches de trabajo",
        validity: "20 días naturales",
        createdOffset: -4,
        updatedOffset: -2,
        sentOffset: -1
      },
      tasks: [
        { title: "Primer seguimiento de cotización", detail: "Confirmar recepción de propuesta y resolver dudas del alcance.", dueOffset: 1 },
        { title: "Preparar versión 2 si solicitan fases", detail: "Separar parqueos A, B y acceso peatonal en partidas.", owner: "Ingeniería", dueOffset: 3 }
      ],
      activities: [
        { type: "Cotización enviada", channel: "Correo", message: "Se envió versión 1 aprobada con alcance, exclusiones, plazo y vigencia.", offset: -1 },
        { type: "WhatsApp de apoyo", channel: "WhatsApp", message: "Se notificó a Laura que la propuesta quedó enviada al correo.", offset: -1 }
      ]
    },
    {
      cliente: "Bodega Fría Pacífico",
      contacto: "Marco Solano",
      telefono: "+506 8720 3321",
      correo: "marco.solano@bf-pacifico.cr",
      preferencia: "WhatsApp",
      fuente: "Formulario web",
      ubicacion: "Acceso a andenes refrigerados, Esparza",
      provincia: "Puntarenas",
      canton: "Esparza",
      coordenadas: "9.9977, -84.6642",
      servicio: "Base granular y mezcla asfáltica",
      urgencia: "Alta",
      fechaInicio: demoDate(5),
      descripcion: "Rehabilitar acceso a andenes refrigerados con base granular y mezcla asfáltica. Tránsito de camiones requiere intervención por ventanas cortas.",
      largo: "95",
      ancho: "9.5",
      espesor: "10",
      metrosLineales: "95",
      senales: "10",
      responsable: "Ingeniería",
      monto: "22100000",
      probabilidad: "72",
      proximaAccion: "Realizar segundo seguimiento y confirmar ventana de ejecución.",
      stage: "Seguimiento",
      files: ["medidas-andenes.xlsx", "fotos-baches.zip", "plano-operacion.pdf"],
      lastContactOffset: -4,
      quote: {
        approvedPrice: "21650000",
        scope: "Preparación de base granular, compactación, colocación de mezcla asfáltica y señalización temporal de seguridad.",
        exclusions: "No incluye obras hidráulicas mayores, sustitución de subrasante profunda ni horarios no aprobados.",
        technicalNotes: "Se recomienda trabajar por ventanas para mantener operación logística.",
        estimatedTerm: "2 días hábiles por ventana",
        validity: "15 días naturales",
        createdOffset: -7,
        updatedOffset: -5,
        sentOffset: -4
      },
      tasks: [
        { title: "Segundo seguimiento comercial", detail: "Cliente no ha confirmado ventana de ejecución; contactar por WhatsApp.", dueOffset: 0 },
        { title: "Programar revisión si no responde", detail: "Si no hay respuesta, pasar a pausa y revisar en 5 días.", owner: "Ventas", dueOffset: 5 }
      ],
      activities: [
        { type: "Cotización enviada", channel: "Correo", message: "Propuesta enviada y confirmada por WhatsApp.", offset: -4 },
        { type: "Seguimiento 1", channel: "WhatsApp", message: "Cliente indica que revisará con operaciones la ventana de intervención.", offset: -2 }
      ]
    },
    {
      cliente: "Terminal Logística Moín",
      contacto: "Karla Thompson",
      telefono: "+506 2798 6100",
      correo: "operaciones@moinlogistica.cr",
      preferencia: "Ambos",
      fuente: "Llamada",
      ubicacion: "Acceso de contenedores y patios de maniobra, Moín",
      provincia: "Limón",
      canton: "Limón",
      coordenadas: "10.0014, -83.0836",
      servicio: "Demarcación vial y cierres de obra",
      urgencia: "Alta",
      fechaInicio: demoDate(7),
      descripcion: "Demarcación de patios de maniobra, rutas de camiones, pasos peatonales operativos y cierres parciales por bloques sin detener logística.",
      largo: "1320",
      ancho: "9",
      espesor: "",
      metrosLineales: "4100",
      senales: "38",
      responsable: "Gerencia",
      monto: "26400000",
      probabilidad: "68",
      proximaAccion: "Validar propuesta por bloques operativos y preparar reunión de aprobación.",
      stage: "Cotización en preparación",
      files: ["plano-patios-moin.pdf", "rutas-contenedores.xlsx", "fotos-patio-maniobra.zip"],
      lastContactOffset: -2,
      quote: {
        approvedPrice: "0",
        scope: "Demarcación de rutas internas, patios de maniobra, pasos peatonales, flechas direccionales y apoyo de cierres parciales por bloques.",
        exclusions: "No incluye reparación de superficie, cierres portuarios no coordinados ni trabajos fuera de áreas indicadas.",
        technicalNotes: "Se recomienda dividir la ejecución por bloques para mantener continuidad logística.",
        estimatedTerm: "Pendiente de confirmar por bloques",
        validity: "12 días naturales",
        createdOffset: -3,
        updatedOffset: -1
      },
      tasks: [
        { title: "Preparar propuesta por bloques", detail: "Separar patios, accesos y rutas de camiones en partidas.", owner: "Gerencia", dueOffset: 0 },
        { title: "Confirmar horarios operativos", detail: "Validar ventanas con operaciones y seguridad industrial.", owner: "Ingeniería", dueOffset: 1 }
      ],
      activities: [
        { type: "Llamada operativa", channel: "Teléfono", message: "Cliente solicita propuesta que no detenga tránsito de contenedores.", owner: "Gerencia", offset: -2 },
        { type: "Análisis IA", channel: "CRM", message: "OpenAI sugiere cotizar por bloques y pedir horarios operativos.", owner: "Ventas", offset: -1 }
      ]
    },
    {
      cliente: "Concesionaria Ruta 27",
      contacto: "Andrés Brenes",
      telefono: "+506 2588 7000",
      correo: "mantenimiento@ruta27.cr",
      preferencia: "Correo",
      fuente: "Referido",
      ubicacion: "Rampa de intercambio, tramo oeste",
      provincia: "San José",
      canton: "Escazú",
      coordenadas: "9.9305, -84.1439",
      servicio: "Flex Beam",
      urgencia: "Alta",
      fechaInicio: demoDate(10),
      descripcion: "Reposición e instalación de Flex Beam en rampa de intercambio con tránsito de alta velocidad, terminales abatibles y control nocturno.",
      largo: "310",
      ancho: "",
      espesor: "",
      metrosLineales: "310",
      senales: "12",
      responsable: "Gerencia",
      monto: "38700000",
      probabilidad: "82",
      proximaAccion: "Ajustar alcance por terminales y validar horario nocturno solicitado.",
      stage: "Negociación o ajustes",
      files: ["kmz-tramo-ruta27.kmz", "fotos-rampa.zip", "esquema-cierre-nocturno.pdf"],
      lastContactOffset: -1,
      quote: {
        version: 2,
        approvedPrice: "37450000",
        scope: "Suministro e instalación de Flex Beam, postes, terminales, elementos reflectivos y apoyo de seguridad vial nocturna.",
        exclusions: "No incluye reparaciones estructurales fuera del tramo, expropiaciones, permisos especiales ni cierres adicionales no pactados.",
        technicalNotes: "Versión ajustada por terminales abatibles y trabajo nocturno.",
        estimatedTerm: "5 noches de trabajo",
        validity: "10 días naturales",
        createdOffset: -8,
        updatedOffset: -1,
        sentOffset: -1
      },
      tasks: [
        { title: "Preparar ajuste de cotización", detail: "Separar terminales y control nocturno en partidas claras.", owner: "Gerencia", dueOffset: 0 },
        { title: "Reunión de cierre", detail: "Coordinar llamada con mantenimiento para aprobar versión 2.", owner: "Ventas", dueOffset: 1 }
      ],
      activities: [
        { type: "Reunión técnica", channel: "Correo", message: "Cliente solicita ajustar terminales y confirmar disponibilidad nocturna.", owner: "Gerencia", offset: -1 },
        { type: "Negociación", channel: "CRM", message: "Probabilidad sube por urgencia y alcance validado.", owner: "Ventas", offset: -1 }
      ]
    },
    {
      cliente: "Condominio Vista Real",
      contacto: "Sofía Araya",
      telefono: "+506 8891 7744",
      correo: "administracion@vistareal.cr",
      preferencia: "Ambos",
      fuente: "Cliente existente",
      ubicacion: "Calles internas y accesos de visitantes, Curridabat",
      provincia: "San José",
      canton: "Curridabat",
      coordenadas: "9.9152, -84.0354",
      servicio: "Señalización vertical y horizontal",
      urgencia: "Baja",
      fechaInicio: demoDate(28),
      descripcion: "Renovación de señalización interna del condominio, zonas de velocidad reducida, pasos peatonales y numeración de parqueos.",
      largo: "540",
      ancho: "5.8",
      espesor: "",
      metrosLineales: "1120",
      senales: "34",
      responsable: "Ventas",
      monto: "8300000",
      probabilidad: "100",
      proximaAccion: "Coordinar fecha de inicio y solicitar orden de compra.",
      stage: "Ganada",
      files: ["orden-compra-vista-real.pdf", "plano-condominio.pdf", "fotos-parqueos.zip"],
      lastContactOffset: -1,
      quote: {
        approvedPrice: "8120000",
        scope: "Demarcación interna, señales verticales, pasos peatonales, leyendas de velocidad y parqueos numerados.",
        exclusions: "No incluye reparación de superficie ni pintura de cordones fuera del plano aprobado.",
        technicalNotes: "Cliente aprueba ejecución por sectores para reducir afectación a residentes.",
        estimatedTerm: "3 días hábiles",
        validity: "Aceptada",
        createdOffset: -10,
        updatedOffset: -3,
        sentOffset: -8
      },
      tasks: [
        { title: "Solicitar orden de compra", detail: "Confirmar número de OC y datos de facturación.", dueOffset: 0 },
        { title: "Coordinar inicio", detail: "Programar cuadrilla y materiales para arranque.", owner: "Ingeniería", dueOffset: 2 }
      ],
      activities: [
        { type: "Cierre ganado", channel: "Correo", message: "Cliente aprueba propuesta y solicita coordinación de fecha.", offset: -1 },
        { type: "Nota interna", channel: "CRM", message: "Pasar a coordinación operativa cuando llegue OC.", owner: "Ventas", offset: -1 }
      ]
    },
    {
      cliente: "Residencial Los Laureles",
      contacto: "Comité de infraestructura",
      telefono: "+506 2430 1188",
      correo: "comite@loslaureles.cr",
      preferencia: "Correo",
      fuente: "Correo",
      ubicacion: "Acceso principal y calle secundaria, Grecia",
      provincia: "Alajuela",
      canton: "Grecia",
      coordenadas: "10.0731, -84.3110",
      servicio: "Base granular y mezcla asfáltica",
      urgencia: "Baja",
      fechaInicio: demoDate(45),
      descripcion: "Solicitud de rehabilitación de acceso residencial con base granular, nivelación y carpeta asfáltica. Presupuesto del comité está limitado.",
      largo: "180",
      ancho: "4.8",
      espesor: "8",
      metrosLineales: "180",
      senales: "8",
      responsable: "Gerencia",
      monto: "17600000",
      probabilidad: "0",
      proximaAccion: "Registrar descarte y dejar contacto para futura etapa presupuestaria.",
      stage: "Perdida o descartada",
      lossReason: "Presupuesto insuficiente para el alcance solicitado",
      files: ["solicitud-comite.pdf", "fotos-calle-secundaria.zip"],
      lastContactOffset: -6,
      quote: {
        approvedPrice: "17150000",
        scope: "Nivelación, base granular, compactación y colocación de carpeta asfáltica en acceso residencial.",
        exclusions: "No incluye drenajes nuevos, ampliación de vía ni reparación de aceras.",
        technicalNotes: "Se recomendó dividir en dos etapas, pero el presupuesto no cubre la primera fase.",
        estimatedTerm: "4 días hábiles",
        validity: "15 días naturales",
        createdOffset: -14,
        updatedOffset: -9,
        sentOffset: -8
      },
      tasks: [
        { title: "Cerrar oportunidad", detail: "Registrar motivo de pérdida y programar revisión futura.", owner: "Gerencia", dueOffset: 0, done: true },
        { title: "Revisión futura", detail: "Contactar en próximo ciclo presupuestario.", dueOffset: 30 }
      ],
      activities: [
        { type: "Aviso de cierre", channel: "Correo", message: "Cliente descarta por presupuesto y agradece alternativa por etapas.", offset: -6 },
        { type: "Motivo de pérdida", channel: "CRM", message: "Presupuesto insuficiente para el alcance solicitado.", owner: "Gerencia", offset: -6 }
      ]
    },
    {
      cliente: "Hotel Bahía Serena",
      contacto: "Natalia Quirós",
      telefono: "+506 2670 4400",
      correo: "mantenimiento@bahiaserena.cr",
      preferencia: "WhatsApp",
      fuente: "WhatsApp",
      ubicacion: "Ingreso turístico y parqueo principal, Playas del Coco",
      provincia: "Guanacaste",
      canton: "Carrillo",
      coordenadas: "10.5501, -85.6969",
      servicio: "Demarcación vial y cierres de obra",
      urgencia: "Media",
      fechaInicio: demoDate(3),
      descripcion: "Demarcación de parqueo, flechas de circulación, zonas de carga y cierres parciales para ejecutar antes de alta ocupación.",
      largo: "420",
      ancho: "6.4",
      espesor: "",
      metrosLineales: "1380",
      senales: "16",
      responsable: "Ingeniería",
      monto: "11800000",
      probabilidad: "100",
      proximaAccion: "Registrar servicio ejecutado, adjuntar cierre fotográfico y preparar postventa.",
      stage: "Servicio ejecutado",
      files: ["acta-entrega-bahia-serena.pdf", "cierre-fotografico.zip", "plano-final-demarcacion.pdf"],
      lastContactOffset: -1,
      quote: {
        approvedPrice: "11450000",
        scope: "Demarcación de parqueo, flechas, zonas de carga, pasos peatonales y cierres parciales durante ejecución.",
        exclusions: "No incluye pintura de fachadas, obra civil ni trabajos fuera del área contratada.",
        technicalNotes: "Servicio completado antes de alta ocupación; se adjunta cierre fotográfico.",
        estimatedTerm: "2 días hábiles",
        validity: "Aceptada",
        createdOffset: -18,
        updatedOffset: -2,
        sentOffset: -14
      },
      tasks: [
        { title: "Postventa", detail: "Enviar agradecimiento, solicitar testimonio y validar satisfacción.", dueOffset: 1 },
        { title: "Archivar expediente", detail: "Guardar acta, fotos y versión final de cotización.", owner: "Ventas", dueOffset: 2 }
      ],
      activities: [
        { type: "Servicio ejecutado", channel: "CRM", message: "Trabajo finalizado y recibido por mantenimiento del hotel.", owner: "Ingeniería", offset: -1 },
        { type: "Cierre fotográfico", channel: "WhatsApp", message: "Se compartieron fotografías finales y acta de entrega.", offset: -1 }
      ]
    }
  ];

  try {
    if (demoButton) {
      demoButton.disabled = true;
      demoButton.textContent = "Creando demo...";
    }

    for (const [index, sample] of samples.entries()) {
      if (formNote) formNote.textContent = `Creando demo completo con OpenAI... ${index + 1}/${samples.length}`;
      const data = new FormData();
      Object.entries(sample).forEach(([key, value]) => {
        if (!["activities", "files", "lastContactOffset", "lossReason", "quote", "stage", "tasks"].includes(key)) {
          data.set(key, value);
        }
      });
      const opportunity = await saveOpportunity(opportunityFromForm(data));
      enrichDemoOpportunity(opportunity, sample);
    }

    state.selectedId = state.opportunities.find((opportunity) => opportunity.stage === "Cotización enviada")?.id || state.opportunities[0]?.id || null;
    saveState();
    if (formNote) formNote.textContent = "Demo completo creado: pipeline, IA, tareas, comunicaciones, cotizaciones e historial listos para presentar.";
    renderAll();
  } finally {
    if (demoButton) {
      demoButton.disabled = false;
      demoButton.textContent = originalDemoLabel;
    }
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const opportunity = opportunityFromForm(new FormData(form));
  formNote.textContent = "Consultando OpenAI para clasificar la oportunidad y preparar automatizaciones...";
  await saveOpportunity(opportunity);
  form.reset();
  probabilityInput.value = "35";
  probabilityLabel.textContent = "35%";
  const review = buildAiReview(opportunity);
  formNote.textContent = review.source === "openai"
    ? "Oportunidad creada con automatizaciones de OpenAI."
    : "Oportunidad creada con respaldo local porque OpenAI no respondió.";
  renderAll();
});

probabilityInput?.addEventListener("input", () => {
  probabilityLabel.textContent = `${probabilityInput.value}%`;
});

pipeline?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  state.selectedId = button.dataset.id;
  saveState();
  renderAll();
});

selectedPanel?.addEventListener("submit", (event) => {
  if (!event.target.matches("[data-stage-form]")) return;
  event.preventDefault();
  updateStage(new FormData(event.target));
});

messageTemplate?.addEventListener("change", () => {
  const opportunity = getActiveOpportunity();
  if (opportunity && messageBody) messageBody.value = MESSAGE_TEMPLATES[messageTemplate.value]({ opportunity, review: buildAiReview(opportunity) });
});

messageForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const opportunity = getActiveOpportunity();
  if (!opportunity) {
    messageForm.querySelector("[data-message-note]").textContent = "Seleccione una oportunidad antes de registrar una comunicación.";
    return;
  }
  const data = new FormData(messageForm);
  const saved = registerActivity(`Plantilla: ${messageTemplate.options[messageTemplate.selectedIndex].text}`, data.get("channel"), data.get("message"));
  if (saved) messageForm.querySelector("[data-message-note]").textContent = "Comunicación registrada en el historial del cliente.";
});

quoteForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!getActiveOpportunity()) {
    quoteNote.textContent = "Seleccione una oportunidad antes de guardar una cotización.";
    return;
  }
  saveQuote(new FormData(quoteForm));
});

document.querySelector("[data-quote-pdf]")?.addEventListener("click", () => {
  if (!getActiveQuote()) {
    quoteNote.textContent = "Guarde primero una versión de cotización.";
    return;
  }
  document.body.classList.add("is-printing-quote");
  window.print();
  window.setTimeout(() => document.body.classList.remove("is-printing-quote"), 800);
});

document.querySelector("[data-quote-send]")?.addEventListener("click", registerQuoteSend);

taskList?.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-task-id]");
  if (!checkbox) return;
  const task = state.tasks.find((item) => item.id === checkbox.dataset.taskId);
  if (task) {
    task.done = checkbox.checked;
    saveState();
    renderAll();
  }
});

[searchInput, urgencyFilter, ownerFilter].forEach((control) => {
  control?.addEventListener("input", renderAll);
});

demoButton?.addEventListener("click", seedDemo);

clearButton?.addEventListener("click", () => clearLocalData());

exportButton?.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `roads-solutions-crm-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

renderAll();
