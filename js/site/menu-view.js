/* ============================================================
   Cardápio — do jeito de um cardápio de balcão:
   - uma categoria por vez (abas), em vez de 100 cartões empilhados
   - pizzas: escolhe o tamanho uma vez; a tabela de cada grupo
     (tradicionais / especiais) mostra o preço — sem repetir em cada sabor
   - lista compacta com foto pequena; "+" já adiciona no tamanho escolhido
   - combos com "o que vem", esfihas por quantidade, bebidas em lista
   - busca em tudo; destaques com fotos grandes
   ============================================================ */
import { html, raw, esc, $, $$, setHTML, brl, brlC, norm, debounce, storage, finePointer } from "./util.js";
import { imgUrl, thumbUrl, photoSrcset } from "./api.js";
import { flavorsOf, minFlavorPrice, flavorPriceCents } from "../shared/pricing.js";
import { attachTilt } from "./fx.js";
import { observeCards } from "./scrollfx.js";
import { motion, scrollToTarget, ticker } from "./motion.js";
import { icon, categoryIcon } from "./icons.js";
import { scrollHighlightsBy } from "./reveal.js";

const TAG_LABELS = { frango: "Frango", carnes: "Carnes", "frutos-do-mar": "Frutos do mar", queijos: "Queijos", vegetariana: "Vegetarianas", picante: "Picantes" };
const TIER_LABELS = { tradicional: "Tradicionais", especial: "Especiais" };
const TIER_ORDER = ["tradicional", "especial"];
const STOP_WORDS = new Set(["a", "à", "o", "de", "da", "do", "com", "e", "1", "2"]);

const view = {
  idx: null,
  query: "",
  cat: null,
  filters: {},
  expanded: {},
  sizes: storage.get("fg-sizes", {}) || {},
  onOpen: null,
  onQuickAdd: null,
};

const byOrder = (a, b) => (a.sort ?? 0) - (b.sort ?? 0);
const productsOf = (cat) => [...view.idx.products.values()].filter((p) => p.categoryId === cat.id).sort(byOrder);
const isBest = (id) => !!view.idx.menu.bestSellers?.includes(id);
const fame = (item) => (isBest(item.id) ? 2 : item.popular ? 1 : 0);
const rowLimit = () => (window.matchMedia("(max-width: 760px)").matches ? 8 : 12);

/* ---------- Itens exibíveis (destaques e busca) ---------- */
function entriesForCategory(cat) {
  const out = [];
  for (const p of productsOf(cat)) {
    if (p.kind === "pizza") flavorsOf(view.idx, p.id).forEach((f) => out.push({ type: "flavor", product: p, flavor: f }));
    else if (p.kind === "units") (p.sizes || []).forEach((s) => out.push({ type: "unitsize", product: p, size: s }));
    else out.push({ type: "product", product: p });
  }
  return out;
}
const entryText = (e) => norm([e.flavor?.name, e.flavor?.description, (e.flavor?.tags || []).join(" "), e.flavor?.tier, e.product.name, e.product.description, e.size?.name].filter(Boolean).join(" "));

function categories() {
  return [...view.idx.categories.values()].sort(byOrder).filter((c) => entriesForCategory(c).length);
}
/** Quantos itens a categoria mostra (sabores, combos ou produtos). */
function countFor(cat) {
  return productsOf(cat).reduce((n, p) => n + (p.kind === "pizza" || p.kind === "units" ? flavorsOf(view.idx, p.id).length : 1), 0);
}

/* ---------- Tamanho escolhido (lembrado no aparelho) ---------- */
export function sizeOf(p) {
  const sizes = p?.sizes || [];
  const saved = view.sizes[p?.id];
  return sizes.find((s) => s.id === saved) || sizes.find((s) => s.id === "grande") || sizes[0] || null;
}
function setSize(pid, sid) {
  view.sizes[pid] = sid;
  storage.set("fg-sizes", view.sizes);
}

/** Valor mais comum (centavos) — o "preço do grupo". */
function modal(values) {
  const count = new Map();
  let best = null, n = 0;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const c = (count.get(v) || 0) + 1;
    count.set(v, c);
    if (c > n) { n = c; best = v; }
  }
  return best;
}

/** Palavras que mais aparecem nos nomes do grupo ("filé, camarão, strogonoff…"). */
function keywords(flavors, n = 4) {
  const count = new Map(), first = new Map();
  flavors.forEach((f, i) => {
    const w = String(f.name || "").split(/\s+/)[0].toLowerCase();
    if (w.length < 3 || STOP_WORDS.has(w)) return;
    count.set(w, (count.get(w) || 0) + 1);
    if (!first.has(w)) first.set(w, i);
  });
  return [...count.keys()].sort((a, b) => count.get(b) - count.get(a) || first.get(a) - first.get(b)).slice(0, n);
}

/* ---------- Cartões grandes (destaques) ---------- */
const SIZES = { carousel: "(max-width: 640px) 72vw, 280px" };

function entryPrice(e) {
  if (e.type === "flavor") {
    const size = sizeOf(e.product);
    const c = size ? flavorPriceCents(e.flavor, size.id) : null;
    if (c !== null && (e.product.sizes || []).length > 1) return { value: c / 100, prefix: size.name };
    const min = minFlavorPrice(e.flavor);
    return { value: min, prefix: Object.keys(e.flavor.prices || {}).length > 1 ? "a partir de" : "" };
  }
  if (e.type === "unitsize") return { value: e.size.price, prefix: "" };
  return { value: e.product.price, prefix: "" };
}

