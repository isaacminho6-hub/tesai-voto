/* ==================== Supabase ==================== */
const SUPABASE_URL = "https://jlsledoyvbjqzmikfase.supabase.co"; // ya lo tenés
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsc2xlZG95dmJpcXptaWtmYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjIwOTQsImV4cCI6MjA3MTE5ODA5NH0.EMCOh87jgSZAwN1uoiemQr_D6ixwwvCF_ZY6xYzpIO0";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ==================== Helpers / UI ==================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => new Intl.NumberFormat().format(n ?? 0);

// Inyecta estilos mínimos (tarjetas, grilla)
(function injectStyles(){
  const css = `
  .grid {display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:18px}
  .card {background:#111824;border:1px solid #243044;border-radius:14px;overflow:hidden;box-shadow:0 6px 14px rgba(0,0,0,.25)}
  .card img {width:100%;aspect-ratio:1/1;object-fit:cover;display:block}
  .card .body {padding:12px}
  .card h4 {margin:0 0 8px 0;font-weight:600;font-size:16px}
  .btn {width:100%;border:0;border-radius:10px;padding:10px 12px;cursor:pointer;font-weight:600}
  .btn-primary {background:#33d69f;color:#071218}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .kpis {display:flex;gap:16px}
  .kpis .kpi{flex:1;background:#0e1522;border:1px solid #243044;border-radius:12px;padding:12px}
  .list-compact li{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed #223}
  .pill{padding:2px 8px;border-radius:999px;background:#0e2133;border:1px solid #244}
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

/* ============== Referencias de vistas (tabs) ============== */
const views = {
  noti:   $('#view-noti'),
  votar:  $('#view-votar'),
  results:$('#view-resultados'),
  equipos:$('#view-equipos'),
  ayuda:  $('#view-ayuda'),
};

// Enlaza tabs si existen
const tabs = $('#tabs');
if (tabs){
  tabs.addEventListener('click',(e)=>{
    const b = e.target.closest('[data-view]');
    if(!b) return;
    tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    b.classList.add('active');
    Object.values(views).forEach(v=>v?.classList.add('hidden'));
    const target = views[b.dataset.view];
    target?.classList.remove('hidden');
  });
}

/* ============== Device ID (1 voto por dispositivo) ============== */
function getDeviceId(){
  let id = localStorage.getItem('device_id');
  if(!id){
    id = (crypto.randomUUID?.() ?? (Date.now().toString(36)+Math.random().toString(36).slice(2))).slice(0,24);
    localStorage.setItem('device_id', id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();

/* ==================== KPI Tops ==================== */
async function loadKPIs(){
  const [{count: votosCount}, {count: candCount}] = await Promise.all([
    supabase.from('votos').select('*', { count:'exact', head:true }),
    supabase.from('candidatos').select('*', { count:'exact', head:true }),
  ]);
  $('#kpi-votos') && ($('#kpi-votos').textContent = fmt(votosCount));
  $('#kpi-cands') && ($('#kpi-cands').textContent = fmt(candCount));
  $('#kpi-ses') && ($('#kpi-ses').textContent = '1'); // página = 1 sesión por dispositivo
}

/* ============== Cargar candidatos y render tarjetas ============== */
async function loadCandidatos(){
  // Asegura contenedor
  let list = $('#votar-list');
  if(!list){
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div id="votar-list" class="grid"></div>`;
    views.votar?.appendChild(wrap);
    list = $('#votar-list');
  }

  // Trae si ya voté para desactivar botones
  const { data: myVote } = await supabase
    .from('votos')
    .select('candidato_id')
    .eq('dispositivo', DEVICE_ID)
    .limit(1)
    .maybeSingle();

  const { data: cands, error } = await supabase
    .from('candidatos')
    .select('id, nombre, foto_url, foto'); // por compat: si tenés "foto" vieja

  if(error){ list.innerHTML = renderError(error.message); return; }

  list.innerHTML = cands.map(c=>{
    // Fallback de imagen:
    const src = (c.foto_url && c.foto_url.trim())
      ? c.foto_url.trim()
      : (c.foto && c.foto.trim())
        ? absolutizeRepoPath(c.foto.trim())
        : absolutizeRepoPath(`assets/img/${c.nombre}.png`);

    const disabled = !!myVote;
    return `
      <article class="card" data-id="${c.id}">
        <img src="${src}" alt="${c.nombre}">
        <div class="body">
          <h4>${c.nombre}</h4>
          <button class="btn btn-primary" ${disabled?'disabled':''}>Votar</button>
        </div>
      </article>
    `;
  }).join('');

  // Click votar
  list.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button.btn');
    if(!btn) return;
    const card = e.target.closest('.card');
    const candidato_id = Number(card.dataset.id);
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    // Verifica nuevamente si ya votó (race-safety)
    const { data: already } = await supabase
      .from('votos').select('id').eq('dispositivo', DEVICE_ID).limit(1);

    if(already && already.length){
      btn.textContent = 'Ya votaste';
      disableAllVoteButtons();
      return;
    }

    const { error: insErr } = await supabase.from('votos').insert({
      candidato_id,
      dispositivo: DEVICE_ID,
      fecha: new Date().toISOString()
    });

    if(insErr){
      btn.textContent = 'Reintentar';
      btn.disabled = false;
      alert('Error al registrar tu voto: ' + insErr.message);
      return;
    }

    btn.textContent = '¡Voto registrado!';
    disableAllVoteButtons();
    loadKPIs();
    loadResultados();
  });
}

