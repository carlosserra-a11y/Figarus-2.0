/* ============================================================
   Gaveta do carrinho + finalização do pedido.
   ============================================================ */
import { html, raw, $, setHTML, brl, brlC, storage, maskPhone, maskCep, norm } from "./util.js";
import { thumbUrl, state as apiState, createOrder } from "./api.js";
import { openLayer, closeLayer, isOpen } from "./dialog.js";
import { cart } from "./cart.js";
import { toCents, fromCents, buildWhatsAppText, PAYMENT_LABELS, priceCart, parseDecimal } from "../shared/pricing.js";
import { toast, confetti, flyToCart } from "./fx.js";
import { rememberOrder, openOrders } from "./orders.js";
import { icon } from "./icons.js";

let idx = null;
let menu = null;
let openBuilderFn = null;
const CUSTOMER_KEY = "fg_customer";

const ck = {
  name: "", phone: "", mode: "delivery",
  address: { cep: "", street: "", number: "", complement: "", district: "", reference: "" },
  payment: "pix", changeFor: "", notes: "", remember: true,
  errors: {}, sending: false, serverError: "", done: null, cepInfo: "",
};

export function initCheckout(menuIndex, menuData, { openBuilder }) {
  idx = menuIndex; menu = menuData; openBuilderFn = openBuilder;
  const saved = storage.get(CUSTOMER_KEY);
  if (saved) Object.assign(ck, { name: saved.name || "", phone: saved.phone || "", mode: saved.mode || "delivery", address: { ...ck.address, ...(saved.address || {}) }, payment: saved.payment || "pix" });
  if (menu.store.deliveryEnabled === false) ck.mode = "pickup";
  if (menu.store.pickupEnabled === false) ck.mode = "delivery";
  cart.subscribe(() => { renderCartBadge(); if (isOpen($("#cartLayer"))) renderCart(); });
  renderCartBadge();
}
export function setCheckoutMenu(menuIndex, menuData) { idx = menuIndex; menu = menuData; renderCartBadge(); }

/* ---------- Contador no cabeçalho e botão flutuante ---------- */
export function renderCartBadge() {
  const n = cart.count();
  $("#cartCount").textContent = n;
  const t = cart.totals({ mode: "pickup" });
  $("#floatingCount").textContent = n;
  $("#floatingTotal").textContent = brlC(t?.subtotalCents || 0);
  $("#floatingCart").hidden = n === 0 || isOpen($("#cartLayer")) || isOpen($("#checkoutLayer"));
}

/* ---------- Carrinho ---------- */
export function openCart() {
  renderCart();
  openLayer($("#cartLayer"), { onClose: renderCartBadge });
  renderCartBadge();
}

function upsellHtml() {
  const inCart = new Set(cart.items.map((i) => i.productId));
  const drinks = [...idx.products.values()].filter((p) => p.categoryId === "bebidas" && p.kind === "simple" && !inCart.has(p.id)).slice(0, 8);
  const hasPizza = cart.items.some((i) => { const p = idx.products.get(i.productId); return p && p.kind !== "simple"; });
  if (!drinks.length || !hasPizza) return "";
  return html`<div class="upsell"><h4>${icon("soda")}Que tal uma bebida gelada?</h4><div class="upsell-row">
    ${drinks.map((d) => html`<button type="button" class="up" data-upsell="${d.id}"><img src="${thumbUrl(d.image)}" alt="" loading="lazy"><span>${d.name}</span><b>+ ${brl(d.price)}</b></button>`)}
  </div></div>`;
}

