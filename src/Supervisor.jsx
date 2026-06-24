import { useState, useEffect, useRef } from 'react'
import logo from './assets/Ocasa.png'
import { registrarAutorizado, obtenerAutorizados } from './services/api'
import './Supervisor.css'

// ─── Reutiliza el mismo parser de DNI ────────────────────────────────────────
function parsearDNI(raw) {
  const limpio = raw.trim()
  if (!limpio) return null

  const candidatosSep = ['"', '-', '@', '|', ';', '[', ']']
  let separadorDominante = null
  let maxOcurrencias = 0
  for (const sep of candidatosSep) {
    const count = limpio.split(sep).length - 1
    if (count > maxOcurrencias) { maxOcurrencias = count; separadorDominante = sep }
  }
  const tieneSeparadorMultiple = maxOcurrencias >= 4
  const esFormatoMRZ_Con2 = !tieneSeparadorMultiple && limpio.startsWith("007") && limpio.split("2").length >= 6
  const esFormatoMRZ_Limpio = !esFormatoMRZ_Con2 && !tieneSeparadorMultiple && limpio.length > 40

  if (esFormatoMRZ_Con2) {
    const partes = limpio.split("2").map(p => p.trim()).filter(p => p.length > 0)
    const apellido = partes[1] || ''
    const nombre = partes[2] || ''
    const resto = partes.slice(3).join("")
    const m = resto.match(/([MF])(\d{7,8})/i)
    return { apellido, nombre, dni: m ? m[2] : '', cuil: '' }
  }

  if (tieneSeparadorMultiple) {
    const partes = limpio.split(separadorDominante).map(p => p.trim()).filter(p => p.length > 0)
    const dniIdx = partes.findIndex(p => /^\d{7,8}$/.test(p))
    if (dniIdx === -1) return null
    const dni = partes[dniIdx]
    const sexoIdx = partes.findIndex(p => /^[MF]$/i.test(p))
    const limite = sexoIdx !== -1 ? sexoIdx : dniIdx
    const camposTexto = partes.slice(0, limite)
      .filter(p => /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü\s]+$/.test(p) && p.length > 1)
    return { apellido: camposTexto[0] || '', nombre: camposTexto[1] || '', dni, cuil: '' }
  }

  if (esFormatoMRZ_Limpio) {
    const m = limpio.match(/([MF])(\d{7,8})[A-Z]/i)
    if (!m) return null
    return { apellido: '', nombre: '', dni: m[2], cuil: '' }
  }

  return null
}

