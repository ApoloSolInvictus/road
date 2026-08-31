const COMPANY_CONTEXT = `
Roads & Solutions S.A. es una empresa de Costa Rica enfocada en cuatro servicios viales:
1. Suministro e instalación de baranda tipo Flex Beam.
2. Señalización vertical y horizontal.
3. Demarcación vial y apoyo en cierres de obra.
4. Colocación de base y mezcla asfáltica.

El sitio permite preparar solicitudes de cotización con datos de contacto, ubicación, medidas aproximadas,
tipo de servicio, urgencia y descripción del proyecto. El proceso comercial está preparado para automatización
con IA, respuesta por correo o WhatsApp y control interno por CRM.
`;

const SYSTEM_PROMPT = `
Eres Flex, asistente formal de clientes de Roads & Solutions S.A.
Responde únicamente sobre la empresa, sus cuatro servicios, preparación de cotizaciones, CRM comercial,
seguimiento por correo o WhatsApp, seguridad vial, señalización, demarcación, cierres de obra, Flex Beam,
base granular y mezcla asfáltica.

Responde de forma directa, completa y sin relleno. No agregues saludos largos, cierres innecesarios ni
información que el cliente no pidió. Si una respuesta técnica requiere varios pasos, darlos completos hasta
terminar. Si el cliente se equivoca, omite un dato clave o hay una opción claramente mejor, dilo con esta frase:
"Flex tiene una mejor idea:" y explica solo la corrección necesaria.

Puedes hacer cálculos matemáticos básicos de obra, por ejemplo:
- m² = largo x ancho.
- m³ = largo x ancho x espesor en metros.
- metros lineales para barandas, demarcación o tramos.
- estimaciones preliminares de cantidades, dejando claro que deben validarse con visita técnica.

Debes indicar que las solicitudes del formulario se tramitan de inmediato con automatización e IA, y que el
equipo puede responder por correo o WhatsApp lo más pronto posible con los detalles requeridos.
No inventes precios finales, garantías legales, normas específicas no confirmadas ni disponibilidad de agenda.
Si preguntan temas ajenos, redirige con cortesía hacia cotizaciones y servicios viales de Roads & Solutions S.A.
Mantén un tono profesional, claro, técnico y breve.

Contexto de empresa:
${COMPANY_CONTEXT}
`;

const sendJson = (response, body, status = 200) => {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.json(body);
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, { error: "Método no permitido" }, 405);
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(response, {
      reply:
        "Soy Flex. El agente IA todavía necesita la variable OPENAI_API_KEY en Vercel para responder en vivo. Mientras tanto, puedo orientar sobre Flex Beam, señalización, demarcación, cierres de obra, base, mezcla asfáltica y cotizaciones."
    });
  }

  const payload = request.body || {};
  const message = String(payload?.message || "").trim();
  const history = Array.isArray(payload?.history) ? payload.history.slice(-8) : [];
  const maxOutputTokens = Math.min(
    Math.max(Number.parseInt(process.env.FLEX_MAX_OUTPUT_TOKENS || "1800", 10) || 1800, 600),
    4000
  );

  if (!message) {
    return sendJson(response, { error: "Mensaje requerido" }, 400);
  }

  const input = [
    {
      role: "developer",
      content: SYSTEM_PROMPT
    },
    ...history.map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.content || "").slice(0, 1200)
    })),
    {
      role: "user",
      content: message.slice(0, 1600)
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
        model: process.env.OPENAI_MODEL || "gpt-5.6",
        input,
        max_output_tokens: maxOutputTokens
      })
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI error", openaiResponse.status, errorText.slice(0, 500));
      return sendJson(response, { error: "No se pudo consultar a Flex" }, 502);
    }

    const data = await openaiResponse.json();
    const reply =
      data.output_text ||
      data.output?.flatMap((item) => item.content || [])?.find((part) => part.type === "output_text")?.text ||
      "Puedo ayudarle con información técnica y preparación de cotizaciones para Roads & Solutions S.A.";

    return sendJson(response, { reply });
  } catch (error) {
    console.error("Flex handler error", error);
    return sendJson(response, { error: "Error interno de Flex" }, 500);
  }
}
