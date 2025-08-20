// app.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/esm/supabase.js";

// ======= Config Supabase (tuyas) =======
const SUPABASE_URL  = "https://jlsledoyvbjqzmikfase.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsc2xlZG95dmJpcXptaWtmYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjIwOTQsImV4cCI6MjA3MTE5ODA5NH0.EMCOh87jgSZAwN1uoiemQr_D6ixwwvCF_ZY6xYzpIO0";
// ======================================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ======= Vistas (tabs) =======
const views = {
  votar: document.getElementById("view-votar"),
  resultados: document.getElementById("view-resultados"),
  ayuda: document.getElementById("view-ayuda"),
};
document.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest(".tab");
  if (!b) return;
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  b.classList.add("active");
  Object.values(views).forEach(v => v.classList.add("hidden"));
  views[b.dataset.view].classList.remove("hidden");
  if (b.dataset.view === "resultados") loadResultados();
});

// ======= Device ID (para 1 voto por dispositivo) =======
function getDeviceId() {
  const KEY = "device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();

// ======= KPIs =======
async function loadKPIs() {
  const votosCount = await supabase.from("votos").select("*", { count: "exact", head: true });
  const candsCount = await supabase.from("candidatos").select("*", { count: "exact", head: true });

  document.getElementById("kpi-votos").textContent = votosCount.count ?? "0";
  document.getElementById("kpi-cands").textContent = candsCount.count ?? "0";
  document.getElementById("kpi-ses").textContent = "1";
}

// ======= Cargar candidatos y render tarjetas =======
async function loadCandidatos() {
  hideMsg();
  const cards = document.getElementById("cards");
  cards.innerHTML = "";

  const { data, error } = await supabase
    .from("candidatos")
    .select("id, nombre, foto")
    .order("nombre", { ascending: true });

  if (error) {
    showErr(`TypeError: ${error.message}`);
    return;
  }
  if (!data || !data.length) {
    showErr("No hay candidatos para mostrar.");
    return;
  }

  for (const c of data) {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.src = `assets/img/${c.foto}`;
    img.alt = c.nombre;

    const body = document.createElement("div");
    body.className = "body";
    body.innerHTML = `<h4>${c.nombre}</h4>`;

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Votar";
    btn.onclick = () => votar(c.id);

    body.appendChild(btn);
    card.appendChild(img);
    card.appendChild(body);
    cards.appendChild(card);
  }
}

// ======= Votar =======
let voting = false;

async function votar(candidato_id) {
  if (voting) return;
  voting = true;
  hideMsg();

  // Doble protección del lado cliente
  if (localStorage.getItem("ya_voto") === "1") {
    showErr("Este dispositivo ya emitió un voto.");
    voting = false;
    return;
  }

  // Validación mínima
  const cand = String(candidato_id || "").trim();
  if (!cand) {
    showErr("Candidato inválido.");
    voting = false;
    return;
  }

  const row = {
    fecha: new Date().toISOString(),     // si la BD tiene default now(), esto es opcional
    candidato_id: cand,
    dispositivo: DEVICE_ID,
  };

  const { error } = await supabase.from("votos").insert(row);

  if (error) {
    // 23505 = índice único (ya votó este dispositivo)
    if (error.code === "23505") {
      localStorage.setItem("ya_voto", "1");
      showErr("Este dispositivo ya realizó su voto.");
    } else {
      showErr("Error al registrar el voto. Intenta de nuevo.");
      console.error(error);
    }
  } else {
    localStorage.setItem("ya_voto", "1");
    showOk();
    await loadKPIs();
    await loadResultados();
  }

  voting = false;
}

// ======= Resultados (agregado en DB, súper liviano) =======
async function loadResultados() {
  const ul = document.getElementById("lista-resultados");
  ul.innerHTML = "";

  // Leemos directamente la vista agregada creada en SQL: public.resultados_view
  const { data, error } = await supabase
    .from("resultados_view")
    .select("candidato_id, nombre, votos")
    .order("votos", { ascending: false })
    .order("nombre", { ascending: true });

  if (error) {
    console.error(error);
    ul.innerHTML = `<li>Error al cargar resultados</li>`;
    return;
  }

  data.forEach(r => {
    const li = document.createElement("li");
    li.textContent = r.nombre;
    const span = document.createElement("span");
    span.textContent = r.votos;
    li.appendChild(span);
    ul.appendChild(li);
  });
}

// ======= Mensajes =======
function hideMsg() {
  document.getElementById("error").hidden = true;
  document.getElementById("ok").hidden = true;
}
function showErr(msg) {
  document.getElementById("error-msg").textContent = msg;
  document.getElementById("error").hidden = false;
}
function showOk() {
  document.getElementById("ok").hidden = false;
}

// ======= Init =======
(async function init() {
  // tabs por data-view
  document.querySelectorAll(".tab").forEach(
    b => (b.dataset.view = b.textContent.trim().toLowerCase())
  );
  await loadKPIs();
  await loadCandidatos();
})();

