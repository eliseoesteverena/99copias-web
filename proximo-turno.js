/* proximo-turno.js — muestra el próximo turno de entrega/retiro en las páginas públicas.
 *
 * Uso (en home, cotizador, fotos y zonas):
 *
 *   <div data-proximo-turno data-carillas="50" data-categoria="impresion-rapida">
 *     Entrega desde 24 hs · Elegí día y horario al hacer tu pedido
 *   </div>
 *   <script src="/proximo-turno.js" defer></script>
 *
 * El texto dentro del div es el respaldo: se reemplaza solo si la API responde.
 * Si la API falla o no hay turnos, el visitante sigue viendo ese texto.
 *
 * REQUISITO: la API vive en app.99copias.com.ar y las páginas en 99copias.com.ar,
 * así que los GET /api/zonas, /api/turnos/dias y /api/turnos deben responder
 *   Access-Control-Allow-Origin: https://99copias.com.ar
 */
(function (root) {
  'use strict';

  var API = 'https://app.99copias.com.ar';
  var APP = 'https://app.99copias.com.ar/';
  var TZ = 'America/Argentina/Buenos_Aires';
  var MAX_DIAS = 14; // misma ventana que el selector de la app
  var CACHE_MS = 3 * 60 * 1000;
  var DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  // ---------- fechas (siempre en hora de Buenos Aires, no la del dispositivo) ----------

  function ahoraAR(fecha) {
    var p = {};
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(fecha || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return {
      y: +p.year, m: +p.month, d: +p.day,
      minutos: (+p.hour) * 60 + (+p.minute)
    };
  }

  // Día i (0 = hoy) a partir de "ahora". Usa UTC puro para no depender del huso del dispositivo.
  function diaOffset(ahora, i) {
    var t = new Date(Date.UTC(ahora.y, ahora.m - 1, ahora.d) + i * 86400000);
    return { iso: t.toISOString().slice(0, 10), dow: t.getUTCDay(), d: t.getUTCDate(), m: t.getUTCMonth() + 1 };
  }

  function aMinutos(hhmm) {
    var p = String(hhmm).split(':');
    return (+p[0]) * 60 + (+p[1] || 0);
  }

  // ---------- lógica de búsqueda (sin DOM, testeable) ----------

  // Devuelve { fecha, offset, dia, turno } del primer turno disponible, o null.
  async function buscarProximo(opts) {
    var get = opts.get;
    var dias = await get('/api/turnos/dias?zona_id=' + opts.zonaId);
    if (!Array.isArray(dias) || !dias.length) return null;

    for (var i = 0; i < MAX_DIAS; i++) {
      var dia = diaOffset(opts.ahora, i);
      if (dias.indexOf(dia.dow) === -1) continue;

      var qs = new URLSearchParams({
        zona_id: opts.zonaId, fecha: dia.iso,
        categoria: opts.categoria, carillas: opts.carillas
      });
      var turnos = await get('/api/turnos?' + qs.toString());
      var libres = (turnos || []).filter(function (t) {
        if (!t.disponible) return false;
        // Hoy: descartar turnos que ya empezaron.
        if (i === 0 && aMinutos(t.hora_inicio) <= opts.ahora.minutos) return false;
        return true;
      });
      if (libres.length) {
        libres.sort(function (a, b) { return a.hora_inicio.localeCompare(b.hora_inicio); });
        return { fecha: dia.iso, offset: i, dia: dia, turno: libres[0] };
      }
    }
    return null;
  }

  function hora(h) {
    return String(h).replace(/^0/, '').replace(/:00$/, '');
  }

  function textoCuando(r) {
    var cuando;
    if (r.offset === 0) cuando = 'Hoy';
    else if (r.offset === 1) cuando = 'Mañana';
    else {
      var n = DIAS_ES[r.dia.dow];
      cuando = n.charAt(0).toUpperCase() + n.slice(1) + ' ' + r.dia.d + '/' + r.dia.m;
    }
    return cuando + ', de ' + hora(r.turno.hora_inicio) + ' a ' + hora(r.turno.hora_fin) + ' hs';
  }

  function cuposRestantes(t) {
    if (!t.capacidad_maxima) return null;
    return t.capacidad_maxima - t.ocupados;
  }

  // ---------- red + caché ----------

  function apiGet(path) {
    return fetch(API + path).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function cacheGet(k) {
    try {
      var raw = sessionStorage.getItem('pt:' + k);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return Date.now() - o.t < CACHE_MS ? o.v : null;
    } catch (e) { return null; }
  }
  function cacheSet(k, v) {
    try { sessionStorage.setItem('pt:' + k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) { /* sin caché */ }
  }

  // ---------- UI ----------

  var CSS = [
    '.pt{font:inherit;color:var(--ink,#1a1a1a);border:1.5px solid var(--ink,#1a1a1a);border-radius:10px;',
    'padding:.85rem 1rem;max-width:30rem;background:var(--paper,#fff);display:grid;gap:.55rem}',
    '.pt-k{margin:0;font-size:.85rem;opacity:.7}',
    '.pt-when{margin:0;font-size:1.25rem;font-weight:700;line-height:1.25}',
    '.pt-low{margin:0;font-size:.85rem;font-weight:600}',
    '.pt-row{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}',
    '.pt-sel{font:inherit;padding:.45rem .6rem;border:1.5px solid var(--ink,#1a1a1a);border-radius:8px;',
    'background:var(--paper,#fff);color:inherit;min-height:44px;flex:1 1 11rem}',
    '.pt-cta{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 1rem;',
    'border-radius:8px;background:var(--ink,#1a1a1a);color:var(--paper,#fff);font-weight:700;text-decoration:none;flex:1 1 9rem}',
    '.pt-cta:focus-visible,.pt-sel:focus-visible{outline:3px solid var(--mustard,#e0a800);outline-offset:2px}',
    '.pt[aria-busy="true"] .pt-when{opacity:.5}'
  ].join('');

  function inyectarCSS() {
    if (document.getElementById('pt-css')) return;
    var s = document.createElement('style');
    s.id = 'pt-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  async function montar(host) {
    var categoria = host.getAttribute('data-categoria') || 'impresion-rapida';
    var carillas = host.getAttribute('data-carillas') || '50';

    var envio, retiro;
    try {
      var r = await Promise.all([
        apiGet('/api/zonas?tipo=envio'),
        apiGet('/api/zonas?tipo=retiro').catch(function () { return []; })
      ]);
      envio = r[0] || []; retiro = r[1] || [];
    } catch (e) { return; } // se queda el texto de respaldo
    var zonas = envio.concat(retiro);
    if (!zonas.length) return;

    inyectarCSS();

    var box = el('div', 'pt');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Próxima entrega disponible');
    var k = el('p', 'pt-k');
    var when = el('p', 'pt-when', 'Buscando turnos…');
    when.setAttribute('aria-live', 'polite');
    var low = el('p', 'pt-low'); low.hidden = true;
    var row = el('div', 'pt-row');

    var sel = el('select', 'pt-sel');
    sel.setAttribute('aria-label', 'Barrio o punto de retiro');
    function grupo(titulo, lista) {
      if (!lista.length) return;
      var g = document.createElement('optgroup');
      g.label = titulo;
      lista.forEach(function (z) {
        var o = document.createElement('option');
        o.value = z.id; o.textContent = z.nombre;
        g.appendChild(o);
      });
      sel.appendChild(g);
    }
    grupo('Envío a domicilio', envio);
    grupo('Retiro', retiro);

    var cta = el('a', 'pt-cta', 'Hacer mi pedido');
    cta.href = APP;

    var guardada = null;
    try { guardada = localStorage.getItem('99c.zona'); } catch (e) { /* ok */ }
    if (guardada && zonas.some(function (z) { return String(z.id) === guardada; })) sel.value = guardada;

    row.appendChild(sel); row.appendChild(cta);
    box.appendChild(k); box.appendChild(when); box.appendChild(low); box.appendChild(row);

    var pedido = 0; // evita que una respuesta lenta pise a una más nueva
    async function actualizar() {
      var id = sel.value;
      var zona = zonas.filter(function (z) { return String(z.id) === id; })[0];
      try { localStorage.setItem('99c.zona', id); } catch (e) { /* ok */ }
      cta.href = APP + '?zona=' + encodeURIComponent(id);
      k.textContent = zona && zona.es_retiro ? 'Próximo retiro' : 'Próxima entrega';
      box.setAttribute('aria-busy', 'true');
      low.hidden = true;

      var mi = ++pedido;
      var clave = [id, categoria, carillas].join('|');
      var res = cacheGet(clave);
      if (!res) {
        try {
          res = await buscarProximo({
            zonaId: id, categoria: categoria, carillas: carillas,
            ahora: ahoraAR(), get: apiGet
          });
          if (res) cacheSet(clave, res);
        } catch (e) { res = undefined; }
      }
      if (mi !== pedido) return;
      box.removeAttribute('aria-busy');

      if (res) {
        when.textContent = textoCuando(res);
        var c = cuposRestantes(res.turno);
        if (c != null && c <= 3) {
          low.textContent = c === 1 ? 'Queda 1 cupo' : 'Quedan ' + c + ' cupos';
          low.hidden = false;
        }
      } else if (res === null) {
        when.textContent = 'Sin turnos en los próximos días. Escribinos por WhatsApp.';
      } else {
        when.textContent = 'Elegí día y horario al hacer tu pedido.';
      }
    }

    sel.addEventListener('change', actualizar);
    host.textContent = '';
    host.appendChild(box);
    actualizar();
  }

  function init() {
    var hosts = document.querySelectorAll('[data-proximo-turno]');
    for (var i = 0; i < hosts.length; i++) montar(hosts[i]);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  // Para pruebas en Node
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buscarProximo: buscarProximo, ahoraAR: ahoraAR, textoCuando: textoCuando };
  }
})(typeof window !== 'undefined' ? window : this);
