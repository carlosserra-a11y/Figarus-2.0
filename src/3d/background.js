/* ============================================================
   Fundo 3D da página: ingredientes flutuando em profundidade.
   - a câmera desce junto com a rolagem (parallax de verdade)
   - cada ingrediente GIRA conforme a página desce (rolou, girou) e, na
     rolagem rápida, fica um pouco para trás e se afasta para as laterais,
     voltando com mola — como se boiasse
   - nada nasce atrás do título do topo: eles aparecem a partir da 2ª tela
   - o cursor (ou o dedo) afasta os ingredientes próximos, que voltam com mola
   - clique/toque numa área vazia solta uma nuvem de farinha
   - farinha no ar animada na GPU (nada recalculado na CPU por quadro)
   - desenha a 60 fps só quando algo muda; parada, ~30 fps; escondido
     atrás da seção escura "Sobre" ou com modal aberto, não desenha
   ============================================================ */
import {
  PerspectiveCamera, InstancedMesh, Object3D, Fog, Color, DirectionalLight, HemisphereLight,
  Points, BufferGeometry, Float32BufferAttribute, PointsMaterial, ShaderMaterial, Scene, Euler, Quaternion, Vector3, DynamicDrawUsage,
} from "three";
import { createRenderer, studioEnvironment, registerScene, guardContext, damp, wake, prefersReducedMotion, trackElement, adaptiveQuality, yieldToMain } from "./core.js";
import { INGREDIENTS, loadIngredientTextures } from "./ingredients.js";
import { softSprite } from "./textures.js";

const FOV = 35;
const CAM_Z = 12;
const BURST = 56;

const FLOUR_VERT = /* glsl */`
  attribute vec4 seed; // x, y (0–1), profundidade z, fase
  uniform float uTime, uCamY, uHalfW, uHalfH, uDrift, uSize, uScale;
  varying float vFog;
  void main() {
    float depth = (${CAM_Z.toFixed(1)} - seed.z) / ${CAM_Z.toFixed(1)};
    float span = uHalfH * 2.0 * depth;
    float yy = mod(seed.y * span + uTime * 0.25 * (0.5 + seed.w / 6.0) + uDrift, span);
    vec3 p = vec3((seed.x * 2.0 - 1.0) * uHalfW * depth + sin(uTime * 0.3 + seed.w) * 0.2, uCamY - uHalfH * depth + yy, seed.z);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale / -mv.z;
    vFog = -mv.z;
  }`;
