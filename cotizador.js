// Cotizador de impresiones: PDF (por carilla) y fotos (por tamaño).
// Los archivos se leen en el dispositivo; nunca se suben desde esta página.
(function () {
  'use strict';

  var APP_URL = 'https://app.99copias.com.ar/';
  var APP_ORIGIN = 'https://app.99copias.com.ar';
  var PDF_LIB = '/vendor/pdf-lib-1.17.1.min.js';
  var BYN = 50, COLOR = 150, RING = 1500;
  var SIZES = [['6x8', '6 x 8', 250], ['9x13', '9 x 13', 650], ['10x15', '10 x 15', 800], ['13x18', '13 x 18', 1100], ['15x20', '15 x 20', 1900], ['20x25', '20 x 25', 2200]];

  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return '$' + Math.round(n).toLocaleString('es-AR'); };
  var num = function (el, min, max, def) {
    var v = parseInt(el.value, 10);
    if (isNaN(v)) v = def;
    return Math.max(min, Math.min(max, v));
  };
  var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

  // ---------- envío a la app ----------
  // 1) Web Share (celular con la app instalada: aparece en la lista de "compartir con")
  // 2) Ventana de la app + postMessage (la app responde {type:'99copias:listo'} y recibe los archivos)
  function sendToApp(files, meta, say) {
    // La app solo aparece en la lista de compartir donde los PWA pueden ser "share target" (Android/ChromeOS).
    // En iOS la lista no la incluye, así que ahí se usa la apertura directa de la app.
    var canShare = /Android|CrOS/i.test(navigator.userAgent) && !!(navigator.share && navigator.canShare && navigator.canShare({ files: files }));
    if (canShare) {
      say('Elegí 99copias en la lista para compartir los archivos.');
      navigator.share({ files: files, title: '99copias', text: 'Archivos para imprimir en 99copias' })
        .then(function () { say('Listo: enviamos los archivos a la app.'); })
        .catch(function (e) {
          if (e && e.name === 'AbortError') say('Cancelaste el envío. Podés intentarlo de nuevo.');
          else say('No pudimos compartirlos desde acá. Abrí la app y subí los archivos desde ahí.');
        });
      return;
    }
    var w = window.open(APP_URL + '?origen=cotizador', '99copias-app');
    if (!w) { say('Tu navegador bloqueó la ventana. Abrí la app y subí tus archivos desde ahí.'); return; }
    say('Abriendo la app…');
    var done = false;
    function onMsg(e) {
      if (e.origin !== APP_ORIGIN || !e.data || e.data.type !== '99copias:listo') return;
      done = true; clearTimeout(timer); window.removeEventListener('message', onMsg);
      w.postMessage({ type: '99copias:archivos', files: files, meta: meta }, APP_ORIGIN);
      say('Enviamos tus archivos a la app.');
    }
    var timer = setTimeout(function () {
      if (done) return;
      window.removeEventListener('message', onMsg);
      say('Abrimos la app. Si no ves tus archivos ahí, subilos desde la app.');
    }, 15000);
    window.addEventListener('message', onMsg);
  }

  function wireDrop(zone, input, pick, onFiles) {
    pick.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { if (input.files && input.files.length) onFiles(Array.prototype.slice.call(input.files)); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('dragover'); }); });
    ['dragleave', 'dragend', 'drop'].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('dragover'); }); });
    zone.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files; if (f && f.length) onFiles(Array.prototype.slice.call(f)); });
  }

  // =====================================================  DOCUMENTOS PDF
  (function () {
    var drop = $('qd-drop'); if (!drop) return;
    var input = $('qd-input'), pick = $('qd-pick'), list = $('qd-list'), status = $('qd-status');
    var count = $('qd-count'), range = $('qd-range'), ring = $('qd-ring'), cta = $('qd-cta');
    var files = []; // {file, pages}
    var say = function (t) { status.textContent = t; };

    function pages() { return num(count, 1, 100000, 50); }
    function render() {
      var p = pages(), nFiles = Math.max(1, files.length), extra = ring.checked ? RING * nFiles : 0;
      range.value = Math.min(1000, p);
      $('qd-count-out').textContent = p.toLocaleString('es-AR');
      $('qd-byn').textContent = fmt(p * BYN + extra);
      $('qd-color').textContent = fmt(p * COLOR + extra);
      $('qd-note').textContent = plural(p, 'carilla', 'carillas') + (ring.checked ? ' + anillado de ' + plural(nFiles, 'archivo', 'archivos') : '') + '. El total final lo ves en la app, antes de pagar.';
    }
    count.addEventListener('input', render);
    range.addEventListener('input', function () { count.value = range.value; render(); });
    ring.addEventListener('change', render);

    function renderList() {
      list.textContent = '';
      files.forEach(function (it, i) {
        var li = document.createElement('li');
        var name = document.createElement('span'); name.className = 'qp-name'; name.textContent = it.file.name;
        var pg = document.createElement('span'); pg.className = 'qp-pages'; pg.textContent = it.pages ? plural(it.pages, 'pág.', 'págs.') : 'no se pudo leer';
        var x = document.createElement('button'); x.type = 'button'; x.className = 'qp-x'; x.textContent = '×'; x.setAttribute('aria-label', 'Quitar ' + it.file.name);
        x.addEventListener('click', function () { files.splice(i, 1); afterChange(); });
        li.appendChild(name); li.appendChild(pg); li.appendChild(x); list.appendChild(li);
      });
    }
    function afterChange() {
      $('qd-clear').hidden = !files.length;
      renderList();
      var total = files.reduce(function (a, f) { return a + f.pages; }, 0);
      if (total) { count.value = Math.min(100000, total); say(plural(files.filter(function (f) { return f.pages; }).length, 'archivo', 'archivos') + ' · ' + plural(total, 'página detectada', 'páginas detectadas') + '.'); }
      else if (files.length) say('No pudimos leer esos PDF. Ajustá la cantidad a mano.');
      else say('');
      render();
    }

    var libPromise = null;
    function loadLib() {
      if (window.PDFLib) return Promise.resolve(window.PDFLib);
      if (!libPromise) libPromise = new Promise(function (ok, fail) {
        var s = document.createElement('script'); s.src = PDF_LIB; s.async = true;
        s.onload = function () { ok(window.PDFLib); }; s.onerror = function () { libPromise = null; fail(new Error('pdf-lib')); };
        document.head.appendChild(s);
      });
      return libPromise;
    }
    // el lector de PDF se descarga en segundo plano cuando el navegador está libre
    window.addEventListener('load', function () { (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(function () { loadLib().catch(function () {}); }); });

    wireDrop(drop, input, pick, function (picked) {
      var pdfs = picked.filter(function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); });
      if (!pdfs.length) { say('No detectamos archivos PDF. Probá con uno o varios .pdf'); return; }
      say('Leyendo ' + plural(pdfs.length, 'archivo', 'archivos') + '…');
      loadLib().then(function (L) {
        return Promise.all(pdfs.map(function (file) {
          return file.arrayBuffer().then(function (b) { return L.PDFDocument.load(b, { ignoreEncryption: true }); })
            .then(function (d) { return { file: file, pages: d.getPageCount() }; })
            .catch(function () { return { file: file, pages: 0 }; });
        }));
      }).then(function (res) { files = files.concat(res); afterChange(); })
        .catch(function () { say('No pudimos preparar el lector de PDF. Ajustá la cantidad a mano.'); });
    });

    $('qd-clear').addEventListener('click', function () { files = []; count.value = 50; ring.checked = false; afterChange(); });
    cta.addEventListener('click', function (e) {
      if (!files.length) return; // sin archivos: el enlace abre la app
      e.preventDefault();
      sendToApp(files.map(function (f) { return f.file; }), { origen: 'cotizador', tipo: 'pdf', archivos: files.length, paginas: pages(), anillado: ring.checked }, say);
    });
    render();
  })();

  // =====================================================  FOTOS
  (function () {
    var drop = $('qf-drop'); if (!drop) return;
    var input = $('qf-input'), pick = $('qf-pick'), thumbs = $('qf-thumbs'), status = $('qf-status');
    var count = $('qf-count'), range = $('qf-range'), box = $('qf-sizes'), cta = $('qf-cta');
    var photos = []; // {file, url}
    var say = function (t) { status.textContent = t; };
    var size = '10x15';

    box.textContent = '';
    SIZES.forEach(function (s) {
      var lab = document.createElement('label'); lab.className = 'qp-row'; lab.dataset.size = s[0];
      lab.innerHTML = '<input type="radio" name="qf-size" value="' + s[0] + '"><span>' + s[1] + ' cm</span><span class="qp-unit">' + fmt(s[2]) + ' c/u</span><span class="qp-tot"></span>';
      box.appendChild(lab);
    });
    box.addEventListener('change', function (e) { if (e.target.name === 'qf-size') { size = e.target.value; render(); } });

    function units() { return num(count, 1, 5000, 10); }
    function render() {
      var u = units(), n = u;
      range.value = Math.min(parseInt(range.max, 10), n);
      $('qf-count-out').textContent = n.toLocaleString('es-AR');
      var unit;
      SIZES.forEach(function (s) {
        var row = box.querySelector('[data-size="' + s[0] + '"]');
        row.querySelector('.qp-tot').textContent = fmt(u * s[2]);
        row.classList.toggle('is-on', s[0] === size);
        row.querySelector('input').checked = s[0] === size;
        if (s[0] === size) unit = s[2];
      });
      $('qf-total').textContent = fmt(u * unit);
      $('qf-note').textContent = plural(n, 'foto', 'fotos') + ' de ' + size.replace('x', ' x ') + ' cm. El total final lo ves en la app, antes de pagar.';
    }
    count.addEventListener('input', render);
    range.addEventListener('input', function () { count.value = range.value; render(); });
    
    function renderThumbs() {
      thumbs.textContent = '';
      photos.slice(0, 7).forEach(function (p) {
        var li = document.createElement('li'), im = document.createElement('img');
        im.alt = ''; im.src = p.url; im.onerror = function () { im.remove(); li.textContent = '🖼'; };
        li.appendChild(im); thumbs.appendChild(li);
      });
      if (photos.length > 7) { var more = document.createElement('li'); more.textContent = '+' + (photos.length - 7); thumbs.appendChild(more); }
    }
    function afterChange() {
      $('qf-clear').hidden = !photos.length;
      renderThumbs();
      if (photos.length) { count.value = Math.min(5000, photos.length); say(plural(photos.length, 'foto cargada', 'fotos cargadas') + '.'); }
      else say('');
      render();
    }
    wireDrop(drop, input, pick, function (picked) {
      var imgs = picked.filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name); });
      if (!imgs.length) { say('No detectamos fotos. Probá con JPG, PNG, HEIC o WEBP.'); return; }
      imgs.forEach(function (f) { photos.push({ file: f, url: URL.createObjectURL(f) }); });
      afterChange();
    });
    $('qf-clear').addEventListener('click', function () { photos.forEach(function (p) { URL.revokeObjectURL(p.url); }); photos = []; count.value = 10; size = '10x15'; afterChange(); });
    cta.addEventListener('click', function (e) {
      if (!photos.length) return;
      e.preventDefault();
      sendToApp(photos.map(function (p) { return p.file; }), { origen: 'cotizador', tipo: 'fotos', cantidad: num(count, 1, 5000, 10), copias: 1, tamano: size }, say);
    });
    render();
  })();
})();
