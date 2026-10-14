/* Modais e gavetas acessíveis: foco preso dentro, Esc fecha, foco volta ao botão de origem. */
import { reducedMotion } from "./util.js";

const stack = [];
/** Avisa o resto do site (rolagem suave, 3D) quando há camada aberta por cima da página. */
const announce = () => document.dispatchEvent(new CustomEvent("figaros:layers", { detail: { open: stack.length > 0 } }));
const pending = new WeakMap(); // fechamentos animando — cancelados se a camada reabrir
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openLayer(layer, { onClose, initialFocus } = {}) {
  if (stack.some((s) => s.layer === layer)) return;
  if (pending.has(layer)) { clearTimeout(pending.get(layer).timer); pending.get(layer).finish(true); }
  const entry = { layer, onClose, returnTo: document.activeElement };
  stack.push(entry);
  layer.hidden = false;
  layer.classList.remove("closing");
  document.body.classList.add("no-scroll");
  document.documentElement.classList.add("no-scroll");
  announce();
  requestAnimationFrame(() => {
    const target = (initialFocus && layer.querySelector(initialFocus)) || layer.querySelector(".dialog-close, .drawer-head button") || layer.querySelector(FOCUSABLE);
    target?.focus({ preventScroll: true });
  });
}

export function closeLayer(layer, { silent = false } = {}) {
  const i = stack.findIndex((s) => s.layer === layer);
  if (i < 0) return;
  const [entry] = stack.splice(i, 1);
  const finish = (reopening = false) => {
    pending.delete(layer);
    layer.classList.remove("closing");
    if (!silent) entry.onClose?.();
    if (reopening) return;
    layer.hidden = true;
    if (!stack.length) { document.body.classList.remove("no-scroll"); document.documentElement.classList.remove("no-scroll"); announce(); }
    if (entry.returnTo && document.contains(entry.returnTo)) entry.returnTo.focus?.({ preventScroll: true });
  };
  if (reducedMotion()) return finish();
  layer.classList.add("closing");
  pending.set(layer, { finish, timer: setTimeout(finish, 210) });
}

export const isOpen = (layer) => stack.some((s) => s.layer === layer);
export const topLayer = () => stack[stack.length - 1]?.layer || null;

document.addEventListener("keydown", (e) => {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === "Escape") {
    // Painel interno (ex.: seletor de sabores) fecha primeiro
    const inner = top.layer.querySelector("[data-escape]");
    if (inner) { e.preventDefault(); inner.dispatchEvent(new CustomEvent("escape")); return; }
    e.preventDefault();
    closeLayer(top.layer);
    return;
  }
  if (e.key === "Tab") {
    const items = [...top.layer.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!top.layer.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
});

document.addEventListener("click", (e) => {
  const closer = e.target.closest("[data-close]");
  if (!closer) return;
  const layer = closer.closest(".layer");
  if (layer) closeLayer(layer);
});
