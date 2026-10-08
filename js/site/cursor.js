/* ============================================================
   Figaro's 2.0 — ponteiro e toque:
   - cursor próprio (só mouse): ponto + anel que cresce sobre links/botões
     e mostra "Ver", "Pedir"… sobre os cartões (?nocursor desliga)
   - luz que segue o mouse nos cartões e uma borda que acende perto dele
   - ondinha no clique dos botões e vibração curta ao adicionar no celular
   Tudo no laço único (motion.js); "reduzir movimento" desliga o que se mexe.
   ============================================================ */
import { finePointer } from "./util.js";
import { ticker, motion, onReducedMotion } from "./motion.js";

const root = document.documentElement;
const PARAMS = new URLSearchParams(location.search);

/* ---------- Cursor ---------- */
const INTERACTIVE = "a, button, [role='tab'], label, summary, .hero-visual.is-3d, [data-cursor]";
const TEXTY = "input, textarea, select, iframe, [contenteditable='true']";
/** Rótulo do anel conforme o que está embaixo do mouse. */
function labelFor(t) {
  const own = t.closest("[data-cursor]");
  if (own) return own.dataset.cursor;
  if (t.closest(".mrow-add, .add-chip")) return "+";
  if (t.closest(".card-link")) return t.closest("[data-quick]") ? "Pedir" : "Ver";
  if (t.closest(".mrow-main, .combo [data-open], .pick")) return "Ver";
  if (t.closest(".hero-visual.is-3d")) return "Girar";
  if (t.closest(".btn-primary, .cart-btn, .floating-cart")) return "Pedir";
  if (t.closest("#mapLoad")) return "Mapa";
  return "";
}

let cur = null;
function initCursor() {
  if (!finePointer() || motion.reduced || PARAMS.has("nocursor")) return;
  const el = document.createElement("div");
  el.className = "cursor is-hidden";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<div class="c-ring"><span class="c-ring-in"><b class="c-label"></b></span></div><div class="c-dot"></div>';
  document.body.appendChild(el);
  const ring = el.querySelector(".c-ring"), dot = el.querySelector(".c-dot"), label = el.querySelector(".c-label");
  const st = { x: -100, y: -100, rx: -100, ry: -100, on: false, label: "" };
  cur = { el, st };
  root.classList.add("has-cursor");

  const setLabel = (txt) => {
    if (txt === st.label) return;
    st.label = txt;
    label.textContent = txt;
    el.classList.toggle("has-label", !!txt);
  };
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    st.x = e.clientX; st.y = e.clientY;
    if (!st.on) { st.on = true; st.rx = st.x; st.ry = st.y; }
    const t = e.target instanceof Element ? e.target : null;
    const texty = !!t?.closest(TEXTY);
    el.classList.toggle("is-hidden", texty);
    el.classList.toggle("is-hover", !!t?.closest(INTERACTIVE) && !texty);
    setLabel(t && !texty ? labelFor(t) : "");
    dot.style.transform = `translate3d(${st.x}px, ${st.y}px, 0)`;
    ticker.wake();
  }, { passive: true });
  document.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") el.classList.add("is-down"); });
  document.addEventListener("pointerup", () => el.classList.remove("is-down"));
  document.documentElement.addEventListener("mouseleave", () => { el.classList.add("is-hidden"); st.on = false; });
  // modal abriu/fechou: o que estava embaixo do mouse mudou
  document.addEventListener("figaros:layers", () => setLabel(""));

  ticker.add((f) => {
    if (!st.on) return false;
    const k = 1 - Math.exp(-16 * f.dt); // o anel vem atrás, com suavidade
    st.rx += (st.x - st.rx) * k;
    st.ry += (st.y - st.ry) * k;
    ring.style.transform = `translate3d(${st.rx.toFixed(1)}px, ${st.ry.toFixed(1)}px, 0)`;
    return Math.abs(st.x - st.rx) + Math.abs(st.y - st.ry) > 0.3;
  });
}
function destroyCursor() {
  if (!cur) return;
  cur.el.remove();
  cur = null;
  root.classList.remove("has-cursor");
}

/* ---------- Luz que segue o mouse (cartões, passos, contato…) ---------- */
const SPOT = ".card, .combo, .step, .contact-card, .size, .stats li, .about-points li, .review";
function initSpotlight() {
  if (!finePointer()) return;
  let pending = null, lastEl = null;
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || motion.reduced) return;
    const el = e.target instanceof Element ? e.target.closest(SPOT) : null;
    if (lastEl && lastEl !== el) { lastEl.style.removeProperty("--sx"); lastEl.style.removeProperty("--sy"); }
    lastEl = el;
    if (!el) return;
    if (!el.classList.contains("spot")) el.classList.add("spot");
    pending = { el, x: e.clientX, y: e.clientY };
    ticker.wake();
  }, { passive: true });
  // aplica no máximo uma vez por quadro
  ticker.add(() => {
    if (!pending) return false;
    const { el, x, y } = pending;
    pending = null;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${(x - r.left).toFixed(0)}px`);
    el.style.setProperty("--sy", `${(y - r.top).toFixed(0)}px`);
    return false;
  });
}

/* ---------- Ondinha no clique + vibração ---------- */
const RIPPLE = ".btn, .cart-btn, .round-btn, .icon-btn, .mrow-add, .cat-tab, .chip, .floating-cart, .more, .size, .opt, .opt-row";
function initRipple() {
  document.addEventListener("pointerdown", (e) => {
    if (motion.reduced || e.button > 0) return;
    const host = e.target instanceof Element ? e.target.closest(RIPPLE) : null;
    if (!host || host.disabled) return;
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement("span");
    s.className = "ripple";
    s.setAttribute("aria-hidden", "true");
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    host.appendChild(s);
    s.addEventListener("animationend", () => s.remove(), { once: true });
    setTimeout(() => s.remove(), 900);
  }, { passive: true });
}

/** Vibração curtinha (celular) quando algo entra no carrinho. */
export function haptic(ms = 12) {
  if (motion.reduced || !window.matchMedia("(pointer: coarse)").matches) return;
  try { navigator.vibrate?.(ms); } catch { /* sem vibração */ }
}

export function initPointerFx() {
  initCursor();
  initSpotlight();
  initRipple();
  onReducedMotion((r) => { if (r) destroyCursor(); });
}
