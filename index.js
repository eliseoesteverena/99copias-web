
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
 
 
/* ===== Cómo funciona · demo interactiva del pedido (agregar al final de index.js) ===== */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const root=$('#d99');if(!root)return;
const body=$('#d99-body'),cur=$('#d99-cur'),pr=$('#d99-pr'),bk=$('#d99-bk'),nx=$('#d99-nx');
const S={color:false,zone:false,faz:'Simple',fin:'Suelto',loaded:false};
let MODE='foto';
const IMGS=[{"w":451,"h":300,"src":"/img/demo/foto-1.jpg"},{"w":512,"h":512,"src":"/img/demo/foto-2.jpg"},{"w":600,"h":400,"src":"/img/demo/foto-3.jpg"},{"w":640,"h":427,"src":"/img/demo/foto-4.jpg"}];
const SZ={'6x8':[6,8,250],'9x13':[9,13,650],'10x15':[10,15,800],'13x18':[13,18,1100],'15x20':[15,20,1900],'20x25':[20,25,2200]};
let P=[],ci=0;
function resetP(fin){P=IMGS.map(i=>({w:i.w,h:i.h,src:i.src,size:'10x15',rot:0,flip:0,zoom:1,ox:0,oy:0,byn:0,br:1,ct:1,sat:1,copies:1}));ci=0;
 if(fin){P.forEach(q=>q.size='13x18');P[0].byn=1;P[1].copies=2}}
resetP(false);
const fmt=n=>'$'+n.toLocaleString('es-AR');
const fin=()=>MODE==='doc'&&S.fin==='Anillado'?1500:0,prn=()=>MODE==='foto'?P.reduce((s,p)=>s+SZ[p.size][2]*p.copies,0):50*(S.color?150:50),sub=()=>prn()+fin(),total=()=>sub()+(S.zone?3500:0);
const NAMES=['ARCHIVOS','ENTREGA','DATOS','PAGO'];
let step=0,tok=0;
function price(){const t=S.loaded?fmt(total()):'';if(pr.dataset.v!==t){pr.dataset.v=t;pr.innerHTML=t?'<b>'+t+'</b>':'';pr.classList.remove('fl');void pr.offsetWidth;pr.classList.add('fl')}
 const a=$('#amt',body);if(a){a.textContent=fmt(sub());$('#rate').textContent=S.color?'$150':'$50';$$('#fp,#fx',body).forEach(e=>e.classList.toggle('hid',!fin()))}}
function seg(n,v){$$(`[data-seg=${n}] button`,body).forEach(b=>b.classList.toggle('is-on',b.dataset.v===v))}
const segH=(n,o,on)=>`<div class="segmented" data-seg="${n}">${o.map(x=>`<button data-v="${x}" class="${x===on?'is-on':''}">${x}</button>`).join('')}</div>`;
const F=(l,id,ph='',h='')=>`<div class="field"><label>${l}</label><input class="input" id="${id}" readonly placeholder="${ph}">${h?`<span class="hint">${h}</span>`:''}</div>`;
const SG=(l,n,o,on)=>`<div class="field"><label>${l}</label>${segH(n,o,on)}</div>`;
const PH=(t,s)=>`<div class="panel-head"><h2>${t}</h2><p class="sub">${s}</p></div>`;
const PK=(id,l,v)=>`<div class="pick hid" id="${id}"><div><small>${l}</small><b>${v}</b></div><u>Cambiar</u></div>`;
const T0d=()=>PH('Cargá tus archivos','Aceptamos PDF e imágenes. Configurá copias, rango de páginas y acabado para cada uno.')+`
<div class="dropzone" id="drop"><div class="dz-title">Arrastrá y soltá tus archivos</div><div class="dz-or">ó</div><span class="btn" id="pick">Seleccioná tus archivos</span><div class="dz-list">Se aceptan PDF e imágenes (JPG, PNG)</div></div>
<div class="file-card hid" id="cfg"><div class="file-head"><div class="file-thumb">📄</div><div><div class="idx">01</div><div class="fname">tu_documento.pdf</div><div class="fsub">50 carillas</div><span class="upload-status is-uploading" id="us">Subiendo…</span></div></div>
<div class="form-grid">${F('Copias','i1')}${F('Rango de páginas','i2','ej. 1-5,8')}${SG('Faz','faz',['Simple','Doble'],'Simple')}${SG('Páginas por carilla','ppc',['1','2','4','6'],'1')}${SG('Tipo de impresión','tipo',['ByN','Color'],'ByN')}${SG('Acabado','fin',['Abrochado','Clip','Anillado'],'')}</div>
<div class="dim-line hid" id="dl"><span>50 carillas</span><span class="tm">×</span><span id="rate">$50</span><span class="tm hid" id="fp">+</span><span class="hid" id="fx">Anillado $1.500</span><span class="result">= <span class="amt" id="amt">$2.500</span></span></div></div>`;
const T0f=()=>PH('Subí y editá tus fotos','Elegí un tamaño para cada foto, encuadrala como quieras y ajustá el color si hace falta. Un tamaño = una foto.')+`<div class="dropzone" id="drop"><div class="dz-title">Arrastrá y soltá tus fotos</div><div class="dz-or">ó</div><span class="btn" id="pick">Seleccioná tus fotos</span><div class="dz-list">Se aceptan imágenes (JPG, PNG, HEIC, WEBP)</div></div>`;
const rcRows=()=>MODE==='foto'?`<div class="receipt-row"><div><b>${P.length} fotos</b><em>${P.map(p=>p.size.replace('x',' x ')+(p.copies>1?' ×'+p.copies:'')+(p.byn?' B/N':'')).join(' · ')}</em></div><span class="val">${fmt(prn())}</span></div>`:`<div class="receipt-row"><div><b>tu_documento.pdf</b><em>${S.color?'Color':'ByN'} · 50 carillas · ${S.faz} faz · ${S.fin}</em></div><span class="val">${fmt(prn())}</span></div>${fin()?`<div class="receipt-row"><b>Anillado</b><span class="val">${fmt(fin())}</span></div>`:''}`;