function cardHtml(e, i = 0, ctx = "carousel") {
  const pr = entryPrice(e);
  const priceHtml = pr.value != null ? html`<span class="price">${pr.prefix ? html`<small>${pr.prefix}</small>` : ""}${brl(pr.value)}</span>` : html`<span></span>`;
  const isFlavor = e.type === "flavor";
  const title = isFlavor ? e.flavor.name : e.type === "unitsize" ? `${e.size.name}` : e.product.name;
  const desc = isFlavor ? e.flavor.description : e.type === "unitsize" ? `${e.product.name}${e.size.includes ? " + " + e.size.includes.toLowerCase() : ""}. Escolha os sabores.` : e.product.description;
  const img = imgUrl((isFlavor ? e.flavor.image : "") || e.product.image);
  const badges = [];
  if (isFlavor && e.flavor.tier === "especial") badges.push(html`<span class="badge especial">Especial</span>`);
  if (isBest(isFlavor ? e.flavor.id : e.product.id)) badges.push(html`<span class="badge hot">${icon("flame")}Mais pedido</span>`);
  else if (isFlavor ? e.flavor.popular : e.product.popular) badges.push(html`<span class="badge green">Destaque</span>`);
  if (e.product.badge) badges.push(html`<span class="badge">${e.product.badge}</span>`);
  const quick = e.product.kind === "simple";
  const attrs = quick ? raw(`data-quick="${esc(e.product.id)}"`) : raw(`data-open="${esc(e.product.id)}"${isFlavor ? ` data-flavor="${esc(e.flavor.id)}"` : ""}${e.size ? ` data-size="${esc(e.size.id)}"` : ""}`);
  return html`<article class="card" style="--i:${Math.min(i, 20)}">
    <div class="card-media">
      ${img ? html`<img src="${img}"${photoSrcset(img) ? raw(` srcset="${esc(photoSrcset(img))}" sizes="${SIZES[ctx] || SIZES.carousel}"`) : ""} alt="${title}" loading="lazy" decoding="async" width="400" height="300">` : html`<span class="ph">${icon("slice")}</span>`}
      <div class="badges">${badges}</div>
    </div>
    <div class="card-body">
      <h3>${title}</h3>
      ${desc ? html`<p>${desc}</p>` : ""}
      <div class="card-foot">${priceHtml}<span class="add-chip" aria-hidden="true">${icon("plus")}</span></div>
    </div>
    <button class="card-link" type="button" ${attrs} aria-label="${quick ? "Adicionar" : "Escolher"} ${title}"></button>
  </article>`;
}

/* ---------- Abas ---------- */
function renderTabs(cats, counts) {
  setHTML($("#catTabs"), html`<span class="cat-ink" aria-hidden="true"></span>${cats.map((c) => {
    const sel = !counts && c.id === view.cat;
    return html`<button class="cat-tab" role="tab" type="button" id="tab-${c.id}" data-cat="${c.id}" aria-selected="${sel}" aria-controls="panel-${c.id}" tabindex="${sel || (counts && c === cats[0]) ? 0 : -1}">
      ${categoryIcon(c)}<span>${c.name}</span><span class="n">${counts ? counts[c.id] || 0 : countFor(c)}</span></button>`;
  })}`);
  moveInk(true);
}

/** Pílula verde que desliza até a aba ativa. */
function moveInk(instant = false) {
  const bar = $("#catTabs");
  const ink = bar?.querySelector(".cat-ink");
  const active = bar?.querySelector('.cat-tab[aria-selected="true"]');
  if (!ink) return;
  if (!active) { ink.style.opacity = "0"; return; }
  if (instant) ink.classList.add("no-anim");
  ink.style.width = `${active.offsetWidth}px`;
  ink.style.height = `${active.offsetHeight}px`;
  ink.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  ink.style.opacity = "1";
  if (instant) { void ink.offsetWidth; ink.classList.remove("no-anim"); }
}

function centerTab(tab) {
  const bar = $("#catTabs");
  if (!tab || !bar) return;
  bar.scrollTo({ left: tab.offsetLeft - bar.clientWidth / 2 + tab.clientWidth / 2, behavior: motion.reduced ? "auto" : "smooth" });
}

/* ---------- Pizzas: tamanho, explicação, grupos ---------- */
function discSvg(s, minCm, maxCm) {
  const t = maxCm > minCm ? (s.cm - minCm) / (maxCm - minCm) : 1;
  const r = 12 + t * 10;
  const n = s.slices || 8;
  let cuts = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    cuts += `<path d="M24 24L${(24 + (r - 2) * Math.cos(a)).toFixed(2)} ${(24 + (r - 2) * Math.sin(a)).toFixed(2)}"/>`;
  }
  const pep = [[0.45, -0.32], [-0.42, 0.16], [0.08, 0.52], [-0.18, -0.55], [0.55, 0.36]]
    .map(([x, y], k) => `<circle style="--k:${k}" cx="${(24 + x * r * 0.82).toFixed(2)}" cy="${(24 + y * r * 0.82).toFixed(2)}" r="${(r * 0.13).toFixed(2)}"/>`).join("");
  return raw(`<svg class="disc" viewBox="0 0 48 48" aria-hidden="true"><circle class="disc-crust" cx="24" cy="24" r="${r.toFixed(2)}"/><circle class="disc-top" cx="24" cy="24" r="${(r - 2.6).toFixed(2)}"/><g class="disc-cuts">${cuts}</g><g class="disc-pep">${pep}</g></svg>`);
}

