const SERVICES = [
  "Flex Beam",
  "Señalización vertical y horizontal",
  "Demarcación vial y cierres de obra",
  "Base granular y mezcla asfáltica"
];

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

const SYSTEM_PROMPT = `
Eres el motor de automatización comercial del CRM de Roads & Solutions S.A., empresa de Costa Rica enfocada en:
- Flex Beam.
- Señalización vertical y horizontal.
- Demarcación vial y cierres de obra.
- Base granular y mezcla asfáltica.

Analiza oportunidades comerciales entrantes y devuelve únicamente JSON válido, sin markdown.
Debes ayudar a identificar servicio principal, datos faltantes, resumen de necesidad, medidas preliminares,
visita técnica recomendada, preguntas adicionales, borrador de respuesta, urgencia, complejidad, etapa recomendada
y próxima acción comercial.

No apruebes precios finales, no inventes disponibilidad de agenda, no reemplaces la validación técnica del equipo
y no agregues servicios fuera del enfoque vial de la empresa.
`;

const sendJson = (response, body, status = 200) => {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.json(body);
};

const asText = (value, fallback = "") => String(value ?? fallback).trim();

const pickAllowed = (value, allowed, fallback) => {
  const exact = allowed.find((item) => item === value);
  return exact || fallback;
};

const listOfText = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asText(item)).filter(Boolean).slice(0, 8);
};

const parseModelJson = (data) => {
  const text =
    data.output_text ||
    data.output?.flatMap((item) => item.content || [])?.find((part) => part.type === "output_text")?.text ||
    "";

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const normalizeReview = (raw, opportunity) => {
  const service = pickAllowed(raw?.service, SERVICES, opportunity?.service || SERVICES[1]);
  const recommendedStage = pickAllowed(raw?.recommendedStage, STAGES, "");
  const missing = listOfText(raw?.missing);
  const questions = listOfText(raw?.questions);

  return {
    service,
    missing,
    visit: Boolean(raw?.visit),
    summary: asText(raw?.summary, `${opportunity?.client?.name || "Cliente"} solicita ${service}.`),
    questions: questions.length ? questions : ["Validar alcance técnico final.", "Confirmar fecha disponible para cotización o visita."],
    draft: asText(raw?.draft, `Gracias por contactar a Roads & Solutions S.A. Iniciaremos la revisión de ${service} y le contactaremos con los siguientes pasos.`),
    urgency: pickAllowed(raw?.urgency, ["Alta", "Media", "Baja"], opportunity?.project?.urgency || "Media"),
    complexity: pickAllowed(raw?.complexity, ["Baja", "Media", "Alta", "Baja / Media", "Media / Alta"], "Media"),
    quantities: asText(raw?.quantities, "Sin cantidades preliminares suficientes."),
    nextAction: asText(raw?.nextAction, missing.length ? "Solicitar información adicional" : "Revisión técnica"),
    recommendedStage,
    source: "openai"
  };
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, { error: "Método no permitido" }, 405);
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(response, { error: "OPENAI_API_KEY no configurada" }, 503);
  }

  const opportunity = request.body?.opportunity;
  if (!opportunity?.client || !opportunity?.project) {
    return sendJson(response, { error: "Oportunidad requerida" }, 400);
  }

  const maxOutputTokens = Math.min(
    Math.max(Number.parseInt(process.env.CRM_AI_MAX_OUTPUT_TOKENS || "1200", 10) || 1200, 500),
    2500
  );

  const input = [
    {
      role: "developer",
      content: SYSTEM_PROMPT
    },
    {
      role: "user",
      content: JSON.stringify({
        opportunity,
        requiredJsonShape: {
          service: SERVICES,
          missing: ["string"],
          visit: "boolean",
          summary: "string",
          questions: ["string"],
          draft: "string",
          urgency: ["Alta", "Media", "Baja"],
          complexity: ["Baja", "Media", "Alta", "Baja / Media", "Media / Alta"],
          quantities: "string",
          nextAction: "string",
          recommendedStage: STAGES
        }
      }).slice(0, 9000)
    }
  ];

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CRM_MODEL || process.env.OPENAI_MODEL || "gpt-5.6",
        input,
        max_output_tokens: maxOutputTokens
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("CRM AI OpenAI error", openaiResponse.status, errorText.slice(0, 500));
      return sendJson(response, { error: "No se pudo consultar OpenAI para el CRM" }, 502);
    }

    const data = await openaiResponse.json();
    const parsed = parseModelJson(data);
    if (!parsed) {
      return sendJson(response, { error: "OpenAI no devolvió JSON válido" }, 502);
    }

    return sendJson(response, { review: normalizeReview(parsed, opportunity) });
  } catch (error) {
    console.error("CRM AI handler error", error);
    return sendJson(response, { error: "Error interno de IA del CRM" }, 500);
  }
}
