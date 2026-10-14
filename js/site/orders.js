/* "Meus pedidos": histórico neste aparelho + acompanhamento em tempo real + pedir de novo. */
import { html, $, setHTML, brlC, storage, timeAgo, fmtDateTime } from "./util.js";
import { state as apiState, getOrder, getStatuses } from "./api.js";
import { openLayer, closeLayer, isOpen } from "./dialog.js";
import { openCart } from "./checkout.js";
import { cart } from "./cart.js";
import { ORDER_STATUS } from "../shared/pricing.js";
import { toast } from "./fx.js";
import { icon } from "./icons.js";

const KEY = "fg_orders";
let pollTimer = null;
let viewing = null;
let idx = null;
const STEPS_DELIVERY = [["novo", "receipt", "Pedido recebido"], ["confirmado", "checkCircle", "Confirmado"], ["preparo", "flame", "No forno"], ["saiu", "scooter", "Saiu para entrega"], ["entregue", "house", "Entregue"]];
const STEPS_PICKUP = [["novo", "receipt", "Pedido recebido"], ["confirmado", "checkCircle", "Confirmado"], ["preparo", "flame", "No forno"], ["pronto", "bag", "Pronto para retirar"], ["entregue", "checkCircle", "Retirado"]];

export const history = () => storage.get(KEY, []).filter((o) => o && o.code).slice(0, 30);

export function rememberOrder(o) {
  const list = history().filter((x) => x.code !== o.code);
  list.unshift({ ...o, status: "novo" });
  storage.set(KEY, list.slice(0, 30));
  updateOrdersButton();
}

export function initOrders(menuIndex) {
  idx = menuIndex;
  updateOrdersButton();
  $("#ordersBtn").addEventListener("click", () => openOrders());
  refreshStatuses();
}
export function setOrdersIndex(menuIndex) { idx = menuIndex; }

function updateOrdersButton() {
  const list = history();
  $("#ordersBtn").hidden = !list.length;
  const active = list.some((o) => o.online && !["entregue", "cancelado"].includes(o.status));
  $("#ordersDot").hidden = !active;
}

async function refreshStatuses() {
  if (!apiState.online) return;
  const list = history();
  const codes = list.filter((o) => o.online && !["entregue", "cancelado"].includes(o.status)).map((o) => o.code);
  if (!codes.length) return;
  try {
    const res = await getStatuses(codes);
    const byCode = new Map(res.map((r) => [r.code, r]));
    const updated = list.map((o) => (byCode.has(o.code) ? { ...o, status: byCode.get(o.code).status } : o));
    storage.set(KEY, updated);
    updateOrdersButton();
    if (isOpen($("#ordersLayer")) && !viewing) renderList();
  } catch { /* sem conexão — tenta depois */ }
}

export function openOrders(code = null) {
  viewing = code;
  code ? renderTracking(code) : renderList();
  if (!isOpen($("#ordersLayer"))) openLayer($("#ordersLayer"), { onClose: () => { clearInterval(pollTimer); viewing = null; } });
  clearInterval(pollTimer);
  pollTimer = setInterval(() => (viewing ? renderTracking(viewing, true) : refreshStatuses()), 20000);
  if (!code) refreshStatuses();
}

function renderList() {
  const list = history();
  setHTML($("#ordersDrawer"), html`
    <div class="drawer-head"><h2 id="ordersTitle">Meus pedidos</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">×</button></div>
    <div class="drawer-body">
      ${!list.length ? html`<div class="cart-empty"><img class="mascot" src="assets/img/chef.webp" alt="" width="120" height="120"><h3>Nenhum pedido ainda</h3><p>Seus pedidos feitos neste aparelho aparecem aqui.</p></div>` : ""}
      ${list.map((o) => html`<div class="order-card">
        <div class="top"><span class="code">#${o.code}</span>${o.online ? html`<span class="st ${o.status}">${ORDER_STATUS[o.status]?.label || o.status}</span>` : html`<span class="st">Enviado pelo WhatsApp</span>`}</div>
        <small>${timeAgo(o.createdAt)} · ${brlC(o.totalCents)}</small>
        ${o.summary?.length ? html`<small style="color:var(--ink-2)">${o.summary.slice(0, 3).join(" · ")}${o.summary.length > 3 ? "…" : ""}</small>` : ""}
        <div class="acts">
          ${o.online && apiState.online ? html`<button type="button" class="btn btn-sm btn-ghost" data-track="${o.code}">Acompanhar</button>` : ""}
          <button type="button" class="btn btn-sm btn-green" data-again="${o.code}">Pedir de novo</button>
        </div>
      </div>`)}
      ${list.length ? html`<p class="counter" style="text-align:center"><button type="button" class="rm" id="clearHistory">Apagar histórico deste aparelho</button></p>` : ""}
    </div>`);
}

