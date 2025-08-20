/* ==================== Config Supabase ==================== */
// Usá las tuyas (ya las tenés). Si querés, podés dejarlas así:
const SUPABASE_URL = "https://jlsledoyvbjqzmikfase.supabase.co";
const SUPABASE_ANON_KEY = "eyJh...tuAnonKey..."; // tu anon key completa

// Cliente v2 desde CDN (global "supabase")
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ==================== Utilidades UI ==================== */
const $$ = (sel) => document.querySelectorAll(sel);
const $ = (sel) => document.querySelector(sel);

function showError(msg) {
  const box = $("#err");
  box.textContent = msg;
  box.style.display = "flex";
}
function hideError() {
  const box = $("#err");
  box.style.display = "none";
  box.textContent = "";
}

// Mini estilos inyectados (cards, etc.)
(function injectStyles(){
  const css = `
  .list-compact .card{border-radius:12px}
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

/* ==================== Tabs ==================== */
const views = {
  noti: $("#view-noti"),
  votar: $("#view-votar"),
  resultados: $("#view-resultados"),
  equipos: $("#view-equipos"),
  ayuda: $("#view-ayuda"),
};
document.getElementById("tabs").addEventListener("click", (e)=>{
  const b = e.target.closest(".tab");
  if (!b) return;
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  b.classList.add("active");
  Object.values(views).forEach(v=>v.classList.remove("view-active"));
  views[b.dataset.view].classList.add("view-active");
});

/* ==================== Device ID (1 voto) ==================== */
function getDeviceId(){
  let id = localStorage.getItem("device_id");
  if (!id){
    // UUID simple
    id = crypto.randomUUID ? crypto.randomUUID() : (Date.now()+"-"+Math.random());
    localStorage.setItem("device_id", id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();

/* ==================== KPIs ==================== */
async function loadKPIs(){
  try{
    const { count: votosCount, error: e1 } = await sb.from("votos").select("*", { count:"exact", head:true });
    if (e1) throw e1;
    const { count: candCount, error: e2 } = await sb.from("candidatos").select("*", { count:"exact", head:true });
    if (e2) throw e2;

    document.getElementById("kpi-votos").textContent = votosCount ?? 0;
    document.getElementById("kpi-cands").textContent = candCount ?? 0;
  }catch(err){
    showError("No se pudieron cargar KPIs: " + err.message);
    console.error(err);
  }
}

/* ==================== Cargar Candidatos ==================== */
function cardTemplate(c){
  const imgSrc = `assets/img/${c.foto}`; // en BD guardaste Ada.png, etc.
  return `
    <div class="card">
      <img class="pic" loading="lazy" src="${imgSrc}" alt="${c.nombre}" onerror="this.src='assets/img/sample.png'">
      <div class="body">
        <span class="pill">Candidata/o</span>
        <div class="h">
          <div>
            <div class="name">${c.nombre}</div>
            <div class="team">${c.equipo ?? ""}</div>
          </div>
          <div class="team">#${c.id ?? ""}</div>
        </div>
        <button class="btn" data-votar="${c.id}">Votar por ${c.nombre}</button>
      </div>
    </div>
  `;
}

async function loadCandidatos(){
  hideError();
  const cont = document.getElementById("cards");
  cont.innerHTML = "";

  try{
    const { data, error } = await sb.from("candidatos").select("id,nombre,foto");
    if (error) throw error;

    if (!data || data.length === 0){
      cont.innerHTML = `<div class="error" style="display:flex">No hay candidatos cargados.</div>`;
      return;
    }

    cont.innerHTML = data.map(cardTemplate).join("");

    cont.addEventListener("click", onVoteClick);
  }catch(err){
    console.error(err);
    showError("Error al cargar candidatos: " + (err.message || "falló la consulta"));
  }
}

/* ==================== Votar ==================== */
let voting = false;

async function onVoteClick(e){
  const btn = e.target.closest("button[data-votar]");
  if (!btn) return;
  if (voting) return;

  const candidato_id = parseInt(btn.dataset.votar, 10);

  try{
    voting = true;
    btn.disabled = true;
    btn.textContent = "Enviando voto…";

    // 1 voto por dispositivo: si ya existe, no dejamos
    const { data: ya, error: e0 } = await sb
      .from("votos")
      .select("id")
      .eq("dispositivo", DEVICE_ID)
      .maybeSingle();

    if (e0) throw e0;
    if (ya){
      btn.textContent = "Ya votaste desde este dispositivo";
      return;
    }

    const payload = {
      candidato_id,
      dispositivo: DEVICE_ID,
      fecha: new Date().toISOString()
    };

    const { error: insErr } = await sb.from("votos").insert(payload);
    if (insErr) throw insErr;

    btn.textContent = "¡Voto registrado!";
    await loadKPIs();
  }catch(err){
    console.error(err);
    btn.textContent = "Error al votar";
    showError("Error al votar: " + (err.message || "desconocido"));
  }finally{
    voting = false;
    setTimeout(()=>{ try{ btn.disabled = false; btn.textContent = "Votar"; }catch{} }, 1800);
  }
}

/* ==================== Init ==================== */
(async function init(){
  // debug de conectividad mínima (ayuda si aparece “Failed to fetch”)
  try{
    const { error } = await sb.from("candidatos").select("id", { head:true, count:"exact" });
    if (error) console.warn("Ping candidatos con error:", error);
  }catch(pingErr){
    console.warn("Ping falló:", pingErr);
  }

  await loadKPIs();
  await loadCandidatos();
})();



