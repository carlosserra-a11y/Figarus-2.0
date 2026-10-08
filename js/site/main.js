/* ============================================================
   FIGARO'S PIZZARIA — ponto de entrada do site
   ============================================================ */
import { html, $, $$, setHTML, brl, starsHtml, icons } from "./util.js";
import { loadMenu, state as apiState } from "./api.js";
import { indexMenu, storeStatus, priceItem } from "../shared/pricing.js";
import { cart } from "./cart.js";
import { initMenu, sizeOf } from "./menu-view.js";
import { initBuilder, openBuilder } from "./builder.js";
import { initCheckout, openCart, renderCartBadge, onStoreStatusChange } from "./checkout.js";
import { initOrders } from "./orders.js";
import { initBackgroundFx, initFloaters, initMagnetic, observeReveal, flyToCart, toast, disableFlour } from "./fx.js";
import { closeLayer } from "./dialog.js";
import { initScrollFx, getStoryProgress } from "./scrollfx.js";
import { ticker, initSmoothScroll, scrollToTarget, initFpsMeter } from "./motion.js";
import { icon } from "./icons.js";
// Figaro's 2.0 — "Futurismo Quente"
import { initTheme } from "./theme.js";
import { initIntro } from "./preloader.js";
import { initReveal, setCount } from "./reveal.js";
import { initPointerFx, haptic } from "./cursor.js";

const PARAMS = new URLSearchParams(location.search);

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Ícones marcados no HTML (data-icon) — desenhados em traço, iguais em qualquer aparelho. */
function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = String(icon(el.dataset.icon));
    el.removeAttribute("data-icon");
  });
}

/* ---------- Header, menu mobile e navegação ativa ---------- */
function initChrome() {
  hydrateIcons();
  // a dica "arraste pra girar" some depois que a pessoa mexe na pizza
  const hv = $("#heroVisual");
  hv?.addEventListener("pointerdown", () => hv.classList.add("touched"), { once: true });
  const header = $("#siteHeader");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Âncoras (#cardapio, #contato…) rolam suave e param no lugar certo, abaixo do header fixo
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains("skip-link") || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = decodeURIComponent(a.getAttribute("href").slice(1));
    const target = /^[\w-]+$/.test(id) ? document.getElementById(id) : null; // ignora #pedido/CODIGO
    if (!target) return;
    e.preventDefault();
    scrollToTarget(target);
    if (location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
    // pelo teclado (Enter no link): o foco vai junto para a seção, como numa âncora comum
    if (e.detail === 0) {
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  });

  const toggle = $("#menuToggle"), nav = $("#mobileNav");
  const setMenu = (open) => { toggle.setAttribute("aria-expanded", String(open)); nav.hidden = !open; toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu"); };
  toggle.addEventListener("click", () => setMenu(nav.hidden));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("click", (e) => { if (!nav.hidden && !e.target.closest("#siteHeader")) setMenu(false); });
  window.addEventListener("resize", () => { if (window.innerWidth > 1080) setMenu(false); });

  const links = $$(".main-nav a");
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const hero = document.querySelector(".hero");
  const navSpy = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    // de volta ao topo: nenhum item fica marcado (antes ficava preso no último visitado)
    const id = e.target === hero ? "" : e.target.id;
    links.forEach((a) => a.classList.toggle("active", !!id && a.getAttribute("href") === `#${id}`));
  }), { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => navSpy.observe(s));
  if (hero) navSpy.observe(hero);

  // Animações CSS longas (selo girando, vapor, logo flutuando) param quando a seção sai da tela
  if ("IntersectionObserver" in window) {
    const off = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle("is-offscreen", !e.isIntersecting)), { rootMargin: "100px" });
    document.querySelectorAll(".hero, .about").forEach((el) => off.observe(el));
  }

  $("#cartBtn").addEventListener("click", openCart);
  $("#floatingCart").addEventListener("click", openCart);
  $("#year").textContent = new Date().getFullYear();

  // Mapa só carrega quando a pessoa pede (mais rápido e sem rastreamento à toa)
  $("#mapLoad").addEventListener("click", function () {
    const q = this.dataset.q || "Figaro's Pizzaria, Av. Elza Lucchi, 1277 - Palhoça, SC";
    const iframe = document.createElement("iframe");
    iframe.title = "Mapa da Figaro's Pizzaria";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    this.replaceWith(iframe);
  });

  // Imagens que falharem viram um fundo neutro (sem quebrar o layout)
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || img.dataset.failed) return;
    img.dataset.failed = "1";
    img.src = "assets/img/placeholder.webp";
  }, true);
}

