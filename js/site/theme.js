/* ============================================================
   Tema claro / escuro ("Forno à Noite").
   O tema inicial já foi aplicado pelo theme-boot.js (antes de pintar a página):
   o que a pessoa escolheu no botão; senão, o escuro.
   Ao trocar: um círculo se abre a partir do botão (View Transitions, quando o
   navegador tem), a escolha fica salva no aparelho e o fundo 3D é avisado.
   ============================================================ */
import { motion } from "./motion.js";

const root = document.documentElement;
const COLORS = { dark: "#120c09", light: "#982C27" };

function apply(theme, { save = false } = {}) {
  root.dataset.theme = theme;
  const btn = document.getElementById("themeBtn");
  if (btn) {
    btn.setAttribute("aria-pressed", String(theme === "light"));
    btn.setAttribute("aria-label", theme === "dark" ? "Usar tema claro" : "Usar tema escuro");
    btn.title = theme === "dark" ? "Tema claro" : "Tema escuro";
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLORS[theme]);
  if (save) { try { localStorage.setItem("fg-theme", theme); } catch { /* sem armazenamento */ } }
  document.dispatchEvent(new CustomEvent("figaros:theme", { detail: { theme } }));
}

export function initTheme() {
  apply(root.dataset.theme === "light" ? "light" : "dark");
  const btn = document.getElementById("themeBtn");
  btn?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    if (!document.startViewTransition || motion.reduced) return apply(next, { save: true });
    const r = btn.getBoundingClientRect();
    root.style.setProperty("--vt-x", `${Math.round(r.left + r.width / 2)}px`);
    root.style.setProperty("--vt-y", `${Math.round(r.top + r.height / 2)}px`);
    root.classList.add("theme-vt");
    const vt = document.startViewTransition(() => apply(next, { save: true }));
    vt.finished.finally(() => root.classList.remove("theme-vt"));
  });
}
