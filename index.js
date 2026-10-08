
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
const fmt=n=>'$'+n.toLocaleString('es-AR');
const fin=()=>S.fin==='Anillado'?1500:0,prn=()=>50*(S.color?150:50),sub=()=>prn()+fin(),total=()=>sub()+(S.zone?3500:0);
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
const T=[
()=>PH('Cargá tus archivos','Aceptamos PDF e imágenes. Configurá copias, rango de páginas y acabado para cada uno.')+`
<div class="dropzone" id="drop"><div class="dz-title">Arrastrá y soltá tus archivos</div><div class="dz-or">ó</div><span class="btn" id="pick">Seleccioná tus archivos</span><div class="dz-list">Se aceptan PDF e imágenes (JPG, PNG)</div></div>
<div class="file-card hid" id="cfg"><div class="file-head"><div class="file-thumb">📄</div><div><div class="idx">01</div><div class="fname">tu_documento.pdf</div><div class="fsub">50 carillas</div><span class="upload-status is-uploading" id="us">Subiendo…</span></div></div>
<div class="form-grid">${F('Copias','i1')}${F('Rango de páginas','i2','ej. 1-5,8')}${SG('Faz','faz',['Simple','Doble'],'Simple')}${SG('Páginas por carilla','ppc',['1','2','4','6'],'1')}${SG('Tipo de impresión','tipo',['ByN','Color'],'ByN')}${SG('Acabado','fin',['Abrochado','Clip','Anillado'],'')}</div>
<div class="dim-line hid" id="dl"><span>50 carillas</span><span class="tm">×</span><span id="rate">$50</span><span class="tm hid" id="fp">+</span><span class="hid" id="fx">Anillado $1.500</span><span class="result">= <span class="amt" id="amt">$2.500</span></span></div></div>`,
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
<div class="receipt"><div class="receipt-head"><h3>Resumen del pedido</h3><span>1 archivo</span></div>
<div class="receipt-row"><div><b>tu_documento.pdf</b><em>${S.color?'Color':'ByN'} · 50 carillas · ${S.faz} faz · ${S.fin}</em></div><span class="val">${fmt(prn())}</span></div>
${fin()?`<div class="receipt-row"><b>Anillado</b><span class="val">${fmt(fin())}</span></div>`:''}
<div class="receipt-row"><b>Envío a Palermo</b><span class="val">$3.500</span></div>
<div class="receipt-total"><span>Total a pagar</span><b>${fmt(total())}</b></div></div>
<div class="tabs"><div class="on" id="tm">Mercado Pago</div><div id="tt">Transferencia</div></div>
<div id="pm"><span class="btn btn-primary btn-block" style="padding:.9em .9em 1.2em">Ir a pagar con Mercado Pago →</span><div class="eyebrow" style="text-align:center;margin-top:.75em"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="vertical-align:-2px;margin-right:.4em"><rect x="5" y="11" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Pago seguro</div></div>
<div id="pt" class="hid"><div class="plate tr"><p class="eyebrow" style="margin:0 0 .6em">Datos para transferir</p><div><b>Alias:</b> 99copias.mp</div><div><b>Titular:</b> 99copias</div></div>
<div class="comp">Subir comprobante (opcional, lo podés hacer después desde "Mis pedidos")</div>
<span class="btn btn-primary btn-block" id="cf" style="padding:.9em .9em 1.2em">Confirmar pedido →</span></div></div>
<div id="ok" class="hid"><div class="plate is-focused" style="text-align:center;padding:2.2em 1.2em"><svg width="44" height="44" viewBox="0 0 44 44" fill="none" style="margin:0 auto .5em;display:block"><path d="M22 2 L26 18 L42 22 L26 26 L22 42 L18 26 L2 22 L18 18 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><div class="eyebrow">Pedido confirmado</div><h2 style="margin-top:.6em;font:600 1.4em var(--ff)">¡Listo! Así de simple.</h2><p style="color:var(--ink-60);margin-top:.6em;font-size:.9em">Ahora hacelo con tu archivo: en menos de un minuto tenés tu pedido en curso.</p><a class="btn btn-primary" style="margin-top:1.4em;text-decoration:none" href="https://app.99copias.com.ar">Hacer mi pedido →</a></div></div>`
];
/* ---------- animación ---------- */
const RMq=matchMedia('(prefers-reduced-motion: reduce)');let RM=RMq.matches;const SPD=[1.8,1,1,1.8];
const wait=ms=>RM?Promise.resolve():new Promise(r=>setTimeout(r,ms*SPD[step]));
async function aim(el,w){
  if(RM)return;
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

const SC=[
async w=>{
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
},
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
  if(i===0){S.color=false;S.faz='Simple';S.fin='Suelto'}
  S.zone=i>=2;
  body.innerHTML=T[i]();body.scrollTo({top:0});
  $('#d99-steps').innerHTML=NAMES.map((n,k)=>`<div class="tick ${k===i?'is-active':k<i?'is-done':''}"><span class="n">0${k+1}</span><span class="lbl">${n}</span></div>`).join('');
  $$('.demo-list li').forEach((l,k)=>l.classList.toggle('on',k===i));
  bk.style.display=i?'':'none';nx.style.display=i===3?'none':'';
  nx.disabled=i===0;cur.style.transitionDuration=(i===1||i===2)?'.8s':'1.4s';cur.style.opacity=0;price();
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
new IntersectionObserver((e,o)=>{if(e[0].isIntersecting&&!started){started=true;go(0);o.disconnect()}},{threshold:.5}).observe(root);
RMq.addEventListener('change',e=>{RM=e.matches;if(started)go(step)});
})();
