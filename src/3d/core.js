/* ============================================================
   Núcleo 3D:
   - nível do aparelho (sem criar contexto WebGL extra só para testar)
   - laço de animação compartilhado com o site (js/site/motion.js)
   - "palco": UM renderer para o topo e a caixa (nunca aparecem juntos)
   - medidas de seção em cache (nada de getBoundingClientRect por quadro)
   - qualidade adaptativa, pausa com modal aberto, perda/recuperação de contexto
   ============================================================ */
import {
  WebGLRenderer, SRGBColorSpace, ACESFilmicToneMapping, PCFShadowMap, PMREMGenerator,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const rmQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
export const prefersReducedMotion = () => rmQuery.matches;

/** Detecta se dá para usar WebGL e qual qualidade (override: "low" | "high"). */
export function detectTier(override) {
  if (!("WebGLRenderingContext" in window)) return null;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const small = Math.min(screen.width, screen.height) < 700;
  const saveData = !!navigator.connection?.saveData;
  // Só rebaixa quem é fraco de verdade; o resto é ajustado medindo os quadros (veja adaptiveQuality)
  let low = saveData || cores <= 2 || mem <= 2 || (small && cores <= 4 && mem <= 3);
  if (override === "low") low = true;
  else if (override === "high") low = false;
  return {
    low,
    small,
    maxDpr: low ? 1.25 : small ? 1.75 : 2,
    bgDpr: low ? 1 : 1.25,
    shadows: !low,
    shadowSize: low ? 512 : 1024,
    texSize: low || small ? 512 : 1024,
    idleFps: low ? 24 : 30,
  };
}

/** Devolve a vez ao navegador (a inicialização do 3D é feita em pedaços, sem travar a rolagem). */
export const yieldToMain = () => new Promise((r) => (globalThis.scheduler?.yield ? globalThis.scheduler.yield().then(r) : setTimeout(r, 0)));

/* ---------- Laço compartilhado ---------- */
const scenes = new Set();
let host = null;
let paused = false;

function tickAll(f) {
  if (paused) return false;
  let busy = false;
  for (const s of scenes) {
    if (!s.active || s.dead) continue;
    try { if (s.tick(f.dt, f.t, f) !== false) busy = true; } catch (e) { console.error("[3D]", e); s.fail?.(e); }
  }
  return busy;
}

/** Usa o laço do site; sem ele, cria um laço mínimo próprio. */
export function useTicker(ticker) {
  if (host) return;
  if (ticker) { host = ticker; ticker.add(tickAll); return; }
  const f = { t: 0, dt: 1 / 60, y: window.scrollY, vel: 0, vw: window.innerWidth, vh: window.innerHeight };
  let raf = 0, last = 0;
  const loop = (now) => {
    if (last && now <= last) return; // repetido no mesmo quadro (wake() durante o quadro): ignora
    raf = 0;
    f.dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now; f.t = now / 1000;
    const y = window.scrollY; f.vel += ((y - f.y) / f.dt - f.vel) * Math.min(1, f.dt * 8); f.y = y;
    if (!Number.isFinite(f.vel)) f.vel = 0;
    f.vw = window.innerWidth; f.vh = window.innerHeight;
    // um único próximo quadro (antes podiam ser dois, e eles se multiplicavam)
    if (tickAll(f) && !document.hidden) { if (!raf) raf = requestAnimationFrame(loop); } else if (!raf) last = 0;
  };
  host = { wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(loop); } };
  window.addEventListener("scroll", host.wake, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) host.wake(); });
}
export const wake = () => host?.wake();

/** Pausa tudo (ex.: carrinho ou produto aberto por cima da página). */
export function setPaused(v) { paused = v; if (!v) wake(); }

/**
 * Registra uma cena. `tick(dt, time, frame)` desenha um quadro (retorna false se não precisa de mais).
 * Com `el`, a cena só roda enquanto o elemento estiver perto da tela.
 */
export function registerScene(scene, el, { margin = "200px" } = {}) {
  scenes.add(scene);
  scene.active = false;
  if (el && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(([e]) => { scene.visible = e.isIntersecting; scene.active = scene.visible && !scene.dead; scene.onVisible?.(scene.visible); if (scene.active) wake(); }, { rootMargin: margin });
    io.observe(el);
  } else {
    scene.visible = true;
    scene.active = !scene.dead;
    wake();
  }
}

/* ---------- Medidas em cache (lidas só quando o layout muda) ---------- */
const tracked = new Set();
let bodyRO = null;
function measureBox(b) { const r = b.el.getBoundingClientRect(); b.top = r.top + window.scrollY; b.height = r.height || 1; }
/** Posição de um elemento na página, atualizada em resize/mudança de altura (sem custo por quadro). */
export function trackElement(el) {
  const box = { el, top: 0, height: 1 };
  measureBox(box);
  tracked.add(box);
  if (!bodyRO) {
    const all = () => tracked.forEach(measureBox);
    window.addEventListener("resize", all, { passive: true });
    if ("ResizeObserver" in window) { bodyRO = new ResizeObserver(all); bodyRO.observe(document.body); }
    else bodyRO = true;
  }
  if ("ResizeObserver" in window) new ResizeObserver(() => measureBox(box)).observe(el);
  return box;
}

