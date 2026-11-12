/* proximo-turno.js — muestra el próximo turno de entrega/retiro en las páginas públicas.
 *
 * Uso (en home, cotizador, fotos y zonas):
 *
 *   Ver el bloque HTML (<section class="pt-sec"> … <div class="pt-card" data-proximo-turno>)
 *   y el bloque CSS (.pt-*) que van en la página y en styles.css.
 *   <script src="/proximo-turno.js" defer></script>
 *
 * El contenido estático dentro del div es el respaldo: se reemplaza solo si la API responde.
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

  function partesCuando(r) {
    var cuando;
    if (r.offset === 0) cuando = 'Hoy';
    else if (r.offset === 1) cuando = 'Mañana';
    else {
      var n = DIAS_ES[r.dia.dow];
      cuando = n.charAt(0).toUpperCase() + n.slice(1) + ' ' + r.dia.d + '/' + r.dia.m;
    }
    return { dia: cuando, horas: 'de ' + hora(r.turno.hora_inicio) + ' a ' + hora(r.turno.hora_fin) + ' hs' };
  }

  function textoCuando(r) {
    var p = partesCuando(r);
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
      return Date.now() - o.t < CACHE_MS ? o.v : null;
    } catch (e) { return null; }
  }
  function cacheSet(k, v) {
    try { sessionStorage.setItem('pt:' + k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) { /* sin caché */ }
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

    var envio, retiro;
    try {
      var r = await Promise.all([
        apiGet('/api/zonas?tipo=envio'),
        apiGet('/api/zonas?tipo=retiro').catch(function () { return []; })
      ]);
      envio = r[0] || []; retiro = r[1] || [];
    } catch (e) { return; } // se queda el bloque estático de respaldo
    var zonas = envio.concat(retiro);
    if (!zonas.length) return;

    var uid = 'pt' + Math.random().toString(36).slice(2, 7);

    // --- parte superior: cuándo + botón ---
    var main = el('div', 'pt-main');
    var info = el('div', 'pt-info');
    var eyebrow = el('p', 'pt-eyebrow', 'Próxima entrega');
    var when = el('p', 'pt-when');
    when.setAttribute('aria-live', 'polite');
    var dia = el('span', 'pt-day', 'Buscando turnos…');
    var horas = el('span', 'pt-hours');
    when.appendChild(dia); when.appendChild(horas);
    var tags = el('div', 'pt-tags');
    info.appendChild(eyebrow); info.appendChild(when); info.appendChild(tags);
    var cta = el('a', 'btn btn-primary pt-cta', 'Hacer mi pedido');
    cta.href = APP;
    main.appendChild(info); main.appendChild(cta);

    // --- chips de barrios ---
    var zwrap = el('div', 'pt-zonas');
    var zlabel = el('p', 'pt-zlabel', 'Elegí tu barrio');
    zlabel.id = uid + '-l';
    var chips = el('div', 'pt-chips');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-labelledby', zlabel.id);

    var botones = [];
    function chip(z, esRetiro) {
      var b = el('button', 'pt-chip' + (esRetiro ? ' pt-chip--retiro' : ''), esRetiro ? 'Retiro · ' + z.nombre : z.nombre);
      b.type = 'button';
      b.setAttribute('data-id', z.id);
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

    zwrap.appendChild(zlabel); zwrap.appendChild(chips);

    host.textContent = '';
    host.appendChild(main);
    host.appendChild(zwrap);

    // --- indicador de scroll horizontal ---
    function bordes() {
      var desborda = chips.scrollWidth > chips.clientWidth + 1;
      var alFinal = chips.scrollLeft + chips.clientWidth >= chips.scrollWidth - 2;
      if (desborda && !alFinal) chips.setAttribute('data-fade', 'end');
      else chips.removeAttribute('data-fade');
    }
    chips.addEventListener('scroll', bordes, { passive: true });
    window.addEventListener('resize', bordes);

    // --- selección ---
    var actual = null;
    var pedido = 0; // evita que una respuesta lenta pise a una más nueva

    async function elegir(id) {
      id = String(id);
      if (id === actual) return;
      actual = id;
      try { localStorage.setItem('99c.zona', id); } catch (e) { /* ok */ }

      var zona = zonas.filter(function (z) { return String(z.id) === id; })[0];
      botones.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-id') === id ? 'true' : 'false');
      });
      cta.href = APP + '?zona=' + encodeURIComponent(id);
      eyebrow.textContent = zona && zona.es_retiro ? 'Próximo retiro' : 'Próxima entrega';
      host.setAttribute('aria-busy', 'true');
      tags.textContent = '';

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
      host.removeAttribute('aria-busy');

      if (res) {
        var p = partesCuando(res);
        dia.textContent = p.dia;
        horas.textContent = p.horas;
        if (res.offset === 0) tags.appendChild(el('span', 'tag tag-mint', 'Llega hoy'));
        var c = cuposRestantes(res.turno);
        if (c != null && c <= 3) {
          tags.appendChild(el('span', 'tag tag-mustard', c === 1 ? 'Queda 1 cupo' : 'Quedan ' + c + ' cupos'));
        }
      } else if (res === null) {
        dia.textContent = 'Sin turnos por ahora';
        horas.textContent = 'Escribinos por WhatsApp';
      } else {
        dia.textContent = 'Elegís día y horario';
        horas.textContent = 'al hacer tu pedido';
      }
    }

    chips.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.pt-chip') : null;
      if (b) elegir(b.getAttribute('data-id'));
    });

    var guardada = null;
    try { guardada = localStorage.getItem('99c.zona'); } catch (e) { /* ok */ }
    var inicial = zonas.some(function (z) { return String(z.id) === guardada; }) ? guardada : zonas[0].id;
    await elegir(inicial);

    // Llevar el chip elegido a la vista sin mover la página en vertical.
    var sel = botones.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0];
    if (sel && chips.scrollWidth > chips.clientWidth) chips.scrollLeft = Math.max(0, sel.offsetLeft - 8);
    bordes();
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
    module.exports = { buscarProximo: buscarProximo, ahoraAR: ahoraAR, textoCuando: textoCuando, partesCuando: partesCuando };
  }
})(typeof window !== 'undefined' ? window : this);
