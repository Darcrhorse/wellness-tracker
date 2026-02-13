(function(){
  const DATA_URL = '../data/wellness.json';
  const $ = (s)=>document.querySelector(s);
  const fmt = new Intl.DateTimeFormat('es-CR',{dateStyle:'medium', timeStyle:'short'});
  const fmtDate = new Intl.DateTimeFormat('es-CR',{dateStyle:'medium'});

  function daysSince(startIso){
    if(!startIso) return null;
    const start = new Date(startIso);
    const now = new Date();
    return Math.floor((now - start)/(1000*60*60*24));
  }

  function currentPhase(d){
    if(d==null) return {label:'—', idx:-1};
    const day=d+1; // day count starting at 1
    if(day<=7) return {label:'Semana 1 (Días 1-7)', idx:0};
    if(day<=14) return {label:'Semana 2 (Días 8-14)', idx:1};
    if(day<=28) return {label:'Semanas 3-4 (Días 15-28)', idx:2};
    return {label:'Mes 2+ (Día 29+)', idx:3};
  }

  function renderTimeline(days){
    const tl = $('#timeline');
    const items=[
      {t:'Semana 1 (Días 1-7)', d:'Irritabilidad intensa, mal humor, problemas para dormir. ESTO ES NORMAL. No es personal — es la nicotina saliendo del cuerpo. Los días 2-7 son los más difíciles según investigación médica (NCI).'},
      {t:'Semana 2 (Días 8-14)', d:'Los antojos siguen fuertes pero son menos frecuentes. El humor empieza a estabilizarse. Paciencia — cada día es más fácil que el anterior.'},
      {t:'Semanas 3-4 (Días 15-28)', d:'Mejora notable. Menos explosiones emocionales. El sueño se normaliza. Los antojos vienen en oleadas pero pasan en minutos.'},
      {t:'Mes 2+ (Día 29+)', d:'Casi de vuelta a la normalidad. Antojos ocasionales por estrés pero completamente manejables.'}
    ];
    const phase = currentPhase(days).idx;
    tl.innerHTML = items.map((it,i)=>`<div class='tl-item' style='${i===phase?"color:#4ade80;font-weight:600":""}'>${it.t}: <span class='muted'>${it.d}</span></div>`).join('');
  }

  function nicReduction(today, plan){
    if(!plan||today==null) return null;
    const delivered = (n)=> n*Number(plan.deliveredPer||0);
    const base = delivered(Number(plan.baseline||0));
    const cur = delivered(Number(today||0));
    if(base<=0) return null;
    return Math.max(0, Math.min(100, Math.round((1 - (cur/base))*100)));
  }

  function renderProgress(data){
    const d = daysSince(data.quitStart);
    const limit = data.plan?.week1_2 ?? 3; // simple display for pareja
    const todaySmokes = data.today?.smokes ?? 0;
    const red = nicReduction(todaySmokes, data.plan);
    const kpis = [
      {k:'Días desde el inicio', v: d==null?'—':d},
      {k:'Cigarrillos hoy', v: `${todaySmokes} / ${limit}`},
      {k:'Reducción de nicotina', v: red==null?'—':`${red}% vs antes`},
    ];
    $('#progress-kpis').innerHTML = kpis.map(o=>`<div class='kpi'><span class='muted'>${o.k}</span><strong>${o.v}</strong></div>`).join('');
    const pct = Math.max(0, Math.min(100, Math.round((todaySmokes/Math.max(1,limit))*100)));
    $('#progress-bar').style.width = pct+'%';
  }

  function drawMood(logs){
    const c = $('#moodChart');
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    if(!logs||!logs.length){
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText('Sin datos', 10, 20);
      return;
    }
    const data = logs.slice(-14);
    const maxY = 10, minY=0;
    const pad=20; const W=c.width-pad*2; const H=c.height-pad*2;
    // grid
    ctx.strokeStyle='#1f2937'; ctx.lineWidth=1; ctx.beginPath();
    for(let i=0;i<=5;i++){ const y=pad + (H*i/5); ctx.moveTo(pad,y); ctx.lineTo(pad+W,y);} ctx.stroke();
    // line
    const xStep=W/Math.max(1,data.length-1);
    ctx.lineWidth=2; ctx.beginPath();
    data.forEach((d,i)=>{
      const x=pad + i*xStep;
      const y=pad + H*(1-((Number(d.avgMood)||0 - minY)/(maxY-minY)));
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    // color by last value
    const last = Number(data[data.length-1].avgMood)||0;
    ctx.strokeStyle = last<=3? '#ef4444' : last<=6? '#f59e0b' : '#22c55e';
    ctx.stroke();
  }

  async function load(){
    try{
      const res = await fetch(DATA_URL+`?t=${Date.now()}`, {cache:'no-store'});
      const data = await res.json();
      renderTimeline(daysSince(data.quitStart));
      renderProgress(data);
      const logs = Array.isArray(data.logs)? data.logs.map(x=>({date:x.date, avgMood:Number(x.avgMood)||0})):[];
      drawMood(logs);
      const upd = data.updated? fmt.format(new Date(data.updated)) : '—';
      $('#footer').textContent = `Datos actualizados cada 15 minutos. Última actualización: ${upd}`;
    }catch(e){
      console.error(e);
      $('#timeline').innerHTML = '<div class="muted">No se pudo cargar la información.</div>';
      $('#footer').textContent = 'Datos actualizados cada 15 minutos. Última actualización: —';
    }
  }

  load();
})();
