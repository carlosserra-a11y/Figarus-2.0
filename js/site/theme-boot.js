/* ============================================================
   Roda ANTES do CSS pintar a página (script clássico no <head>):
   - tema: o que a pessoa escolheu no botão; senão "Forno à Noite" (escuro)
   - abertura (preloader): só na primeira visita da sessão e sem "reduzir movimento"
   Arquivo separado (e não <script> inline) porque o servidor bloqueia scripts inline (CSP).
   ============================================================ */
(function () {
  var html = document.documentElement;
  var theme = null;
  try { theme = localStorage.getItem("fg-theme"); } catch (e) { /* sem armazenamento */ }
  html.setAttribute("data-theme", theme === "light" || theme === "dark" ? theme : "dark");

  var params = new URLSearchParams(location.search);
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var seen = false;
  try { seen = sessionStorage.getItem("fg-intro") === "1"; sessionStorage.setItem("fg-intro", "1"); } catch (e) { seen = true; }
  if (!seen && !reduced && !params.has("nointro")) html.classList.add("intro");
})();