function sizePicker(p, cur) {
  const sizes = p.sizes || [];
  const discs = sizes.every((s) => s.cm);
  const cms = sizes.map((s) => s.cm || 0);
  const minCm = Math.min(...cms), maxCm = Math.max(...cms);
  return html`<div class="sizes${discs ? "" : " plain"}" role="radiogroup" aria-label="Tamanho — ${p.name}">
    ${sizes.map((s) => {
      const meta = p.kind === "units"
        ? brl(s.price)
        : html`${s.slices ? `${s.slices} fatias` : ""}${s.slices && s.cm ? html`<span class="cm"> · ${s.cm} cm</span>` : s.cm ? `${s.cm} cm` : ""}`;
      return html`<button type="button" class="size" role="radio" aria-checked="${s.id === cur.id}" tabindex="${s.id === cur.id ? 0 : -1}" data-pick-size="${s.id}" data-product="${p.id}">
        ${discs ? discSvg(s, minCm, maxCm) : ""}
        <span class="size-name">${s.name}</span>${String(meta) ? html`<span class="size-meta">${meta}</span>` : ""}
      </button>`;
    })}
  </div>`;
}

/** Bordas que custam a mais, agrupadas por preço: "cheddar e chocolate + R$ 11,50 · catupiry + R$ 16,00". */
function bordasText(groupId) {
  const g = view.idx.addonGroups.get(groupId);
  if (!g) return "";
  const byPrice = new Map();
  (g.options || []).filter((o) => o.active !== false && o.price > 0).sort((a, b) => a.price - b.price || byOrder(a, b)).forEach((o) => {
    if (!byPrice.has(o.price)) byPrice.set(o.price, []);
    byPrice.get(o.price).push(o.name.toLowerCase());
  });
  const list = (names) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0]);
  return [...byPrice].map(([price, names]) => `${list(names)} + ${brl(price)}`).join(" · ");
}

function sizeInfo(p, cur) {
  const lines = [];
  const pizza = p.kind === "pizza" && cur.slices;
  if (pizza) {
    const max = cur.maxFlavors || 1;
    lines.push(html`<p class="si-head">${icon("slice")}<span><b>${cur.name}</b> · ${cur.slices} fatias${cur.cm ? ` · ${cur.cm} cm` : ""} · ${max > 1 ? `até ${max} sabores` : "1 sabor"}</span></p>`);
  }
  if (cur.includes) lines.push(html`<p>${icon(p.kind === "units" ? "soda" : "cheese")}<span>${p.kind === "pizza" && cur.slices ? "Já vem com" : "Inclui"} <b>${cur.includes}</b></span></p>`);
  if (pizza && (p.sizes || []).some((s) => (s.maxFlavors || 1) > 1)) {
    const rule = view.idx.store.pricingRule === "highest" ? "vale o preço do sabor mais caro" : "o preço é a média dos sabores";
    const max = cur.maxFlavors || 1;
    const firstMulti = (p.sizes || []).find((s) => (s.maxFlavors || 1) > 1);
    lines.push(max > 1
      ? html`<p>${icon("swap")}<span>Meio a meio: ${rule}. <button type="button" class="link-btn" data-open="${p.id}" data-size="${cur.id}">Montar com ${max} sabores</button></span></p>`
      : html`<p>${icon("swap")}<span>A ${cur.name} é de 1 sabor. Meio a meio a partir da ${firstMulti?.name || "próxima"}.</span></p>`);
  }
  if (p.kind === "units") lines.push(html`<p>${icon("esfiha")}<span>Escolha quantas quiser de cada sabor — somando <b>${cur.units}</b>.</span></p>`);
  const bordas = p.addonGroupId ? bordasText(p.addonGroupId) : "";
  if (bordas) lines.push(html`<p class="si-small">${icon("info")}<span>Outras bordas: ${bordas}</span></p>`);
  if (p.kind === "units") lines.push(html`<button type="button" class="btn btn-primary" data-open="${p.id}" data-size="${cur.id}">Montar ${cur.name} · ${brl(cur.price)}${icon("arrowRight")}</button>`);
  return lines.length ? html`<div class="size-info">${lines}</div>` : html`<div class="size-info"></div>`;
}

function groupsOf(p, flavors) {
  const tiers = [...new Set(flavors.map((f) => f.tier || "tradicional"))]
    .sort((a, b) => (TIER_ORDER.indexOf(a) + 1 || 9) - (TIER_ORDER.indexOf(b) + 1 || 9));
  return tiers.map((t) => ({
    key: `${p.id}:${t}`,
    label: tiers.length > 1 ? TIER_LABELS[t] || t : "Sabores",
    flavors: flavors.filter((f) => (f.tier || "tradicional") === t),
  }));
}

function priceTable(p, flavors, cur) {
  const cells = (p.sizes || []).map((s) => ({ s, c: modal(flavors.map((f) => flavorPriceCents(f, s.id))) })).filter((x) => x.c !== null);
  if (!cells.length) return "";
  const pick = cells.length > 1;
  return html`<ol class="ptable" aria-label="Preços por tamanho">${cells.map(({ s, c }) => html`<li class="${s.id === cur.id ? "on" : ""}">${pick
    ? html`<button type="button" data-pick-size="${s.id}" data-product="${p.id}" aria-label="${s.name}: ${brlC(c)}"><span>${s.name}</span><b>${brlC(c)}</b></button>`
    : html`<span class="cell"><span>${s.name}</span><b>${brlC(c)}</b></span>`}</li>`)}</ol>`;
}

