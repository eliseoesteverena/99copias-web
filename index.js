
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
      if (drop && fileInput && window.PDFLib) {
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

          Promise.all(files.map(function (file) {
            return file.arrayBuffer()
              .then(function (buffer) {
                return PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
              })
              .then(function (pdfDoc) { return pdfDoc.getPageCount(); })
              .catch(function () { return 0; });
          })).then(function (counts) {
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

    // Mobile menu
    var burger = document.getElementById('burger');
    var navLinks = document.getElementById('navLinks');
    burger.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navLinks.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });

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
 