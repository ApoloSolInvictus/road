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

El formulario público crea solicitudes en el CRM local y el panel privado usa Firebase Authentication para el acceso por correo y contraseña.

### Configurar Firebase Auth

1. En Firebase Console, crea una aplicación web y habilita el proveedor `Email/Password` en Authentication.
2. Copia `firebase-config.example.js` como `firebase-config.js`.
3. Completa en `firebase-config.js` los valores públicos de configuración de la aplicación web.
4. Crea los usuarios autorizados desde Firebase Console.

`firebase-config.js` está ignorado por Git. La configuración web de Firebase no contiene secretos de servidor, pero las reglas de Firestore, Storage y cualquier dato comercial deben protegerse en sus propios servicios antes de migrar el CRM desde `localStorage`.

### Configurar Firebase desde Vercel

En el proyecto de Vercel, abre `Settings → Environment Variables` y agrega estas variables para `Production` (y `Preview` si también deseas probar previews):

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

Después de guardar las variables, ejecuta un nuevo redeploy desde `Deployments → Redeploy`. El build genera `firebase-config.js` automáticamente; no necesitas subir ese archivo ni usar la terminal.