function flavorRow(p, f, cur, groupCents, i, { showPrice = false, late = -1 } = {}) {
  // esfihas: o preço é do combo (quantidade), não de cada sabor
  const priced = p.kind === "pizza" && !!cur;
  const c = priced ? flavorPriceCents(f, cur.id) : null;
  const off = priced && c === null;
  const own = priced && !off && (showPrice || c !== groupCents);
  const tags = f.tags || [];
  const marks = [];
  if (isBest(f.id)) marks.push(html`<span class="mk hot" title="Mais pedida">${icon("flame")}<span class="mk-t">mais pedida</span></span>`);
  else if (f.popular) marks.push(html`<span class="mk" title="Destaque da casa">${icon("star")}<span class="mk-t">destaque</span></span>`);
  if (tags.includes("picante")) marks.push(html`<span class="mk-ico chili" title="Picante">${icon("chili", { label: "picante" })}</span>`);
  if (tags.includes("vegetariana")) marks.push(html`<span class="mk-ico leaf" title="Vegetariana">${icon("leaf", { label: "vegetariana" })}</span>`);
  const img = f.image || p.image;
  const multiSize = (p.sizes || []).length > 1;
  return html`<li class="mrow${off ? " off" : ""}${late >= 0 ? " late" : ""}" style="--i:${i}${late >= 0 ? `;--li:${late}` : ""}">
    <button type="button" class="mrow-main" data-open="${p.id}" data-flavor="${f.id}"${cur ? raw(` data-size="${esc(cur.id)}"`) : ""}>
      <span class="mrow-ph">${img ? html`<img src="${thumbUrl(img)}" alt="" loading="lazy" decoding="async" width="64" height="64" data-peek="${thumbUrl(img, 480)}">` : icon("slice")}</span>
      <span class="mrow-txt">
        <span class="mrow-name">${f.name}${marks}</span>
        ${f.description ? html`<span class="mrow-desc">${f.description}</span>` : ""}
        ${off ? html`<span class="mrow-own">Não tem neste tamanho</span>` : ""}
      </span>
      ${own ? html`<span class="mrow-price">${multiSize ? html`<small>${cur.name}</small>` : ""}${brlC(c)}</span>` : ""}
    </button>
    ${p.kind === "pizza" ? html`<button type="button" class="mrow-add" data-add-pizza="${p.id}" data-flavor="${f.id}" data-size="${cur?.id || ""}" aria-label="Adicionar ${f.name}${cur && multiSize ? `, ${cur.name}` : ""}"${off ? raw(" disabled") : ""}>${icon("plus")}</button>` : ""}
  </li>`;
}

