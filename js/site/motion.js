/* ============================================================
   Movimento do site:
   - UM laço (requestAnimationFrame) para todas as animações: parallax,
     faixa de sabores, brasas, 3D… (antes eram 6 laços disputando o quadro)
   - o laço dorme quando nada se mexe (página parada = processador livre)
   - rolagem suave com Lenis, só com mouse/trackpad (no toque, a nativa)
   - "reduzir movimento" acompanhado em tempo real
   ============================================================ */

const rmQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
export const motion = { reduced: rmQuery.matches };
const rmListeners = new Set();
rmQuery.addEventListener?.("change", () => {
  motion.reduced = rmQuery.matches;
  document.documentElement.classList.toggle("rm", motion.reduced);
  rmListeners.forEach((fn) => fn(motion.reduced));
  if (motion.reduced && lenis) {
    lenis.destroy();
    lenis = null;
    document.documentElement.classList.remove("has-lenis");
  }
  wake();
});
document.documentElement.classList.toggle("rm", motion.reduced);
export const onReducedMotion = (fn) => rmListeners.add(fn);

/* ---------- Laço único ---------- */
const subs = new Set();
/** Estado compartilhado do quadro (lido uma vez por quadro, sem forçar layout). */
export const frame = { t: 0, dt: 1 / 60, y: window.scrollY, vel: 0, vw: window.innerWidth, vh: window.innerHeight };
let raf = 0, last = 0, lenis = null;
// relógio contínuo para o Lenis: depois de um tempo parado, ele não recebe um "salto" de segundos
// (senão o primeiro giro da rodinha pulava sem suavidade)
let lenisTime = 0;

function loop(now) {
  // Segunda chamada no mesmo quadro: ignora. (Antes, quem chamava wake() durante o quadro — o Lenis avisa
  // "rolei" no meio dele — agendava um laço e o fim do quadro agendava OUTRO: a cada quadro o número de laços
  // dobrava (1, 2, 4, 8…) até a página travar na rolagem suave; e com dt = 0 a velocidade virava NaN.)
  if (last && now <= last) return;
  raf = 0;
  frame.dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
  last = now;
  frame.t = now / 1000;
  if (lenis) { lenisTime += frame.dt * 1000; lenis.raf(lenisTime); }
  const y = window.scrollY;
  frame.vel += ((y - frame.y) / frame.dt - frame.vel) * Math.min(1, frame.dt * 8);
  if (!Number.isFinite(frame.vel)) frame.vel = 0;
  frame.y = y;
  let busy = Math.abs(frame.vel) > 1 || !!lenis?.isScrolling;
  for (const fn of subs) {
    try { if (fn(frame)) busy = true; } catch (e) { console.error("[animação]", e); subs.delete(fn); }
  }
  // um único próximo quadro (wake() pode já ter agendado durante este)
  if (busy && !document.hidden) { if (!raf) raf = requestAnimationFrame(loop); }
  else if (!raf) { last = 0; frame.vel = 0; }
}

/** Acorda o laço (rolagem, ponteiro, algo novo para animar). */
export function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(loop); }

/** Inscreve uma função `fn(frame)` que roda a cada quadro; retorne true para pedir o próximo quadro. */
export const ticker = {
  add(fn) { subs.add(fn); wake(); return () => subs.delete(fn); },
  wake,
};

const measureViewport = () => { frame.vw = window.innerWidth; frame.vh = window.innerHeight; };
window.addEventListener("scroll", wake, { passive: true });
window.addEventListener("wheel", wake, { passive: true });
window.addEventListener("resize", () => { measureViewport(); wake(); }, { passive: true });
document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });

/* ---------- Camadas (modais/gavetas) ---------- */
let layersOpen = false;
document.addEventListener("figaros:layers", (e) => {
  layersOpen = !!e.detail?.open;
  if (!lenis) return;
  layersOpen ? lenis.stop() : lenis.start();
});

/* ---------- Rolagem suave ---------- */
export async function initSmoothScroll() {
  const params = new URLSearchParams(location.search);
  if (motion.reduced || params.has("nosmooth") || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return null;
  try {
    const { default: Lenis } = await import("../vendor/lenis.mjs");
    lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: false,
      allowNestedScroll: true, // gavetas, modais e carrosséis continuam rolando sozinhos
      prevent: (node) => node.classList?.contains("layer"),
    });
    lenis.on("scroll", wake);
    if (layersOpen) lenis.stop();
    document.documentElement.classList.add("has-lenis");
    wake();
  } catch (e) {
    console.warn("Rolagem suave indisponível:", e);
  }
  return lenis;
}

/** Margem do topo para âncoras (header fixo + folga). */
function anchorOffset(el) {
  const own = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  if (own) return own;
  return parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
}

/** Rola a página até um elemento (suave quando possível), respeitando o header fixo. */
export function scrollToTarget(el, { offset } = {}) {
  if (!el) return;
  const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - (offset ?? anchorOffset(el)));
  if (lenis) {
    const dist = Math.abs(top - window.scrollY);
    lenis.scrollTo(top, { duration: Math.min(1.6, Math.max(0.6, dist / 2600)), easing: (t) => 1 - Math.pow(1 - t, 4) });
    wake(); // o laço pode estar dormindo (página parada): sem isso a rolagem não anda
  } else {
    window.scrollTo({ top, behavior: motion.reduced ? "auto" : "smooth" });
  }
}

/** Rola a página até uma posição (suave quando possível; `immediate` vai direto). */
export function scrollToY(top, { immediate = false } = {}) {
  top = Math.max(0, top);
  if (lenis) {
    const dist = Math.abs(top - window.scrollY);
    lenis.scrollTo(top, immediate ? { immediate: true, force: true } : { duration: Math.min(1.2, Math.max(0.5, dist / 2600)), easing: (t) => 1 - Math.pow(1 - t, 4) });
    wake();
  } else {
    window.scrollTo({ top, behavior: immediate || motion.reduced ? "auto" : "smooth" });
  }
}

/** Volta a página para uma posição na hora (ex.: depois de redesenhar o cardápio). */
export function restoreScroll(y) {
  if (lenis) { lenis.scrollTo(y, { immediate: true, force: true }); wake(); }
  else window.scrollTo({ top: y, behavior: "instant" });
}

/* ---------- Medidor de FPS (?fps na URL) ---------- */
export function initFpsMeter() {
  const el = document.createElement("div");
  el.className = "fps-meter";
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  let n = 0, acc = 0, worst = 0;
  ticker.add((f) => {
    n++; acc += f.dt; worst = Math.max(worst, f.dt);
    if (acc >= 0.5) {
      el.textContent = `${Math.round(n / acc)} fps · pior ${Math.round(worst * 1000)} ms`;
      n = 0; acc = 0; worst = 0;
    }
    return true; // mantém o laço acordado para medir
  });
}