function renderCart() {
  const drawer = $("#cartDrawer");
  const totals = cart.totals({ mode: "pickup" });
  const items = cart.items;
  const min = toCents(menu.store.minOrder);
  const sub = totals?.subtotalCents || 0;
  const invalid = totals?.items.some((p) => !p.ok);
  setHTML(drawer, html`
    <div class="drawer-head"><h2 id="cartTitle">Seu pedido</h2><button type="button" class="icon-btn" data-close aria-label="Fechar carrinho">×</button></div>
    <div class="drawer-body">
      ${!items.length ? html`<div class="cart-empty"><img class="mascot" src="assets/img/chef.webp" alt="" width="120" height="120"><h3>Seu carrinho está vazio</h3><p>O Figaro já acendeu o forno — bora escolher uma pizza?</p><a class="btn btn-primary" href="#cardapio" data-close>Ver cardápio</a></div>` : ""}
      ${items.map((it, i) => {
        const p = totals.items[i];
        return html`<div class="cart-item">
          <img src="${thumbUrl(p.image)}" alt="" loading="lazy">
          <div>
            <h4>${p.title}</h4>
            ${p.lines.length ? html`<ul>${p.lines.map((l) => html`<li>${l}</li>`)}</ul>` : ""}
            ${!p.ok ? html`<p class="err-box">${p.errors[0]} Edite ou remova este item.</p>` : ""}
            <div class="row">
              <div class="stepper sm"><button type="button" data-q="${it.key}" data-d="-1" aria-label="Diminuir">−</button><output>${it.qty}</output><button type="button" data-q="${it.key}" data-d="1" aria-label="Aumentar" ${it.qty >= 50 ? "disabled" : ""}>+</button></div>
              <span class="lp">${brlC(p.totalCents)}</span>
            </div>
            <div class="row" style="margin-top:6px;justify-content:flex-start;gap:14px">
              ${idx.products.get(it.productId)?.kind !== "simple" ? html`<button type="button" class="rm" data-edit="${it.key}">Editar</button>` : ""}
              <button type="button" class="rm" data-rm="${it.key}">Remover</button>
            </div>
          </div>
        </div>`;
      })}
      ${items.length ? upsellHtml() : ""}
    </div>
    ${items.length ? html`<div class="drawer-foot">
      ${min && sub < min ? html`<div class="min-bar"><p>Faltam ${brlC(min - sub)} para o pedido mínimo de ${brlC(min)}</p><div class="progress"><i style="width:${Math.round((sub / min) * 100)}%"></i></div></div>` : ""}
      <div class="sum-line"><span>Subtotal</span><span>${brlC(sub)}</span></div>
      <div class="sum-line"><span>Entrega</span><span>calculada a seguir</span></div>
      <div class="sum-line total"><span>Total</span><span>${brlC(sub)}</span></div>
      <button type="button" class="btn btn-primary btn-lg btn-block" id="goCheckout" ${(min && sub < min) || invalid ? "disabled" : ""}>Finalizar pedido →</button>
      <p class="counter" style="text-align:center;margin-top:8px"><button type="button" class="rm" id="clearCart">Esvaziar carrinho</button></p>
    </div>` : ""}
  `);
}

$("#cartDrawer").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.q) { const it = cart.items.find((x) => x.key === b.dataset.q); if (it) cart.setQty(it.key, it.qty + Number(b.dataset.d)); return; }
  if (b.dataset.rm) { cart.remove(b.dataset.rm); toast("Item removido"); return; }
  if (b.dataset.edit) {
    const it = cart.items.find((x) => x.key === b.dataset.edit);
    closeLayer($("#cartLayer"), { silent: true });
    // ao salvar (ou desistir), volta para o carrinho — a pessoa estava revisando o pedido
    setTimeout(() => openBuilderFn({ productId: it.productId, edit: it, onDone: openCart }), 220);
    return;
  }
  if (b.dataset.upsell) { cart.add({ productId: b.dataset.upsell, qty: 1 }); flyToCart(b.querySelector("img")?.src, b); toast("Bebida adicionada", "ok"); return; }
  if (b.id === "clearCart") { if (confirm("Esvaziar o carrinho?")) cart.clear(); return; }
  if (b.id === "goCheckout") { closeLayer($("#cartLayer"), { silent: true }); setTimeout(openCheckout, 220); }
});

/** Loja abriu/fechou enquanto o checkout estava aberto: redesenha sem perder o que foi digitado. */
export function onStoreStatusChange() {
  if (!isOpen($("#checkoutLayer")) || ck.done || ck.sending) return;
  readForm();
  renderCheckout();
}

/* ---------- Checkout ---------- */
export function openCheckout() {
  ck.done = null; ck.serverError = ""; ck.errors = {};
  renderCheckout();
  openLayer($("#checkoutLayer"), { onClose: () => { renderCartBadge(); if (ck.done) { ck.done = null; } } });
  renderCartBadge();
}

