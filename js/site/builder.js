/* ============================================================
   Montador de produto: pizzas (tamanho + até N sabores + borda),
   combos (partes + bebidas), esfihas (unidades por sabor) e simples.
   ============================================================ */
import { html, raw, $, setHTML, brl, brlC, norm, esc } from "./util.js";
import { imgUrl, thumbUrl } from "./api.js";
import { openLayer, closeLayer } from "./dialog.js";
import { flavorsOf, flavorPriceCents, priceItem, cheapestFlavorCents, combineFlavorPrices, MAX_NOTES } from "../shared/pricing.js";
import { flyToCart, toast } from "./fx.js";
import { icon } from "./icons.js";

const layer = () => $("#productLayer");
const dlg = () => $("#productDialog");
let idx = null;
let S = null; // estado do item sendo montado
let onAdd = null;

export function initBuilder(menuIndex, { onAdded }) { idx = menuIndex; onAdd = onAdded; }
export function setBuilderIndex(menuIndex) { idx = menuIndex; }

/** Abre o montador. `preset` pode trazer flavorId/sizeId, ou um item do carrinho para editar.
 *  `onDone` roda quando o montador fecha (salvando ou não) — ex.: voltar para o carrinho. */
export function openBuilder({ productId, flavorId, sizeId, edit, onDone } = {}) {
  const product = idx.products.get(productId);
  if (!product) { toast("Esse item não está mais disponível.", "err"); return; }
  S = {
    product,
    sizeId: sizeId || (product.sizes?.length === 1 ? product.sizes[0].id : ""),
    flavorIds: flavorId ? [flavorId] : [],
    addons: {},
    units: {},
    parts: {},
    drinks: [],
    qty: 1,
    notes: "",
    editKey: null,
    tried: false,
    pickerFor: null,
  };
  if (product.kind === "combo") {
    (product.parts || []).forEach((p) => {
      const allowed = p.allowedFlavorIds?.length ? p.allowedFlavorIds : null;
      S.parts[p.id] = { flavorIds: allowed && allowed.length === 1 ? [allowed[0]] : [], addons: {} };
    });
    const opts = product.drinks?.options || [];
    if (product.drinks?.qty && opts.length) S.drinks = Array(product.drinks.qty).fill(opts[0].id);
  }
  if (product.addonGroupId) {
    const g = idx.addonGroups.get(product.addonGroupId);
    if (g?.defaultOptionId) S.addons[product.addonGroupId] = g.defaultOptionId;
  }
  if (edit) Object.assign(S, structuredClone({ sizeId: edit.sizeId || S.sizeId, flavorIds: edit.flavorIds || [], addons: edit.addons || S.addons, units: edit.units || {}, parts: edit.parts || S.parts, drinks: edit.drinks || S.drinks, qty: edit.qty || 1, notes: edit.notes || "" }), { editKey: edit.key });
  const session = S;
  render();
  openLayer(layer(), { onClose: () => { if (S === session) S = null; onDone?.(); } });
}

function selection() {
  const p = S.product;
  const sel = { productId: p.id, qty: S.qty, notes: S.notes.trim() };
  if (p.kind === "pizza") Object.assign(sel, { sizeId: S.sizeId, flavorIds: [...S.flavorIds], addons: { ...S.addons } });
  if (p.kind === "units") Object.assign(sel, { sizeId: S.sizeId, units: Object.fromEntries(Object.entries(S.units).filter(([, n]) => n > 0)) });
  if (p.kind === "combo") Object.assign(sel, { parts: structuredClone(S.parts), drinks: [...S.drinks] });
  return sel;
}

