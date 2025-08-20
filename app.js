// aplicación.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// === CONFIG SUPABASE ===
const SUPABASE_URL = 'https://jlsledoyvbjqzmikfase.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsc2xlZG95dmJpcXptaWtmYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MjIwOTQsImV4cCI6MjA3MTE5ODA5NH0.EMCOh87jgSZAwN1uoiemQr_D6ixwwvCF_ZY6xYzpIO0'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Helpers
const $ = sel => document.querySelector(sel)
const fmt = n => new Intl.NumberFormat('es').format(n ?? 0)

// Render de candidatos
async function cargarCandidatos() {
  const cont = $('#lista-candidatos')
  const errorBox = $('#error')

  cont.innerHTML = ''
  errorBox.textContent = ''

  const { data, error } = await supabase
    .from('candidatos')
    .select('id, nombre, foto')
    .order('nombre', { ascending: true })

  if (error) {
    errorBox.textContent = `Error al cargar candidatos: ${error.message}`
    return
  }

  if (!data || data.length === 0) {
    cont.innerHTML = '<p>No hay candidatas/os cargados.</p>'
    return
  }

  // grilla
  const grid = document.createElement('div')
  grid.style.display = 'grid'
  grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))'
  grid.style.gap = '16px'

  for (const c of data) {
    const card = document.createElement('div')
    card.className = 'card'
    card.style.background = '#111824'
    card.style.border = '1px solid #243048'
    card.style.borderRadius = '12px'
    card.style.overflow = 'hidden'
    card.style.boxShadow = '0 6px 14px rgba(0,0,0,.25)'

    const img = document.createElement('img')
    img.src = `assets/img/${c.foto}`
    img.alt = c.nombre
    img.style.width = '100%'
    img.style.aspectRatio = '1/1'
    img.style.objectFit = 'cover'
    img.loading = 'lazy'

    const body = document.createElement('div')
    body.style.padding = '12px'

    const h4 = document.createElement('h4')
    h4.textContent = c.nombre
    h4.style.margin = '0 0 8px 0'

    const btn = document.createElement('button')
    btn.textContent = 'Votar'
    btn.className = 'btn btn-primary'
    btn.style.width = '100%'
    btn.style.padding = '10px 12px'
    btn.style.borderRadius = '8px'
    btn.style.border = '1px solid #3d59c6'
    btn.style.background = '#3d59c6'
    btn.style.color = 'white'
    btn.style.cursor = 'pointer'

    btn.addEventListener('click', () => votar(c.id, btn))

    body.appendChild(h4)
    body.appendChild(btn)
    card.appendChild(img)
    card.appendChild(body)
    grid.appendChild(card)
  }

  cont.appendChild(grid)
}

function getDeviceId(){
  let id = localStorage.getItem('device_id')
  if(!id){
    id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2)) + String(Math.random()).slice(2)
    localStorage.setItem('device_id', id)
  }
  return id
}

async function votar(candidato_id, button){
  try{
    button.disabled = true
    button.textContent = 'Enviando...'

    const dispositivo = getDeviceId()

    // Verificar si ya votó este dispositivo
    const { data: ya, error: e1 } = await supabase
      .from('votos')
      .select('id', { count: 'exact', head: true })
      .eq('dispositivo', dispositivo)

    if (e1) throw e1
    if ((ya ?? 0) > 0) {
      alert('Ya registraste un voto desde este dispositivo.')
      button.textContent = 'Votar'
      button.disabled = false
      return
    }

    const { error: e2 } = await supabase.from('votos').insert({
      fecha: new Date().toISOString(),
      candidato_id,
      dispositivo
    })
    if (e2) throw e2

    button.textContent = '¡Voto registrado!'
    await cargarKPIs()
    await cargarResultadosPreview() // opcional si tenés un resumen
  } catch(err){
    console.error(err)
    alert('Error al registrar el voto.')
    button.textContent = 'Votar'
    button.disabled = false
  }
}

// KPIs (totales)
async function cargarKPIs(){
  const [votosRes, candsRes] = await Promise.all([
    supabase.from('votos').select('*', { count: 'exact', head: true }),
    supabase.from('candidatos').select('*', { count: 'exact', head: true })
  ])
  $('#total-votos').textContent = fmt(votosRes.count ?? 0)
  $('#total-candidatos').textContent = fmt(candsRes.count ?? 0)
  $('#total-sesiones').textContent = '1' // simple, si usás otra métrica cambiá aquí
}

// (opcional) resultados rápidos
async function cargarResultadosPreview(){
  // Podés dejarlo en blanco si todavía no mostrás resultados
}

window.addEventListener('DOMContentLoaded', async () => {
  await cargarKPIs()
  await cargarCandidatos()
})
