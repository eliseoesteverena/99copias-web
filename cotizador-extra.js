// Complemento del cotizador: cotización compartible por enlace (?paginas=100&anillado=1 / ?fotos=24&tamano=10x15)
// y eventos de medición (dataLayer, si existe). Se carga después de cotizador.js y no lo modifica.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var int = function (v, min, max) { var n = parseInt(v, 10); return isNaN(n) ? null : Math.max(min, Math.min(max, n)); };
  var track = function (name, data) {
    try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: name }, data || {})); } catch (e) {}
  };
  var setVal = function (el, v, ev) { el.value = v; el.dispatchEvent(new Event(ev || 'input', { bubbles: true })); };

  // ---------- precarga desde el enlace ----------
  var q = new URLSearchParams(location.search), target = null;
  var pag = int(q.get('paginas'), 1, 100000);
  if (pag && $('qd-count')) {
    setVal($('qd-count'), pag); target = 'documentos';
    if (q.get('anillado') === '1') { $('qd-ring').checked = true; $('qd-ring').dispatchEvent(new Event('change', { bubbles: true })); }
  }
  var fot = int(q.get('fotos'), 1, 5000);
  if (fot && $('qf-count')) {
    setVal($('qf-count'), fot); target = target || 'fotos';
    var tam = q.get('tamano'), radio = tam && document.querySelector('input[name="qf-size"][value="' + tam.replace(/[^0-9x]/g, '') + '"]');
    if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
  }
  if (target && $(target)) setTimeout(function () { $(target).scrollIntoView(); }, 50);

  // ---------- compartir cotización ----------
  function share(btn, url, text) {
    var el = btn.querySelector('.qp-share-t') || btn, label = el.textContent;
    var done = function (t) { el.textContent = t; setTimeout(function () { el.textContent = label; }, 2500); };
    if (navigator.share) { navigator.share({ title: 'Cotización de impresión | 99copias', text: text, url: url }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(function () { done('Enlace copiado'); }, function () { window.prompt('Copiá este enlace:', url); }); return; }
    window.prompt('Copiá este enlace:', url);
  }
  var base = location.origin + location.pathname;
  if ($('qd-share')) $('qd-share').addEventListener('click', function () {
    var n = int($('qd-count').value, 1, 100000) || 50, ring = $('qd-ring').checked;
    track('cotizador_compartir', { tipo: 'pdf' });
    share(this, base + '?paginas=' + n + (ring ? '&anillado=1' : '') + '#documentos', 'Cotización para imprimir ' + n + ' carillas en 99copias');
  });
  if ($('qf-share')) $('qf-share').addEventListener('click', function () {
    var n = int($('qf-count').value, 1, 5000) || 10;
    var r = document.querySelector('input[name="qf-size"]:checked'), t = r ? r.value : '10x15';
    track('cotizador_compartir', { tipo: 'fotos' });
    share(this, base + '?fotos=' + n + '&tamano=' + t + '#fotos', 'Cotización para imprimir ' + n + ' fotos en 99copias');
  });

  // ---------- medición del embudo: usar → cargar archivo → ir a la app ----------
  [['qd', 'pdf'], ['qf', 'fotos']].forEach(function (p) {
    var card = $(p[0] + '-drop'); if (!card) return;
    var used = false;
    var once = function () { if (!used) { used = true; track('cotizador_uso', { tipo: p[1] }); } };
    card.addEventListener('input', once); card.addEventListener('change', once);
    $(p[0] + '-pick').addEventListener('click', function () { track('cotizador_cargar_archivo', { tipo: p[1] }); });
    $(p[0] + '-cta').addEventListener('click', function () { track('cotizador_cta_app', { tipo: p[1], conArchivos: !$(p[0] + '-clear').hidden }); });
  });
})();