async function renderTracking(code, silent = false) {
  const drawer = $("#ordersDrawer");
  if (!silent) setHTML(drawer, html`<div class="drawer-head"><h2 id="ordersTitle">Pedido #${code}</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">×</button></div><div class="drawer-body"><div class="skeleton-grid" style="grid-template-columns:1fr"><div class="sk" style="height:220px"></div></div></div>`);
  let o;
  try { o = await getOrder(code); } catch (err) {
    if (!silent) setHTML(drawer.querySelector(".drawer-body"), html`<p class="empty">${err.status === 404 ? "Pedido não encontrado." : "Sem conexão agora. Tente de novo em instantes."}</p><button type="button" class="btn btn-ghost btn-block" data-back>← Meus pedidos</button>`);
    return;
  }
  if (viewing !== code) return;
  const list = history().map((x) => (x.code === code ? { ...x, status: o.status } : x));
  storage.set(KEY, list); updateOrdersButton();
  const steps = o.mode === "pickup" ? STEPS_PICKUP : STEPS_DELIVERY;
  const cur = ORDER_STATUS[o.status]?.step ?? 0;
  const eventAt = (s) => o.events.filter((e) => e.status === s).pop()?.at;
  setHTML(drawer, html`
    <div class="drawer-head"><h2 id="ordersTitle">Pedido #${o.code}</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">×</button></div>
    <div class="drawer-body">
      <p style="font-weight:800">Olá, ${o.customerFirstName}! ${o.status === "cancelado" ? "Este pedido foi cancelado. Fale com a gente no WhatsApp se precisar." : o.status === "entregue" ? "Bom apetite!" : "Acompanhe aqui — a página atualiza sozinha."}</p>
      ${o.status === "cancelado" ? html`<p class="st cancelado" style="margin:12px 0">Cancelado</p>` : html`<div class="timeline">
        ${steps.map(([s, ico, label]) => {
          const st = ORDER_STATUS[s].step;
          const cls = st < cur || (st === cur && s === "entregue") ? "done" : st === cur ? "now" : "todo";
          const at = eventAt(s);
          return html`<div class="tl ${cls}"><span class="b">${cls === "done" ? icon("check") : icon(ico)}</span><div><strong>${label}</strong>${at ? html`<small>${fmtDateTime(at)}</small>` : ""}</div></div>`;
        })}
      </div>`}
      <div class="summary">
        ${o.items.map((it) => html`<div class="it"><span>${it.qty}× ${it.title}</span><span>${brlC(it.totalCents)}</span></div>`)}
        <hr>
        ${o.deliveryFeeCents ? html`<div class="it"><span>Entrega</span><span>${brlC(o.deliveryFeeCents)}</span></div>` : ""}
        <div class="it" style="font-weight:900;color:var(--ink)"><span style="color:var(--ink)">Total</span><span>${brlC(o.totalCents)}</span></div>
      </div>
      <div style="display:grid;gap:10px;margin-top:16px">
        <button type="button" class="btn btn-green btn-block" data-again="${o.code}">Pedir de novo</button>
        <button type="button" class="btn btn-ghost btn-block" data-back>← Meus pedidos</button>
      </div>
    </div>`);
}

$("#ordersDrawer").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.track) { viewing = b.dataset.track; renderTracking(viewing); }
  if (b.hasAttribute("data-back")) { viewing = null; renderList(); refreshStatuses(); }
  if (b.id === "clearHistory" && confirm("Apagar o histórico de pedidos deste aparelho?")) { storage.set(KEY, []); updateOrdersButton(); renderList(); }
  if (b.dataset.again) {
    const o = history().find((x) => x.code === b.dataset.again);
    if (!o?.items?.length) return toast("Não foi possível repetir esse pedido.", "err");
    let ok = 0, fail = 0;
    for (const sel of o.items) {
      const p = idx && cart.priced(sel);
      if (p && p.ok) { cart.add(sel); ok++; } else fail++;
    }
    toast(fail ? `${ok} item(ns) adicionados — ${fail} não estão mais disponíveis.` : "Itens adicionados ao carrinho!", fail ? "" : "ok", 3600);
    // já mostra o carrinho com os itens (antes a pessoa ficava na gaveta sem ver o que entrou)
    if (ok) { closeLayer($("#ordersLayer"), { silent: true }); clearInterval(pollTimer); viewing = null; setTimeout(openCart, 220); }
  }
});
