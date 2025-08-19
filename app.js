
// ================== Config Supabase ==================
const SUPABASE_URL = "https://jlsledoyvbjqzmikfase.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsc2xlZG95dmJpcXptaWtmYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjIwOTQsImV4cCI6MjA3MTE5ODA5NH0.EMCOh87jgSZAwN1uoiemQr_D6ixwwvCF_ZY6xYzpIO0";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================== Tabs ==================
const views = {
  noti: document.getElementById('view-noti'),
  votar: document.getElementById('view-votar'),
  resultados: document.getElementById('view-resultados'),
  equipos: document.getElementById('view-equipos'),
  ayuda: document.getElementById('view-ayuda'),
};
document.getElementById('tabs').addEventListener('click', (e)=>{
  const b = e.target.closest('[data-view]'); if(!b) return;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  b.classList.add('active');
  Object.values(views).forEach(v=>v.classList.add('hidden'));
  views[b.dataset.view].classList.remove('hidden');
});

// ================== Device ID (1 voto por dispositivo) ==================
function getDeviceId(){
  let id = localStorage.getItem('device_id');
  if(!id){ id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2); localStorage.setItem('device_id', id); }
  return id;
}
const DEVICE_ID = getDeviceId();

// ================== KPIs ==================
async function loadKPIs(){
  const { count: votosCount } = await supabase.from('votos').select('*', { count: 'exact', head: true });
  const { count: candCount } = await supabase.from('candidatos').select('*', { count: 'exact', head: true });
  document.getElementById('kpi-votos').textContent = votosCount ?? '—';
  document.getElementById('kpi-cands').textContent = candCount ?? '—';
}

// ================== Video Noti ==================
(function loadVideo(){
  const holder = document.getElementById('video-holder');
  const p = 'assets/videos/noti.mp4';
  fetch(p, {method:'HEAD'}).then(r=>{
    if(r.ok && (r.headers.get('content-length') ?? '0') !== '0'){
      holder.innerHTML = `<video controls src="${p}"></video>`;
    }else{
      holder.innerHTML = `<div class="notice">Sin video cargado. Reemplazá <code>${p}</code> con tu archivo.</div>`;
    }
  }).catch(()=> holder.innerHTML = `<div class="notice">Sin video cargado. Reemplazá <code>${p}</code> con tu archivo.</div>`);
})();

// ================== Candidatos & Votar ==================
async function loadCandidatos(){
  const grid = document.getElementById('grid-candidatos');
  grid.innerHTML = '';
  const { data, error } = await supabase.from('candidatos').select().order('nombre', {ascending: true});
  if(error){ grid.innerHTML = `<div class="notice">Error al cargar candidatos: ${error.message}</div>`; return; }
  if(!data || !data.length){ grid.innerHTML = `<div class="notice">No hay candidatos.</div>`; return; }
  for(const c of data){
    const foto = c.foto || 'assets/img/sample.png';
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="media"><img src="${foto}" alt="${c.nombre}"/></div>
      <div class="body">
        <div class="title">${c.nombre}</div>
        <div class="small">${c.id}</div>
        <button class="btn" data-vote="${c.id}">🗳️ Votar</button>
      </div>
    `;
    grid.appendChild(el);
  }
  grid.addEventListener('click', async (e)=>{
    const b = e.target.closest('[data-vote]'); if(!b) return;
    const candidato_id = b.getAttribute('data-vote');
    // ¿Ya votó este dispositivo?
    const { data: prev } = await supabase.from('votos')
      .select('id').eq('dispositivo', DEVICE_ID).limit(1);
    if(prev && prev.length){
      alert("Este dispositivo ya emitió su voto. ¡Gracias!");
      return;
    }
    const { error } = await supabase.from('votos').insert([{ candidato_id, dispositivo: DEVICE_ID }]);
    if(error){ alert("No se pudo registrar el voto: "+error.message); return; }
    alert("✅ ¡Voto registrado!");
    await Promise.all([loadKPIs(), loadResultados()]);
  }, { once: true });
}

// ================== Resultados (gráfico) ==================
let chart;
async function loadResultados(){
  const { data: cands } = await supabase.from('candidatos').select();
  const { data: votos } = await supabase.from('votos').select('candidato_id');

  const counts = {};
  (cands||[]).forEach(c=>counts[c.id]=0);
  (votos||[]).forEach(v=>{ counts[v.candidato_id]=(counts[v.candidato_id]||0)+1; });

  const labels = (cands||[]).map(c=>c.nombre);
  const byId = Object.fromEntries((cands||[]).map(c=>[c.id,c]));
  const values = (cands||[]).map(c=>counts[c.id]||0);

  const ctx = document.getElementById('chart').getContext('2d');
  const colors = labels.map((_,i)=>`hsl(${(i*47)%360} 90% 60%)`);
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Votos', data: values, backgroundColor: colors }]},
    options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, ticks:{precision:0}}}}
  });
}

// ================== Equipos ==================
async function loadEquipos(){
  const cont = document.getElementById('equipos-list');
  cont.innerHTML = '';
  const { data, error } = await supabase.from('equipos').select().limit(200);
  if(error){ cont.innerHTML = `<div class="notice">Error al cargar equipos: ${error.message}</div>`; return; }
  if(!data || !data.length){ cont.innerHTML = `<div class="notice">No hay equipos cargados.</div>`; return; }
  for(const e of data){
    const el = document.createElement('div');
    el.className = 'card';
    const title = e.nombre || e.titulo || e.id || 'Equipo';
    const extra = e.categoria || e.deporte || e.division || '';
    el.innerHTML = `
      <div class="media"><img src="${e.foto || 'assets/img/sample.png'}" alt="${title}"/></div>
      <div class="body">
        <div class="title">${title}</div>
        <div class="small">${extra}</div>
      </div>
    `;
    cont.appendChild(el);
  }
}

// ================== CSV Export ==================
function toCSV(rows){
  if(!rows || !rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = v => `"${String(v).replace(/"/g,'""')}"`;
  return [keys.join(','), ...rows.map(r=>keys.map(k=>esc(r[k]??'')).join(','))].join('\n');
}
async function exportCSV(){
  const { data, error } = await supabase.from('votos').select();
  if(error){ alert('No se pudo exportar: '+error.message); return; }
  const blob = new Blob([toCSV(data||[])], { type:"text/csv;charset=utf-8" });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'votos.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ================== Events & Init ==================
document.getElementById('btn-csv').addEventListener('click', exportCSV);
document.getElementById('btn-refresh').addEventListener('click', async ()=>{
  await Promise.all([loadKPIs(), loadResultados(), loadEquipos()]);
});

(async function init(){
  await Promise.all([loadKPIs(), loadCandidatos(), loadResultados(), loadEquipos()]);
})();
