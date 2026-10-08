/* ============================================================
   Figaro's 2.0 — animações de rolagem novas (no laço único de motion.js):
   - topo: a pizza cresce e gira, o título se separa em camadas, o fundo escurece (--hp)
   - header: vira pílula de vidro, some ao descer e volta ao subir; o indicador
     do link ativo desliza entre os itens
   - destaques: no computador a seção fica presa e os cartões andam na horizontal
   - contadores que contam do zero ao aparecer
   - "Sobre": o texto principal é pintado palavra por palavra pela rolagem
   - "Como pedir": nós da linha de luz alinhados com os passos
   - cor do fundo muda devagar de uma seção para outra
   - faísca na ponta da barra de progresso e divisores desenhados pela rolagem
     (CSS puro quando o navegador suporta animation-timeline; senão, daqui)
   Nada aqui lê o layout a cada quadro: as medidas só mudam em resize.
   "Reduzir movimento": tudo parado e visível.
   ============================================================ */
import { ticker, motion, onReducedMotion, scrollToY } from "./motion.js";

const root = document.documentElement;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const PARAMS = new URLSearchParams(location.search);
const supports = (q) => typeof CSS !== "undefined" && !!CSS.supports?.(q);
const scrollTimeline = supports("animation-timeline: scroll()");
const viewTimeline = supports("animation-timeline: view()");
const PIN_MEDIA = window.matchMedia("(min-width: 921px) and (min-height: 640px)");
const PIN_SPEED = 1.35; // cada pixel rolado anda 1,35 px na horizontal (a seção não fica presa tempo demais)

const hero = { el: null, top: 0, h: 1, last: -1 };
const hdr = { el: null, nav: null, pill: false, hidden: false, acc: 0, lastY: window.scrollY };
const pin = { sec: null, track: null, meter: null, on: false, top: 0, dist: 0, last: -1 };
const paint = { el: null, top: 0, h: 1, last: -1 };
const story = { line: null, track: null, steps: [] };
let spark = null, maxScroll = 1, lastY = -1, dirty = true;

/* ---------- Medidas (só em resize / mudança de altura da página) ---------- */
const docTop = (el) => el.getBoundingClientRect().top + window.scrollY;
/** Foco vindo do teclado? (navegador antigo sem :focus-visible: considera qualquer foco) */
const focusVisible = (el) => { try { return el.matches(":focus-visible"); } catch { return true; } };

function measurePin() {
  if (!pin.sec || pin.sec.hidden) return;
  const can = !motion.reduced && !PARAMS.has("nopin") && PIN_MEDIA.matches;
  const dist = pin.track.scrollWidth - pin.track.clientWidth;
  const on = can && dist > 60;
  if (on !== pin.on) {
    pin.on = on;
    pin.sec.classList.toggle("is-pinned", on);
    if (!on) { pin.track.scrollLeft = 0; pin.sec.style.removeProperty("--pin-h"); }
  }
  if (on) {
    pin.dist = pin.track.scrollWidth - pin.track.clientWidth;
    pin.sec.style.setProperty("--pin-h", `${Math.round(window.innerHeight + pin.dist / PIN_SPEED)}px`);
  }
  pin.top = docTop(pin.sec);
  pin.last = -1;
}

function measureStory() {
  if (!story.line || !story.steps.length) return;
  // centro de cada passo (offsetTop ignora o transform da entrada)
  const mids = story.steps.map((s) => s.offsetTop + s.offsetHeight / 2);
  const a = mids[0], b = mids[mids.length - 1];
  story.line.style.setProperty("--a", `${a}px`);
  story.line.style.setProperty("--b", `${b}px`);
  story.line.style.setProperty("--mid", b > a ? ((mids[1] - a) / (b - a)).toFixed(3) : ".5");
}

function measure() {
  measurePin();
  if (hero.el) { hero.top = docTop(hero.el); hero.h = hero.el.offsetHeight || 1; }
  if (paint.el) { paint.top = docTop(paint.el); paint.h = paint.el.offsetHeight || 1; }
  measureStory();
  maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  hero.last = paint.last = -1;
  dirty = true;
  ticker.wake();
}

/* ---------- Header: pílula, some ao descer, volta ao subir ---------- */
const navOpen = () => hdr.nav && !hdr.nav.hidden;
function setHidden(h) {
  if (h === hdr.hidden) return;
  hdr.hidden = h;
  root.classList.toggle("hdr-hide", h);
}
function headerTick(y) {
  const dy = y - hdr.lastY;
  hdr.lastY = y;
  const pill = y > 24 && !navOpen();
  if (pill !== hdr.pill) { hdr.pill = pill; hdr.el.classList.toggle("pill", pill); }
  // fica visível: no topo, com o menu do celular aberto, com modal aberto ou navegando pelo teclado dentro do header
  // (foco de clique do mouse não conta — senão o header nunca sumia depois de clicar num link do menu)
  if (motion.reduced || y < 140 || navOpen() || document.body.classList.contains("no-scroll") || (hdr.el.contains(document.activeElement) && focusVisible(document.activeElement))) { hdr.acc = 0; setHidden(false); return; }
  if (dy === 0) return;
  if ((dy > 0) !== (hdr.acc > 0)) hdr.acc = 0;
  hdr.acc += dy;
  if (hdr.acc > 16) setHidden(true);
  else if (hdr.acc < -10) setHidden(false);
}

