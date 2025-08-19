// ================= Config Supabase =================
const SUPABASE_URL = "https://jlsledoyvbjqzmikfase.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // tu anon key
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================= Tabs =================
const views = {
  noti: document.getElementById('view-noti'),
  votar: document.getElementById('view-votar'),
  resultados: document.getElementById('view-resultados'),
  equipos: document.getElementById('view-equipos'),
  ayuda: document.getElementById('view-ayuda'),
};

document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]');
  if (!b) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  b.classList.add('active');
  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[b.dataset.view].classList.remove('hidden');
});

// ================= Device ID (1 voto por dispositivo) =================
function getDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('device_id', id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();

// ================= KPIs =================
async function loadKPIs() {
  const { count: votosCount } = await supabase.from('votos').select('*', { count: 'exact', head: true });
  const { count: candCount } = await supabase.from('candidatos').select('*', { count: 'exact', head: true });

  document.getElementById('kpi-votos').textContent = votosCount ?? '-';
  document.getElementById('kpi-cands').textContent = candCount ?? '-';
}

// ================= Cargar Candidatos =================
async function loadCandidatos() {
  const { data, error } = await supabase.from('candidatos').select('*');
  if (error) {
    console.error(error);
    return;
  }
  const cont = document.getElementById('candidatos-list');
  cont.innerHTML = '';
  data.forEach(c => {
    const card = document.createElement('div');
    card.className = "candidato";
    card.innerHTML = `
      <img src="${c.foto}" alt="${c.nombre}">
      <h3>${c.nombre}</h3>
      <button onclick="emitirVoto('${c.id}')">Votar</button>
    `;
    cont.appendChild(card);
  });
}

// ================= Emitir Voto =================
async function emitirVoto(candidato_id) {
  // Chequear si ya votó este dispositivo
  const { data: yaVoto } = await supabase
    .from('votos')
    .select('*')
    .eq('device_id', DEVICE_ID);

  if (yaVoto && yaVoto.length > 0) {
    alert("Ya votaste desde este dispositivo 🚫");
    return;
  }

  const { error } = await supabase.from('votos').insert([
    { candidato_id, device_id: DEVICE_ID }
  ]);

  if (error) {
    console.error(error);
    alert("❌ Error al votar");
  } else {
    alert("✅ Voto registrado");
    loadKPIs();
    loadResultados();
  }
}

// ================= Resultados =================
async function loadResultados() {
  const { data: candidatos } = await supabase.from('candidatos').select('*');
  const { data: votos } = await supabase.from('votos').select('*');

  const conteo = {};
  votos.forEach(v => {
    conteo[v.candidato_id] = (conteo[v.candidato_id] || 0) + 1;
  });

  const cont = document.getElementById('resultados-list');
  cont.innerHTML = '';
  candidatos.forEach(c => {
    const total = conteo[c.id] || 0;
    const card = document.createElement('div');
    card.className = "resultado";
    card.innerHTML = `
      <img src="${c.foto}" alt="${c.nombre}">
      <h3>${c.nombre}</h3>
      <p>Votos: ${total}</p>
    `;
    cont.appendChild(card);
  });
}

// ================= Cargar Equipos =================
async function loadEquipos() {
  const { data, error } = await supabase.from('equipos').select('*');
  if (error) {
    console.error(error);
    return;
  }
  const cont = document.getElementById('equipos-list');
  cont.innerHTML = '';
  data.forEach(eq => {
    const item = document.createElement('div');
    item.className = "equipo";
    item.innerHTML = `<p>${eq.nombre}</p>`;
    cont.appendChild(item);
  });
}

// ================= Inicialización =================
window.addEventListener('DOMContentLoaded', () => {
  loadKPIs();
  loadCandidatos();
  loadResultados();
  loadEquipos();
});