function cartNow() {
  return priceCart(idx, cart.items, { mode: ck.mode, district: ck.address.district });
}

function field(id, label, value, { type = "text", cls = "", attrs = "", hint = "", ac = "" } = {}) {
  const err = ck.errors[id];
  return html`<div class="field ${cls}">
    <label for="ck_${id}">${label}</label>
    <input class="input ${err ? "invalid" : ""}" id="ck_${id}" name="${id}" type="${type}" value="${value}" ${ac ? html`autocomplete="${ac}"` : ""} ${err ? html`aria-invalid="true" aria-describedby="err_${id}"` : ""} ${attrs ? raw(attrs) : ""}>
    ${err ? html`<p class="ferr" id="err_${id}">${err}</p>` : hint ? html`<p class="hint">${hint}</p>` : ""}
  </div>`;
}

function renderCheckout() {
  const box = $("#checkoutDialog");
  if (ck.done) return renderSuccess(box);
  const store = menu.store;
  const c = cartNow();
  const closed = !menu.status?.open;
  const areas = Array.isArray(store.deliveryAreas) ? store.deliveryAreas : [];
  const a = ck.address;
  setHTML(box, html`
    <button type="button" class="dialog-close" data-close aria-label="Fechar">×</button>
    <div class="dialog-scroll">
      <div class="dialog-head"><h2 id="checkoutTitle">Finalizar pedido</h2><p>Confira seus dados — leva menos de 1 minuto.</p></div>
      <form class="ck-body" id="ckForm" novalidate>
        ${closed ? html`<div class="closed-box">${icon("moon")}<div>${menu.status?.label || "Fechado agora"}${menu.status?.detail ? ` — ${menu.status.detail}` : ""}. Você pode deixar tudo pronto e enviar quando abrirmos.</div></div>` : ""}

        <section class="ck-section">
          <h3>${icon("user")}Seus dados</h3>
          <div class="form-grid">
            ${field("name", "Nome completo", ck.name, { cls: "c3", ac: "name", attrs: 'maxlength="80"' })}
            ${field("phone", "WhatsApp / telefone", ck.phone, { cls: "c3", type: "tel", ac: "tel-national", attrs: 'inputmode="tel" maxlength="16" placeholder="(48) 99999-9999"' })}
          </div>
        </section>

        <section class="ck-section">
          <h3>${icon("scooter")}Como você quer receber?</h3>
          <div class="seg" role="radiogroup" aria-label="Entrega ou retirada">
            ${store.deliveryEnabled !== false ? html`<button type="button" class="opt" role="radio" aria-checked="${ck.mode === "delivery"}" data-mode="delivery">${icon("scooter")}<span class="t">Entrega</span><span class="s">${store.etaDelivery || "no seu endereço"}</span></button>` : ""}
            ${store.pickupEnabled !== false ? html`<button type="button" class="opt" role="radio" aria-checked="${ck.mode === "pickup"}" data-mode="pickup">${icon("bag")}<span class="t">Retirar</span><span class="s">${store.etaPickup || "no balcão, sem taxa"}</span></button>` : ""}
          </div>
        </section>

        ${ck.mode === "delivery" ? html`<section class="ck-section">
          <h3>${icon("pin")}Endereço de entrega</h3>
          <div class="form-grid">
            ${field("cep", "CEP", a.cep, { cls: "c2 keep", attrs: 'inputmode="numeric" maxlength="9" placeholder="88130-000"', ac: "postal-code", hint: ck.cepInfo })}
            ${field("street", "Rua / avenida", a.street, { cls: "c4 keep", ac: "address-line1", attrs: 'maxlength="120"' })}
            ${field("number", "Número", a.number, { cls: "c2 keep", attrs: 'maxlength="12" inputmode="text"' })}
            ${field("complement", "Complemento", a.complement, { cls: "c4 keep", attrs: 'maxlength="60" placeholder="Apto, bloco, casa…"', ac: "address-line2" })}
            ${areas.length ? html`<div class="field c3"><label for="ck_district">Bairro</label>
                <select class="select ${ck.errors.district ? "invalid" : ""}" id="ck_district" name="district">
                  <option value="">Selecione…</option>
                  ${areas.map((ar) => html`<option value="${ar.name}" ${norm(ar.name) === norm(a.district) ? "selected" : ""}>${ar.name} — ${ar.fee > 0 ? brl(ar.fee) : "grátis"}</option>`)}
                  <option value="__outro" ${a.district && !areas.some((ar) => norm(ar.name) === norm(a.district)) ? "selected" : ""}>Outro bairro</option>
                </select>${ck.errors.district ? html`<p class="ferr">${ck.errors.district}</p>` : ""}</div>
                ${a.district && !areas.some((ar) => norm(ar.name) === norm(a.district)) ? field("districtOther", "Qual bairro?", a.district === "__outro" ? "" : a.district, { cls: "c3" }) : ""}`
              : field("district", "Bairro", a.district, { cls: "c3", attrs: 'maxlength="60"' })}
            ${field("reference", "Ponto de referência", a.reference, { cls: "c3", attrs: 'maxlength="100" placeholder="Opcional"' })}
          </div>
        </section>` : html`<section class="ck-section"><h3>${icon("bag")}Retirada</h3><p class="hint" style="font-weight:700">${store.address}</p></section>`}

        <section class="ck-section">
          <h3>${icon("card")}Pagamento <small style="font-weight:700;color:var(--ink-3)">(na entrega/retirada)</small></h3>
          <div class="seg" role="radiogroup" aria-label="Forma de pagamento">
            ${["pix", "credito", "debito", "dinheiro"].map((m) => html`<button type="button" class="opt" role="radio" aria-checked="${ck.payment === m}" data-pay="${m}">${icon({ pix: "pix", credito: "card", debito: "card", dinheiro: "cash" }[m])}<span class="t">${{ pix: "PIX", credito: "Crédito", debito: "Débito", dinheiro: "Dinheiro" }[m]}</span></button>`)}
          </div>
          ${ck.payment === "dinheiro" ? html`<div class="form-grid" style="margin-top:12px">${field("changeFor", "Troco para quanto?", ck.changeFor, { cls: "c3", attrs: 'inputmode="decimal" placeholder="Ex.: 100 (deixe vazio se não precisar)"' })}</div>` : ""}
          ${ck.payment === "pix" ? html`<p class="hint" style="margin-top:8px">Enviamos a chave PIX pelo WhatsApp junto com a confirmação.</p>` : ""}
        </section>

        <section class="ck-section">
          <h3>${icon("note")}Observações do pedido</h3>
          <textarea class="textarea" id="ck_notes" name="notes" maxlength="300" rows="2" placeholder="Ex.: interfone com defeito, me liga quando chegar.">${ck.notes}</textarea>
        </section>

        <section class="ck-section">
          <h3>${icon("receipt")}Resumo</h3>
          <div class="summary">
            ${c.items.map((p) => html`<div class="it"><span>${p.qty}× ${p.title}</span><span>${brlC(p.totalCents)}</span></div>`)}
            <hr>
            <div class="it"><span>Subtotal</span><span>${brlC(c.subtotalCents)}</span></div>
            ${ck.mode === "delivery" ? html`<div class="it"><span>Taxa de entrega${areas.length ? "" : " (pode variar por bairro)"}</span><span>${c.deliveryFeeCents ? brlC(c.deliveryFeeCents) : "grátis"}</span></div>` : ""}
            <div class="it" style="font-size:18px;color:var(--ink);font-weight:900"><span style="color:var(--ink)">Total</span><span>${brlC(c.totalCents)}</span></div>
          </div>
        </section>

        <label class="check"><input type="checkbox" id="ck_remember" ${ck.remember ? "checked" : ""}> Lembrar meus dados neste aparelho para o próximo pedido</label>
        ${ck.serverError ? html`<div class="err-box" role="alert">${ck.serverError}</div>` : ""}
        ${ck.serverError && ck.fallback ? html`<button type="button" class="btn btn-whats btn-block" id="fallbackWhats">Enviar pelo WhatsApp</button>` : ""}
        ${!c.ok && cart.items.length ? html`<div class="err-box" role="alert">${c.errors[0]}</div>` : ""}
        <button type="submit" class="btn btn-primary btn-lg btn-block" id="ckSubmit" ${ck.sending || closed || !c.ok ? "disabled" : ""}>
          ${ck.sending ? "Enviando…" : closed ? "Estamos fechados agora" : `Confirmar pedido · ${brlC(c.totalCents)}`}
        </button>
        ${!apiState.online ? html`<p class="hint" style="text-align:center">Seu pedido será enviado pelo WhatsApp da loja.</p>` : ""}
      </form>
    </div>
  `);
  bindCheckout();
}

