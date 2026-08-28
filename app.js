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
