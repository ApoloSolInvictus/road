import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const config = window.ROAD_FIREBASE_CONFIG || {};
const gate = document.querySelector("[data-auth-gate]");
const privateViews = document.querySelectorAll("[data-private-crm]");
const authForm = document.querySelector("[data-auth-form]");
const status = document.querySelector("[data-auth-status]");
const resetButton = document.querySelector("[data-auth-reset]");
const signOutButton = document.querySelector("[data-auth-signout]");

const configured = ["apiKey", "authDomain", "projectId", "appId"].every((key) => {
  const value = String(config[key] || "");
  return value && !value.startsWith("REPLACE_WITH_");
});

function setStatus(message, isError = false) {
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function showPrivateViews(isAuthenticated) {
  if (gate) gate.hidden = isAuthenticated;
  privateViews.forEach((view) => {
    view.hidden = !isAuthenticated;
  });
}

function readableAuthError(error) {
  const messages = {
    "auth/invalid-credential": "El correo o la contraseña no son válidos.",
    "auth/invalid-email": "Ingrese un correo válido.",
    "auth/too-many-requests": "Demasiados intentos. Espere unos minutos y vuelva a intentar.",
    "auth/network-request-failed": "No se pudo conectar con Firebase. Revise la conexión."
  };
  return messages[error.code] || "No fue posible iniciar sesión. Verifique la configuración y sus credenciales.";
}

if (!configured) {
  showPrivateViews(false);
  setStatus("Falta configurar Firebase. Copie firebase-config.example.js como firebase-config.js y complete los datos del proyecto.", true);
  if (authForm) authForm.addEventListener("submit", (event) => event.preventDefault());
} else {
  const app = initializeApp(config);
  const auth = getAuth(app);

  onAuthStateChanged(auth, (user) => {
    showPrivateViews(Boolean(user));
    if (user) setStatus(`Sesión activa: ${user.email}`);
  });

  authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(authForm);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    setStatus("Validando acceso...");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      authForm.reset();
    } catch (error) {
      setStatus(readableAuthError(error), true);
    }
  });

  resetButton?.addEventListener("click", async () => {
    const email = String(authForm?.elements.email?.value || "").trim();
    if (!email) {
      setStatus("Escriba su correo para enviar el enlace de restablecimiento.", true);
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setStatus("Se envió un enlace de restablecimiento al correo indicado.");
    } catch (error) {
      setStatus(readableAuthError(error), true);
    }
  });

  signOutButton?.addEventListener("click", () => signOut(auth));
}
