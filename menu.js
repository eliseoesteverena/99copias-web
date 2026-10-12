// Menú móvil de 99copias. El menú en sí vive en partials/header.html (se arma en el build);
// acá solo está el comportamiento del botón de hamburguesa.
(function () {
  var burger = document.getElementById('burger');
  var nav = document.getElementById('navLinks');
  if (!burger || !nav) return;

  function set(open) {
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }

  burger.addEventListener('click', function () { set(!nav.classList.contains('open')); });
  nav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); burger.focus(); }
  });
})();
