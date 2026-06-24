import { useState, useEffect, useRef } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts'
import * as XLSX from 'xlsx'
import logo from './assets/Ocasa.png'
import { registrarSalidaEnSheet, registrarVueltaEnSheet, obtenerRegistrosSheet, obtenerAutorizados } from './services/api'
import './App.css'

const MINUTOS_DESCANSO   = 30
const MINUTOS_TOLERANCIA = 10
const SEGS_DESCANSO      = MINUTOS_DESCANSO   * 60
const SEGS_TOLERANCIA    = MINUTOS_TOLERANCIA * 60
const SEGS_LIMITE        = SEGS_DESCANSO + SEGS_TOLERANCIA

const COLOR_PRIMARY    = '#00AEEF'
const COLOR_OK         = '#22c55e'
const COLOR_TOLERANCIA = '#f59e0b'
const COLOR_EXCEDIDO   = '#ef4444'
const COLOR_WARN       = '#f59e0b'

// ─── Parser DNI PDF417 ───────────────────────────────────────────────────────
/*function parsearDNI(raw) {
  const limpio = raw.trim()

  // ── Parser clásico con separadores (@, ", |, ;) ───────────────────────────
  const separadores = ['@', '"', '|', ';']
  let sep = '@'
  let maxCount = 0
  for (const s of separadores) {
    const count = limpio.split(s).length - 1
    if (count > maxCount) { maxCount = count; sep = s }
  }

  if (maxCount >= 4) {
    const partes = limpio.split(sep).map((p) => p.trim())
    let apellido = '', nombre = '', dni = '', cuil = ''
    if (partes.length >= 9 && /^\d{7,8}$/.test(partes[4]) && /^\d{3}$/.test(partes[8])) {
      apellido = partes[1]; nombre = partes[2]; dni = partes[4]
      const codigoCUIL = partes[8]
      cuil = `${codigoCUIL.substring(0,2)}${dni}${codigoCUIL.substring(2,3)}`
      return { apellido, nombre, dni, cuil }
    }
    const partesLimpias = partes.map((p) => p.replace(/["@|;]/g, '').trim()).filter((p) => p.length > 0)
    for (let i = 0; i < partesLimpias.length; i++) {
      const p = partesLimpias[i]
      const cuilMatch = p.match(/(?:CUIL)?(\d{2}-?\d{8}-?\d{1})$/)
      if (!cuil && cuilMatch) { cuil = cuilMatch[1].replace(/-/g, ''); continue }
      if (!dni && /^\d{7,8}$/.test(p)) { dni = p; continue }
      if (/^[A-ZÁÉÍÓÚÑÜa-záéíóúñü\s]+$/.test(p) && p.length > 1) {
        if (!apellido) apellido = p
        else if (!nombre) nombre = p
      }
    }
    return { apellido, nombre, dni, cuil }
  }

  // ── Fallback: separador es el dígito "2" ──────────────────────────────────
  // Ej: "007447354522SUAREZ2JAVIER GUSTAVO EXEQUIEL2M2364210872C209/02/1992206/01/20262207"
  // El DNI siempre está entre [MF]2 y [A-Z]2, extraerlo con regex directamente
  const dniRegex = /[MF]2(\d{7,8})[A-Z]2/
  const dniMatch = limpio.match(dniRegex)
  if (dniMatch) {
    const dni      = dniMatch[1]
    const fin3     = limpio.slice(-3)
    const prefCuil = fin3.substring(0, 2)
    const sufCuil  = fin3.substring(2, 3)
    const cuil     = `${prefCuil}${dni}${sufCuil}`

    // Apellido y nombre: están antes del [MF]2DNI, después de los dígitos iniciales
    const idxMF = limpio.search(/[MF]2\d{7,8}[A-Z]2/)
    const textoAntes = limpio.substring(0, idxMF).replace(/^\d+/, '') // sacar números del inicio
    const partsNombre = textoAntes.split('2').map(p => p.trim()).filter(p => p.length > 1 && !/^\d+$/.test(p))

    let apellido = partsNombre[0] || ''
    let nombre   = partsNombre[1] || ''

    return { apellido, nombre, dni, cuil }
  }

  return null
}*/
function parsearDNI(raw) {
  const limpio = raw.trim()
  if (!limpio) return null

  // ───────────────────────────────────────────────────────────────────────────
  // FASE 1: DETECTAR SEPARADOR Y FORMATO
  // ───────────────────────────────────────────────────────────────────────────

  // Detectar separador dominante (" - @ | ; [ ])
  const candidatosSep = ['"', '-', '@', '|', ';', '[', ']']
  let separadorDominante = null
  let maxOcurrencias = 0
  for (const sep of candidatosSep) {
    const count = limpio.split(sep).length - 1
    if (count > maxOcurrencias) {
      maxOcurrencias = count
      separadorDominante = sep
    }
  }
  const tieneSeparadorMultiple = maxOcurrencias >= 4

  // Formato MRZ con separador "2" (código empieza con 007, SIN separadores múltiples)
  const esFormatoMRZ_Con2 = !tieneSeparadorMultiple && limpio.startsWith("007") && limpio.split("2").length >= 6

  // Formato MRZ limpio sin separadores visibles (muy largo, sin separadores comunes)
  const esFormatoMRZ_Limpio = !esFormatoMRZ_Con2 && !tieneSeparadorMultiple && limpio.length > 40

  // ───────────────────────────────────────────────────────────────────────────
  // FASE 2: EXTRACCIÓN SEGÚN FORMATO
  // ───────────────────────────────────────────────────────────────────────────

  // ── CASO A: FORMATO MRZ CON SEPARADOR "2" ─────────────────────────────────
  if (esFormatoMRZ_Con2) {
    try {
      const partes = limpio.split("2").map(p => p.trim()).filter(p => p.length > 0)
      const apellido = partes[1] || 'Desconocido'
      const nombre   = partes[2] || 'Desconocido'
      const restoCadena = partes.slice(3).join("")
      const matchDni = restoCadena.match(/([MF])(\d{7,8})/i)
      const dni = matchDni ? matchDni[2] : 'Desconocido'
      return { apellido, nombre, dni, cuil: '' }
    } catch (error) {
      console.error("Error procesando formato MRZ con separador 2:", error)
      return null
    }
  }

  // ── CASO B: FORMATO CON SEPARADOR MÚLTIPLE (" - @ | ;) ───────────────────
  // DNI viejo: 994"APELLIDO"NOMBRE"M"DNI"...
  // DNI nuevo: 00744134478"APELLIDO"NOMBRE"DNI"B"03-09-99"17-12-25"JWT
  // PDF417 clásico: código@APELLIDO@NOMBRE@...@DNI@...
  if (tieneSeparadorMultiple) {
    try {
      const partes = limpio.split(separadorDominante).map(p => p.trim()).filter(p => p.length > 0)

      // DNI: único campo de exactamente 7-8 dígitos
      const dniIdx = partes.findIndex(p => /^\d{7,8}$/.test(p))
      if (dniIdx === -1) return null
      const dni = partes[dniIdx]

      // Sexo: campo de un solo carácter M o F (puede estar antes o después del DNI)
      const sexoIdx = partes.findIndex(p => /^[MF]$/i.test(p))

      // Apellido y nombre: campos de solo letras y espacios, aparecen antes del DNI
      const camposTexto = partes
        .slice(0, dniIdx)
        .filter(p => /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü\s]+$/.test(p) && p.length > 1)

      const apellido = camposTexto[0] || ''
      const nombre   = camposTexto[1] || ''

      return { apellido, nombre, dni, cuil: '' }
    } catch (error) {
      console.error(`Error procesando formato separador '${separadorDominante}':`, error)
      return null
    }
  }

  // ── CASO C: FORMATO MRZ LIMPIO (sin separadores) ──────────────────────────
  if (esFormatoMRZ_Limpio) {
    try {
      const matchSexoDni = limpio.match(/([MF])(\d{7,8})[A-Z]/i)
      if (!matchSexoDni) return null
      const dni = matchSexoDni[2]
      let bloqueTexto = limpio.substring(11)
      const indiceCorte = bloqueTexto.search(/[MF]\d{7,8}[A-Z]/i)
      if (indiceCorte !== -1) {
        bloqueTexto = bloqueTexto.substring(0, indiceCorte).trim()
      }
      let apellido = bloqueTexto
      let nombre = ''
      const palabras = bloqueTexto.split(/\s+/)
      if (palabras.length > 1) {
        apellido = palabras[0]
        nombre = palabras.slice(1).join(' ')
      }
      return { apellido: apellido || 'Desconocido', nombre: nombre || 'Desconocido', dni, cuil: '' }
    } catch (error) {
      console.error("Error procesando formato MRZ limpio:", error)
      return null
    }
  }

  // ── CASO C: FORMATOS CON SEPARADORES (", @, ,, |, ;) ──────────────────────
  // Estrategia unificada: detectar el separador más usado, splitear,
  // y extraer campos por contenido (no por posición fija)
  
  const separadores = ['"', '@', ',', '|', ';']
  let sep = '"'
  let maxCount = 0
  
  for (const s of separadores) {
    const count = limpio.split(s).length - 1
    if (count > maxCount) {
      maxCount = count
      sep = s
    }
  }

  if (maxCount >= 3) {
    try {
      const partes = limpio.split(sep)
        .map(p => p.trim().replace(/["@|;,]/g, '')) // limpiar separadores residuales
        .filter(p => p.length > 0)

      // Buscar DNI: campo de exactamente 7-8 dígitos puros
      const dniIdx = partes.findIndex(p => /^\d{7,8}$/.test(p))
      if (dniIdx === -1) return null
      const dni = partes[dniIdx]

      // Buscar CUIL: formato XX-XXXXXXXX-X o 11 dígitos seguidos
      const cuilMatch = partes.find(p => p.match(/(?:CUIL)?(\d{2}-?\d{8}-?\d{1})$/))
      const cuil = cuilMatch ? cuilMatch.replace(/[^\d]/g, '') : ''

      // Apellido y nombre: campos de solo letras, espacios y acentos
      // Típicamente aparecen antes del DNI
      const camposTexto = partes
        .slice(0, dniIdx)
        .filter(p => {
          // Debe empezar con mayúscula y tener al menos 2 caracteres
          // Acepta letras, espacios, acentos, diéresis
          return /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü\s]+$/.test(p) && p.length > 1
        })

      const apellido = camposTexto[0] || ''
      const nombre   = camposTexto[1] || ''

      // Si no encontramos nombre/apellido en los campos de texto,
      // buscar en toda la lista (fallback para formatos raros)
      if (!apellido && !nombre) {
        const textoFallback = partes.filter(p => 
          /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü\s]+$/.test(p) && 
          p.length > 1 &&
          !/^\d/.test(p) // no empieza con número
        )
        return {
          apellido: textoFallback[0] || '',
          nombre: textoFallback[1] || '',
          dni,
          cuil
        }
      }

      return { apellido, nombre, dni, cuil }
    } catch (error) {
      console.error("Error procesando formato con separadores:", error)
      return null
    }
  }

  return null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ahoraDate() { return new Date() }

function formatHora(d) {
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatFecha(d) {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function diffSegundos(inicio, fin) {
  return Math.floor((fin - inicio) / 1000)
}

function formatDuracionSegundos(segundos) {
  const s = Math.abs(segundos)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  if (h > 0) return `${h}h ${m}min ${seg}s`
  if (m > 0) return `${m}min ${seg}s`
  return `${seg}s`
}

function getNombreCorto(p) {
  return `${p.apellido} ${p.nombre.split(' ')[0]}`
}

// Agrupa historial por hora (HH:00) y cuenta ok / excedidos
function buildDatosPorHora(historial) {
  const mapa = {}
  historial.forEach((h) => {
    const hora = h.vuelta.getHours()
    const key  = `${String(hora).padStart(2, '0')}:00`
    if (!mapa[key]) mapa[key] = { hora: key, correctos: 0, excedidos: 0, tolerancia: 0 }
    if (h.excedido)        mapa[key].excedidos++
    else if (h.enTolerancia) mapa[key].tolerancia++
    else                   mapa[key].correctos++
  })
  return Object.values(mapa).sort((a, b) => a.hora.localeCompare(b.hora))
}

// ─── Exportar a Excel ─────────────────────────────────────────────────────────
function exportarExcel(excedidos) {
  const filas = excedidos.map((h) => ({
    Fecha:             formatFecha(h.vuelta),
    'Apellido':        h.apellido,
    'Nombre':          h.nombre,
    'DNI':             h.dni,
    'CUIL':            h.cuil || '',
    'Hora de salida':  formatHora(h.salida),
    'Hora de vuelta':  formatHora(h.vuelta),
    'Duración total':  formatDuracionSegundos(h.segundosTomados),
    'Excedido en':     h.excedido
      ? formatDuracionSegundos(h.segundosTomados - SEGS_LIMITE)
      : formatDuracionSegundos(h.segundosTomados - SEGS_DESCANSO),
    'Estado':          h.excedido ? 'Excedido' : 'Tolerancia',
  }))
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Excedidos')
  const fecha = new Date().toLocaleDateString('es-AR').replace(/\//g, '-')
  XLSX.writeFile(wb, `excedidos_${fecha}.xlsx`)
}

// ─── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className="kpi-body">
        <div className="kpi-value" style={{ color }}>{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Tarjeta activo en tiempo real ────────────────────────────────────────────
function TarjetaActivo({ persona }) {
  const [segundos, setSegundos] = useState(diffSegundos(persona.salida, new Date()))
  useEffect(() => {
    const id = setInterval(() => setSegundos(diffSegundos(persona.salida, new Date())), 1000)
    return () => clearInterval(id)
  }, [persona.salida])

  const excedido     = segundos > SEGS_LIMITE
  const enTolerancia = segundos > SEGS_DESCANSO && !excedido
  const pct   = Math.min((segundos / SEGS_LIMITE) * 100, 100)
  const color = excedido ? COLOR_EXCEDIDO : enTolerancia ? COLOR_TOLERANCIA : COLOR_PRIMARY
  const bgAvatar = excedido ? '#fee2e2' : enTolerancia ? '#fef9c3' : '#e0f7ff'

  let timerLabel, timerValue
  if (excedido) {
    timerLabel = 'Excedido'
    timerValue = `+${formatDuracionSegundos(segundos - SEGS_LIMITE)}`
  } else if (enTolerancia) {
    timerLabel = 'Tolerancia'
    timerValue = `${formatDuracionSegundos(SEGS_LIMITE - segundos)} restantes`
  } else {
    timerLabel = 'Restante'
    timerValue = formatDuracionSegundos(SEGS_DESCANSO - segundos)
  }

  return (
    <div className={`activo-card ${excedido ? 'activo-excedido' : enTolerancia ? 'activo-tolerancia' : 'activo-normal'}`}>
      <div className="activo-avatar" style={{ background: bgAvatar, color }}>
        {persona.apellido[0]}{persona.nombre[0]}
      </div>
      <div className="activo-info">
        <div className="activo-nombre">{persona.apellido} {persona.nombre}</div>
        <div className="activo-dni">DNI {persona.dni}</div>
        <div className="activo-salida-hora">Salió a las {formatHora(persona.salida)}</div>
        <div className="activo-progress-bar">
          <div className="activo-progress-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      <div className="activo-timer" style={{ color }}>
        <span className="timer-label">{timerLabel}</span>
        <span className="timer-value">{timerValue}</span>
      </div>
    </div>
  )
}

// ─── Tooltip genérico ─────────────────────────────────────────────────────────
function CustomBarTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-title">{label}</div>
        {payload.map((p, i) => (
          <div key={i} className="chart-tooltip-row">
            <span style={{ color: p.color }}>●</span> {p.name}: <strong>{p.value}</strong>
          </div>
        ))}
      </div>
    )
  }
  return null
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function App({ onCambiarRol }) {
  const [bufferRef] = [useRef('')]
  const timerRef = useRef(null)
  const [buffer, setBuffer] = useState('')
  const [esperando, setEsperando] = useState(true)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(null)
  const [descansos, setDescansos] = useState({})
  const [historial, setHistorial] = useState([])
  const [tab, setTab] = useState('dashboard') // 'dashboard' | 'historial' | 'excedidos'
  const [busquedaActivos, setBusquedaActivos] = useState('')
  const [busquedaHistorial, setBusquedaHistorial] = useState('')
  const [busquedaExcedidos, setBusquedaExcedidos] = useState('')
  const [syncStatus, setSyncStatus] = useState(null) // null | 'syncing' | 'ok' | 'error'
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [formData, setFormData] = useState({ nombre: '', apellido: '', dni: '', cuil: '' })
  // autorizados: null = cargando | array de strings de DNI del día
  const [autorizados, setAutorizados] = useState(null)

  // ─── Rehidratar estado desde Google Sheets al montar ──────────────────────
  useEffect(() => {
    // Convierte cualquier formato de fecha a "D/M/YYYY" normalizado
    const normFecha = (val) => {
      if (!val && val !== 0) return ''
      // Número serial de Excel/Sheets (ej: 46000)
      if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000))
        return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`
      }
      const str = String(val).trim()
      // Formato ISO "2025-06-24"
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const d = new Date(str)
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
      }
      // Formato "24/6/2025" o "24/06/2025" → normalizar quitando ceros
      return str.split('/').map((p) => String(Number(p))).join('/')
    }

    const parsearHora = (horaStr) => {
      if (!horaStr) return null
      const str = String(horaStr).trim()
      if (!str) return null
      let hh, mm, ss
      if (str.includes('T')) {
        const d = new Date(str)
        hh = d.getHours(); mm = d.getMinutes(); ss = d.getSeconds()
      } else {
        ;[hh, mm, ss] = str.split(':').map(Number)
      }
      if (isNaN(hh) || isNaN(mm)) return null
      const d = new Date()
      d.setHours(hh, mm, ss || 0, 0)
      return d
    }

    Promise.all([obtenerAutorizados(), obtenerRegistrosSheet()])
      .then(([autorizadosData, registros]) => {
        const ahora = new Date()
        const hoy = `${ahora.getDate()}/${ahora.getMonth() + 1}/${ahora.getFullYear()}`

        // Autorizados: lista de DNI strings
        const listaAutorizados = Array.isArray(autorizadosData) ? autorizadosData : []
        const dnisAutorizadosHoy = listaAutorizados.map((a) => String(a.dni).trim())
        setAutorizados(dnisAutorizadosHoy)

        if (!Array.isArray(registros)) return

        // Debug: ver qué fechas llegan desde Sheets
        if (registros.length > 0) {
          console.log('[Sheets] Primera fecha recibida:', registros[0].fecha, '| tipo:', typeof registros[0].fecha)
          console.log('[Sheets] Fecha normalizada:', normFecha(registros[0].fecha), '| Hoy:', hoy)
        }

        const deHoy = registros.filter((r) => normFecha(r.fecha) === hoy)
        console.log(`[Sheets] Total registros: ${registros.length} | Del día: ${deHoy.length}`)

        const nuevoHistorial = []
        const nuevosDescansos = {}

        deHoy.forEach((r) => {
          const salida = parsearHora(r.ida_al_descanso)
          if (!salida) return

          const vuelta = parsearHora(r.vuelta_al_descanso)
          if (vuelta) {
            const segundosTomados = diffSegundos(salida, vuelta)
            const enTolerancia = segundosTomados > SEGS_DESCANSO && segundosTomados <= SEGS_LIMITE
            const excedido = segundosTomados > SEGS_LIMITE
            nuevoHistorial.push({
              nombre: r.nombre || '',
              apellido: r.apellido || '',
              dni: r.dni || '',
              cuil: r.cuil || '',
              salida, vuelta, segundosTomados, enTolerancia, excedido,
            })
          } else {
            // Rehidratar descanso activo (no requiere autorización para mostrarlo)
            nuevosDescansos[r.dni] = {
              nombre: r.nombre || '',
              apellido: r.apellido || '',
              dni: r.dni || '',
              cuil: r.cuil || '',
              salida,
            }
          }
        })

        nuevoHistorial.sort((a, b) => b.vuelta - a.vuelta)
        setHistorial(nuevoHistorial)
        setDescansos(nuevosDescansos)
      })
      .catch((err) => console.error('Error al cargar datos iniciales:', err))
      .finally(() => setCargando(false))

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault() // evita que el browser haga scroll o active botones enfocados
        const datos = bufferRef.current
        bufferRef.current = ''
        setBuffer('')
        clearTimeout(timerRef.current)
        if (datos.length > 10) procesarScan(datos)
        return
      }
      if (e.key.length > 1) return
      bufferRef.current += e.key
      setBuffer(bufferRef.current)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => { bufferRef.current = ''; setBuffer('') }, 100)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [descansos, historial])

  const procesarScan = (raw) => {
    setError('')
    console.log('RAW DNI:', JSON.stringify(raw))
    const datos = parsearDNI(raw)
    console.log('PARSED:', datos)
    if (!datos || !datos.dni) {
      setError('No se reconoció el documento. Escanear el dorso del DNI.')
      setEsperando(true)
      return
    }
    const ahora = ahoraDate()

    // ── Bloqueo 12h: verificar si ya tomó descanso en las últimas 12 horas ──
    const SEGS_12H = 12 * 60 * 60
    const descansoPrevio = historial.find(
      (h) => String(h.dni) === String(datos.dni) &&
             diffSegundos(h.vuelta, ahora) < SEGS_12H
    )
    if (descansoPrevio) {
      const segsRestantes = SEGS_12H - diffSegundos(descansoPrevio.vuelta, ahora)
      const h = Math.floor(segsRestantes / 3600)
      const m = Math.floor((segsRestantes % 3600) / 60)
      setError(
        `${datos.apellido} ${datos.nombre} ya tomó descanso hoy. ` +
        `Puede volver a fichar en ${h}h ${m}min.`
      )
      setEsperando(true)
      return
    }

    // ── Bloqueo de autorización: solo pueden salir los autorizados por el supervisor ──
    const estaActivo = descansos[datos.dni] // si ya está en descanso, lo dejamos volver sin check
    if (!estaActivo && autorizados !== null && !autorizados.includes(String(datos.dni).trim())) {
      setError(
        `${datos.apellido} ${datos.nombre} no está autorizado para salir al descanso. ` +
        `Un supervisor debe autorizarlo primero.`
      )
      setEsperando(true)
      return
    }

    // ── Leer el estado actual ANTES de mutar para decidir la acción ─────────
    const existente = descansos[datos.dni]
    if (!existente) {
      // ── SALIDA ────────────────────────────────────────────────────────────
      const nuevo = { ...datos, salida: ahora }
      setDescansos((prev) => ({ ...prev, [datos.dni]: nuevo }))
      setFlash({ tipo: 'salida', datos: nuevo })
      setEsperando(false)

      setSyncStatus('syncing')
      registrarSalidaEnSheet(nuevo)
        .then((res) => {
          if (res?.estatus === 'ERROR' || res?.error) {
            console.error('Sheets: error al registrar salida', res)
            setSyncStatus('error')
          } else {
            setSyncStatus('ok')
          }
        })
        .catch((err) => {
          console.error('Sheets: fallo de red en salida', err)
          setSyncStatus('error')
        })
    } else {
      // ── VUELTA ──────────────────────────────────────────────────────────
      const segundosTomados = diffSegundos(existente.salida, ahora)
      const enTolerancia = segundosTomados > SEGS_DESCANSO && segundosTomados <= SEGS_LIMITE
      const excedido = segundosTomados > SEGS_LIMITE
      const registro = { ...existente, vuelta: ahora, segundosTomados, enTolerancia, excedido }

      setDescansos((prev) => {
        const siguiente = { ...prev }
        delete siguiente[datos.dni]
        return siguiente
      })
      setFlash({ tipo: 'vuelta', datos: registro })
      setHistorial((h) => [registro, ...h])
      setEsperando(false)

      // Llamada a Sheets fuera del setter: se ejecuta exactamente una vez
      const textoExcedido = excedido
        ? `Excedido +${formatDuracionSegundos(segundosTomados - SEGS_LIMITE)}`
        : enTolerancia
          ? `Tolerancia +${formatDuracionSegundos(segundosTomados - SEGS_DESCANSO)}`
          : 'A tiempo'
      setSyncStatus('syncing')
      registrarVueltaEnSheet(datos.dni, textoExcedido)
        .then((res) => {
          if (res?.estatus === 'ERROR' || res?.error) {
            console.error('Sheets: error al registrar vuelta', res)
            setSyncStatus('error')
          } else {
            setSyncStatus('ok')
          }
        })
        .catch((err) => {
          console.error('Sheets: fallo de red en vuelta', err)
          setSyncStatus('error')
        })
    }
  }

  const cerrarFlash = () => { setFlash(null); setEsperando(true) }

  const handleSubmitManual = (e) => {
    e.preventDefault()
    if (!formData.nombre.trim() || !formData.apellido.trim() || !formData.dni.trim()) {
      setError('Nombre, apellido y DNI son obligatorios')
      return
    }
    if (!/^\d{7,8}$/.test(formData.dni)) {
      setError('El DNI debe tener 7 u 8 dígitos')
      return
    }

    const datosSimulados = {
      nombre: formData.nombre.trim().toUpperCase(),
      apellido: formData.apellido.trim().toUpperCase(),
      dni: formData.dni.trim(),
      cuil: formData.cuil.trim()
    }

    const ahora = ahoraDate()

    // Bloqueo 12h
    const SEGS_12H = 12 * 60 * 60
    const descansoPrevio = historial.find(
      (h) => String(h.dni) === String(datosSimulados.dni) &&
             diffSegundos(h.vuelta, ahora) < SEGS_12H
    )
    if (descansoPrevio) {
      const segsRestantes = SEGS_12H - diffSegundos(descansoPrevio.vuelta, ahora)
      const h = Math.floor(segsRestantes / 3600)
      const m = Math.floor((segsRestantes % 3600) / 60)
      setError(
        `${datosSimulados.apellido} ${datosSimulados.nombre} ya tomó descanso hoy. ` +
        `Puede volver a fichar en ${h}h ${m}min.`
      )
      return
    }

    const existente = descansos[datosSimulados.dni]

    // Bloqueo de autorización: solo aplica para salidas nuevas (no para vueltas)
    if (!existente && autorizados !== null && !autorizados.includes(String(datosSimulados.dni).trim())) {
      setError(
        `${datosSimulados.apellido} ${datosSimulados.nombre} no está autorizado para salir al descanso. ` +
        `Un supervisor debe autorizarlo primero.`
      )
      return
    }

    // Validaciones OK — recién ahora cerramos el modal
    setFormData({ nombre: '', apellido: '', dni: '', cuil: '' })
    setModalAbierto(false)

    if (!existente) {
      // SALIDA
      const nuevo = { ...datosSimulados, salida: ahora }
      setDescansos((prev) => ({ ...prev, [datosSimulados.dni]: nuevo }))
      setFlash({ tipo: 'salida', datos: nuevo })
      setEsperando(false)

      setSyncStatus('syncing')
      registrarSalidaEnSheet(nuevo)
        .then((res) => {
          if (res?.estatus === 'ERROR' || res?.error) {
            console.error('Sheets: error al registrar salida', res)
            setSyncStatus('error')
          } else {
            setSyncStatus('ok')
          }
        })
        .catch((err) => {
          console.error('Sheets: fallo de red en salida', err)
          setSyncStatus('error')
        })
    } else {
      // VUELTA
      const segundosTomados = diffSegundos(existente.salida, ahora)
      const enTolerancia = segundosTomados > SEGS_DESCANSO && segundosTomados <= SEGS_LIMITE
      const excedido = segundosTomados > SEGS_LIMITE
      const registro = { ...existente, vuelta: ahora, segundosTomados, enTolerancia, excedido }

      setDescansos((prev) => {
        const siguiente = { ...prev }
        delete siguiente[datosSimulados.dni]
        return siguiente
      })
      setFlash({ tipo: 'vuelta', datos: registro })
      setHistorial((h) => [registro, ...h])
      setEsperando(false)

      const textoExcedido = excedido
        ? `Excedido +${formatDuracionSegundos(segundosTomados - SEGS_LIMITE)}`
        : enTolerancia
          ? `Tolerancia +${formatDuracionSegundos(segundosTomados - SEGS_DESCANSO)}`
          : 'A tiempo'
      setSyncStatus('syncing')
      registrarVueltaEnSheet(datosSimulados.dni, textoExcedido)
        .then((res) => {
          if (res?.estatus === 'ERROR' || res?.error) {
            console.error('Sheets: error al registrar vuelta', res)
            setSyncStatus('error')
          } else {
            setSyncStatus('ok')
          }
        })
        .catch((err) => {
          console.error('Sheets: fallo de red en vuelta', err)
          setSyncStatus('error')
        })
    }
  }

  const activosArray = Object.values(descansos)

  // ─── Métricas ───────────────────────────────────────────────────────────────
  const totalDescansos   = historial.length
  const excedidosCount   = historial.filter((h) => h.excedido).length
  const toleranciaCount  = historial.filter((h) => h.enTolerancia).length
  const okCount          = totalDescansos - excedidosCount - toleranciaCount
  const tiempoPromedioSegs = totalDescansos > 0
    ? Math.round(historial.reduce((a, h) => a + h.segundosTomados, 0) / totalDescansos)
    : 0

  // Pie
  const pieData = [
    { name: 'A tiempo',   value: okCount },
    { name: 'Tolerancia', value: toleranciaCount },
    { name: 'Excedido',   value: excedidosCount },
  ]

  // Bar — últimos 8 (en minutos para mejor legibilidad)
  const barData = [...historial].reverse().slice(-8).map((h) => ({
    nombre:       getNombreCorto(h),
    'Duración':   +(h.segundosTomados / 60).toFixed(1),
    'Límite':     MINUTOS_DESCANSO,
    'Tolerancia': MINUTOS_TOLERANCIA,
  }))

  // Line — correctos y excedidos por hora
  const datosPorHora = buildDatosPorHora(historial)

  // Lista excedidos para tab
  const listaExcedidos = historial.filter((h) => h.excedido || h.enTolerancia)
    .sort((a, b) => b.segundosTomados - a.segundosTomados)

  // Top 5 para dashboard
  const topExcedidos = listaExcedidos.slice(0, 5)

  // ─── Filtros de búsqueda ────────────────────────────────────────────────────
  const filtrar = (lista, q) => {
    if (!q.trim()) return lista
    const t = q.toLowerCase().trim()
    return lista.filter((h) =>
      (h.apellido || '').toLowerCase().includes(t) ||
      (h.nombre   || '').toLowerCase().includes(t) ||
      String(h.dni).includes(t)
    )
  }
  const activosFiltrados   = filtrar(activosArray, busquedaActivos)
  const historialFiltrado  = filtrar(historial, busquedaHistorial)
  const excedidosFiltrados = filtrar(listaExcedidos, busquedaExcedidos)

  return (
    <div className="dashboard">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="Logo" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${tab === 'dashboard' ? 'nav-active' : ''}`} onClick={() => setTab('dashboard')}>
            <span className="nav-icon">📊</span><span>Dashboard</span>
          </button>
          <button className={`nav-item ${tab === 'historial' ? 'nav-active' : ''}`} onClick={() => setTab('historial')}>
            <span className="nav-icon">📋</span><span>Historial</span>
          </button>
          <button className={`nav-item ${tab === 'excedidos' ? 'nav-active' : ''}`} onClick={() => setTab('excedidos')}>
            <span className="nav-icon">⚠️</span><span>Excedidos</span>
            {listaExcedidos.length > 0 && (
              <span className="nav-badge">{listaExcedidos.length}</span>
            )}
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="scanner-badge">
            <span className={`scanner-dot ${esperando ? 'dot-waiting' : 'dot-ok'}`} />
            <span>{esperando ? 'Esperando DNI...' : 'DNI leído ✓'}</span>
          </div>
          {buffer.length > 0 && <div className="reading-bar">Leyendo...</div>}
          {syncStatus === 'syncing' && (
            <div className="sync-badge sync-syncing">⏳ Guardando en Sheets...</div>
          )}
          {syncStatus === 'ok' && (
            <div className="sync-badge sync-ok">✅ Guardado en Sheets</div>
          )}
          {syncStatus === 'error' && (
            <div className="sync-badge sync-error">⚠️ Error al guardar en Sheets</div>
          )}
          <button className="nav-item" style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem' }} onClick={onCambiarRol}>
            ← Cambiar rol
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        <header className="main-header">
          <div>
            <h1 className="header-title">Sistema de Descansos</h1>
            <p className="header-sub">
              Descanso: <strong>{MINUTOS_DESCANSO} min</strong>
              &nbsp;·&nbsp;Tolerancia: <strong>{MINUTOS_TOLERANCIA} min</strong>
              &nbsp;·&nbsp;
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="header-scanner-status">
            <span className={`pulso-dot ${esperando ? '' : 'pulso-green'}`} />
            {esperando ? 'Listo para escanear' : 'Documento leído'}
          </div>
        </header>

        {cargando && (
          <div className="alert-info">
            ⏳ Cargando registros del día desde Google Sheets...
          </div>
        )}

        {error && (
          <div className="alert-error">
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')} className="alert-close">✕</button>
          </div>
        )}

        {flash && (
          <div className={`flash-notification flash-${
            flash.tipo === 'vuelta'
              ? flash.datos.excedido ? 'excedido' : flash.datos.enTolerancia ? 'tolerancia' : 'vuelta'
              : flash.tipo
          }`}>
            <div className="flash-icon">
              {flash.tipo === 'salida' ? '🚶' : flash.datos.excedido ? '⚠️' : flash.datos.enTolerancia ? '🟡' : '✅'}
            </div>
            <div className="flash-content">
              <div className="flash-title">
                {flash.tipo === 'salida' ? 'Salida registrada'
                  : flash.datos.excedido ? 'Descanso excedido'
                  : flash.datos.enTolerancia ? 'Regresó en tolerancia'
                  : 'Vuelta a tiempo'}
              </div>
              <div className="flash-person">
                {flash.datos.apellido} {flash.datos.nombre}
                <span className="flash-dni">DNI {flash.datos.dni}</span>
              </div>
              {flash.tipo === 'vuelta' && (
                <div className="flash-times">
                  <span>Salida: <strong>{formatHora(flash.datos.salida)}</strong></span>
                  <span>Vuelta: <strong>{formatHora(flash.datos.vuelta)}</strong></span>
                  <span className={flash.datos.excedido ? 'text-red' : flash.datos.enTolerancia ? 'text-warn' : 'text-green'}>
                    Duración: <strong>{formatDuracionSegundos(flash.datos.segundosTomados)}</strong>
                    {flash.datos.excedido && ` (+${formatDuracionSegundos(flash.datos.segundosTomados - SEGS_LIMITE)} sobre límite)`}
                    {flash.datos.enTolerancia && ` (+${formatDuracionSegundos(flash.datos.segundosTomados - SEGS_DESCANSO)} en tolerancia)`}
                  </span>
                </div>
              )}
            </div>
            <button className="flash-close" onClick={cerrarFlash}>✕</button>
          </div>
        )}

        {/* ══════════════ DASHBOARD ══════════════ */}
        {tab === 'dashboard' && (
          <>
            <div className="kpi-grid">
              <KpiCard icon="☕" label="Total descansos"   value={totalDescansos}  sub="en el día"                              color={COLOR_PRIMARY} />
              <KpiCard icon="✅" label="A tiempo"          value={okCount}         sub={`hasta ${MINUTOS_DESCANSO} min`}        color={COLOR_OK} />
              <KpiCard icon="🟡" label="En tolerancia"     value={toleranciaCount} sub={`hasta ${MINUTOS_DESCANSO + MINUTOS_TOLERANCIA} min`} color={COLOR_TOLERANCIA} />
              <KpiCard icon="⚠️" label="Excedidos"         value={excedidosCount}  sub={`más de ${MINUTOS_DESCANSO + MINUTOS_TOLERANCIA} min`} color={COLOR_EXCEDIDO} />
              <KpiCard icon="⏱"  label="Tiempo promedio"   value={formatDuracionSegundos(tiempoPromedioSegs)} sub="por descanso" color={COLOR_WARN} />
              <KpiCard icon="🧑" label="En descanso ahora" value={activosArray.length} sub="personas activas"                  color={COLOR_PRIMARY} />
            </div>

            {activosArray.length > 0 && (
              <section className="section-card">
                <div className="section-header">
                  <h2 className="section-title">
                    <span className="section-dot" style={{ background: COLOR_WARN }} />En descanso ahora
                  </h2>
                  <span className="section-badge" style={{ background: `${COLOR_WARN}22`, color: COLOR_WARN }}>
                    {activosArray.length} persona{activosArray.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <input
                  className="search-input"
                  type="search"
                  placeholder="Buscar por nombre, apellido o DNI..."
                  value={busquedaActivos}
                  onChange={(e) => setBusquedaActivos(e.target.value)}
                />
                <div className="activos-grid">
                  {activosFiltrados.length === 0
                    ? <div className="search-empty">Sin resultados para "{busquedaActivos}"</div>
                    : activosFiltrados.map((p) => <TarjetaActivo key={p.dni} persona={p} />)
                  }
                </div>
              </section>
            )}

            {totalDescansos > 0 && (
              <>
                {/* Pie + Bar */}
                <div className="charts-grid">
                  <div className="section-card">
                    <div className="section-header">
                      <h2 className="section-title">
                        <span className="section-dot" style={{ background: COLOR_PRIMARY }} />Distribución del día
                      </h2>
                    </div>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                            paddingAngle={4} dataKey="value"
                            label={({ name, percent }) => percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                            labelLine={false}>
                            <Cell key="ok"  fill={COLOR_OK} />
                            <Cell key="tol" fill={COLOR_TOLERANCIA} />
                            <Cell key="exc" fill={COLOR_EXCEDIDO} />
                          </Pie>
                          <Tooltip formatter={(v) => [v, 'cantidad']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pie-legend">
                        <div className="pie-legend-item"><span style={{ background: COLOR_OK }} />A tiempo: <strong>{okCount}</strong></div>
                        <div className="pie-legend-item"><span style={{ background: COLOR_TOLERANCIA }} />Tolerancia: <strong>{toleranciaCount}</strong></div>
                        <div className="pie-legend-item"><span style={{ background: COLOR_EXCEDIDO }} />Excedidos: <strong>{excedidosCount}</strong></div>
                      </div>
                    </div>
                  </div>

                  <div className="section-card">
                    <div className="section-header">
                      <h2 className="section-title">
                        <span className="section-dot" style={{ background: COLOR_PRIMARY }} />Últimos descansos (minutos)
                      </h2>
                    </div>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={barData} margin={{ top: 8, right: 16, left: -10, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#6b7280' }} angle={-35} textAnchor="end" interval={0} />
                          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} unit=" min" />
                          <Tooltip content={<CustomBarTooltip />} formatter={(v) => [`${v} min`]} />
                          <Legend verticalAlign="top" height={28} iconSize={10} />
                          <Bar dataKey="Duración"   fill={COLOR_PRIMARY}    radius={[4,4,0,0]} />
                          <Bar dataKey="Límite"     fill={COLOR_OK}         radius={[4,4,0,0]} opacity={0.45} />
                          <Bar dataKey="Tolerancia" fill={COLOR_TOLERANCIA} radius={[4,4,0,0]} opacity={0.45} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Line chart por hora */}
                <div className="section-card">
                  <div className="section-header">
                    <h2 className="section-title">
                      <span className="section-dot" style={{ background: COLOR_PRIMARY }} />Descansos por hora
                    </h2>
                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={datosPorHora} margin={{ top: 8, right: 24, left: -10, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="hora" tick={{ fontSize: 11, fill: '#6b7280' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Legend verticalAlign="top" height={28} iconSize={10} />
                        <Line type="monotone" dataKey="correctos"  name="A tiempo"   stroke={COLOR_OK}         strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="tolerancia" name="Tolerancia" stroke={COLOR_TOLERANCIA} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} strokeDasharray="5 3" />
                        <Line type="monotone" dataKey="excedidos"  name="Excedidos"  stroke={COLOR_EXCEDIDO}   strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}

            {topExcedidos.length > 0 && (
              <section className="section-card">
                <div className="section-header">
                  <h2 className="section-title">
                    <span className="section-dot" style={{ background: COLOR_EXCEDIDO }} />Mayores excedidos del día
                  </h2>
                </div>
                <div className="rank-list">
                  {topExcedidos.map((h, i) => (
                    <div key={i} className="rank-item">
                      <div className="rank-pos" style={{
                        background: i === 0 ? (h.excedido ? COLOR_EXCEDIDO : COLOR_TOLERANCIA) : (h.excedido ? '#fee2e2' : '#fef9c3'),
                        color: i === 0 ? '#fff' : (h.excedido ? COLOR_EXCEDIDO : COLOR_TOLERANCIA)
                      }}>{i + 1}</div>
                      <div className="rank-info">
                        <div className="rank-nombre">{h.apellido} {h.nombre}</div>
                        <div className="rank-dni">DNI {h.dni}</div>
                      </div>
                      <div className="rank-tiempo">
                        <div className={`rank-duracion ${h.excedido ? 'text-red' : 'text-warn'}`}>{formatDuracionSegundos(h.segundosTomados)}</div>
                        <div className="rank-extra">
                          {h.excedido
                            ? `+${formatDuracionSegundos(h.segundosTomados - SEGS_LIMITE)} sobre límite`
                            : `+${formatDuracionSegundos(h.segundosTomados - SEGS_DESCANSO)} en tolerancia`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {totalDescansos === 0 && activosArray.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">☕</div>
                <div className="empty-title">Sin registros aún</div>
                <div className="empty-sub">Escaneá el DNI de un empleado para comenzar</div>
              </div>
            )}
          </>
        )}

        {/* ══════════════ HISTORIAL ══════════════ */}
        {tab === 'historial' && (
          <section className="section-card">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-dot" style={{ background: COLOR_PRIMARY }} />Historial del día
              </h2>
              <span className="section-badge" style={{ background: `${COLOR_PRIMARY}22`, color: COLOR_PRIMARY }}>
                {historialFiltrado.length}{busquedaHistorial ? ` de ${historial.length}` : ''} registro{historial.length !== 1 ? 's' : ''}
              </span>
            </div>
            <input
              className="search-input"
              type="search"
              placeholder="Buscar por nombre, apellido o DNI..."
              value={busquedaHistorial}
              onChange={(e) => setBusquedaHistorial(e.target.value)}
            />
            {historial.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <div className="empty-title">Sin registros aún</div>
                <div className="empty-sub">Los descansos completados aparecerán aquí</div>
              </div>
            ) : historialFiltrado.length === 0 ? (
              <div className="search-empty">Sin resultados para "{busquedaHistorial}"</div>
            ) : (
              <div className="table-wrap">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>#</th><th>Persona</th><th>DNI</th><th>Salida</th><th>Vuelta</th><th>Duración</th><th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialFiltrado.map((h, i) => (
                      <tr key={i} className={h.excedido ? 'tr-excedido' : h.enTolerancia ? 'tr-tolerancia' : ''}>
                        <td className="td-num">{historialFiltrado.length - i}</td>
                        <td className="td-persona">
                          <div className="tabla-avatar" style={{
                            background: h.excedido ? '#fee2e2' : h.enTolerancia ? '#fef9c3' : '#e0f7ff',
                            color: h.excedido ? COLOR_EXCEDIDO : h.enTolerancia ? COLOR_TOLERANCIA : COLOR_PRIMARY
                          }}>{h.apellido[0]}{h.nombre[0]}</div>
                          <span>{h.apellido} {h.nombre}</span>
                        </td>
                        <td>{h.dni}</td>
                        <td>{formatHora(h.salida)}</td>
                        <td>{formatHora(h.vuelta)}</td>
                        <td className={h.excedido ? 'text-red fw600' : h.enTolerancia ? 'text-warn fw600' : 'text-green fw600'}>
                          {formatDuracionSegundos(h.segundosTomados)}
                        </td>
                        <td>
                          {h.excedido
                            ? <span className="badge badge-exc">⚠️ Excedido</span>
                            : h.enTolerancia
                              ? <span className="badge badge-tol">🟡 Tolerancia</span>
                              : <span className="badge badge-ok">✅ OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ══════════════ EXCEDIDOS ══════════════ */}
        {tab === 'excedidos' && (
          <section className="section-card">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-dot" style={{ background: COLOR_EXCEDIDO }} />Registro de excedidos y tolerancia
              </h2>
              <button
                className="btn-export"
                onClick={() => exportarExcel(listaExcedidos)}
                disabled={listaExcedidos.length === 0}
              >
                📥 Exportar Excel
              </button>
            </div>
            <input
              className="search-input"
              type="search"
              placeholder="Buscar por nombre, apellido o DNI..."
              value={busquedaExcedidos}
              onChange={(e) => setBusquedaExcedidos(e.target.value)}
            />
            {listaExcedidos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <div className="empty-title">Sin excedidos aún</div>
                <div className="empty-sub">Todos los descansos están dentro del tiempo permitido</div>
              </div>
            ) : excedidosFiltrados.length === 0 ? (
              <div className="search-empty">Sin resultados para "{busquedaExcedidos}"</div>
            ) : (
              <div className="table-wrap">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Fecha</th>
                      <th>Apellido</th>
                      <th>Nombre</th>
                      <th>DNI</th>
                      <th>CUIL</th>
                      <th>H. Salida</th>
                      <th>H. Vuelta</th>
                      <th>Duración</th>
                      <th>Se pasó</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excedidosFiltrados.map((h, i) => (
                      <tr key={i} className={h.excedido ? 'tr-excedido' : 'tr-tolerancia'}>
                        <td className="td-num">{i + 1}</td>
                        <td>{formatFecha(h.vuelta)}</td>
                        <td className="fw600">{h.apellido}</td>
                        <td>{h.nombre}</td>
                        <td>{h.dni}</td>
                        <td>{h.cuil || '—'}</td>
                        <td>{formatHora(h.salida)}</td>
                        <td>{formatHora(h.vuelta)}</td>
                        <td className={h.excedido ? 'text-red fw600' : 'text-warn fw600'}>
                          {formatDuracionSegundos(h.segundosTomados)}
                        </td>
                        <td className={h.excedido ? 'text-red fw600' : 'text-warn fw600'}>
                          +{h.excedido
                            ? formatDuracionSegundos(h.segundosTomados - SEGS_LIMITE)
                            : formatDuracionSegundos(h.segundosTomados - SEGS_DESCANSO)}
                        </td>
                        <td>
                          {h.excedido
                            ? <span className="badge badge-exc">⚠️ Excedido</span>
                            : <span className="badge badge-tol">🟡 Tolerancia</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── Bottom nav mobile ── */}
      <nav className="mobile-nav">
        <button className={`mobile-nav-item ${tab === 'dashboard' ? 'nav-active' : ''}`} onClick={() => setTab('dashboard')}>
          <span className="nav-icon">📊</span>
          <span>Inicio</span>
        </button>
        <button className={`mobile-nav-item ${tab === 'historial' ? 'nav-active' : ''}`} onClick={() => setTab('historial')}>
          <span className="nav-icon">📋</span>
          <span>Historial</span>
        </button>
        <button className={`mobile-nav-item ${tab === 'excedidos' ? 'nav-active' : ''}`} onClick={() => setTab('excedidos')}>
          <span className="nav-icon">⚠️</span>
          <span>Excedidos</span>
          {listaExcedidos.length > 0 && (
            <span className="mobile-nav-badge">{listaExcedidos.length}</span>
          )}
        </button>
      </nav>

      {/* ── Botón flotante para carga manual ── */}
      <button 
        className="btn-flotante" 
        onClick={() => setModalAbierto(true)}
        title="Registrar sin DNI"
      >
        ➕
      </button>

      {/* ── Modal de carga manual ── */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={() => setModalAbierto(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar manualmente</h3>
              <button className="modal-close" onClick={() => setModalAbierto(false)}>✕</button>
            </div>
            <form className="modal-form" onSubmit={handleSubmitManual}>
              <div className="form-group">
                <label>Apellido *</label>
                <input
                  type="text"
                  value={formData.apellido}
                  onChange={(e) => setFormData({...formData, apellido: e.target.value})}
                  placeholder="PÉREZ"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  placeholder="JUAN CARLOS"
                  required
                />
              </div>
              <div className="form-group">
                <label>DNI *</label>
                <input
                  type="text"
                  value={formData.dni}
                  onChange={(e) => setFormData({...formData, dni: e.target.value.replace(/\D/g, '')})}
                  placeholder="12345678"
                  required
                  maxLength={8}
                />
              </div>
              <div className="form-group">
                <label>CUIL (opcional)</label>
                <input
                  type="text"
                  value={formData.cuil}
                  onChange={(e) => setFormData({...formData, cuil: e.target.value.replace(/\D/g, '')})}
                  placeholder="20123456789"
                  maxLength={11}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