/** Pílula do menu que desliza até o link ativo (main.js marca .active). */
function initNavInk() {
  const nav = document.querySelector(".main-nav");
  const ink = nav?.querySelector(".nav-ink");
  if (!ink) return;
  const move = () => {
    const a = nav.querySelector("a.active");
    if (!a || !a.offsetWidth) { ink.style.opacity = "0"; return; }
    ink.style.width = `${a.offsetWidth}px`;
    ink.style.transform = `translateX(${a.offsetLeft}px)`;
    ink.style.opacity = "1";
  };
  new MutationObserver(move).observe(nav, { subtree: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", move, { passive: true });
  document.fonts?.ready.then(move);
}

/* ---------- Quadro ---------- */
function tick(f) {
  const y = f.y;
  if (hdr.el) headerTick(y);
  if (y === lastY && !dirty) return false;
  lastY = y;
  dirty = false;
  const vh = f.vh;

  // topo: 0 → 1 enquanto ele sai da tela
  if (hero.el && !motion.reduced) {
    const p = clamp01(y / (hero.top + hero.h * 0.85));
    if (Math.abs(p - hero.last) > 0.002) { hero.last = p; hero.el.style.setProperty("--hp", p.toFixed(3)); }
  }

  // destaques presos: a rolagem vertical vira deslocamento horizontal
  if (pin.on) {
    const p = clamp01((y - pin.top) / (pin.dist / PIN_SPEED));
    if (Math.abs(p - pin.last) > 0.0005) {
      pin.last = p;
      pin.track.scrollLeft = p * pin.dist;
      pin.meter?.style.setProperty("--hm", Math.max(0.08, p).toFixed(3));
    }
  }

  // "Sobre": pinta da hora que o parágrafo aparece até ele chegar perto do meio da tela
  if (paint.el && !motion.reduced) {
    const p = clamp01((y + vh * 0.86 - paint.top) / (paint.h + vh * 0.38));
    if (Math.abs(p - paint.last) > 0.003) { paint.last = p; paint.el.style.setProperty("--pp", p.toFixed(3)); }
  }

  // faísca na ponta da barra (quando o CSS não anima sozinho)
  if (spark && !scrollTimeline) {
    const p = Math.min(1, y / maxScroll);
    spark.style.transform = `translateX(${(p * f.vw).toFixed(1)}px)`;
    spark.style.opacity = p > 0.01 && p < 0.995 && !motion.reduced ? "1" : "0";
  }
  return false;
}

/* ---------- Destaques: botões e teclado quando a seção está presa ---------- */
/** Rola os destaques (setas ‹ ›). Retorna true se tratou (seção presa). */
export function scrollHighlightsBy(dir) {
  if (!pin.on) return false;
  const step = (pin.track.clientWidth * 0.8) / PIN_SPEED;
  const y = Math.max(pin.top, Math.min(pin.top + pin.dist / PIN_SPEED, window.scrollY + dir * step));
  scrollToY(y);
  return true;
}

function initPin() {
  pin.sec = document.getElementById("destaques");
  pin.track = document.getElementById("highlights");
  pin.meter = document.getElementById("hlMeter")?.parentElement || null;
  if (!pin.sec || !pin.track) return;
  // medidor de posição no modo normal (celular: arrastar o carrossel)
  pin.track.addEventListener("scroll", () => {
    if (pin.on) return;
    const max = pin.track.scrollWidth - pin.track.clientWidth;
    pin.meter?.style.setProperty("--hm", max > 0 ? Math.max(0.08, pin.track.scrollLeft / max).toFixed(3) : "1");
  }, { passive: true });
  // teclado (Tab) dentro da seção presa: leva a página até o cartão focado
  pin.track.addEventListener("focusin", (e) => {
    if (!pin.on || !focusVisible(e.target)) return;
    const card = e.target.closest(".card");
    if (!card) return;
    const p = clamp01((card.offsetLeft - 24) / pin.dist);
    scrollToY(pin.top + (p * pin.dist) / PIN_SPEED, { immediate: true });
  });
  // setas do teclado no carrossel preso: a página rola e os cartões andam
  pin.track.addEventListener("keydown", (e) => {
    if (!pin.on || e.target !== pin.track) return;
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    scrollHighlightsBy(dir);
  });
  // o carrossel é redesenhado (tamanho escolhido, cardápio carregado): mede de novo
  new MutationObserver(() => requestAnimationFrame(measure)).observe(pin.track, { childList: true });
  PIN_MEDIA.addEventListener?.("change", measure);
}

/* ---------- "Sobre": palavras que acendem com a rolagem ---------- */
function splitPaint(el) {
  let i = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/).filter(Boolean);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part.trim()) { frag.append(part); continue; }
          const w = document.createElement("span");
          w.className = "pw";
          w.style.setProperty("--i", i++);
          w.textContent = part;
          frag.append(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
    }
  };
  walk(el);
  el.style.setProperty("--pn", i);
}