/* ---------- Pizza em SVG dividida pelos sabores ---------- */
function pizzaSvg(flavors, slices = 8, maxFlavors = 1) {
  const n = Math.max(1, flavors.length || 1);
  const R = 46, C = 50;
  const wedge = (i) => {
    if (n === 1) return `M ${C} ${C} m -${R} 0 a ${R} ${R} 0 1 0 ${R * 2} 0 a ${R} ${R} 0 1 0 -${R * 2} 0`;
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const x0 = C + R * Math.cos(a0), y0 = C + R * Math.sin(a0), x1 = C + R * Math.cos(a1), y1 = C + R * Math.sin(a1);
    return `M ${C} ${C} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${1 / n > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
  };
  const defs = flavors.map((f, i) => `<pattern id="pz${i}" patternUnits="userSpaceOnUse" width="100" height="100"><image href="${esc(thumbUrl(f.image, 480))}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"/></pattern>`).join("");
  const fills = flavors.length
    ? flavors.map((f, i) => `<path class="slice slice-new" d="${wedge(i)}" fill="url(#pz${i})"/>`).join("")
    : `<circle cx="50" cy="50" r="${R}" fill="#f0c26b"/><circle cx="50" cy="50" r="${R - 6}" fill="#e9a94f" opacity=".5"/><text x="50" y="55" text-anchor="middle" font-size="9" font-weight="800" fill="#7a4a1c">escolha os sabores</text>`;
  let cuts = "";
  for (let i = 0; i < slices; i++) {
    const a = (i / slices) * Math.PI * 2 - Math.PI / 2;
    cuts += `<line x1="50" y1="50" x2="${(C + R * Math.cos(a)).toFixed(2)}" y2="${(C + R * Math.sin(a)).toFixed(2)}" stroke="rgba(255,248,235,.55)" stroke-width=".6"/>`;
  }
  let dividers = "";
  if (n > 1) for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    dividers += `<line x1="50" y1="50" x2="${(C + R * Math.cos(a)).toFixed(2)}" y2="${(C + R * Math.sin(a)).toFixed(2)}" stroke="#2b1d17" stroke-width="1.4"/>`;
  }
  const empty = Math.max(0, maxFlavors - flavors.length);
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${flavors.length ? esc(flavors.map((f) => f.name).join(", ")) : "Pizza sem sabores ainda"}${empty ? ` — cabe mais ${empty}` : ""}">
    <defs>${defs}</defs>
    <circle cx="50" cy="50" r="49.5" fill="#d08a33"/><circle cx="50" cy="50" r="48" fill="#e5a750"/>
    ${fills}${cuts}${dividers}
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="#c47e2f" stroke-width="2.4"/>
  </svg>`;
}

/* ---------- Render ---------- */
function stepTitle(n, title, ok, req = "Obrigatório") {
  return html`<div class="field-title"><h3><span class="stepn">${n}</span>${title}</h3><span class="req ${ok ? "ok" : ""}">${ok ? "✓ OK" : req}</span></div>`;
}

function sizeSection(n) {
  const p = S.product;
  const sizes = p.sizes || [];
  if (sizes.length <= 1 && p.kind === "pizza") return "";
  const maxCm = Math.max(...sizes.map((s) => s.cm || 0), 1);
  return html`<section>
    ${stepTitle(n, p.kind === "units" ? "Quantidade" : "Tamanho", !!S.sizeId)}
    <div class="size-grid" role="radiogroup" aria-label="Tamanho">
      ${sizes.map((s) => {
        let priceTxt = "";
        if (p.kind === "units") priceTxt = brl(s.price);
        else {
          const sel = S.flavorIds.map((id) => idx.flavors.get(id)).filter(Boolean);
          const cents = sel.map((f) => flavorPriceCents(f, s.id));
          if (sel.length && cents.every((c) => c !== null)) priceTxt = brlC(combineFlavorPrices(cents, idx.store.pricingRule));
          else {
            const all = flavorsOf(idx, p.id).map((f) => flavorPriceCents(f, s.id)).filter((c) => c !== null);
            priceTxt = all.length ? `a partir de ${brlC(Math.min(...all))}` : "";
          }
        }
        const meta = [s.slices ? `${s.slices} fatias` : "", s.cm ? `${s.cm} cm` : "", p.kind === "pizza" && (s.maxFlavors || 1) > 1 ? `até ${s.maxFlavors} sabores` : ""].filter(Boolean).join(" · ");
        return html`<button type="button" class="opt" role="radio" aria-checked="${S.sizeId === s.id}" data-size="${s.id}">
          ${s.cm ? html`<span class="size-dot" style="--d:${Math.round(14 + (s.cm / maxCm) * 22)}" aria-hidden="true"></span>` : ""}
          <span class="t">${s.name}</span>${meta ? html`<span class="s">${meta}</span>` : ""}
          ${s.includes ? html`<span class="s">+ ${s.includes}</span>` : ""}
          ${priceTxt ? html`<span class="p">${priceTxt}</span>` : ""}
        </button>`;
      })}
    </div>
  </section>`;
}

function slotsHtml(flavorIds, max, sizeId, target, productId) {
  const items = flavorIds.map((id, i) => {
    const f = idx.flavors.get(id);
    if (!f) return "";
    const c = flavorPriceCents(f, sizeId);
    return html`<div class="slot">
      <img src="${thumbUrl(f.image)}" alt="" loading="lazy">
      <div class="grow"><strong>${flavorIds.length > 1 ? `1/${flavorIds.length} ` : ""}${f.name}</strong><small>${f.tier === "especial" ? "Especial · " : ""}${c !== null ? brlC(c) : "indisponível neste tamanho"}</small></div>
      <button type="button" class="x" data-swap="${i}" data-target="${target}" aria-label="Trocar ${f.name}">${icon("swap")}</button>
      <button type="button" class="x" data-remove-flavor="${i}" data-target="${target}" aria-label="Remover ${f.name}">×</button>
    </div>`;
  });
  const canAdd = flavorIds.length < max;
  return html`<div class="flavor-slots">${items}
    ${canAdd ? html`<button type="button" class="slot add" data-add-flavor data-target="${target}" data-product="${productId}">＋ ${flavorIds.length ? "Adicionar outro sabor" : "Escolher sabor"} <small>(${flavorIds.length}/${max})</small></button>` : ""}
  </div>`;
}

function addonSection(n, groupId, current, target) {
  const g = idx.addonGroups.get(groupId);
  if (!g || !(g.options || []).length) return "";
  return html`<section>
    ${stepTitle(n, g.name, true, "Opcional")}
    <div class="opt-list" role="radiogroup" aria-label="${g.name}">
      ${g.options.map((o) => html`<button type="button" class="opt-row" role="radio" aria-checked="${(current || g.defaultOptionId) === o.id}" data-addon="${o.id}" data-group="${g.id}" data-target="${target}">
        <span class="radio" aria-hidden="true"></span><span class="grow">${o.name}</span><span class="p">${o.price > 0 ? "+ " + brl(o.price) : "grátis"}</span>
      </button>`)}
    </div>
  </section>`;
}

function notesSection(n) {
  return html`<section>
    <div class="field-title"><h3><span class="stepn">${n}</span>Alguma observação?</h3><span class="req">Opcional</span></div>
    <textarea class="textarea" id="pdNotes" maxlength="${MAX_NOTES}" rows="2" placeholder="Ex.: sem cebola, bem assada, cortar em 8…">${S.notes}</textarea>
    <div class="counter"><span id="pdNotesCount">${S.notes.length}</span>/${MAX_NOTES}</div>
  </section>`;
}

function bodyHtml() {
  const p = S.product;
  let n = 1;
  const parts = [];
  if (p.kind === "pizza") {
    const size = (p.sizes || []).find((s) => s.id === S.sizeId);
    if ((p.sizes || []).length > 1) parts.push(sizeSection(n++));
    const max = size?.maxFlavors || Math.max(...p.sizes.map((s) => s.maxFlavors || 1));
    const sel = S.flavorIds.map((id) => idx.flavors.get(id)).filter(Boolean);
    parts.push(html`<section>
      ${stepTitle(n++, max > 1 ? `Sabores (até ${max})` : "Sabor", sel.length > 0)}
      <div class="builder-flex">
        <div class="pizza-viz" id="pizzaViz">${raw(pizzaSvg(sel, size?.slices || 8, max))}</div>
        ${slotsHtml(S.flavorIds, max, S.sizeId || p.sizes[p.sizes.length - 1].id, "main", p.id)}
      </div>
      ${max > 1 && sel.length > 1 ? html`<p class="counter" style="text-align:left">Pizza com ${sel.length} sabores: ${idx.store.pricingRule === "highest" ? "vale o preço do sabor mais caro" : "o preço é a média dos sabores escolhidos"}.</p>` : ""}
    </section>`);
    if (p.addonGroupId) parts.push(addonSection(n++, p.addonGroupId, S.addons[p.addonGroupId], "main"));
  } else if (p.kind === "units") {
    parts.push(sizeSection(n++));
    const size = p.sizes.find((s) => s.id === S.sizeId);
    const total = Object.values(S.units).reduce((s, v) => s + v, 0);
    const max = size?.units || 0;
    parts.push(html`<section>
      ${stepTitle(n++, "Sabores", size && total === max)}
      ${size ? html`<div class="min-bar"><p>${total === max ? "Tudo certo!" : `Escolha mais ${max - total} de ${max}`}</p><div class="progress ${total === max ? "full" : ""}"><i style="width:${Math.min(100, (total / max) * 100)}%"></i></div></div>` : html`<p class="counter" style="text-align:left">Escolha a quantidade primeiro.</p>`}
      <div class="units-list">
        ${flavorsOf(idx, p.id).map((f) => {
          const v = S.units[f.id] || 0;
          return html`<div class="unit-row">
            <img src="${thumbUrl(f.image)}" alt="" loading="lazy">
            <div class="grow"><strong>${f.name}</strong><small>${f.description}</small></div>
            <div class="stepper sm"><button type="button" data-unit="${f.id}" data-delta="-1" aria-label="Menos ${f.name}" ${v <= 0 ? "disabled" : ""}>−</button><output>${v}</output><button type="button" data-unit="${f.id}" data-delta="1" aria-label="Mais ${f.name}" ${!size || total >= max ? "disabled" : ""}>+</button></div>
          </div>`;
        })}
      </div>
    </section>`);
  } else if (p.kind === "combo") {
    for (const part of p.parts || []) {
      const st = S.parts[part.id];
      const sel = st.flavorIds.map((id) => idx.flavors.get(id)).filter(Boolean);
      const prod = idx.products.get(part.productId);
      const size = prod?.sizes?.find((s) => s.id === part.sizeId);
      parts.push(html`<section>
        ${stepTitle(n++, part.label, sel.length > 0)}
        <div class="builder-flex">
          <div class="pizza-viz">${raw(pizzaSvg(sel, size?.slices || 8, part.maxFlavors))}</div>
          ${slotsHtml(st.flavorIds, part.maxFlavors || 1, part.sizeId, part.id, part.productId)}
        </div>
        ${part.allowedFlavorIds?.length ? "" : html`<p class="counter" style="text-align:left">Sabores especiais têm um pequeno acréscimo, mostrado no preço.</p>`}
      </section>`);
      if (part.addonGroupId) parts.push(addonSection(n++, part.addonGroupId, st.addons[part.addonGroupId], part.id));
    }
    if (p.drinks?.qty) {
      const d = p.drinks;
      if (d.qty === 1) {
        parts.push(html`<section>${stepTitle(n++, d.label, S.drinks.length === 1)}
          <div class="opt-list" role="radiogroup" aria-label="${d.label}">${d.options.map((o) => html`<button type="button" class="opt-row" role="radio" aria-checked="${S.drinks[0] === o.id}" data-drink="${o.id}">
            <span class="radio" aria-hidden="true"></span><span class="grow">${o.name}</span><span class="p">${o.extra > 0 ? "+ " + brl(o.extra) : "incluso"}</span></button>`)}</div></section>`);
      } else {
        const count = (id) => S.drinks.filter((x) => x === id).length;
        parts.push(html`<section>${stepTitle(n++, `${d.label} (escolha ${d.qty})`, S.drinks.length === d.qty)}
          <div class="units-list">${d.options.map((o) => html`<div class="unit-row"><div class="grow"><strong>${o.name}</strong><small>${o.extra > 0 ? "+ " + brl(o.extra) + " cada" : "incluso"}</small></div>
            <div class="stepper sm"><button type="button" data-drinkq="${o.id}" data-delta="-1" aria-label="Menos ${o.name}" ${count(o.id) ? "" : "disabled"}>−</button><output>${count(o.id)}</output><button type="button" data-drinkq="${o.id}" data-delta="1" aria-label="Mais ${o.name}" ${S.drinks.length >= d.qty ? "disabled" : ""}>+</button></div></div>`)}</div></section>`);
      }
    }
  }
  parts.push(notesSection(n++));
  return parts;
}

function heroImage() {
  const first = S.product.kind === "pizza" && S.flavorIds[0] ? idx.flavors.get(S.flavorIds[0]) : null;
  return imgUrl(first?.image || S.product.image);
}

function titleText() {
  const p = S.product;
  if (p.kind === "pizza" && S.flavorIds.length === 1) {
    const f = idx.flavors.get(S.flavorIds[0]);
    if (f) return { title: f.name, desc: f.description, tier: f.tier };
  }
  if (p.kind === "units" && S.sizeId) {
    const s = p.sizes.find((x) => x.id === S.sizeId);
    return { title: `${p.name} · ${s?.name || ""}`, desc: p.description };
  }
  return { title: p.name, desc: p.description };
}

function footer() {
  const r = priceItem(idx, selection());
  const label = S.editKey ? "Salvar alterações" : "Adicionar";
  return html`<div class="stepper" aria-label="Quantidade">
      <button type="button" data-qty="-1" aria-label="Diminuir quantidade" ${S.qty <= 1 ? "disabled" : ""}>−</button>
      <output aria-live="polite">${S.qty}</output>
      <button type="button" data-qty="1" aria-label="Aumentar quantidade" ${S.qty >= 50 ? "disabled" : ""}>+</button>
    </div>
    <button type="button" class="btn btn-primary btn-lg" id="pdAdd" aria-disabled="${!r.ok}">
      <span>${label}</span><strong>${r.totalCents ? brlC(r.totalCents) : ""}</strong>
    </button>`;
}

function render({ keepScroll = true } = {}) {
  const box = dlg();
  const scroller = box.querySelector(".dialog-scroll");
  const top = keepScroll && scroller ? scroller.scrollTop : 0;
  const t = titleText();
  const r = priceItem(idx, selection());
  setHTML(box, html`
    <button type="button" class="dialog-close" data-close aria-label="Fechar">×</button>
    <div class="dialog-scroll">
      <div class="pd-hero"><img src="${heroImage()}" alt="" id="pdHeroImg">
        <div class="badges">${t.tier === "especial" ? html`<span class="badge especial">Especial</span>` : ""}</div>
      </div>
      <div class="pd-body">
        <div class="pd-title"><h2 id="productTitle">${t.title}</h2>${t.desc ? html`<p>${t.desc}</p>` : ""}</div>
        ${bodyHtml()}
        ${S.tried && !r.ok ? html`<div class="err-box" role="alert">${r.errors[0]}</div>` : ""}
      </div>
    </div>
    <div class="pd-foot" id="pdFoot">${footer()}</div>
  `);
  const sc = box.querySelector(".dialog-scroll");
  if (sc) sc.scrollTop = top;
  bind();
}

/** Atualiza só o rodapé (preço) — usado ao digitar observações, sem perder o foco. */
function refreshFooter() { setHTML($("#pdFoot"), footer()); }

function bind() {
  const box = dlg();
  const notes = $("#pdNotes", box);
  notes?.addEventListener("input", () => { S.notes = notes.value.slice(0, MAX_NOTES); $("#pdNotesCount").textContent = S.notes.length; });
  box.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b || !box.contains(b) || !S) return;
    const p = S.product;
    if (b.dataset.size) {
      S.sizeId = b.dataset.size;
      if (p.kind === "pizza") {
        const size = p.sizes.find((s) => s.id === S.sizeId);
        if (S.flavorIds.length > (size.maxFlavors || 1)) {
          S.flavorIds = S.flavorIds.slice(0, size.maxFlavors || 1);
          toast(`O tamanho ${size.name} aceita até ${size.maxFlavors || 1} sabor(es).`);
        }
        const unavailable = S.flavorIds.filter((id) => flavorPriceCents(idx.flavors.get(id), S.sizeId) === null);
        if (unavailable.length) { S.flavorIds = S.flavorIds.filter((id) => !unavailable.includes(id)); toast("Removemos sabores que não existem nesse tamanho."); }
      }
      if (p.kind === "units") {
        const size = p.sizes.find((s) => s.id === S.sizeId);
        let total = Object.values(S.units).reduce((s, v) => s + v, 0);
        for (const k of Object.keys(S.units).reverse()) { while (total > size.units && S.units[k] > 0) { S.units[k]--; total--; } }
      }
      return render();
    }
    if (b.dataset.qty) { S.qty = Math.max(1, Math.min(50, S.qty + Number(b.dataset.qty))); return refreshFooter(); }
    if (b.dataset.addon) {
      const target = b.dataset.target;
      if (target === "main") S.addons[b.dataset.group] = b.dataset.addon;
      else S.parts[target].addons[b.dataset.group] = b.dataset.addon;
      return render();
    }
    if (b.dataset.drink) { S.drinks = [b.dataset.drink]; return render(); }
    if (b.dataset.drinkq) {
      const d = Number(b.dataset.delta);
      if (d > 0 && S.drinks.length < p.drinks.qty) S.drinks.push(b.dataset.drinkq);
      if (d < 0) { const i = S.drinks.lastIndexOf(b.dataset.drinkq); if (i >= 0) S.drinks.splice(i, 1); }
      return render();
    }
    if (b.dataset.unit) {
      const size = p.sizes.find((s) => s.id === S.sizeId);
      const total = Object.values(S.units).reduce((s, v) => s + v, 0);
      const d = Number(b.dataset.delta);
      if (d > 0 && size && total >= size.units) return;
      S.units[b.dataset.unit] = Math.max(0, (S.units[b.dataset.unit] || 0) + d);
      return render();
    }
    if (b.dataset.removeFlavor !== undefined) {
      const list = b.dataset.target === "main" ? S.flavorIds : S.parts[b.dataset.target].flavorIds;
      list.splice(Number(b.dataset.removeFlavor), 1);
      return render();
    }
    if (b.dataset.swap !== undefined) return openPicker(b.dataset.target, Number(b.dataset.swap));
    if (b.hasAttribute("data-add-flavor")) return openPicker(b.dataset.target, -1);
    if (b.id === "pdAdd") return submit(b);
  };
}

