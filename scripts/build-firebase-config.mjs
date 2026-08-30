import { existsSync, readFileSync, writeFileSync } from "node:fs";

const outputFile = "firebase-config.js";
const keys = [
  ["apiKey", "FIREBASE_API_KEY"],
  ["authDomain", "FIREBASE_AUTH_DOMAIN"],
  ["projectId", "FIREBASE_PROJECT_ID"],
  ["storageBucket", "FIREBASE_STORAGE_BUCKET"],
  ["messagingSenderId", "FIREBASE_MESSAGING_SENDER_ID"],
  ["appId", "FIREBASE_APP_ID"]
];

const localConfigIsReady = existsSync(outputFile) && !readFileSync(outputFile, "utf8").includes("REPLACE_WITH_");
if (localConfigIsReady && !process.env.VERCEL) {
  console.log("Firebase: se conserva la configuración local para este build.");
  process.exit(0);
}

const missing = keys.filter(([, envName]) => !process.env[envName]).map(([, envName]) => envName);
if (missing.length) {
  console.error(`Firebase: faltan variables de entorno: ${missing.join(", ")}`);
  process.exit(1);
}

const config = Object.fromEntries(keys.map(([configKey, envName]) => [configKey, process.env[envName]]));
writeFileSync(outputFile, `window.ROAD_FIREBASE_CONFIG = ${JSON.stringify(config, null, 2)};\n`, "utf8");
console.log("Firebase: configuración generada desde variables de entorno de Vercel.");