function disableAllVoteButtons(){
  $$('#votar-list .btn').forEach(b=>{ b.disabled = true; b.textContent = 'Voto registrado'; });
}

function renderError(msg){
  return `
    <div class="kpis">
      <div class="kpi"><strong>Error al cargar candidatos</strong><br><span class="pill">${msg}</span></div>
    </div>
  `;
}

function absolutizeRepoPath(path){
  // Asegura URL absoluta del raw en GitHub Pages
  // Si ya es absoluta, devuelve tal cual
  if(/^https?:\/\//i.test(path)) return path;
  // Para GitHub Pages públicas, los assets también sirven directo:
  // https://isaacminho6-hub.github.io/tesai-voto/<path>
  return `https://raw.githubusercontent.com/isaacminho6-hub/tesai-voto/main/${path.replace(/^\/+/,'')}`;
}

/* ==================== Resultados (ranking simple) ==================== */
async function loadResultados(){
  let box = $('#resultados-box');
  if(!box){
    const el = document.createElement('div');
    el.innerHTML = `<div id="resultados-box"></div>`;
    views.results?.appendChild(el);
    box = $('#resultados-box');
  }

  const { data: votos, error } = await supabase
    .from('votos')
    .select('candidato_id');

  if(error){ box.innerHTML = renderError(error.message); return; }

  // Conteo
  const counts = new Map();
  votos?.forEach(v=>{
    counts.set(v.candidato_id, (counts.get(v.candidato_id) ?? 0) + 1);
  });

  // Trae nombres para mostrar
  const { data: cands } = await supabase.from('candidatos').select('id, nombre');

  const rows = (cands||[])
    .map(c=>({ id:c.id, nombre:c.nombre, votos: counts.get(c.id) ?? 0 }))
    .sort((a,b)=> b.votos - a.votos);

  box.innerHTML = `
    <ul class="list-compact">
      ${rows.map(r=>`
        <li><span>${r.nombre}</span><strong>${fmt(r.votos)}</strong></li>
      `).join('')}
    </ul>
  `;
}

/* ==================== Equipos (opcional) ==================== */
async function loadEquipos(){
  if(!views.equipos) return;
  let box = $('#equipos-box');
  if(!box){
    const el = document.createElement('div');
    el.innerHTML = `<div id="equipos-box"></div>`;
    views.equipos.appendChild(el);
    box = $('#equipos-box');
  }
  const { data, error } = await supabase.from('equipos').select('*');
  if(error){ box.innerHTML = renderError(error.message); return; }
  if(!data?.length){ box.innerHTML = `<div class="pill">Sin equipos cargados</div>`; return; }

  box.innerHTML = `
    <ul class="list-compact">
      ${data.map(e=>`<li><span>${e.nombre ?? 'Equipo'}</span><span class="pill">${e.categoria ?? ''}</span></li>`).join('')}
    </ul>
  `;
}

/* ==================== Init ==================== */
async function init(){
  // KPIs + contenido
  await loadKPIs();
  await loadCandidatos();
  await loadResultados();
  await loadEquipos();

  // Realtime opcional: refrescar cada 10s resultados/KPIs
  setInterval(()=>{ loadKPIs(); loadResultados(); }, 10000);
}

document.addEventListener('DOMContentLoaded', init);


