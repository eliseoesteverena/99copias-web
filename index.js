
    // Typewriter: Imprimí / Cotizá
    (function () {
      var el = document.getElementById('typewriterText');
      if (!el) return;

      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        // Oculta el cursor si el usuario prefiere reducir el movimiento
        var caret = document.querySelector('.typewriter-caret');
        if (caret) {
          caret.style.display = 'none';
        }
        return; // deja "Imprimí" estático, sin animar
      }

      var words = ['Imprimí', 'Cotizá'];
      var TYPE_SPEED = 90;
      var DELETE_SPEED = 45;
      var PAUSE_AFTER_TYPE = 1700;
      var PAUSE_AFTER_DELETE = 350;

      var wordIndex = 0;
      var charIndex = words[0].length; // "Imprimí" ya está completo en el HTML inicial
      var typing = false; // arranca en pausa, antes de borrar

      function tick() {
        var word = words[wordIndex];

        if (!typing) {
          if (charIndex > 0) {
            charIndex--;
            el.textContent = word.slice(0, charIndex);
            setTimeout(tick, DELETE_SPEED);
          } else {
            wordIndex = (wordIndex + 1) % words.length;
            el.classList.toggle('typewriter-alt', wordIndex === 1);
            typing = true;
            setTimeout(tick, PAUSE_AFTER_DELETE);
          }
        } else {
          var next = words[wordIndex];
          if (charIndex < next.length) {
            charIndex++;
            el.textContent = next.slice(0, charIndex);
            setTimeout(tick, TYPE_SPEED);
          } else {
            typing = false;
            setTimeout(tick, PAUSE_AFTER_TYPE);
          }
        }
      }

      setTimeout(tick, PAUSE_AFTER_TYPE);
    })();

    // Cotizador hero
    (function () {
      var range = document.getElementById('quoteRange');
      var count = document.getElementById('quoteCount');
      var totalByn = document.getElementById('totalByn');
      var totalColor = document.getElementById('totalColor');
      var drop = document.getElementById('quoteDrop');
      var fileInput = document.getElementById('quoteFileInput');
      var status = document.getElementById('quoteDropStatus');
      var statusText = document.getElementById('quoteDropStatusText');
      var manual = document.getElementById('quoteManual');
      if (!range) return;

      var defaultHint = 'Arrastrá tus PDF a cualquier parte de esta tarjeta, o hacé clic para elegirlos';

      function fmt(n) {
        return '$' + n.toLocaleString('es-AR');
      }

      function update() {
        var qty = Number(range.value);
        count.textContent = qty;
        totalByn.textContent = fmt(qty * 50);
        totalColor.textContent = fmt(qty * 150);
      }

      range.addEventListener('input', update);
      // El slider vive dentro de la zona droppable: sus clics no deben abrir el selector de archivos
      range.addEventListener('click', function (e) { e.stopPropagation(); });
      update();

      // Cotización arrastrando PDF (suma páginas de uno o varios archivos)
      if (drop && fileInput) {
        var openPicker = function () { fileInput.click(); };

        drop.addEventListener('click', function (e) {
          if (e.target.closest('.quote-slider')) return;
          openPicker();
        });
        drop.addEventListener('keydown', function (e) {
          if (e.target.closest('.quote-slider')) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
        });

        ['dragenter', 'dragover'].forEach(function (evt) {
          drop.addEventListener(evt, function (e) {
            e.preventDefault();
            e.stopPropagation();
            drop.classList.add('dragover');
          });
        });
        ['dragleave', 'dragend', 'drop'].forEach(function (evt) {
          drop.addEventListener(evt, function (e) {
            e.preventDefault();
            e.stopPropagation();
            drop.classList.remove('dragover');
          });
        });

        drop.addEventListener('drop', function (e) {
          var files = e.dataTransfer && e.dataTransfer.files;
          if (files && files.length) processFiles(files);
        });

        fileInput.addEventListener('change', function () {
          if (fileInput.files && fileInput.files.length) processFiles(fileInput.files);
          fileInput.value = '';
        });

        function processFiles(fileList) {
          var files = Array.prototype.filter.call(fileList, function (f) {
            return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
          });

          if (!files.length) {
            statusText.textContent = 'No se detectaron archivos PDF. Probá arrastrando uno o varios .pdf';
            status.classList.remove('has-files');
            return;
          }

          statusText.textContent = 'Leyendo ' + files.length + (files.length === 1 ? ' archivo…' : ' archivos…');
          status.classList.remove('has-files');
          if (manual) manual.classList.add('collapsed');

          var runProcessing = function (PDFLib) {
            return Promise.all(files.map(function (file) {
              return file.arrayBuffer()
                .then(function (buffer) {
                  return PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
                })
                .then(function (pdfDoc) { return pdfDoc.getPageCount(); })
                .catch(function () { return 0; });
            }));
          };

          var promise = window.PDFLib 
            ? Promise.resolve(window.PDFLib) 
            : new Promise(function (resolve, reject) {
                statusText.textContent = 'Preparando lector de PDF...';
                var script = document.createElement('script');
                script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
                script.onload = function () { resolve(window.PDFLib); };
                script.onerror = reject;
                document.head.appendChild(script);
              });

          promise.then(runProcessing).then(function (counts) {
            var totalPages = counts.reduce(function (a, b) { return a + b; }, 0);
            var readOk = counts.filter(function (c) { return c > 0; }).length;

            if (!totalPages) {
              statusText.textContent = 'No pudimos leer esos PDF. Probá con otro archivo o ajustá el control manualmente.';
              status.classList.remove('has-files');
              if (manual) manual.classList.remove('collapsed');
              return;
            }

            var clamped = Math.min(1000, Math.max(1, totalPages));
            range.value = clamped;
            update();

            var msg = readOk + (readOk === 1 ? ' archivo · ' : ' archivos · ') + totalPages + (totalPages === 1 ? ' página detectada' : ' páginas detectadas');
            if (totalPages > 1000) msg += ' (mostrando el máximo de 1000)';
            msg += ' — tocá aquí para ajustar manualmente';
            statusText.textContent = msg;
            status.classList.add('has-files');
          });
        }


        // Tocar el status luego de una carga permite volver al control manual
        status.addEventListener('click', function (e) {
          if (!status.classList.contains('has-files')) return;
          e.stopPropagation();
          if (manual) manual.classList.remove('collapsed');
          statusText.textContent = defaultHint;
          status.classList.remove('has-files');
        });
      }
    })();

    // FAQ accordion
    document.querySelectorAll('.faq-q').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.parentElement;
        var answer = item.querySelector('.faq-a');
        var isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(function (i) {
          i.classList.remove('open');
          i.querySelector('.faq-a').style.maxHeight = null;
        });
        if (!isOpen) {
          item.classList.add('open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    });

    // Reveal on scroll
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
 
 
/* ===== Simulador del pedido: carga diferida (CSS + JS) =====
   No bloquea el render inicial: se pide solo cuando el usuario hace scroll (o si el simulador ya está a la vista al abrir la página). */
(function(){
  'use strict';
  var root=document.getElementById('d99'); if(!root) return;
  var done=false;
  function idle(fn){ if('requestIdleCallback' in window) requestIdleCallback(fn,{timeout:2000}); else setTimeout(fn,300) }
  function load(){
    if(done) return; done=true;
    var css=document.createElement('link'); css.rel='stylesheet'; css.href='/simulador.css';
    function js(){ var s=document.createElement('script'); s.src='/simulador.js'; s.defer=true; document.body.appendChild(s) }
    css.onload=js; css.onerror=js;          /* primero los estilos, así no hay parpadeo sin estilo */
    document.head.appendChild(css);
  }
  function watch(){
    if(!('IntersectionObserver' in window)){ idle(load); return }
    var io=new IntersectionObserver(function(es){ if(es[0].isIntersecting){ io.disconnect(); idle(load) } },{rootMargin:'0px 0px 600px 0px'});
    io.observe(root);
  }
  var evs=['scroll','touchmove','keydown','pointerdown'];
  if(root.getBoundingClientRect().top < window.innerHeight){ idle(load) }      /* ya visible al cargar (hero de fotos) */
  else{
    var arm=function(){ evs.forEach(function(e){removeEventListener(e,arm)}); watch() };
    evs.forEach(function(e){addEventListener(e,arm,{passive:true})});
  }
  /* con el navegador libre, deja los archivos en caché a baja prioridad para que aparezcan al instante */
  addEventListener('load',function(){ idle(function(){
    if(done) return;
    ['/simulador.css','/simulador.js'].forEach(function(u){ var l=document.createElement('link'); l.rel='prefetch'; l.href=u; document.head.appendChild(l) });
  })});
})();

/* ===== Accesibilidad general: FAQ y selector de archivos del cotizador ===== */
(function(){
  'use strict';
  document.querySelectorAll('.faq-item').forEach(function(it,i){
    var q=it.querySelector('.faq-q'),a=it.querySelector('.faq-a');if(!q||!a)return;
    var ic=q.querySelector('.plus');if(ic)ic.setAttribute('aria-hidden','true');
    a.id=a.id||'faq-a-'+(i+1);q.setAttribute('aria-controls',a.id);
    var sync=function(){var o=it.classList.contains('open');q.setAttribute('aria-expanded',String(o));
      if(o){a.removeAttribute('inert');a.removeAttribute('aria-hidden')}else{a.setAttribute('inert','');a.setAttribute('aria-hidden','true')}};
    sync();new MutationObserver(sync).observe(it,{attributes:true,attributeFilter:['class']});
  });
  var pick=document.getElementById('quotePick'),inp=document.getElementById('quoteFileInput');
  if(pick&&inp)pick.addEventListener('click',function(e){e.stopPropagation();inp.click()});
})();

// Precargar pdf-lib en segundo plano tras la carga completa de la página (fuera de la ruta crítica)
window.addEventListener('load', function () {
  var loadPdfLibScript = function () {
    if (window.PDFLib) return;
    var script = document.createElement('script');
    script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
    script.async = true;
    document.head.appendChild(script);
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadPdfLibScript);
  } else {
    setTimeout(loadPdfLibScript, 2000);
  }
});
