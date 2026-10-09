// Menú principal de 99copias.
// Para usarlo, cada página incluye al inicio del <body>:  <script src="/menu.js"></script>
// Para agregar, quitar o renombrar items, editá solo el objeto MENU de acá abajo.
(function () {
  var MENU = {
    logo: { href: '/', src: '/99copias-logo.svg', alt: '99copias', label: '99copias inicio' },
    items: [
      { label: 'Cómo funciona',   href: '/#como' },
      { label: 'Precios',         href: '/#precios' },
      { label: 'Zonas de entrega', href: '/zonas-de-entrega' },
      { label: 'Preguntas',       href: '/#faq' },
      { label: 'Contacto',        href: '/contacto' }
    ],
    cta: { label: 'Imprimir', href: 'https://app.99copias.com.ar' }
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var path = location.pathname.replace(/\/$/, '') || '/';
  var links = MENU.items.map(function (it) {
    // Marca la página actual (solo links sin #ancla)
    var current = it.href.indexOf('#') === -1 && it.href.replace(/\/$/, '') === path;
    return '<a href="' + esc(it.href) + '"' + (current ? ' aria-current="page"' : '') + '>' + esc(it.label) + '</a>';
  }).join('\n');

  var html =
    '<header class="nav">' +
      '<div class="wrap nav-inner">' +
        '<a href="' + esc(MENU.logo.href) + '" class="logo" aria-label="' + esc(MENU.logo.label) + '">' +
          '<img src="' + esc(MENU.logo.src) + '" alt="' + esc(MENU.logo.alt) + '" />' +
        '</a>' +
        '<nav class="nav-links" id="navLinks" aria-label="Principal">' + links + '</nav>' +
        '<div class="nav-cta">' +
          '<a href="' + esc(MENU.cta.href) + '" class="btn btn-mustard" style="padding:10px 20px">' + esc(MENU.cta.label) + '</a>' +
          '<button class="burger" id="burger" aria-label="Abrir menú" aria-expanded="false"><span></span><span></span><span></span></button>' +
        '</div>' +
      '</div>' +
    '</header>';

  document.body.insertAdjacentHTML('afterbegin', html);

  // Menú mobile
  var burger = document.getElementById('burger');
  var nav = document.getElementById('navLinks');
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });
})();