/* ---------- Seletor de sabores ---------- */
function openPicker(target, replaceIndex) {
  const p = S.product;
  let productId, sizeId, allowed = null, current;
  if (target === "main") { productId = p.id; sizeId = S.sizeId; current = S.flavorIds; }
  else {
    const part = p.parts.find((x) => x.id === target);
    productId = part.productId; sizeId = part.sizeId; allowed = part.allowedFlavorIds?.length ? part.allowedFlavorIds : null; current = S.parts[target].flavorIds;
  }
  const base = target === "main" ? null : cheapestFlavorCents(idx, productId, sizeId, allowed);
  const all = flavorsOf(idx, productId).filter((f) => !allowed || allowed.includes(f.id));
  const tiers = new Set(all.map((f) => f.tier));
  let q = "", tier = "";
  const panel = document.createElement("div");
  panel.className = "picker";
  panel.setAttribute("data-escape", "");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Escolher sabor");
  const list = () => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    return all.filter((f) => (!tier || f.tier === tier) && terms.every((t) => norm(`${f.name} ${f.description} ${(f.tags || []).join(" ")}`).includes(t)));
  };
  const priceLabel = (f) => {
    if (!sizeId) { const v = Object.values(f.prices || {}).map(Number).filter(Boolean); return v.length ? `a partir de ${brl(Math.min(...v))}` : ""; }
    const c = flavorPriceCents(f, sizeId);
    if (c === null) return "indisponível";
    if (base !== null) return c > base ? `+ ${brlC(c - base)}` : "incluso";
    return brlC(c);
  };
  const draw = () => {
    const items = list();
    setHTML(panel.querySelector(".picker-list"), items.length ? items.map((f) => {
      const unavailable = sizeId && flavorPriceCents(f, sizeId) === null;
      const already = current.includes(f.id) && current[replaceIndex] !== f.id;
      return html`<button type="button" class="pick" data-pick="${f.id}" aria-disabled="${unavailable || already}">
        <img src="${thumbUrl(f.image)}" alt="" loading="lazy">
        <span><strong>${f.name}${f.tier === "especial" ? html` <span class="mk">especial</span>` : ""}</strong><small>${already ? "Já escolhido" : f.description}</small></span>
        <span class="pp">${priceLabel(f)}</span>
      </button>`;
    }) : html`<p class="empty">Nenhum sabor encontrado.</p>`);
  };
  setHTML(panel, html`<div class="picker-head">
      <div class="row"><button type="button" class="round-btn" data-back aria-label="Voltar">←</button><h3>Escolha ${replaceIndex >= 0 ? "o novo sabor" : "um sabor"}</h3></div>
      <label class="search" style="width:100%"><span class="sr-only">Buscar sabor</span><input type="search" placeholder="Buscar: calabresa, frango, chocolate…" id="pickSearch" autocomplete="off"></label>
      ${tiers.size > 1 ? html`<div class="chips" style="margin:0"><button type="button" class="chip" data-tier="" aria-pressed="true">Todos</button><button type="button" class="chip" data-tier="tradicional" aria-pressed="false">Tradicionais</button><button type="button" class="chip" data-tier="especial" aria-pressed="false">Especiais</button></div>` : ""}
    </div>
    <div class="picker-list"></div>`);
  dlg().appendChild(panel);
  draw();
  const input = panel.querySelector("#pickSearch");
  setTimeout(() => input.focus({ preventScroll: true }), 50);
  input.addEventListener("input", () => { q = input.value; draw(); });
  const close = () => panel.remove();
  panel.addEventListener("escape", close);
  panel.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.target.closest("[data-back]")) return close();
    const chip = e.target.closest("[data-tier]");
    if (chip) { tier = chip.dataset.tier; panel.querySelectorAll("[data-tier]").forEach((c) => c.setAttribute("aria-pressed", String(c === chip))); return draw(); }
    const pick = e.target.closest("[data-pick]");
    if (!pick || pick.getAttribute("aria-disabled") === "true") return;
    if (replaceIndex >= 0) current[replaceIndex] = pick.dataset.pick; else current.push(pick.dataset.pick);
    close();
    render();
    const viz = $("#pizzaViz");
    viz?.animate?.([{ transform: "scale(.92) rotate(-8deg)" }, { transform: "scale(1) rotate(0)" }], { duration: 450, easing: "cubic-bezier(.34,1.56,.64,1)" });
  });
}

function submit(btn) {
  const sel = selection();
  const r = priceItem(idx, sel);
  if (!r.ok) {
    S.tried = true;
    render();
    dlg().querySelector(".err-box")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const img = $("#pdHeroImg");
  onAdd?.(sel, { editKey: S.editKey });
  flyToCart(img?.currentSrc || img?.src, btn);
  toast(S.editKey ? "Item atualizado" : `${r.title} no carrinho!`, "ok");
  closeLayer(layer());
}