function readForm() {
  const f = $("#ckForm");
  if (!f) return;
  const v = (n) => f.elements[n]?.value ?? "";
  ck.name = v("name"); ck.phone = v("phone"); ck.notes = v("notes");
  if (ck.mode === "delivery") {
    const a = ck.address;
    a.cep = v("cep"); a.street = v("street"); a.number = v("number"); a.complement = v("complement"); a.reference = v("reference");
    if (f.elements.district?.tagName === "SELECT") {
      const sel = v("district");
      a.district = sel === "__outro" ? (f.elements.districtOther ? v("districtOther") || "__outro" : "__outro") : sel;
    } else a.district = v("district");
  }
  if (ck.payment === "dinheiro") ck.changeFor = v("changeFor");
  ck.remember = $("#ck_remember")?.checked ?? true;
}

function bindCheckout() {
  const f = $("#ckForm");
  if (!f) return;
  const phone = f.elements.phone;
  phone.addEventListener("input", () => { phone.value = maskPhone(phone.value); });
  const cep = f.elements.cep;
  if (cep) {
    cep.addEventListener("input", () => {
      cep.value = maskCep(cep.value);
      if (cep.value.replace(/\D/g, "").length === 8) lookupCep(cep.value);
    });
  }
  f.elements.district?.addEventListener?.("change", () => { readForm(); renderCheckout(); });
  f.addEventListener("click", (e) => {
    const b = e.target.closest("button[type=button]");
    if (!b) return;
    if (b.dataset.mode) { readForm(); ck.mode = b.dataset.mode; ck.errors = {}; renderCheckout(); }
    if (b.dataset.pay) { readForm(); ck.payment = b.dataset.pay; renderCheckout(); }
  });
  f.addEventListener("submit", (e) => { e.preventDefault(); submitOrder(); });
}