const IC={zoom:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',size:'<rect x="3" y="5" width="18" height="14" rx="2"/>',copies:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',rot:'<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>',flip:'<path d="M12 3v18M8 7l-5 5 5 5V7zM16 7l5 5-5 5V7z"/>',bn:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',adj:'<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'};
const BT=(a,l)=>`<button class="pe-btn" data-a="${a}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[a]}</svg>${l}</button>`;
const RW=(l,id,mn,mx,st)=>`<div class="crow" id="w${id}"><label>${l}</label><input type="range" id="${id}" min="${mn}" max="${mx}" step="${st}"></div>`;
const ED=()=>`<div class="pe-toolbar" id="bar">${BT('zoom','Zoom')}${BT('size','Tamaño')}${BT('copies','Copias')}<i class="pe-sep"></i>${BT('rot','Rotar')}${BT('flip','Espejo')}${BT('bn','B/N')}${BT('adj','Ajustes')}<i class="pe-sep"></i>${BT('trash','Quitar')}</div>
<div class="pe-stage" id="stage"><div class="crop" id="crop"><img id="pimg" alt="Foto a imprimir"></div>
<div class="pe-drop" id="dz"><div class="crow"><span class="bi">−</span><input type="range" id="rz" min="1" max="3" step=".01"><span class="bi">+</span></div></div>
<div class="pe-drop" id="ds"><div class="sizes" id="sizes">${Object.keys(SZ).map(k=>`<button data-v="${k}">${k.replace('x',' x ')} cm</button>`).join('')}</div><div class="applyall" id="aa"><i id="ck"></i><span>Aplicar a todas las fotos</span><span class="btn" id="cfm">Confirmar</span></div></div>
<div class="pe-drop" id="dc"><div class="crow"><label>Copias</label><span class="bi">−</span><input class="input" id="rc" readonly style="text-align:center;flex:1"><span class="bi" id="cplus">+</span></div></div>
<div class="pe-drop" id="da">${RW('Brillo','rb',.6,1.4,.02)}${RW('Contraste','rct',.6,1.4,.02)}${RW('Saturación','rs',0,2,.1)}</div>
<div class="pe-label"><span class="l">Recorte para</span><span class="v" id="clv"></span></div><div class="pe-price" id="pp"></div></div>
<div class="strip" id="strip">${P.map((p,i)=>`<div class="th" data-i="${i}"><img src="${p.src}" alt=""><b class="hid"></b></div>`).join('')}<div class="th add" aria-hidden="true">+</div></div>`;
function render(){
  const p=P[ci],st=$('#stage',body),box=$('#crop',body),im=$('#pimg',body);if(!st)return;
  if(im.getAttribute('src')!==p.src)im.src=p.src;
  if(im.complete&&im.naturalWidth){p.w=im.naturalWidth;p.h=im.naturalHeight}   /* usar siempre las medidas reales de la foto */
  if(!im._l){im._l=1;im.addEventListener('load',()=>render())}
  let [a,b]=SZ[p.size];if(p.rot)[a,b]=[b,a];
  const aw=st.clientWidth-32,ah=st.clientHeight-32;let bw=aw,bh=bw*b/a;if(bh>ah){bh=ah;bw=bh*a/b}
  box.style.width=bw+'px';box.style.height=bh+'px';
  const k=Math.max(bw/p.w,bh/p.h)*p.zoom,iw=p.w*k,ih=p.h*k,mx=(iw-bw)/2,my=(ih-bh)/2;
  p.ox=Math.max(-mx,Math.min(mx,p.ox));p.oy=Math.max(-my,Math.min(my,p.oy));
  if(im.getAttribute('src')!==p.src)im.src=p.src;
  im.style.width=iw+'px';im.style.height=ih+'px';
  im.style.transform=`translate(calc(-50% + ${p.ox}px),calc(-50% + ${p.oy}px)) scaleX(${p.flip?-1:1})`;
  /* mismo filtro que la app (construirFiltroCss): el B/N se suma ENCIMA de brillo/contraste/saturación. Siempre las mismas funciones, así la transición es suave. */
  im.style.filter=`brightness(${p.br}) contrast(${p.ct}) saturate(${p.sat}) grayscale(${p.byn?'100%':'0%'}) contrast(${p.byn?1.5:1}) brightness(${p.byn?1.05:1})`;
  $('#clv',body).textContent=p.size.replace('x',' x ')+' cm';
  $('#pp',body).textContent=fmt(SZ[p.size][2]*p.copies);
  $('#rz',body).value=p.zoom;$('#rb',body).value=p.br;$('#rct',body).value=p.ct;$('#rs',body).value=p.sat;$('#rc',body).value=p.copies;
  $('#wrs',body).classList.toggle('off',!!p.byn);
  $$('#sizes button',body).forEach(x=>x.classList.toggle('is-on',x.dataset.v===p.size));
  $('[data-a=bn]',body).classList.toggle('is-on',!!p.byn);$('[data-a=flip]',body).classList.toggle('is-on',!!p.flip);
  $$('.th[data-i]',body).forEach((t,i)=>{t.classList.toggle('is-active',i===ci);const q=P[i].copies,bd=$('b',t);bd.textContent='×'+q;bd.classList.toggle('hid',q<2)});
  price();
}
const DMAP={zoom:'dz',size:'ds',copies:'dc',adj:'da'};
function open(id){$$('.pe-drop',body).forEach(d=>d.classList.toggle('is-open',d.id===id));$$('.pe-btn',body).forEach(b=>b.classList.toggle('is-open',DMAP[b.dataset.a]===id))}
function loadEd(){body.innerHTML=ED();body.classList.add('ed');root.classList.add('in-ed');render()}
async function slide(prop,to,w){const p=P[ci],f=p[prop];if(RM){p[prop]=to;render();return}
  root.classList.add('fast');for(let i=1;i<=12;i++){p[prop]=f+(to-f)*i/12;render();await w(70)}root.classList.remove('fast');await w(300)}
async function drag(dx,dy,w){const st=$('#crop',body);if(RM){P[ci].ox+=dx;P[ci].oy+=dy;render();return}
  const m=root.getBoundingClientRect(),q=st.getBoundingClientRect(),X=q.left-m.left+q.width/2,Y=q.top-m.top+q.height/2;
  cur.style.opacity=1;cur.style.transform=`translate(${X}px,${Y}px)`;await w(900);
  cur.classList.add('p');await w(200);cur.style.transform=`translate(${X+dx}px,${Y+dy}px)`;P[ci].ox+=dx;P[ci].oy+=dy;render();await w(900);cur.classList.remove('p');await w(400)}


const T=[
()=>MODE==='foto'?T0f():T0d(),
()=>PH('¿Cómo y cuándo lo entregamos?','Elegí envío a domicilio o retiro, y el turno que te quede mejor. Recordamos tu elección para tu próximo pedido.')+`
<div id="zs"><div class="tabs" style="margin-top:0"><div class="on">Envío a domicilio</div><div>Retiro</div></div><div class="zone-card"><div class="zn">ZONA 02</div><div class="zname">Belgrano</div><div class="zprice">Envío: $2.000</div></div><div class="zone-card"><div class="zn">ZONA 04</div><div class="zname">Coghlan</div><div class="zprice">Envío: $2.000</div></div><div class="zone-card" id="zp"><div class="zn">ZONA 05</div><div class="zname">Palermo</div><div class="zprice">Envío: $3.500</div></div></div>
${PK('sz','Zona/Punto','Palermo · Envío: $3.500')}
<div id="ds" class="hid"><div class="sect">Elegí el día</div><div class="dates">${[['JUE',8],['VIE',9],['SÁB',10],['LUN',12],['MAR',13],['MIÉ',14],['JUE',15],['VIE',16],['SÁB',17],['LUN',19]].map(d=>`<div class="date-chip" ${d[1]==16?'id="d16"':''}><span class="dow">${d[0]}</span><span class="dnum">${d[1]}</span></div>`).join('')}</div></div>
${PK('sd','Día','16-10-2026')}
<div id="hs" class="hid"><div class="sect">Elegí el horario</div><div class="slot-card" id="sl"><div class="range">19:00 – 22:00</div><div class="cap">10 cupos</div></div></div>
${PK('sh','Horario','19:00–22:00')}
<div id="as" class="hid">${F('Dirección de entrega','i3','Calle, número, piso/depto')}</div>`,
()=>PH('Datos personales','Los necesitamos para emitir el comprobante y coordinar la entrega.')+`<div class="plate"><div class="form-grid">
${F('Nombre','n1')}${F('Apellido','n2')}${F('Tipo de documento','n3','','Se emitirá Factura B (Consumidor Final)')}${F('Número de documento','n4')}${F('Correo electrónico','n5')}${F('Celular','n6','+54 9 …')}</div></div>`,
()=>PH('Revisá y pagá','Verificá el detalle de tu pedido antes de ir al checkout de Mercado Pago.')+`<div id="rc">
<div class="receipt"><div class="receipt-head"><h3>Resumen del pedido</h3><span>${MODE==='foto'?P.length+' fotos':'1 archivo'}</span></div>
${rcRows()}
<div class="receipt-row"><b>Envío a Palermo</b><span class="val">$3.500</span></div>
<div class="receipt-total"><span>Total a pagar</span><b>${fmt(total())}</b></div></div>
<div class="tabs"><div class="on" id="tm">Mercado Pago</div><div id="tt">Transferencia</div></div>
<div id="pm"><span class="btn btn-primary btn-block" style="padding:.9em .9em 1.2em">Ir a pagar con Mercado Pago →</span><div class="eyebrow" style="text-align:center;margin-top:.75em"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="vertical-align:-2px;margin-right:.4em"><rect x="5" y="11" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Pago seguro</div></div>
<div id="pt" class="hid"><div class="plate tr"><p class="eyebrow" style="margin:0 0 .6em">Datos para transferir</p><div><b>Alias:</b> 99copias.mp</div><div><b>Titular:</b> 99copias</div></div>
<div class="comp">Subir comprobante (opcional, lo podés hacer después desde "Mis pedidos")</div>
<span class="btn btn-primary btn-block" id="cf" style="padding:.9em .9em 1.2em">Confirmar pedido →</span></div></div>
<div id="ok" class="hid"><div class="plate is-focused" style="text-align:center;padding:2.2em 1.2em"><svg width="44" height="44" viewBox="0 0 44 44" fill="none" style="margin:0 auto .5em;display:block"><path d="M22 2 L26 18 L42 22 L26 26 L22 42 L18 26 L2 22 L18 18 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><div class="eyebrow">Pedido confirmado</div><h2 style="margin-top:.6em;font:600 1.4em var(--ff)">¡Listo! Así de simple.</h2><p style="color:var(--ink-60);margin-top:.6em;font-size:.9em">Ahora hacelo con ${MODE==='foto'?'tus fotos':'tu archivo'}: en menos de un minuto tenés tu pedido en curso.</p><a class="btn btn-primary" style="margin-top:1.4em;text-decoration:none" href="https://app.99copias.com.ar">Hacer mi pedido →</a></div></div>`
];
/* ---------- animación ---------- */
const RMq=matchMedia('(prefers-reduced-motion: reduce)');let RM=RMq.matches;const SPD=[.55,1,1,1.8];
const wait=ms=>RM?Promise.resolve():new Promise(r=>setTimeout(r,ms*SPD[step]));
async function aim(el,w){
  if(RM)return;
  const tb=el.closest&&el.closest('#bar');if(tb){tb.scrollTo({left:el.offsetLeft-tb.clientWidth/2+el.offsetWidth/2,behavior:'smooth'});await w(500)}
  const b=body.getBoundingClientRect(),r=el.getBoundingClientRect();
  if(r.bottom>b.bottom-24||r.top<b.top+10){body.scrollBy({top:r.top-b.top-b.height/3});await w(600)}
  const m=root.getBoundingClientRect(),q=el.getBoundingClientRect();
  cur.style.opacity=1;
  cur.style.transform=`translate(${q.left-m.left+Math.min(q.width*.6,120)}px,${q.top-m.top+q.height*.55}px)`;
  await w(900);
}
async function click(sel,w,fn){
  const el=typeof sel==='string'?$(sel,body):sel;
  if(RM){fn&&fn();return}
  await aim(el,w);cur.classList.add('p');await w(160);fn&&fn();cur.classList.remove('p');await w(450);
}
async function type(id,txt,w){
  const el=$('#'+id,body);if(RM){el.value=txt;return}await aim(el,w);
  for(let i=1;i<=txt.length;i++){el.value=txt.slice(0,i);await w(60)}
  await w(250);
}
const show=(...ids)=>ids.forEach(i=>$('#'+i,body).classList.remove('hid'));
const hide=(...ids)=>ids.forEach(i=>$('#'+i,body).classList.add('hid'));

const SC0d=async w=>{
  await w(800);
  await click('#pick',w,()=>{hide('drop');show('cfg')});
  await w(1400);$('#us').className='upload-status is-ok';$('#us').textContent='✓ Subido';nx.disabled=false;S.loaded=true;show('dl');
  $('#i1').value='1';price();await w(600);
  await click('[data-seg=tipo] [data-v=Color]',w,()=>{S.color=true;seg('tipo','Color');price()});
  await w(900);
  await click('[data-seg=tipo] [data-v=ByN]',w,()=>{S.color=false;seg('tipo','ByN');price()});
  await click('[data-seg=faz] [data-v=Doble]',w,()=>{S.faz='Doble';seg('faz','Doble')});
  await click('[data-seg=fin] [data-v=Anillado]',w,()=>{S.fin='Anillado';seg('fin','Anillado');price()});
  cur.style.opacity=0;
};
const SC0f=async w=>{
  await w(700);
  await click('#pick',w,()=>{loadEd();nx.disabled=false;S.loaded=true;price()});
  await w(900);
  await click('[data-a=size]',w,()=>open('ds'));
  await click('#sizes [data-v="13x18"]',w,()=>{const p=P[ci];p.size='13x18';p.zoom=1;p.ox=p.oy=0;render()});
  await w(700);
  await click('#ck',w,()=>$('#aa',body).classList.add('is-checked'));
  await w(500);
  await click('#cfm',w,()=>{P.forEach(q=>{q.size='13x18';q.zoom=1;q.ox=q.oy=0});$('#aa',body).classList.remove('is-checked');render()});
  await w(900);await click('[data-a=size]',w,()=>open(null));
  await click('[data-a=zoom]',w,()=>open('dz'));
  await slide('zoom',1.5,w);
  await click('[data-a=zoom]',w,()=>open(null));
  await drag(-45,0,w);
  await click('[data-a=bn]',w,()=>{P[ci].byn=1;render()});
  await w(700);
  await click('[data-a=adj]',w,()=>open('da'));
  await slide('br',1.1,w);await slide('ct',1.2,w);
  await click('[data-a=adj]',w,()=>open(null));
  await click('.th[data-i="1"]',w,()=>{ci=1;render()});
  await click('[data-a=copies]',w,()=>open('dc'));
  await click('#cplus',w,()=>{P[ci].copies=2;render()});
  await w(600);await click('[data-a=copies]',w,()=>open(null));
  await click('.th[data-i="2"]',w,()=>{ci=2;render()});
  await click('[data-a=rot]',w,()=>{P[ci].rot=1;render()});
  await w(900);cur.style.opacity=0;
};
const SC=[
w=>(MODE==='foto'?SC0f:SC0d)(w),
async w=>{
  await w(800);
  await click('#zp',w,()=>{$('#zp').classList.add('is-selected');S.zone=true;price()});
  await w(500);hide('zs');show('sz','ds');await w(500);
  await click('#d16',w,()=>$('#d16').classList.add('is-selected'));
  await w(400);hide('ds');show('sd','hs');await w(400);
  await click('#sl',w,()=>$('#sl').classList.add('is-selected'));
  await w(400);hide('hs');show('sh','as');await w(400);
  await type('i3','Av. Santa Fe 1234, 5° B',w);
  cur.style.opacity=0;
},
async w=>{
  await w(700);
  for(const [id,t] of [['n1','Lucía'],['n2','Gómez'],['n3','DNI'],['n4','30123456'],['n5','lucia@mail.com'],['n6','+54 9 11 5555 1234']])await type(id,t,w);
  cur.style.opacity=0;
},
async w=>{
  await w(900);
  await click('#tt',w,()=>{$('#tt').classList.add('on');$('#tm').classList.remove('on');hide('pm');show('pt')});
  await w(900);
  await click('#cf',w,()=>{hide('rc');show('ok');body.scrollTo({top:0})});
  cur.style.opacity=0;
}
];
function go(i){
  step=i;tok++;const my=tok;
  const w=async ms=>{await wait(ms);if(my!==tok)throw 0};
  S.loaded=i>0;
  if(i===0){S.color=false;S.faz='Simple';S.fin='Suelto'}else{S.color=false;S.faz='Doble';S.fin='Anillado'}
  resetP(i>0);body.classList.remove('ed');root.classList.remove('in-ed','fast');
  S.zone=i>=2;
  body.innerHTML=T[i]();body.scrollTo({top:0});
  $('#d99-steps').innerHTML=NAMES.map((n,k)=>`<div class="tick ${k===i?'is-active':k<i?'is-done':''}"><span class="n">0${k+1}</span><span class="lbl">${MODE==='foto'&&!k?'FOTOS':n}</span></div>`).join('');
  $$('.demo-list li').forEach((l,k)=>l.classList.toggle('on',k===i));
  bk.style.display=i?'':'none';nx.style.display=i===3?'none':'';
  nx.disabled=i===0;cur.style.transitionDuration=i===3?'1.4s':(i===0?'.4s':'.8s');cur.style.opacity=0;price();
  SC[i](w).catch(()=>{});
}
bk.onclick=()=>go(Math.max(0,step-1));
nx.onclick=()=>go(Math.min(3,step+1));
let started=false;
$$('.demo-list li').forEach((li,k)=>{
  li.setAttribute('role','button');li.tabIndex=0;
  const open=()=>{started=true;go(k);if(matchMedia('(max-width:900px)').matches)root.scrollIntoView({behavior:RM?'auto':'smooth',block:'center'})};
  li.addEventListener('click',open);
  li.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
});
const LI={doc:['Subís y configurás','Copias, faz, color y acabado. El precio se actualiza en vivo.'],foto:['Subís y editás tus fotos','Tamaño, zoom, rotación, encuadre y color. Lo que ves es lo que se imprime.']};
const HD={doc:['Probá el pedido antes de hacerlo.','Así se ve la app por dentro: subís tu archivo, elegís cómo imprimirlo y ves el precio mientras configurás. Recién pagás al final.'],foto:['Editá tus fotos como las querés impresas.','Movés, rotás, encuadrás y ajustás el color. La foto sale impresa tal cual la dejaste, y ves el precio mientras elegís.']};
function setMode(m){MODE=m;var sh=root.closest('section');sh.querySelector('.sec-head h2').textContent=HD[m][0];sh.querySelector('.sec-head > p').textContent=HD[m][1];{const se=root.closest('section');se.classList.toggle('is-dark',m==='foto');se.classList.toggle('is-yellow',m==='doc')}$$('.demo-switch button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.mode===m)));const li=$('.demo-list li');li.querySelector('b').textContent=LI[m][0];li.querySelector('span').textContent=LI[m][1]}
$$('.demo-switch button').forEach(b=>b.addEventListener('click',()=>{const m=b.dataset.mode;if(b.getAttribute('aria-selected')==='true')return;setMode(m);if(m==='foto')IMGS.forEach(i=>{new Image().src=i.src});started=true;go(0)}));
setMode(MODE);IMGS.forEach(i=>{new Image().src=i.src});
new IntersectionObserver((e,o)=>{if(e[0].isIntersecting&&!started){started=true;go(0);o.disconnect()}},{threshold:.5}).observe(root);
RMq.addEventListener('change',e=>{RM=e.matches;if(started)go(step)});
})();
