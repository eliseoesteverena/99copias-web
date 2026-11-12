/* proximo-turno.js — muestra el próximo turno de entrega/retiro en las páginas públicas.
 *
 * Hace UNA sola llamada a /api/turnos/proximos (zonas + próximo turno de cada una), así que
 * cambiar de chip es instantáneo. Cada 3 minutos refresca en segundo plano y solo toca el DOM
 * si lo que se ve cambió. Se pausa con la pestaña oculta.
 *
 * Uso: el bloque HTML (<section class="pt-sec"> … <div class="pt-card" data-proximo-turno>)
 * más el CSS (.pt-*) en styles.css, y:
 *   <script src="/proximo-turno.js" defer></script>
 *
 * Atributos opcionales en el div: data-carillas="50", data-categoria="impresion-rapida",
 * data-refresco="180000" (ms entre actualizaciones).
 *
 * REQUISITO: /api/turnos/proximos debe responder CORS para el sitio (ver _middleware.js).
 */
(function (root) {
  'use strict';

  var API = 'https://app.99copias.com.ar';
  var APP = 'https://app.99copias.com.ar/';
  var TZ = 'America/Argentina/Buenos_Aires';
  var REFRESCO_MS = 3 * 60 * 1000; // actualización en segundo plano
  var DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  // ---------- fechas (siempre en hora de Buenos Aires, no la del dispositivo) ----------

  function ahoraAR(fecha) {
    var p = {};
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(fecha || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return { y: +p.year, m: +p.month, d: +p.day, minutos: (+p.hour) * 60 + (+p.minute) };
  }

  function aMinutos(hhmm) {
    var p = String(hhmm).split(':');
    return (+p[0]) * 60 + (+p[1] || 0);
  }

  // ---------- formato (sin DOM, testeable) ----------

  function hora(h) {
    return String(h).replace(/^0/, '').replace(/:00$/, '');
  }

  // Las etiquetas "Hoy/Mañana" se calculan al mostrar, no al consultar:
  // si la página queda abierta pasada la medianoche, siguen siendo correctas.
  function partesCuando(r, ahora) {
    ahora = ahora || ahoraAR();
    var f = r.fecha.split('-');
    var t = Date.UTC(+f[0], +f[1] - 1, +f[2]);
    var off = Math.round((t - Date.UTC(ahora.y, ahora.m - 1, ahora.d)) / 86400000);
    var cuando;
    if (off === 0) cuando = 'Hoy';
    else if (off === 1) cuando = 'Mañana';
    else {
      var n = DIAS_ES[new Date(t).getUTCDay()];
      cuando = n.charAt(0).toUpperCase() + n.slice(1) + ' ' + (+f[2]) + '/' + (+f[1]);
    }
    return { dia: cuando, horas: 'de ' + hora(r.turno.hora_inicio) + ' a ' + hora(r.turno.hora_fin) + ' hs', hoy: off === 0 };
  }

  function textoCuando(r, ahora) {
    var p = partesCuando(r, ahora);
    return p.dia + ', ' + p.horas;
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
      return Date.now() - o.t < REFRESCO_MS ? o : null;
    } catch (e) { return null; }
  }
  function cacheSet(k, v, t) {
    try { sessionStorage.setItem('pt:' + k, JSON.stringify({ t: t, v: v })); } catch (e) { /* sin caché */ }
  }

  // ---------- UI (los estilos van en styles.css, bloque .pt-*) ----------

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  async function montar(host) {
    var categoria = host.getAttribute('data-categoria') || 'impresion-rapida';
    var carillas = host.getAttribute('data-carillas') || '50';
    var refresco = parseInt(host.getAttribute('data-refresco'), 10) || REFRESCO_MS;

    var clave = 'todo|' + categoria + '|' + carillas;
    var ruta = '/api/turnos/proximos?' + new URLSearchParams({ categoria: categoria, carillas: carillas }).toString();

    var ultima = 0;
    var resp = null;
    var snap = cacheGet(clave); // al navegar entre páginas se reutiliza lo ya consultado
    if (snap) { resp = snap.v; ultima = snap.t; }
    else {
      try { resp = await apiGet(ruta); ultima = Date.now(); cacheSet(clave, resp, ultima); }
      catch (e) { return; } // se queda el bloque estático de respaldo
    }
    var zonas = (resp && resp.zonas) || [];
    if (!zonas.length) return;
    var envio = zonas.filter(function (z) { return !z.es_retiro; });
    var retiro = zonas.filter(function (z) { return z.es_retiro; });

    var uid = 'pt' + Math.random().toString(36).slice(2, 7);

    // --- 1) título ---
    var eyebrow = el('p', 'pt-eyebrow', 'Próxima entrega en:');
    eyebrow.id = uid + '-l';

    // --- 2) chips de barrios ---
    var chips = el('div', 'pt-chips');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-labelledby', eyebrow.id);

    var botones = [];
    function chip(z, esRetiro) {
      var b = el('button', 'pt-chip' + (esRetiro ? ' pt-chip--retiro' : ''), esRetiro ? 'Retiro · ' + z.nombre : z.nombre);
      b.type = 'button';
      b.setAttribute('data-id', z.zona_id);
      b.setAttribute('aria-pressed', 'false');
      botones.push(b);
      chips.appendChild(b);
    }
    envio.forEach(function (z) { chip(z, false); });
    if (envio.length && retiro.length) {
      var sep = el('span', 'pt-sep'); sep.setAttribute('aria-hidden', 'true');
      chips.appendChild(sep);
    }
    retiro.forEach(function (z) { chip(z, true); });

    // --- 3) turno que devuelve la API + botón ---
    var result = el('div', 'pt-result');
    var info = el('div', 'pt-info');
    var when = el('p', 'pt-when');
    when.setAttribute('aria-live', 'polite');
    var dia = el('span', 'pt-day', 'Buscando turnos…');
    var horas = el('span', 'pt-hours');
    var spin = el('span', 'pt-spin');
    spin.setAttribute('aria-hidden', 'true');
    when.appendChild(dia); when.appendChild(horas); when.appendChild(spin);
    var tags = el('div', 'pt-tags');
    info.appendChild(when); info.appendChild(tags);
    var cta = el('a', 'btn btn-mustard pt-cta', 'Hacer mi pedido');
    cta.href = APP;
    result.appendChild(info); result.appendChild(cta);

    host.textContent = '';
    host.appendChild(eyebrow);
    host.appendChild(chips);
    host.appendChild(result);

    // --- indicador de scroll horizontal ---
    function bordes() {
      var desborda = chips.scrollWidth > chips.clientWidth + 1;
      var alFinal = chips.scrollLeft + chips.clientWidth >= chips.scrollWidth - 2;
      if (desborda && !alFinal) chips.setAttribute('data-fade', 'end');
      else chips.removeAttribute('data-fade');
    }
    chips.addEventListener('scroll', bordes, { passive: true });
    window.addEventListener('resize', bordes);

    // --- estado ---
    var datos = {};        // id -> { fecha, turno } | null (sin turnos)
    zonas.forEach(function (z) { datos[String(z.zona_id)] = z.proximo; });
    var actual = null;
    var vistaPrev = null;  // lo último que se dibujó; si no cambia, no se toca el DOM
    var refrescando = false;

    function pintar() {
      var id = actual;
      var res = datos[id];
      var ahora = ahoraAR();
      var v;

      if (res === undefined) {
        v = { d: 'Elegís día y horario', h: 'al hacer tu pedido', t: [], busy: false };
      } else if (res === null) {
        v = { d: 'Sin turnos por ahora', h: 'Escribinos por WhatsApp', t: [], busy: false };
      } else {
        var p = partesCuando(res, ahora);
        var t = [];
        if (p.hoy) t.push(['tag-mint', 'Llega hoy']);
        var c = cuposRestantes(res.turno);
        if (c != null && c <= 3) t.push(['tag-mustard', c === 1 ? 'Queda 1 cupo' : 'Quedan ' + c + ' cupos']);
        v = { d: p.dia, h: p.horas, t: t, busy: false };
        // el turno de hoy que ya empezó quedó viejo: se vuelve a consultar en silencio
        if (p.hoy && aMinutos(res.turno.hora_inicio) <= ahora.minutos && Date.now() - ultima > 15000) refrescar();
      }

      var firma = JSON.stringify(v);
      if (firma === vistaPrev) return;
      vistaPrev = firma;

      dia.textContent = v.d;
      horas.textContent = v.h;
      tags.textContent = '';
      v.t.forEach(function (x) { tags.appendChild(el('span', 'tag ' + x[0], x[1])); });
      if (v.busy) host.setAttribute('aria-busy', 'true'); else host.removeAttribute('aria-busy');
    }

    async function refrescar() {
      if (refrescando) return;
      refrescando = true;
      ultima = Date.now();
      try {
        var r = await apiGet(ruta);
        (r.zonas || []).forEach(function (z) { datos[String(z.zona_id)] = z.proximo; });
        cacheSet(clave, r, ultima);
      } catch (e) { /* si falla, se conserva el dato anterior */ }
      refrescando = false;
      pintar();
    }

    function elegir(id) {
      id = String(id);
      if (id === actual) return;
      actual = id;
      try { localStorage.setItem('99c.zona', id); } catch (e) { /* ok */ }
      var zona = zonas.filter(function (z) { return String(z.zona_id) === id; })[0];
      botones.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-id') === id ? 'true' : 'false');
      });
      cta.href = APP + '?zona=' + encodeURIComponent(id);
      eyebrow.textContent = zona && zona.es_retiro ? 'Próximo retiro en:' : 'Próxima entrega en:';
      vistaPrev = null;
      pintar();
    }

    chips.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.pt-chip') : null;
      if (b) elegir(b.getAttribute('data-id'));
    });

    // --- arranque ---
    var guardada = null;
    try { guardada = localStorage.getItem('99c.zona'); } catch (e) { /* ok */ }
    var inicial = zonas.some(function (z) { return String(z.zona_id) === guardada; }) ? guardada : zonas[0].zona_id;
    elegir(inicial);

    var sel = botones.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0];
    if (sel && chips.scrollWidth > chips.clientWidth) chips.scrollLeft = Math.max(0, sel.offsetLeft - 8);
    bordes();

    // --- actualización silenciosa ---
    function tick() {
      if (document.hidden) return;
      if (Date.now() - ultima >= refresco) refrescar();
      else pintar(); // por si cambió el día ("Mañana" pasa a "Hoy") sin nueva consulta
    }
    setInterval(tick, Math.min(30000, Math.ceil(refresco / 3)));
    document.addEventListener('visibilitychange', tick);
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
    module.exports = { ahoraAR: ahoraAR, textoCuando: textoCuando, partesCuando: partesCuando };
  }
})(typeof window !== 'undefined' ? window : this);
