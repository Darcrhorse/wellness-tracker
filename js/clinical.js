(function(){
  const DATA_URL = '../data/wellness.json';
  const PIN='506506';
  const $=(s)=>document.querySelector(s);
  const fmt = new Intl.DateTimeFormat('es-CR',{dateStyle:'medium',timeStyle:'short'});
  const fmtDate = new Intl.DateTimeFormat('es-CR',{dateStyle:'medium'});

  function daysSince(startIso){ if(!startIso) return null; const s=new Date(startIso); return Math.floor((Date.now()-s.getTime())/86400000); }
  function deliveredNicPerCig(plan){ return Number(plan?.deliveredPer||0); }

  function ensurePin(){
    const ok = sessionStorage.getItem('clinic_ok')==='1';
    if(ok){ $('#pinOverlay').style.display='none'; $('#app').style.display='block'; return; }
    const input=$('#pinInput'); const btn=$('#pinBtn'); const err=$('#pinError');
    function tryPin(){
      if(input.value===PIN){ sessionStorage.setItem('clinic_ok','1'); $('#pinOverlay').style.display='none'; $('#app').style.display='block'; }
      else { err.textContent='Código incorrecto'; input.value=''; input.focus(); }
    }
    btn.addEventListener('click', tryPin);
    input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') tryPin(); });
    input.focus();
  }

  function renderResumen(data){
    const p=data.plan||{}; const start=new Date(data.quitStart);
    const items=[
      {k:'Paciente', v:'Carlos R.'},
      {k:'Plan', v:'Reducción gradual (tapering) de Marlboro Red'},
      {k:'Fecha de inicio', v: data.quitStart? new Intl.DateTimeFormat('es-CR',{dateStyle:'long', timeStyle:'short'}).format(start):'—'},
      {k:'Línea base', v:`4–6 cigarrillos/día (~54.5mg nicotina total, ~5.5mg entregada/día)`},
      {k:'Plan detallado', v:`Sem 1-2: ${p.week1_2??3}/día → Sem 3-4: ${p.week3_4??2}/día → Sem 5-6: ${p.week5_6??1}/día → Sem 7+: ${p.week7_plus??0}`},
      {k:'Marca', v:`${p.brand||'—'} (${p.nicotinePer||'—'}mg nicotina total, ${p.deliveredPer||'—'}mg entregada por cigarrillo)`},
      {k:'Días desde inicio', v: daysSince(data.quitStart)??'—'}
    ];
    $('#resumen').innerHTML = items.map(o=>`<div class='kpi'><span class='muted'>${o.k}</span><strong>${o.v}</strong></div>`).join('');
  }

  function drawCombo(logs, plan){
    const c=$('#comboChart'); const x=c.getContext('2d'); x.clearRect(0,0,c.width,c.height);
    if(!logs||!logs.length){ x.fillStyle='#a1a1aa'; x.fillText('Sin datos',10,20); return; }
    const data=logs.slice(-14);
    const pad=30; const W=c.width-pad*2; const H=c.height-pad*2;
    const maxSmokes = Math.max(3, ...data.map(d=>Number(d.smokes)||0));
    const maxMood = 10;
    // grid
    x.strokeStyle='#1f2937'; x.beginPath(); for(let i=0;i<=5;i++){const y=pad+H*i/5; x.moveTo(pad,y); x.lineTo(pad+W,y);} x.stroke();
    // bars (smokes)
    const bw = W/Math.max(14, data.length)*0.5; const step=W/Math.max(14,data.length);
    data.forEach((d,i)=>{
      const v=Number(d.smokes)||0; const h=H*(v/maxSmokes); const x0=pad+i*step-bw/2; const y0=pad+H-h;
      x.fillStyle='#334155'; x.fillRect(x0,y0,bw,h);
    });
    // line (mood)
    x.beginPath(); data.forEach((d,i)=>{ const v=Number(d.avgMood)||0; const xi=pad+i*step; const yi=pad+H*(1-v/maxMood); if(i===0) x.moveTo(xi,yi); else x.lineTo(xi,yi); });
    x.strokeStyle='#4ade80'; x.lineWidth=2; x.stroke();
  }

  function renderTable(logs, plan){
    const tb=$('#logTable tbody'); const per=deliveredNicPerCig(plan);
    const rows=(logs||[]).slice(-14).map(r=>{
      const nic=(Number(r.smokes)||0)*per; const nicTxt = isFinite(nic)? nic.toFixed(1):'—';
      return `<tr><td>${r.date||'—'}</td><td>${r.smokes??'—'}</td><td>${r.avgMood??'—'}</td><td>${nicTxt}</td></tr>`;
    }).join('');
    tb.innerHTML = rows || `<tr><td colspan=4 class='muted'>Sin datos</td></tr>`;
  }

  function statusClass(ok,warn,bad){ if(bad) return 'status-bad'; if(warn) return 'status-warn'; return 'status-ok'; }

  function renderWatch(w){
    const el=$('#watch');
    const items=[
      {k:'FC reposo (bpm)', v: w?.heartRate, assess:(v)=>({bad:v>100, warn:v>85})},
      {k:'Estrés (HRV índice)', v: w?.stress, assess:(v)=>({warn:v>70})},
      {k:'SpO₂ (%)', v: w?.spo2, assess:(v)=>({bad:v<92, warn:v<95})},
      {k:'Sueño (h)', v: w?.sleepDuration!=null? (w.sleepDuration/60).toFixed(1):null, assess:(v)=>({warn:v<7, bad:v<6.5})},
      {k:'Pasos', v: w?.steps},
      {k:'Ubicación', v: w?.location}
    ];
    el.innerHTML = items.map(it=>{
      const val = (it.v==null || it.v==='')? '—' : it.v;
      const a = typeof it.assess==='function'? it.assess(Number(it.v)) : {};
      return `<div class='kpi'><span class='muted'>${it.k}</span><strong class='${statusClass(false,a?.warn,a?.bad)}'>${val}</strong></div>`;
    }).join('');
  }

  function renderHitos(quitStart){
    const tl=$('#hitos'); if(!quitStart){ tl.innerHTML='<div class="muted">Sin datos</div>'; return; }
    const start=new Date(quitStart).getTime(); const now=Date.now();
    const events=[
      {t:'12h: Normalización de CO (Surgeon General Report)', ms:12*3600e3},
      {t:'24h: FC comienza a bajar ~5-10 bpm (Persico 1992)', ms:24*3600e3},
      {t:'48h: Terminaciones nerviosas regenerándose, gusto/olfato mejorando', ms:48*3600e3},
      {t:'72h: Respiración más fácil, tubos bronquiales relajándose', ms:72*3600e3},
      {t:'1 semana: Antojos más manejables, VFC mejorando (Yotsukura 1998)', ms:7*24*3600e3},
      {t:'2 semanas: Circulación mejorando', ms:14*24*3600e3},
      {t:'1 mes: Función pulmonar +30%, cilios recuperándose', ms:30*24*3600e3},
      {t:'3 meses: Riesgo cardíaco disminuyendo', ms:90*24*3600e3},
      {t:'6 meses: Tos/sibilancias reducidas significativamente', ms:180*24*3600e3},
      {t:'1 año: Riesgo de enfermedad cardíaca a la mitad vs fumador activo', ms:365*24*3600e3},
    ];
    tl.innerHTML = events.map(ev=>{
      const reached = now >= start + ev.ms; const style = reached? 'color:#4ade80':'color:#a1a1aa';
      return `<div class='tl-item' style='${style}'>${ev.t}</div>`;
    }).join('');
  }

  async function load(){
    try{
      const res=await fetch(DATA_URL+`?t=${Date.now()}`, {cache:'no-store'});
      const data=await res.json();
      renderResumen(data);
      drawCombo(Array.isArray(data.logs)?data.logs:[], data.plan||{});
      renderTable(Array.isArray(data.logs)?data.logs:[], data.plan||{});
      renderWatch(data.watch||{});
      renderHitos(data.quitStart);
      $('#footer').textContent = 'Última actualización: ' + (data.updated? fmt.format(new Date(data.updated)):'—');
    }catch(e){
      console.error(e);
      $('#resumen').innerHTML = '<div class="muted">No se pudo cargar la información.</div>';
    }
  }

  ensurePin();
  if(sessionStorage.getItem('clinic_ok')==='1') load();
  // load after unlocking
  document.getElementById('pinBtn').addEventListener('click', ()=>{ if(sessionStorage.getItem('clinic_ok')==='1') load(); });
  document.getElementById('pinInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter' && sessionStorage.getItem('clinic_ok')==='1') load(); });
})();
