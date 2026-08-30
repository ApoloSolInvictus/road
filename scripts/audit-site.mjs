import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "index.html",
  "crm.html",
  "styles.css",
  "app.js",
  "api/flex.js",
  "vercel.json",
  "CNAME",
  "assets/logo-roads-solutions.jpeg",
  "assets/hero-road-solutions.png",
  "assets/warning-chat-button.png"
];

const checks = [];

for (const file of requiredFiles) {
  try {
    await access(path.join(root, file), constants.R_OK);
    checks.push({ file, ok: true });
  } catch {
    checks.push({ file, ok: false });
  }
}

const htmlFiles = (await readdir(root)).filter((file) => file.endsWith(".html"));
for (const file of htmlFiles) {
  const html = await readFile(path.join(root, file), "utf8");
  const hasViewport = html.includes('name="viewport"');
  const hasTitle = /<title>.+<\/title>/is.test(html);
  checks.push({ file: `${file}:viewport`, ok: hasViewport });
  checks.push({ file: `${file}:title`, ok: hasTitle });
}

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.error("Auditoría fallida:");
  for (const failure of failures) {
    console.error(`- Falta o falla: ${failure.file}`);
  }
  process.exit(1);
}

console.log(`Auditoría completada: ${checks.length} verificaciones correctas.`);