function chipsFor(p, flavors) {
  if (flavors.length < 12) return "";
  const counts = {};
  flavors.forEach((f) => (f.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
  const keys = Object.keys(TAG_LABELS).filter((k) => counts[k]);
  if (!keys.length) return "";
  const active = view.filters[p.id] || "";
  return html`<div class="chips" role="group" aria-label="Filtrar sabores">
    <button class="chip" type="button" data-filter="" data-for="${p.id}" aria-pressed="${!active}">Todos</button>
    ${keys.map((k) => html`<button class="chip" type="button" data-filter="${k}" data-for="${p.id}" aria-pressed="${active === k}">${TAG_LABELS[k]} <small>${counts[k]}</small></button>`)}
  </div>`;
}

function groupsHtml(p, cur, { lateFrom = {} } = {}) {
  const all = flavorsOf(view.idx, p.id).map((f, i) => ({ f, i })).sort((a, b) => fame(b.f) - fame(a.f) || a.i - b.i).map((x) => x.f);
  const filter = view.filters[p.id];
  const limit = rowLimit();
  return groupsOf(p, all).map((g) => {
    const list = filter ? g.flavors.filter((f) => (f.tags || []).includes(filter)) : g.flavors;
    if (!list.length) return "";
    const groupCents = cur ? modal(g.flavors.map((f) => flavorPriceCents(f, cur.id))) : null;
    const canCollapse = !filter && list.length > limit + 2;
    const open = !canCollapse || view.expanded[g.key];
    const shown = open ? list : list.slice(0, limit);
    const words = list.length >= 8 && !filter ? keywords(list) : [];
    const late = lateFrom[g.key];
    return html`<section class="mgroup" data-group="${g.key}">
      <header class="mgroup-head">
        <h4>${g.label} <small>${list.length} ${list.length === 1 ? "sabor" : "sabores"}</small></h4>
        ${priceTable(p, g.flavors, cur)}
        ${words.length ? html`<p class="mgroup-note hand">tem ${words.join(", ")}…</p>` : ""}
      </header>
      <ul class="mrows">${shown.map((f, i) => flavorRow(p, f, cur, groupCents, i, { late: late !== undefined && i >= late ? i - late : -1 }))}</ul>
      ${canCollapse ? html`<button type="button" class="more" ${raw(open ? `data-less="${esc(g.key)}"` : `data-more="${esc(g.key)}"`)} aria-expanded="${open}">${open ? "Mostrar menos" : `Ver mais ${list.length - shown.length} sabores`}${icon("chevronDown")}</button>` : ""}
    </section>`;
  });
}

function pizzaBlock(p, { titled = false, hint = false } = {}) {
  const flavors = flavorsOf(view.idx, p.id);
  if (!flavors.length) return "";
  const cur = sizeOf(p);
  const multiSize = (p.sizes || []).length > 1;
  return html`<div class="pblock" data-product-block="${p.id}">
    ${titled ? html`<h3 class="pblock-title">${p.name}</h3>` : ""}
    ${cur ? html`<div class="pblock-intro">
      ${multiSize ? html`<div class="size-pick">
        <p class="pick-label">Escolha o tamanho${hint ? html` <span class="hand">comece por aqui!</span>` : ""}</p>
        ${sizePicker(p, cur)}
      </div>` : ""}
      ${sizeInfo(p, cur)}
    </div>` : ""}
    ${chipsFor(p, flavors)}
    <div class="mgroups">${groupsHtml(p, cur)}</div>
  </div>`;
}

/* ---------- Esfihas (por quantidade) ---------- */
function unitsBlock(p, { titled = false } = {}) {
  const cur = sizeOf(p);
  const flavors = flavorsOf(view.idx, p.id);
  if (!cur) return "";
  return html`<div class="pblock" data-product-block="${p.id}">
    ${titled ? html`<h3 class="pblock-title">${p.name}</h3>` : ""}
    <div class="pblock-intro">
      <div class="size-pick"><p class="pick-label">Quantas esfihas?</p>${sizePicker(p, cur)}</div>
      ${sizeInfo(p, cur)}
    </div>
    <section class="mgroup">
      <header class="mgroup-head"><h4>Sabores <small>${flavors.length}</small></h4></header>
      <ul class="mrows">${flavors.map((f, i) => flavorRow(p, f, cur, null, i))}</ul>
    </section>
  </div>`;
}

/* ---------- Combos ---------- */
function comboSurcharge(part) {
  const allowed = part.allowedFlavorIds?.length ? new Set(part.allowedFlavorIds) : null;
  const cents = flavorsOf(view.idx, part.productId).filter((f) => !allowed || allowed.has(f.id)).map((f) => flavorPriceCents(f, part.sizeId)).filter((c) => c !== null);
  return cents.length ? Math.max(...cents) - Math.min(...cents) : 0;
}

function comboCard(p, i) {
  const img = imgUrl(p.image);
  const items = (p.parts || []).map((part) => part.label);
  if ((p.parts || []).some((part) => part.addonGroupId)) items.push("Borda de requeijão");
  const d = p.drinks;
  if (d?.qty) items.push(`${d.qty > 1 ? `${d.qty} refrigerantes` : "Refrigerante"}${d.options?.[0] ? ` (${d.options[0].name})` : ""}`);
  const extra = Math.max(0, ...(p.parts || []).map(comboSurcharge));
  return html`<article class="combo" style="--i:${i}">
    <div class="combo-ph">${img ? html`<img src="${img}"${photoSrcset(img) ? raw(` srcset="${esc(photoSrcset(img))}" sizes="(max-width: 640px) 92vw, 300px"`) : ""} alt="" loading="lazy" decoding="async" width="400" height="300">` : icon("box")}</div>
    <div class="combo-body">
      <h4>${p.name}</h4>
      <ul class="combo-list">${items.map((t) => html`<li>${icon("check")}<span>${t}</span></li>`)}</ul>
      ${extra > 0 ? html`<p class="combo-note">Sabor especial acrescenta até ${brlC(extra)}.</p>` : ""}
      <div class="combo-foot"><span class="price">${brl(p.price)}</span><button type="button" class="btn btn-primary btn-sm" data-open="${p.id}">Escolher sabores</button></div>
    </div>
  </article>`;
}

/* ---------- Produtos simples (bebidas) ---------- */
function simpleRow(p, i) {
  const img = p.image ? thumbUrl(p.image) : "";
  return html`<li class="mrow simple" style="--i:${i}">
    <button type="button" class="mrow-main" data-quick="${p.id}" aria-label="Adicionar ${p.name} — ${brl(p.price)}">
      <span class="mrow-ph">${img ? html`<img src="${img}" alt="" loading="lazy" decoding="async" width="64" height="64">` : icon("bottle")}</span>
      <span class="mrow-txt"><span class="mrow-name">${p.name}</span>${p.description ? html`<span class="mrow-desc">${p.description}</span>` : ""}</span>
      <span class="mrow-price">${brl(p.price)}</span>
    </button>
    <button type="button" class="mrow-add" data-quick="${p.id}" aria-label="Adicionar ${p.name}" tabindex="-1">${icon("plus")}</button>
  </li>`;
}

/* ---------- Painel da categoria ---------- */
function renderPanel({ enter = false } = {}) {
  const body = $("#menuBody");
  const cat = view.idx.categories.get(view.cat);
  if (!cat) return;
  const prods = productsOf(cat);
  const titled = prods.filter((p) => p.kind === "pizza" || p.kind === "units").length > 1;
  let firstPizza = true;
  const blocks = [];
  for (const p of prods) {
    if (p.kind === "pizza") { blocks.push(pizzaBlock(p, { titled, hint: firstPizza && (p.sizes || []).length > 1 })); firstPizza = false; }
    else if (p.kind === "units") blocks.push(unitsBlock(p, { titled }));
  }
  const combos = prods.filter((p) => p.kind === "combo");
  if (combos.length) blocks.push(html`<div class="combos">${combos.map(comboCard)}</div>`);
  const simple = prods.filter((p) => p.kind === "simple");
  if (simple.length) blocks.push(html`<ul class="mrows simple-list">${simple.map(simpleRow)}</ul>`);
  setHTML(body, html`<div class="panel${enter ? " enter" : ""}" role="tabpanel" id="panel-${cat.id}" aria-labelledby="tab-${cat.id}">
    <div class="panel-head">
      <h3>${categoryIcon(cat)}${cat.name}</h3>
      ${cat.description ? html`<p>${cat.description}</p>` : ""}
    </div>
    ${blocks}
  </div>`);
  if (enter) setTimeout(() => body.querySelector(".panel")?.classList.remove("enter"), 1200);
}

/** Atualiza só a parte de uma pizza (tamanho/filtro/ver mais) — o seletor fica e anima. */
function refreshProduct(pid, opts = {}) {
  const p = view.idx.products.get(pid);
  const block = $(`#menuBody [data-product-block="${CSS.escape(pid)}"]`);
  if (!p || !block) return renderPanel();
  const cur = sizeOf(p);
  block.querySelectorAll(".size").forEach((b) => {
    const on = b.dataset.pickSize === cur.id;
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  const info = block.querySelector(".size-info");
  if (info) info.outerHTML = String(sizeInfo(p, cur));
  if (p.kind === "pizza") {
    const chips = block.querySelector(".chips");
    if (chips) chips.outerHTML = String(chipsFor(p, flavorsOf(view.idx, p.id)));
    setHTML(block.querySelector(".mgroups"), groupsHtml(p, cur, opts));
  } else if (p.kind === "units") {
    const rows = block.querySelector(".mrows");
    if (rows) setHTML(rows, flavorsOf(view.idx, p.id).map((f, i) => flavorRow(p, f, cur, null, i)));
  }
}

/** Nomes únicos para cada linha (o navegador anima cada uma até a posição nova). */
function nameRows(block, on) {
  block.querySelectorAll(".mrow-main[data-flavor]").forEach((b) => {
    b.parentElement.style.viewTransitionName = on ? `fr-${b.dataset.flavor.replace(/[^\w-]/g, "")}` : "";
  });
}

/* ---------- Busca ---------- */
function resultRow(e, i) {
  if (e.type === "flavor") return flavorRow(e.product, e.flavor, sizeOf(e.product), null, i, { showPrice: true });
  if (e.product.kind === "simple") return simpleRow(e.product, i);
  const p = e.product;
  const name = e.type === "unitsize" ? `${p.name} · ${e.size.name}` : p.name;
  const price = e.type === "unitsize" ? e.size.price : p.price;
  const img = p.image ? thumbUrl(p.image) : "";
  return html`<li class="mrow" style="--i:${i}">
    <button type="button" class="mrow-main" data-open="${p.id}"${e.size ? raw(` data-size="${esc(e.size.id)}"`) : ""}>
      <span class="mrow-ph">${img ? html`<img src="${img}" alt="" loading="lazy" decoding="async" width="64" height="64">` : icon("box")}</span>
      <span class="mrow-txt"><span class="mrow-name">${name}</span>${p.description ? html`<span class="mrow-desc">${p.description}</span>` : ""}</span>
      ${price != null ? html`<span class="mrow-price">${brl(price)}</span>` : ""}
    </button>
  </li>`;
}

function renderSearch() {
  const body = $("#menuBody");
  const cats = categories();
  const terms = norm(view.query).split(/\s+/).filter(Boolean);
  const groups = cats.map((c) => ({ c, list: entriesForCategory(c).filter((e) => terms.every((t) => entryText(e).includes(t))) })).filter((g) => g.list.length);
  renderTabs(cats, Object.fromEntries(groups.map((g) => [g.c.id, g.list.length])));
  if (!groups.length) {
    setHTML(body, html`<div class="empty">${icon("search", { cls: "big" })}<p>Nada encontrado para “${view.query}”.</p><p>Tente outro sabor ou ingrediente — ou <a class="link-btn" href="#contato">fale com a gente</a>.</p></div>`);
    return;
  }
  setHTML(body, html`<div class="panel results">${groups.map((g) => html`<section class="mgroup">
    <header class="mgroup-head"><h4>${categoryIcon(g.c)}${g.c.name} <small>${g.list.length} resultado${g.list.length > 1 ? "s" : ""}</small></h4></header>
    <ul class="mrows">${g.list.map((e, i) => resultRow(e, i))}</ul>
  </section>`)}</div>`);
  markTerms(body.querySelectorAll(".mrow-name, .mrow-desc"), terms);
}

/** Destaca na tela o que foi buscado (sem acento/maiúscula), direto no DOM — nada vira HTML. */
function markTerms(els, terms) {
  if (!terms.length) return;
  const fold = (ch) => ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  els.forEach((el) => {
    // selos ("destaque", "mais pedida") ficam de fora
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest(".mk, .mk-ico") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.textContent;
      const chars = [...text];
      const folded = chars.map(fold);
      if (folded.some((c) => c.length !== 1)) continue; // letra que vira 0 ou 2: não arrisca
      const flat = folded.join("");
      const hits = [];
      for (const t of terms) {
        let i = flat.indexOf(t);
        while (i >= 0) { hits.push([i, i + t.length]); i = flat.indexOf(t, i + t.length); }
      }
      if (!hits.length) continue;
      hits.sort((a, b) => a[0] - b[0]);
      // tudo num <span>: no nome do sabor (flex) o texto não se separa em pedaços
      const frag = document.createElement("span");
      let at = 0;
      for (const [a, b] of hits) {
        if (a < at) continue;
        if (a > at) frag.append(chars.slice(at, a).join(""));
        const m = document.createElement("mark");
        m.className = "hit";
        m.textContent = chars.slice(a, b).join("");
        frag.append(m);
        at = b;
      }
      if (at < chars.length) frag.append(chars.slice(at).join(""));
      node.replaceWith(frag);
    }
  });
}

export function renderMenu() {
  if (norm(view.query)) return renderSearch();
  const cats = categories();
  if (!cats.some((c) => c.id === view.cat)) view.cat = cats[0]?.id || null;
  renderTabs(cats);
  renderPanel();
}

function selectCat(id, { focus = false } = {}) {
  const input = $("#searchInput");
  const searching = !!norm(view.query);
  if (searching) { view.query = ""; input.value = ""; $("#searchClear").hidden = true; }
  if (id === view.cat && !searching) return;
  view.cat = id;
  try { sessionStorage.setItem("fg-cat", id); } catch { /* sem armazenamento */ }
  const menuTop = $("#menuBody").getBoundingClientRect().top;
  const swap = () => {
    if (searching) renderTabs(categories());
    $$("#catTabs .cat-tab").forEach((t) => { const on = t.dataset.cat === id; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
    moveInk();
    renderPanel({ enter: true });
  };
  // (sem View Transitions aqui: elas congelavam a animação de cor das abas;
  //  a pílula verde desliza e as linhas do painel novo entram em cascata)
  swap();
  const tab = document.getElementById(`tab-${id}`);
  centerTab(tab);
  if (focus) tab?.focus({ preventScroll: true });
  // quem já desceu pelo cardápio volta para o começo da categoria nova
  if (menuTop < 0) scrollToTarget($("#menuBody"), { offset: (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 76) + $("#catBar").offsetHeight + 8 });
}

/* ---------- Destaques ---------- */
export function renderHighlights() {
  const el = $("#highlights");
  const best = view.idx.menu.bestSellers || [];
  let entries = [];
  const all = categories().flatMap(entriesForCategory);
  const keyOf = (e) => (e.type === "flavor" ? e.flavor.id : e.product.id);
  if (best.length >= 4) {
    entries = best.map((id) => all.find((e) => keyOf(e) === id)).filter(Boolean);
    $("#highlightsEyebrow").textContent = "Os mais pedidos do mês";
    $("#destaquesTitle").textContent = "Mais pedidos";
  } else {
    entries = all.filter((e) => (e.type === "flavor" ? e.flavor.popular : e.product.popular));
  }
  const seen = new Set();
  entries = entries.filter((e) => { const k = keyOf(e); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
  if (!entries.length) { $("#destaques").hidden = true; return; }
  setHTML(el, entries.map((e, i) => cardHtml(e, i, "carousel")));
  observeCards(el);
}

/* ---------- Foto que aparece ao passar o mouse (como uma polaroid pendurada) ---------- */
function initPeek(root) {
  if (!finePointer()) return;
  const peek = document.createElement("div");
  peek.className = "peek";
  peek.setAttribute("aria-hidden", "true");
  peek.innerHTML = '<img alt="" decoding="async">';
  document.body.appendChild(peek);
  const img = peek.firstChild;
  const st = { on: false, x: -999, y: -999, tx: 0, ty: 0, rot: 0, shown: 0 };
  const hide = () => { st.on = false; peek.classList.remove("on"); };
  root.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse" || motion.reduced) return;
    const src = e.target.closest(".mrow")?.querySelector("img[data-peek]")?.dataset.peek;
    if (!src) return hide();
    if (img.getAttribute("src") !== src) img.src = src;
    if (!st.on && st.x < -900) { st.x = e.clientX; st.y = e.clientY; }
    st.on = true;
    peek.classList.add("on");
    ticker.wake();
  });
  root.addEventListener("pointermove", (e) => { st.tx = e.clientX; st.ty = e.clientY; if (st.on) ticker.wake(); }, { passive: true });
  root.addEventListener("pointerleave", hide);
  root.addEventListener("click", hide);
  document.addEventListener("figaros:layers", hide);
  ticker.add((f) => {
    if (!st.on && !peek.classList.contains("on")) return false;
    const k = 1 - Math.exp(-14 * f.dt);
    const px = st.x;
    st.x += (st.tx - st.x) * k;
    st.y += (st.ty - st.y) * k;
    const vx = (st.x - px) / Math.max(f.dt, 0.001);
    st.rot += (Math.max(-12, Math.min(12, vx * 0.012)) - st.rot) * (1 - Math.exp(-8 * f.dt));
    const w = 214, left = st.x + 26 + w > f.vw ? st.x - w - 26 : st.x + 26;
    peek.style.transform = `translate3d(${left.toFixed(1)}px, ${(st.y - 80).toFixed(1)}px, 0) rotate(${(st.rot - 3).toFixed(2)}deg)`;
    return st.on || Math.abs(vx) > 1;
  });
}

/* ---------- Início ---------- */
export function initMenu(idx, { onOpen, onQuickAdd }) {
  view.idx = idx; view.onOpen = onOpen; view.onQuickAdd = onQuickAdd;
  let saved = null;
  try { saved = sessionStorage.getItem("fg-cat"); } catch { /* sem armazenamento */ }
  view.cat = saved;
  renderMenu();
  renderHighlights();
  attachTilt($("#highlights"));
  initPeek($("#menuBody"));

  const input = $("#searchInput"), clear = $("#searchClear");
  const run = debounce(() => { view.query = input.value; clear.hidden = !input.value; renderMenu(); }, 160);
  input.addEventListener("input", run);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); scrollToTarget($("#menuBody"), { offset: 150 }); } });
  clear.addEventListener("click", () => { input.value = ""; view.query = ""; clear.hidden = true; renderMenu(); input.focus(); });

  const tabs = $("#catTabs");
  tabs.addEventListener("click", (e) => { const tab = e.target.closest("[data-cat]"); if (tab) selectCat(tab.dataset.cat); });
  tabs.addEventListener("keydown", (e) => {
    const all = $$("#catTabs .cat-tab");
    const i = all.indexOf(document.activeElement);
    if (i < 0) return;
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: all.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = all[(to + all.length) % all.length];
    selectCat(next.dataset.cat, { focus: true });
  });
  if ("ResizeObserver" in window) new ResizeObserver(() => moveInk(true)).observe(tabs);

  const onClick = (e) => {
    const t = e.target;
    const pick = t.closest("[data-pick-size]");
    if (pick) {
      setSize(pick.dataset.product, pick.dataset.pickSize);
      refreshProduct(pick.dataset.product);
      // os destaques mostram o preço no tamanho escolhido
      if ($("#highlights [data-open=\"" + CSS.escape(pick.dataset.product) + "\"]")) renderHighlights();
      $(`#menuBody [data-product-block="${CSS.escape(pick.dataset.product)}"] .size[data-pick-size="${CSS.escape(pick.dataset.pickSize)}"]`)?.focus({ preventScroll: true });
      return;
    }
    const more = t.closest("[data-more]");
    if (more) {
      const key = more.dataset.more;
      view.expanded[key] = true;
      refreshProduct(key.split(":")[0], { lateFrom: { [key]: rowLimit() } });
      return;
    }
    const less = t.closest("[data-less]");
    if (less) {
      const key = less.dataset.less;
      view.expanded[key] = false;
      refreshProduct(key.split(":")[0]);
      const head = $(`#menuBody [data-group="${CSS.escape(key)}"]`);
      if (head && head.getBoundingClientRect().top < 0) scrollToTarget(head, { offset: 170 });
      return;
    }
    const chip = t.closest("[data-filter]");
    if (chip) {
      const pid = chip.dataset.for;
      view.filters[pid] = chip.dataset.filter;
      const block = $(`#menuBody [data-product-block="${CSS.escape(pid)}"]`);
      // com View Transitions: as linhas que continuam deslizam para o lugar novo e as outras somem/aparecem
      if (document.startViewTransition && !motion.reduced && block) {
        nameRows(block, true);
        const vt = document.startViewTransition(() => { refreshProduct(pid); nameRows(block, true); });
        vt.finished.finally(() => nameRows(block, false));
        return;
      }
      // sem View Transitions: as linhas do filtro novo entram em cascata
      const groups = groupsOf(idx.products.get(pid), flavorsOf(idx, pid));
      refreshProduct(pid, { lateFrom: Object.fromEntries(groups.map((g) => [g.key, 0])) });
      return;
    }
    const add = t.closest("[data-add-pizza]");
    if (add) {
      const p = idx.products.get(add.dataset.addPizza);
      const g = p?.addonGroupId ? idx.addonGroups.get(p.addonGroupId) : null;
      view.onQuickAdd({ productId: add.dataset.addPizza, sizeId: add.dataset.size, flavorIds: [add.dataset.flavor], addons: g?.defaultOptionId ? { [g.id]: g.defaultOptionId } : {}, qty: 1 }, add.closest(".mrow"));
      return;
    }
    const quick = t.closest("[data-quick]");
    if (quick) { view.onQuickAdd({ productId: quick.dataset.quick, qty: 1 }, quick.closest(".mrow, .card")); return; }
    const open = t.closest("[data-open]");
    if (open) {
      const p = idx.products.get(open.dataset.open);
      view.onOpen({ productId: open.dataset.open, flavorId: open.dataset.flavor, sizeId: open.dataset.size || (p?.kind === "pizza" && (p.sizes || []).length > 1 ? sizeOf(p)?.id : undefined) });
    }
  };
  $("#menuBody").addEventListener("click", onClick);
  $("#highlights").addEventListener("click", onClick);

  // tamanhos: setas do teclado escolhem (padrão de radiogroup)
  $("#menuBody").addEventListener("keydown", (e) => {
    const b = e.target.closest?.(".size");
    if (!b) return;
    const all = [...b.parentElement.querySelectorAll(".size")];
    const i = all.indexOf(b);
    const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    all[(to + all.length) % all.length].click();
  });

  document.querySelectorAll("[data-scroll]").forEach((b) => b.addEventListener("click", () => {
    if (scrollHighlightsBy(Number(b.dataset.scroll))) return; // seção presa: a página rola e os cartões andam
    const c = $("#highlights");
    c.scrollBy({ left: Number(b.dataset.scroll) * c.clientWidth * 0.8, behavior: "smooth" });
  }));
}

export function updateMenuIndex(idx) { view.idx = idx; renderMenu(); renderHighlights(); }