async function lookupCep(value) {
  const digits = value.replace(/\D/g, "");
  readForm();
  ck.cepInfo = "Buscando endereço…";
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const d = await res.json();
    if (d.erro) { ck.cepInfo = "CEP não encontrado — preencha o endereço."; }
    else {
      ck.address.street = d.logradouro || ck.address.street;
      if (!(menu.store.deliveryAreas || []).length || (menu.store.deliveryAreas || []).some((a) => norm(a.name) === norm(d.bairro))) ck.address.district = d.bairro || ck.address.district;
      ck.cepInfo = d.localidade ? `${d.localidade}/${d.uf}${norm(d.localidade) !== "palhoca" ? " — confirme se entregamos aí" : ""}` : "";
    }
  } catch { ck.cepInfo = ""; }
  renderCheckout();
  const num = $("#ck_number");
  if (num && !num.value) num.focus();
}

function validate() {
  const e = {};
  if (ck.name.trim().length < 2) e.name = "Informe seu nome.";
  const d = ck.phone.replace(/\D/g, "");
  if (d.length < 10 || d.length > 11) e.phone = "Informe um telefone com DDD.";
  if (ck.mode === "delivery") {
    const a = ck.address;
    if (!a.street.trim()) e.street = "Informe a rua.";
    if (!a.number.trim()) e.number = "Informe o número (ou S/N).";
    if (a.district === "__outro") e.districtOther = "Informe o bairro.";
    else if (!a.district.trim()) e.district = "Informe o bairro.";
  }
  if (ck.payment === "dinheiro" && ck.changeFor.trim()) {
    const n = parseDecimal(ck.changeFor);
    const total = cartNow().totalCents;
    if (!Number.isFinite(n) || toCents(n) < total) e.changeFor = `Precisa ser maior que o total (${brlC(total)}).`;
  }
  return e;
}