/* ---------- Status aberto/fechado (atualiza a cada minuto) ---------- */
function renderStatus(menu) {
  const status = menu.status || storeStatus(menu.store);
  const pill = $("#statusPill");
  pill.dataset.open = String(status.open);
  setHTML(pill, html`<i></i><span>${status.label}${status.detail ? ` · ${status.detail}` : ""}</span>`);
  pill.title = `${status.label}${status.detail ? " — " + status.detail : ""}`;
  const today = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(new Date());
  const todayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(today);
  setHTML($("#hoursTable tbody"), [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const h = (menu.store.hours || []).find((x) => x.day === d);
    return html`<tr class="${d === todayIdx ? "today" : ""}"><td>${DAYS[d]}${d === todayIdx ? " (hoje)" : ""}</td><td>${!h || h.closed ? "Fechado" : `${h.open} às ${h.close}`}</td></tr>`;
  }));
}

/* ---------- Dados da loja (contato, avaliações) — desenhados uma vez ---------- */
function renderStore(menu) {
  const s = menu.store;
  renderStatus(menu);

  if (s.announcement) { const a = $("#announcement"); a.textContent = s.announcement; a.hidden = false; }
  if (s.address) { $("#storeAddress").textContent = s.address; $("#footerAddress").textContent = s.address; }
  if (s.phone) {
    const tel = $("#storePhone");
    tel.textContent = s.phone;
    tel.href = `tel:+55${s.phone.replace(/\D/g, "")}`;
    $("#footerPhone").textContent = s.phone;
  }
  if (s.whatsapp) $("#whatsBtn").href = `https://wa.me/${s.whatsapp}`;
  if (s.mapsQuery) {
    $("#directionsBtn").href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.mapsQuery)}`;
    $("#mapLoad").dataset.q = s.mapsQuery;
  }
  if (s.lunchInfo) setHTML($("#lunchInfo"), html`${icon("plate")}<span>${s.lunchInfo}</span>`);
  if (s.tagline) $("#footerTagline").textContent = `${s.tagline}. Delivery, retirada, rodízio e buffet.`;
  if (Array.isArray(s.payments) && s.payments.length) setHTML($("#payTags"), s.payments.map((p) => html`<li>${p}</li>`));
  const socials = [];
  if (s.instagram) socials.push(html`<a href="${s.instagram}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${icons.insta}</a>`);
  if (s.facebook) socials.push(html`<a href="${s.facebook}" target="_blank" rel="noopener noreferrer" aria-label="Facebook">${icons.face}</a>`);
  if (s.whatsapp) socials.push(html`<a href="https://wa.me/${s.whatsapp}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${icons.whats}</a>`);
  setHTML($("#socials"), socials);

  const savory = (menu.flavors || []).filter((f) => f.productId === "pizza-salgada").length;
  if (savory) setCount($("#flavorCount"), savory);
  renderStats(menu);

  if (s.rating) {
    const r = $("#heroRating");
    r.hidden = false;
    setHTML(r, html`${starsHtml(s.rating)} <span>${String(s.rating).replace(".", ",")}${s.ratingCount ? ` · +${s.ratingCount} avaliações` : ""}</span>`);
  }
  if ((menu.testimonials || []).length) {
    $("#avaliacoes").hidden = false;
    setHTML($("#reviewsGrid"), menu.testimonials.map((t) => html`<figure class="review reveal">${starsHtml(t.rating || 5)}<p>“${t.text}”</p><figcaption class="who">${t.name}${t.source ? html` <small style="color:var(--ink-3)">· ${t.source}</small>` : ""}</figcaption></figure>`));
    if (s.rating) setHTML($("#ratingBig"), html`<span class="num">${String(s.rating).replace(".", ",")}</span><div>${starsHtml(s.rating)}<div style="font-weight:800;color:var(--ink-2)">${s.ratingCount ? `+${s.ratingCount} avaliações` : ""}</div></div>`);
  }
}

/* ---------- Números da casa (seção "Sobre"): vêm do cardápio ---------- */
function renderStats(menu) {
  const flavors = menu.flavors || [];
  const sizes = (menu.products || []).filter((p) => p.kind === "pizza").flatMap((p) => p.sizes || []);
  const biggest = sizes.reduce((a, b) => ((b.cm || 0) > (a?.cm || 0) ? b : a), null);
  const values = {
    savory: flavors.filter((f) => f.productId === "pizza-salgada").length,
    sweet: flavors.filter((f) => f.productId === "pizza-doce").length,
    flavors: Math.max(0, ...sizes.map((s) => s.maxFlavors || 1)),
    slices: biggest?.slices || 0,
  };
  $$("#stats [data-stat]").forEach((el) => {
    const v = values[el.dataset.stat];
    if (v > 0) setCount(el, v);
    else el.closest("li").hidden = true;
  });
}