const FLOUR_FRAG = /* glsl */`
  uniform sampler2D map;
  uniform vec3 uColor, uFogColor;
  uniform float uOpacity, uFogNear, uFogFar;
  varying float vFog;
  void main() {
    vec4 tex = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(uColor, uOpacity) * tex;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, smoothstep(uFogNear, uFogFar, vFog));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createBackgroundScene({ canvas, tier, covers = [], onReady, onFail }) {
  const scene = new Scene();
  let dpr = Math.min(window.devicePixelRatio || 1, tier.bgDpr);
  const renderer = createRenderer(canvas, { antialias: !tier.low, dpr });
  scene.environmentIntensity = 0.9;
  // a névoa tem a cor do fundo da página (--fog-3d): creme no tema claro, carvão no escuro
  const fogHex = () => getComputedStyle(document.documentElement).getPropertyValue("--fog-3d").trim() || "#f4ecd9";
  const cream = new Color(fogHex());
  scene.fog = new Fog(cream, 13, 34);
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.z = CAM_Z;

  const sun = new DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(-4, 6, 8);
  scene.add(sun, new HemisphereLight(0xfffaf0, 0xb48a5a, 0.9));

  const coverBoxes = covers.filter(Boolean).map(trackElement);
  let worldPerPx = 0, viewW = 0, viewH = 0, docH = 0;
  const dummy = new Object3D();
  const meshes = [], items = [];
  let perKind = tier.low ? 3 : tier.small ? 4 : 6;
  let flour = null, flourMat = null, burst = null, built = false, lastRender = -1, idleFps = tier.idleFps;
  const st = { y: 0, px: 0, tx: 0, ptr: { x: 0, y: 0, on: false, last: -10 }, burstT: 9, springs: 0 };
  const now = () => performance.now() / 1000;

  /* ---------- Layout (só em resize ou quando a página muda de altura) ---------- */
  function layout(force = false) {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    const dh = Math.max(document.documentElement.scrollHeight, h);
    // celular: a barra de endereço muda a altura a cada rolagem — ignora variações pequenas só de altura
    const smallH = coarse ? Math.abs(h - viewH) < 120 : h === viewH;
    if (!force && w === viewW && smallH && Math.abs(dh - docH) < 40) return;
    viewW = w; viewH = h; docH = dh;
    renderer.setPixelRatio(dpr);
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
    worldPerPx = (2 * Math.tan((FOV * Math.PI) / 360) * CAM_Z) / viewH;
    const halfW0 = (viewW / 2) * worldPerPx, halfH0 = (viewH / 2) * worldPerPx;
    const travel = (docH - viewH) * worldPerPx; // quanto a câmera desce do topo ao fim da página
    const skip = halfH0 * 1.9; // a 1ª tela (título do topo) fica livre
    const small = viewW < 700;
    for (const it of items) {
      const depthScale = (CAM_Z - it.z) / CAM_Z; // planos mais distantes mostram uma área maior
      // laterais: deixa o centro livre para o texto; objetos mais próximos (maiores) ficam ainda mais nas bordas
      const edge = small ? 0.74 : it.z > 0 ? 0.8 : 0.66;
      it.x = it.side * halfW0 * depthScale * (edge + it.xr * (1 - edge) * 0.95);
      it.y = halfH0 * 0.8 - skip - it.lane * Math.max(0, travel + halfH0 * 1.6 - skip);
      it.size = it.scale * (small ? 0.82 : 1);
      it.reach = 150 * worldPerPx * depthScale; // raio de influência do cursor (~150 px na tela)
    }
    if (flourMat) {
      flourMat.uniforms.uHalfW.value = halfW0;
      flourMat.uniforms.uHalfH.value = halfH0;
      flourMat.uniforms.uSize.value = 0.12 * dpr;
      flourMat.uniforms.uScale.value = viewH * 0.5;
    }
    wake();
  }
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  window.addEventListener("resize", () => layout(), { passive: true });
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(() => layout());
    ro.observe(document.body);
    ro.observe(canvas);
  }

  /* ---------- Interação ---------- */
  const setPointer = (e) => {
    st.ptr.x = (e.clientX / Math.max(1, viewW)) * 2 - 1;
    st.ptr.y = -((e.clientY / Math.max(1, viewH)) * 2 - 1);
    st.ptr.on = true;
    st.ptr.last = now();
    if (e.pointerType !== "touch") st.tx = st.ptr.x;
    wake();
  };
  window.addEventListener("pointermove", setPointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { st.ptr.on = false; st.tx = 0; });
  window.addEventListener("pointerup", (e) => { if (e.pointerType === "touch") st.ptr.on = false; }, { passive: true });
  // nuvem de farinha ao clicar numa área vazia (nunca em botão, link, cartão…)
  const INTERACTIVE = "a, button, input, select, textarea, label, iframe, [role=button], [role=tab], .card, .layer, .site-header, .cat-bar, .carousel, .hero-visual, .box-stage, .floating-cart, .toast, .map-frame";
  window.addEventListener("pointerdown", (e) => {
    if (!built || e.button > 0 || e.target.closest?.(INTERACTIVE)) return;
    setPointer(e);
    spawnBurst();
  }, { passive: true });

  function pointerWorld(z) {
    const halfH = Math.tan((FOV * Math.PI) / 360) * (CAM_Z - z);
    return [camera.position.x + st.ptr.x * halfH * camera.aspect, st.y + st.ptr.y * halfH];
  }

  function spawnBurst() {
    if (!burst) return;
    const [bx, by] = pointerWorld(3);
    const pos = burst.geometry.attributes.position.array;
    for (let i = 0; i < BURST; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 2.2;
      burst.userData.v[i * 3] = Math.cos(a) * sp;
      burst.userData.v[i * 3 + 1] = Math.sin(a) * sp + 0.8;
      burst.userData.v[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      pos[i * 3] = bx; pos[i * 3 + 1] = by; pos[i * 3 + 2] = 3;
    }
    burst.userData.origin = by;
    st.burstT = 0;
    burst.visible = true;
    // os ingredientes por perto levam um "empurrão"
    for (const it of items) {
      const [px, py] = pointerWorld(it.z);
      const dx = it.x + it.ox - px, dy = it.y + it.oy - py, d = Math.hypot(dx, dy) || 1;
      if (d < it.reach * 2.2) { const k = (1 - d / (it.reach * 2.2)) * 3.2; it.vx += (dx / d) * k; it.vy += (dy / d) * k; it.kick += k * 0.8; }
    }
    wake();
  }

  /* ---------- Quadro ---------- */
  const q = new Quaternion(), e3 = new Euler();
  const quality = adaptiveQuality((level) => {
    if (level === 1) { dpr = 1; layout(true); }
    else if (level === 2) {
      perKind = Math.max(2, Math.ceil(perKind / 2));
      meshes.forEach((m) => (m.count = Math.min(m.count, perKind)));
      if (flour) flour.geometry.setDrawRange(0, Math.floor(flour.geometry.attributes.seed.count / 2));
    } else idleFps = 15;
  });

  const self = {
    tick(dt, time, f) {
      if (!built || prefersReducedMotion()) return false;
      const y = f.y;
      st.y = -y * worldPerPx;
      st.px = damp(st.px, st.tx, 2, dt);
      camera.position.set(st.px * 0.4, st.y, CAM_Z);
      camera.lookAt(st.px * 0.1, st.y, 0);

      // escondido atrás de uma seção opaca (ex.: "Sobre" escura)? não precisa desenhar
      const covered = coverBoxes.some((c) => y > c.top + 40 && y + f.vh < c.top + c.height - 40);
      const pointerLive = st.ptr.on && time - st.ptr.last < 1.5;
      const scrolling = Math.abs(f.vel) > 4;
      const lively = scrolling || pointerLive || st.springs > 0.002 || st.burstT < 1.6;
      if (covered && !lively) return false;
      if (covered) return true;

      const boost = f.vel * 0.0009;
      const vel = Math.max(-2600, Math.min(2600, f.vel));
      let springs = 0;
      const k = 7, c = 3.6, push = 9;
      for (const it of items) {
        if (it.i >= perKind) continue;
        it.rot.x += (it.spin.x + boost * it.spin.x * 3) * dt;
        it.rot.y += (it.spin.y + boost + it.kick * 0.6) * dt;
        it.rot.z += it.spin.z * dt;
        it.kick = damp(it.kick, 0, 2, dt);
        // rolagem rápida: fica um pouco para trás e é "soprado" para a lateral; parou, volta com mola
        const near = 0.55 + Math.max(0, it.z + 7.5) / 10; // mais perto da câmera = reage mais
        const lagT = -vel * 0.00034 * near, swayT = Math.abs(vel) * 0.00016 * near * it.side;
        it.lagV += ((lagT - it.lag) * 38 - it.lagV * 7.5) * dt;
        it.lag += it.lagV * dt;
        it.sway = damp(it.sway, swayT, Math.abs(swayT) > Math.abs(it.sway) ? 6 : 1.6, dt);
        // cursor afasta (mola puxa de volta)
        if (pointerLive) {
          const [px, py] = pointerWorld(it.z);
          const dx = it.x + it.ox - px, dy = it.y + it.oy - py, d = Math.hypot(dx, dy) || 1e-3;
          if (d < it.reach) { const fo = Math.pow(1 - d / it.reach, 2) * push; it.vx += (dx / d) * fo * dt; it.vy += (dy / d) * fo * dt; }
        }
        it.vx += -it.ox * k * dt; it.vy += -it.oy * k * dt;
        const fr = Math.exp(-c * dt);
        it.vx *= fr; it.vy *= fr;
        it.ox += it.vx * dt; it.oy += it.vy * dt;
        springs = Math.max(springs, Math.abs(it.vx) + Math.abs(it.vy) + Math.abs(it.ox) * 0.2 + Math.abs(it.oy) * 0.2 + Math.abs(it.lagV) * 0.5 + Math.abs(it.sway) * 0.3);
        const bob = Math.sin(time * 0.6 + it.bob) * 0.12;
        dummy.position.set(it.x + it.ox + it.sway, it.y + it.oy + bob + it.lag, it.z);
        // giro ligado à posição da rolagem: cada pixel rolado vira um pouquinho de rotação
        const sr = y * it.scrollSpin;
        q.setFromEuler(e3.set(it.rot.x + sr * 0.6, it.rot.y + sr, it.rot.z + sr * 0.35));
        dummy.quaternion.copy(q);
        dummy.scale.setScalar(it.size || it.scale);
        dummy.updateMatrix();
        it.mesh.setMatrixAt(it.i, dummy.matrix);
      }
      st.springs = springs;
      for (const m of meshes) m.instanceMatrix.needsUpdate = true;

      flourMat.uniforms.uTime.value = time;
      flourMat.uniforms.uCamY.value = st.y;
      flourMat.uniforms.uDrift.value = vel * 0.00012;

      if (st.burstT < 1.6) {
        st.burstT += dt;
        const pos = burst.geometry.attributes.position.array, v = burst.userData.v;
        const drag = Math.exp(-2.2 * dt);
        for (let i = 0; i < BURST; i++) {
          v[i * 3] *= drag; v[i * 3 + 1] = v[i * 3 + 1] * drag - 0.9 * dt; v[i * 3 + 2] *= drag;
          pos[i * 3] += v[i * 3] * dt; pos[i * 3 + 1] += v[i * 3 + 1] * dt; pos[i * 3 + 2] += v[i * 3 + 2] * dt;
        }
        burst.geometry.attributes.position.needsUpdate = true;
        burst.material.opacity = Math.max(0, 1 - st.burstT / 1.6) * 0.95;
        if (st.burstT >= 1.6) burst.visible = false;
      }

      if (!lively && time - lastRender < 1 / idleFps) return true;
      if (lively) quality(dt);
      lastRender = time;
      renderer.render(scene, camera);
      return true;
    },
    fail() { self.dead = true; self.active = false; onFail?.(); },
  };
  // trocou o tema (claro/escuro): a névoa acompanha e o fundo é redesenhado
  document.addEventListener("figaros:theme", () => {
    const c = fogHex();
    cream.set(c);
    scene.fog.color.set(c);
    lastRender = -1;
    wake();
  });
  guardContext(renderer, {
    onLost() { self.dead = true; self.active = false; onFail?.(); },
    onRestored() { self.dead = false; self.active = true; document.documentElement.classList.add("bg-3d"); },
  });

  (async () => {
    const tex = await loadIngredientTextures();
    await yieldToMain();
    scene.environment = studioEnvironment(renderer);
    await yieldToMain();
    const hq = !tier.low && !tier.small;
    for (const k of Object.keys(INGREDIENTS)) {
      const { geometry, material } = INGREDIENTS[k](tex, hq);
      const mesh = new InstancedMesh(geometry, material, perKind);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      scene.add(mesh);
      meshes.push(mesh);
      for (let i = 0; i < perKind; i++) {
        items.push({
          mesh, i,
          side: Math.random() < 0.5 ? -1 : 1,
          lane: Math.random(),          // posição vertical ao longo da página (0–1)
          z: 2.5 - Math.random() * 10,  // profundidade (mais perto = maior e mais rápido)
          scale: 0.8 + Math.random() * 0.7,
          rot: new Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
          spin: new Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4),
          bob: Math.random() * Math.PI * 2,
          xr: Math.random(),
          scrollSpin: (Math.random() < 0.5 ? -1 : 1) * (0.0008 + Math.random() * 0.0014), // rad por pixel rolado
          x: 0, y: 0, ox: 0, oy: 0, vx: 0, vy: 0, kick: 0, reach: 1, lag: 0, lagV: 0, sway: 0, size: 0,
        });
      }
    }
    // espalha as faixas verticais de forma uniforme (sem aglomerar)
    items.sort(() => Math.random() - 0.5).forEach((it, n) => { it.lane = (n + Math.random() * 0.8) / items.length; });

    // farinha no ar (posições calculadas no shader)
    const flourN = tier.low ? 140 : 320;
    const seeds = new Float32Array(flourN * 4);
    for (let i = 0; i < flourN; i++) { seeds[i * 4] = Math.random(); seeds[i * 4 + 1] = Math.random(); seeds[i * 4 + 2] = -1 - Math.random() * 16; seeds[i * 4 + 3] = Math.random() * 6; }
    const fgeo = new BufferGeometry();
    fgeo.setAttribute("position", new Float32BufferAttribute(new Float32Array(flourN * 3), 3));
    fgeo.setAttribute("seed", new Float32BufferAttribute(seeds, 4));
    flourMat = new ShaderMaterial({
      uniforms: {
        map: { value: softSprite(32, "255,250,238") },
        uColor: { value: new Color(0xfffaf0) }, uOpacity: { value: 0.85 },
        uFogColor: { value: cream }, uFogNear: { value: 13 }, uFogFar: { value: 34 },
        uTime: { value: 0 }, uCamY: { value: 0 }, uHalfW: { value: 1 }, uHalfH: { value: 1 }, uDrift: { value: 0 },
        uSize: { value: 0.12 }, uScale: { value: 400 },
      },
      vertexShader: FLOUR_VERT,
      fragmentShader: FLOUR_FRAG,
      transparent: true,
      depthWrite: false,
    });
    flour = new Points(fgeo, flourMat);
    flour.frustumCulled = false;
    scene.add(flour);

    // nuvem de farinha do clique
    const bgeo = new BufferGeometry();
    bgeo.setAttribute("position", new Float32BufferAttribute(new Float32Array(BURST * 3), 3));
    burst = new Points(bgeo, new PointsMaterial({ map: softSprite(32, "255,250,238"), size: 0.2, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, color: 0xffffff }));
    burst.userData.v = new Float32Array(BURST * 3);
    burst.frustumCulled = false;
    burst.visible = false;
    scene.add(burst);

    layout(true);
    await renderer.compileAsync?.(scene, camera).catch(() => {});
    built = true;
    onReady?.();
    wake();
  })().catch((e) => { console.warn("[3D] fundo desligado:", e); self.fail(); });

  registerScene(self, null);
  return self;
}