export default function Supervisor({ onCambiarRol }) {
  const [bufferRef] = [useRef('')]
  const timerRef = useRef(null)
  const [autorizados, setAutorizados] = useState([]) // lista del día
  const [flash, setFlash] = useState(null)
  const [error, setError] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [formData, setFormData] = useState({ nombre: '', apellido: '', dni: '' })
  const [syncStatus, setSyncStatus] = useState(null)

  // ─── Cargar autorizados existentes al montar ──────────────────────────────
  useEffect(() => {
    obtenerAutorizados()
      .then((lista) => {
        if (Array.isArray(lista)) {
          setAutorizados(lista.map((a) => ({
            nombre: String(a.nombre || '').toUpperCase(),
            apellido: String(a.apellido || '').toUpperCase(),
            dni: String(a.dni).trim(),
          })))
        }
      })
      .catch(() => {}) // fallo silencioso, el supervisor puede seguir trabajando
  }, [])

  // ─── Scanner ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (modalAbierto) return // ignorar scanner si el modal está abierto
      if (e.key === 'Enter') {
        e.preventDefault()
        const datos = bufferRef.current
        bufferRef.current = ''
        if (datos.length > 10) procesarScan(datos)
        return
      }
      if (e.key.length > 1) return
      bufferRef.current += e.key
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => { bufferRef.current = '' }, 100)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [autorizados, modalAbierto])

  const procesarScan = (raw) => {
    setError('')
    const datos = parsearDNI(raw)
    if (!datos || !datos.dni) {
      setError('No se reconoció el documento. Escaneá el dorso del DNI.')
      return
    }
    registrarPersona(datos)
  }

  const registrarPersona = (datos) => {
    const persona = {
      nombre: datos.nombre.toUpperCase(),
      apellido: datos.apellido.toUpperCase(),
      dni: String(datos.dni),
    }

    // Verificar si ya está autorizado hoy
    if (autorizados.find(a => a.dni === persona.dni)) {
      setError(`${persona.apellido} ${persona.nombre} ya está autorizado hoy.`)
      return
    }

    setAutorizados(prev => [persona, ...prev])
    setFlash(persona)
    setTimeout(() => setFlash(null), 4000)

    setSyncStatus('syncing')
    registrarAutorizado(persona)
      .then((res) => {
        setSyncStatus(res?.estatus === 'ERROR' || res?.error ? 'error' : 'ok')
      })
      .catch(() => setSyncStatus('error'))
  }

  const handleSubmitManual = (e) => {
    e.preventDefault()
    if (!formData.nombre.trim() || !formData.apellido.trim() || !formData.dni.trim()) {
      setError('Todos los campos son obligatorios')
      return
    }
    if (!/^\d{7,8}$/.test(formData.dni)) {
      setError('El DNI debe tener 7 u 8 dígitos')
      return
    }
    registrarPersona(formData)
    setFormData({ nombre: '', apellido: '', dni: '' })
    setModalAbierto(false)
  }

  return (
    <div className="sv-screen">
      {/* ── Header ── */}
      <header className="sv-header">
        <img src={logo} alt="Logo" className="sv-logo" />
        <div className="sv-header-center">
          <h1>Panel de Supervisores</h1>
          <p>Autorizá el personal antes de que salga al descanso</p>
        </div>
        <button className="sv-btn-rol" onClick={onCambiarRol}>
          ← Cambiar rol
        </button>
      </header>

      <main className="sv-main">
        {/* ── Estado scanner ── */}
        <div className="sv-scanner-bar">
          <span className="sv-dot" />
          <span>Escaneá el DNI del empleado para autorizarlo</span>
          {syncStatus === 'syncing' && <span className="sv-sync syncing">⏳ Guardando...</span>}
          {syncStatus === 'ok'      && <span className="sv-sync ok">✅ Guardado</span>}
          {syncStatus === 'error'   && <span className="sv-sync err">⚠️ Error al guardar</span>}
        </div>

        {error && (
          <div className="sv-error">
            ⚠️ {error}
            <button onClick={() => setError('')}>✕</button>
          </div>
        )}

        {flash && (
          <div className="sv-flash">
            <span className="sv-flash-icon">✅</span>
            <div>
              <div className="sv-flash-nombre">{flash.apellido} {flash.nombre}</div>
              <div className="sv-flash-dni">DNI {flash.dni} — Autorizado para el descanso</div>
            </div>
          </div>
        )}

        {/* ── Lista de autorizados ── */}
        <div className="sv-section">
          <div className="sv-section-header">
            <h2>Autorizados hoy <span className="sv-count">{autorizados.length}</span></h2>
            <button className="sv-btn-add" onClick={() => setModalAbierto(true)}>
              ➕ Cargar manual
            </button>
          </div>

          {autorizados.length === 0 ? (
            <div className="sv-empty">
              <div className="sv-empty-icon">👥</div>
              <div>Sin autorizados aún</div>
              <div>Escaneá el DNI o usá "Cargar manual"</div>
            </div>
          ) : (
            <div className="sv-lista">
              {autorizados.map((a, i) => (
                <div key={i} className="sv-item">
                  <div className="sv-avatar">
                    {a.apellido[0]}{a.nombre[0]}
                  </div>
                  <div className="sv-item-info">
                    <div className="sv-item-nombre">{a.apellido} {a.nombre}</div>
                    <div className="sv-item-dni">DNI {a.dni}</div>
                  </div>
                  <span className="sv-badge">✓ Autorizado</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Modal carga manual ── */}
      {modalAbierto && (
        <div className="sv-overlay" onClick={() => setModalAbierto(false)}>
          <div className="sv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sv-modal-header">
              <h3>Autorizar manualmente</h3>
              <button onClick={() => setModalAbierto(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmitManual}>
              <div className="sv-form-group">
                <label>Apellido *</label>
                <input
                  type="text"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  placeholder="PÉREZ"
                  autoFocus
                  required
                />
              </div>
              <div className="sv-form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="JUAN CARLOS"
                  required
                />
              </div>
              <div className="sv-form-group">
                <label>DNI *</label>
                <input
                  type="text"
                  value={formData.dni}
                  onChange={(e) => setFormData({ ...formData, dni: e.target.value.replace(/\D/g, '') })}
                  placeholder="12345678"
                  maxLength={8}
                  required
                />
              </div>
              <div className="sv-modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-confirmar">
                  Autorizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