function renderMarquee(menu) {
  const names = (menu.flavors || []).filter((f) => f.productId === "pizza-salgada" || f.popular).map((f) => f.name);
  const pick = [...new Set(names)].slice(0, 24);
  const track = $("#marqueeTrack");
  const row = pick.map((n) => html`<span>${n}</span>`);
  setHTML(track, html`${row}${row}`);
}

/* ---------- Início ---------- */
async function start() {
  initIntro();
  initTheme();
  initChrome();
  initSmoothScroll();
  if (PARAMS.has("fps")) initFpsMeter();
  initBackgroundFx();
  initFloaters();
  initMagnetic();
  observeReveal();
  initScrollFx();
  initReveal();
  initPointerFx();

  let menu;
  try {
    menu = await loadMenu();
  } catch {
    setHTML($("#menuBody"), html`<div class="empty">${icon("oven", { cls: "big" })}Não conseguimos carregar o cardápio agora.<br><button type="button" class="btn btn-primary" style="margin-top:14px" id="retryMenu">Tentar de novo</button></div>`);
    $("#retryMenu").addEventListener("click", () => location.reload());
    return;
  }
  const idx = indexMenu(menu);
  cart.setMenuIndex(idx);
  renderStore(menu);
  renderMarquee(menu);

  // "+" do cardápio: bebida, ou pizza já no tamanho escolhido (com a borda que vem inclusa)
  const quickAdd = (sel, cardEl) => {
    const r = priceItem(idx, sel);
    if (!r.ok) return toast(r.errors[0], "err");
    cart.add(sel);
    haptic();
    flyToCart(cardEl?.querySelector("img")?.currentSrc, cardEl);
    toast(`${r.title} no carrinho!`, "ok");
  };
  const onAdded = (sel, { editKey }) => { haptic(); return editKey ? cart.replace(editKey, sel) : cart.add(sel); };

  initBuilder(idx, { onAdded });
  initMenu(idx, { onOpen: openBuilder, onQuickAdd: quickAdd });
  initCheckout(idx, menu, { openBuilder });
  initOrders(idx);
  renderCartBadge();
  observeReveal();

  $("#heroBuildBtn").addEventListener("click", () => {
    const pizza = [...idx.products.values()].find((p) => p.kind === "pizza" && (p.sizes || []).some((s) => (s.maxFlavors || 1) > 1));
    if (pizza) openBuilder({ productId: pizza.id, sizeId: sizeOf(pizza)?.id });
  });

  // Deep links: #pedido/CODIGO abre o acompanhamento
  const m = location.hash.match(/^#pedido\/([A-Za-z0-9]{6})$/);
  if (m && apiState.online) import("./orders.js").then((o) => o.openOrders(m[1].toUpperCase()));

  // Atualiza o status (aberto/fechado) a cada minuto
  setInterval(() => {
    const was = menu.status?.open;
    menu.status = storeStatus(menu.store);
    renderStatus(menu);
    if (was !== menu.status.open) onStoreStatusChange();
  }, 60_000);

  // Modelos 3D: carregados depois que a página já está na tela (não atrasam o cardápio)
  if (!PARAMS.has("no3d")) load3D();

  window.addEventListener("pageshow", (e) => { if (e.persisted) renderCartBadge(); });
  window.FIGAROS = { closeAll: () => $$(".layer:not([hidden])").forEach((l) => closeLayer(l)) };
}

function load3D() {
  const go = () => import("./3d.js")
    .then((m) => {
      const r = m.init3D({
        hero: $("#heroVisual"),
        box: $("#box3d"),
        background: $("#bgCanvas"),
        photoUrl: new URL("assets/img/hero-pizza.webp", document.baseURI).href,
        logoUrl: new URL("assets/img/logo-lid.webp", document.baseURI).href,
        ticker,
        storyProgress: getStoryProgress,
        covers: [$("#sobre")],
        quality: PARAMS.get("quality"),
        onBackground: disableFlour,
      });
      document.documentElement.classList.toggle("has-3d", r.enabled);
    })
    .catch((e) => console.warn("3D indisponível:", e));
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 1500 });
  else setTimeout(go, 400);
}

start();

// Service worker: imagens salvas no aparelho e o site abre até sem internet (?nosw desliga)
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost") && !PARAMS.has("nosw")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