async function submitOrder() {
  readForm();
  ck.errors = validate();
  ck.serverError = "";
  ck.fallback = null;
  if (Object.keys(ck.errors).length) {
    renderCheckout();
    $("#checkoutDialog .invalid")?.focus();
    return;
  }
  const payload = {
    customer: { name: ck.name.trim(), phone: ck.phone },
    mode: ck.mode,
    address: ck.mode === "delivery" ? { ...ck.address } : null,
    payment: { method: ck.payment, ...(ck.payment === "dinheiro" && ck.changeFor.trim() ? { changeFor: parseDecimal(ck.changeFor) } : {}) },
    notes: ck.notes.trim(),
    items: cart.items.map(({ key, ...sel }) => sel),
  };
  if (ck.remember) storage.set(CUSTOMER_KEY, { name: ck.name, phone: ck.phone, mode: ck.mode, address: ck.address, payment: ck.payment });
  else storage.remove(CUSTOMER_KEY);

  const c = cartNow();
  if (!apiState.online) return finishOffline(payload, c);

  ck.sending = true; renderCheckout();
  try {
    const res = await createOrder(payload);
    ck.done = { code: res.code, whatsappUrl: res.whatsappUrl, totalCents: res.totalCents, online: true };
    rememberOrder({ code: res.code, createdAt: res.createdAt, totalCents: res.totalCents, items: payload.items, online: true, summary: c.items.map((p) => `${p.qty}× ${p.title}`) });
    cart.clear();
    confetti();
  } catch (err) {
    if (err.status && err.status < 500) {
      ck.serverError = err.message;
      if (err.data?.field) ck.errors[err.data.field] = err.message;
    } else {
      ck.serverError = "Não conseguimos falar com o servidor agora. Você pode enviar o pedido direto pelo WhatsApp.";
      ck.fallback = payload;
    }
  } finally {
    ck.sending = false;
    renderCheckout();
  }
}

function finishOffline(payload, c) {
  const code = "W" + Date.now().toString(36).toUpperCase().slice(-5);
  const text = buildWhatsAppText({ store: menu.store, code, customer: payload.customer, mode: payload.mode, address: payload.address, payment: payload.payment, notes: payload.notes, cart: c });
  ck.done = { code, whatsappUrl: `https://wa.me/${menu.store.whatsapp}?text=${encodeURIComponent(text)}`, totalCents: c.totalCents, online: false };
  rememberOrder({ code, createdAt: new Date().toISOString(), totalCents: c.totalCents, items: payload.items, online: false, summary: c.items.map((p) => `${p.qty}× ${p.title}`) });
  cart.clear();
  confetti();
  renderCheckout();
}

function renderSuccess(box) {
  const d = ck.done;
  setHTML(box, html`
    <button type="button" class="dialog-close" data-close aria-label="Fechar">×</button>
    <div class="dialog-scroll"><div class="success">
      <svg class="check-anim" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45"/><path d="M30 52 l14 14 l27 -30"/></svg>
      <h2 id="checkoutTitle">${d.online ? "Pedido recebido!" : "Quase lá!"}</h2>
      <div class="code" aria-label="Código do pedido">#${d.code}</div>
      <p>${d.online
        ? "Seu pedido já está no nosso sistema. Para agilizar a confirmação, envie também o resumo pelo WhatsApp — é só tocar no botão:"
        : "Toque no botão abaixo para enviar o pedido pelo WhatsApp da Figaro's. A confirmação chega por lá."}</p>
      <div class="actions">
        ${d.whatsappUrl ? html`<a class="btn btn-whats btn-lg" href="${d.whatsappUrl}" target="_blank" rel="noopener noreferrer">Enviar no WhatsApp</a>` : ""}
        ${d.online ? html`<button type="button" class="btn btn-ghost" id="trackBtn">Acompanhar pedido</button>` : ""}
        <button type="button" class="btn btn-ghost" data-close>Voltar ao site</button>
      </div>
      <p style="font-size:14px">Total: <strong>${brlC(d.totalCents)}</strong></p>
    </div></div>`);
  $("#trackBtn")?.addEventListener("click", () => { closeLayer($("#checkoutLayer"), { silent: true }); setTimeout(() => openOrders(d.code), 220); });
}

// Pedido via WhatsApp quando o servidor falhar
$("#checkoutDialog").addEventListener("click", (e) => {
  if (e.target.id === "fallbackWhats" && ck.fallback) finishOffline(ck.fallback, cartNow());
});