/* ---------- Contadores ---------- */
const counting = new Set();
let countIO = null;
const easeOut = (t) => 1 - Math.pow(1 - t, 4);

/** Troca o número final de um contador (ex.: quando o cardápio carrega). */
export function setCount(el, value) {
  if (!el) return;
  el.dataset.to = String(value);
  if (!el.dataset.counting) el.textContent = String(value);
}

function startCount(el, delay = 0) {
  const to = parseInt(el.dataset.to ?? el.textContent, 10);
  if (!Number.isFinite(to) || to <= 0 || motion.reduced) return;
  el.dataset.to = String(to);
  // o "0" só aparece no primeiro quadro: aba em segundo plano (sem quadros) continua mostrando o número certo
  counting.add({ el, t: -delay, dur: Math.min(1.8, 0.9 + to / 80) });
  ticker.wake();
}

function countTick(f) {
  if (!counting.size) return false;
  for (const c of counting) {
    c.t += f.dt;
    if (!c.el.dataset.counting) { c.el.dataset.counting = "1"; c.el.textContent = "0"; }
    if (c.t < 0) continue;
    const to = parseInt(c.el.dataset.to, 10) || 0;
    const k = motion.reduced ? 1 : easeOut(Math.min(1, c.t / c.dur));
    c.el.textContent = String(Math.round(to * k));
    if (k >= 1) { counting.delete(c); delete c.el.dataset.counting; c.el.textContent = String(to); }
  }
  return counting.size > 0;
}

function initCounters() {
  const els = [...document.querySelectorAll("[data-count]")];
  if (!els.length || motion.reduced || !("IntersectionObserver" in window)) return;
  const intro = root.classList.contains("intro") ? 1.05 : 0;
  countIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    countIO.unobserve(e.target);
    startCount(e.target, e.target.closest(".hero") ? intro + 0.2 : 0.1);
  }), { threshold: 0.6 });
  els.forEach((el) => countIO.observe(el));
  ticker.add(countTick);
}

/* ---------- Tom do fundo por seção ---------- */
function initZones() {
  if (!("IntersectionObserver" in window)) return;
  const ids = ["hero", "destaques", "cardapio", "como-funciona", "sobre", "contato"];
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) root.dataset.zone = e.target.id;
  }), { rootMargin: "-48% 0px -48% 0px" });
  ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
}

/* ---------- Divisores sem animation-timeline: desenham ao aparecer ---------- */
function initDividers() {
  const els = document.querySelectorAll(".divider");
  if (viewTimeline || motion.reduced || !("IntersectionObserver" in window)) { if (!viewTimeline) els.forEach((d) => d.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -15% 0px" });
  els.forEach((d) => io.observe(d));
}

/* ---------- Início ---------- */
export function initReveal() {
  // aparelho modesto ou economia de dados: menos brilho/blur/granulado
  const conn = navigator.connection;
  const lite = !!conn?.saveData || ((navigator.hardwareConcurrency || 8) <= 4 && window.innerWidth < 900);
  root.classList.toggle("lite", lite);

  hero.el = document.getElementById("hero");
  hdr.el = document.getElementById("siteHeader");
  hdr.nav = document.getElementById("mobileNav");
  spark = document.getElementById("scrollSpark");
  story.track = document.querySelector(".steps-track");
  story.line = story.track?.querySelector(".steps-line") || null;
  story.steps = story.track ? [...story.track.querySelectorAll(".step")] : [];
  paint.el = document.querySelector("[data-paint]");
  if (paint.el && !motion.reduced) splitPaint(paint.el);

  initNavInk();
  initPin();
  initCounters();
  initZones();
  initDividers();

  measure();
  window.addEventListener("resize", measure, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
  window.addEventListener("load", measure);
  document.fonts?.ready.then(measure);
  onReducedMotion((r) => {
    if (r) {
      hero.el?.style.removeProperty("--hp");
      paint.el?.style.setProperty("--pp", "1");
      setHidden(false);
    }
    measure();
  });
  ticker.add(tick);
}
