/* ============================================================
   Abertura (preloader): a pizza se monta, a logo aparece e a cortina sobe.
   Só na primeira visita da sessão (theme-boot.js decide e põe html.intro).
   Quem anima e esconde é o CSS (funciona até se o JS falhar); aqui só
   limpamos a página depois. ?nointro na URL desliga.
   ============================================================ */
export function initIntro() {
  const el = document.querySelector(".intro-screen");
  const root = document.documentElement;
  if (!el) return;
  if (!root.classList.contains("intro")) { el.remove(); return; }
  const done = () => { root.classList.remove("intro"); el.remove(); };
  el.addEventListener("animationend", (e) => { if (e.target === el) done(); });
  setTimeout(done, 1600); // garantia
}
