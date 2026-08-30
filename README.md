# Roads & Solutions S.A. premium website

Sitio premium para Roads & Solutions S.A., empresa costarricense enfocada en seguridad vial y construcción vial.

## Servicios principales

- Suministro e instalación de baranda tipo Flex Beam.
- Señalización vertical y horizontal.
- Demarcación vial y apoyo en cierres de obra.
- Colocación de base y mezcla asfáltica.

## Vercel

El proyecto está listo para desplegarse en Vercel con:

- Sitio estático principal.
- Endpoint serverless `api/flex.js` para el agente IA.
- Página `crm.html` como base visual del login CRM.
- `vercel.json` con URLs limpias y headers iniciales.

Variables requeridas en Vercel:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` opcional, por defecto `gpt-5.6-luna`
- `FLEX_MAX_OUTPUT_TOKENS` opcional, por defecto `1800`

Comandos:

- `npm install`
- `npm run build`
- `npm run dev`

## SEO preparado

- Metadata principal y Open Graph.
- Twitter card.
- Schema.org `LocalBusiness`.
- `robots.txt`.
- `sitemap.xml`.
- Copy comercial orientado a búsquedas de seguridad vial, Flex Beam, señalización, demarcación y mezcla asfáltica en Costa Rica.

## CRM y automatización

El formulario y el chat de Flex quedan preparados para conectarse a CRM, correo, WhatsApp, Firebase y automatizaciones n8n en la siguiente fase.