/* ---------- Renderer ---------- */
export function createRenderer(canvas, { antialias = true, alpha = true, shadows = false, dpr = 2 } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias, alpha, powerPreference: "high-performance", premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dpr));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if (alpha) renderer.setClearColor(0x000000, 0);
  if (shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
  }
  return renderer;
}

/** Iluminação de estúdio (reflexos realistas em queijo, azeitona, tomate…). Gerada uma vez por renderer. */
export function studioEnvironment(renderer) {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  room.dispose?.();
  return env;
}

/** Se o navegador derrubar o WebGL, volta para a versão 2D; se devolver, religa. */
export function guardContext(renderer, { onLost, onRestored }) {
  renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); onLost?.(); });
  renderer.domElement.addEventListener("webglcontextrestored", () => { onRestored?.(); wake(); });
}

/**
 * Qualidade adaptativa: mede os quadros enquanto há animação e, se ficar abaixo
 * de ~45 fps, rebaixa em degraus (resolução, sombras, quantidade de objetos).
 */
export function adaptiveQuality(onStep, { maxLevel = 3 } = {}) {
  let n = 0, sum = 0, level = 0, warm = 2.5;
  return (dt) => {
    if (level >= maxLevel || document.hidden) return;
    if (warm > 0) { warm -= dt; return; }
    sum += dt; n++;
    if (n < 90) return;
    const avg = sum / n;
    n = 0; sum = 0;
    if (avg > 1 / 45) { level++; warm = 2; onStep(level); }
  };
}

/* ---------- Palco: um renderer para o topo e a caixa ---------- */
export function createStage(tier) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  let dpr = Math.min(window.devicePixelRatio || 1, tier.maxDpr);
  const renderer = createRenderer(canvas, { antialias: !tier.low, shadows: tier.shadows, dpr });
  const entries = [];
  const stage = { renderer, canvas, env: null, current: null, aspect: 1, dead: false, sizeVersion: 0 };
  // o ambiente PBR é gerado num pedaço separado (ele compila shaders e desenha na GPU)
  stage.envReady = yieldToMain().then(() => { stage.env = studioEnvironment(renderer); });

  // tamanho do PRÓPRIO canvas (ele é maior que o container no CSS — antes ficava esticado e borrado)
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    stage.aspect = w / h;
    stage.sizeVersion++;
    wake();
  };
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);

  function show(entry) {
    if (stage.current === entry) return;
    stage.current = entry;
    entry.container.appendChild(canvas);
    canvas.className = entry.cls;
    resize();
    entries.forEach((e) => e.container.classList.toggle("is-3d", e === entry && e.ready && !stage.dead));
  }
  function pick() {
    const vis = entries.filter((e) => e.visible && e.ready);
    if (!vis.length) return;
    if (vis.length === 1) return show(vis[0]);
    // dois perto da tela (tela muito alta): fica com o mais próximo do centro
    const mid = window.innerHeight / 2;
    vis.sort((a, b) => Math.abs(a.container.getBoundingClientRect().top - mid) - Math.abs(b.container.getBoundingClientRect().top - mid));
    show(vis[0]);
  }

  stage.add = (entry) => {
    entries.push(entry);
    const sc = entry.scene;
    const baseTick = sc.tick;
    sc.tick = (dt, t, f) => (stage.current === entry && !stage.dead ? baseTick(dt, t, f) : false);
    sc.onVisible = (v) => { entry.visible = v; pick(); };
    registerScene(sc, entry.container, { margin: "250px" });
  };
  stage.markReady = (entry) => { entry.ready = true; pick(); if (stage.current === entry) entry.container.classList.add("is-3d"); };
  /** Desenha a cena; ajusta a câmera se o palco mudou de tamanho. */
  stage.render = (scene, camera) => {
    if (camera.userData.sizeVersion !== stage.sizeVersion) {
      camera.aspect = stage.aspect;
      camera.updateProjectionMatrix();
      camera.userData.sizeVersion = stage.sizeVersion;
    }
    renderer.render(scene, camera);
  };
  stage.setDpr = (v) => { dpr = Math.max(1, Math.min(v, window.devicePixelRatio || 1)); resize(); };
  stage.quality = adaptiveQuality((level) => {
    if (level === 1) stage.setDpr(dpr - 0.25);
    else if (level === 2) { renderer.shadowMap.enabled = false; entries.forEach((e) => e.scene.dropShadows?.()); stage.setDpr(dpr - 0.25); }
    else stage.setDpr(1);
  });

  guardContext(renderer, {
    onLost() { stage.dead = true; entries.forEach((e) => e.container.classList.remove("is-3d")); },
    onRestored() { stage.dead = false; pick(); if (stage.current?.ready) stage.current.container.classList.add("is-3d"); },
  });
  return stage;
}

/* ---------- Matemática ---------- */
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
/** Aproximação suave e independente de FPS. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
/** Mola (com leve balanço): devolve o novo estado { x, v }. */
export function spring(st, target, dt, k = 120, c = 14) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) { const a = (target - st.x) * k - st.v * c; st.v += a * h; st.x += st.v * h; }
  return st;
}
