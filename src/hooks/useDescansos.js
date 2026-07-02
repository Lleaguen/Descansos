import { useState, useEffect, useRef } from 'react'
import { parsearDNI } from '../utils/parsearDNI.js'
import { ahoraDate, diffSegundos, formatDuracionSegundos } from '../utils/formatters.js'
import {
  SEGS_DESCANSO, SEGS_LIMITE, LIMITE_REINCIDENCIAS,
} from '../constants/index.js'
import {
  registrarSalidaEnSheet,
  registrarVueltaEnSheet,
  obtenerRegistrosSheet,
  obtenerAutorizados,
} from '../services/api.js'

/**
 * Hook principal que gestiona el estado de descansos, historial,
 * rehidratación inicial, y todas las acciones de procesamiento.
 */
export function useDescansos({ autorizados, setAutorizados, autorizadosRef }) {
  const [descansos,     setDescansos]     = useState({})
  const [historial,     setHistorial]     = useState([])
  const [esperando,     setEsperando]     = useState(true)
  const [error,         setError]         = useState('')
  const [flash,         setFlash]         = useState(null)
  const [alertaCritica, setAlertaCritica] = useState(null)
  const [syncStatus,    setSyncStatus]    = useState(null)
  const [cargando,      setCargando]      = useState(true)
  const [formData,      setFormData]      = useState({ nombre: '', apellido: '', dni: '', cuil: '' })
  const [modalAbierto,  setModalAbierto]  = useState(false)

  // Refs para acceso síncrono desde closures (scanner listener, etc.)
  const descansosRef    = useRef({})
  const historialRef    = useRef([])
  const procesarScanRef = useRef(null)

  // Sincronizar refs con state en cada render
  descansosRef.current = descansos
  historialRef.current = historial

  // ─── Rehidratar estado desde Google Sheets al montar ──────────────────────
  useEffect(() => {
    const normFecha = (val) => {
      if (!val && val !== 0) return ''
      if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000))
        return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`
      }
      const str = String(val).trim()
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const d = new Date(str)
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
      }
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

        const listaAutorizados = Array.isArray(autorizadosData) ? autorizadosData : []
        const dnisAutorizadosHoy = listaAutorizados.map((a) => String(a.dni).trim())
        autorizadosRef.current = dnisAutorizadosHoy
        setAutorizados(dnisAutorizadosHoy)

        if (!Array.isArray(registros)) return

        if (registros.length > 0) {
          console.log('[Sheets] Primera fecha recibida:', registros[0].fecha, '| tipo:', typeof registros[0].fecha)
          console.log('[Sheets] Fecha normalizada:', normFecha(registros[0].fecha), '| Hoy:', hoy)
        }
        console.log(`[Sheets] Total registros: ${registros.length}`)

        const nuevoHistorial = []
        const nuevosDescansos = {}

        registros.forEach((r) => {
          const salida = parsearHora(r.ida_al_descanso)
          if (!salida) return

          const fechaStr = normFecha(r.fecha)
          if (fechaStr) {
            const [d, m, y] = fechaStr.split('/').map(Number)
            salida.setFullYear(y, m - 1, d)
          }

          const vuelta = parsearHora(r.vuelta_al_descanso)
          if (vuelta) {
            if (fechaStr) {
              const [d, m, y] = fechaStr.split('/').map(Number)
              vuelta.setFullYear(y, m - 1, d)
            }
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
          } else if (normFecha(r.fecha) === hoy) {
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

  // ─── procesarSalida ────────────────────────────────────────────────────────
  const procesarSalida = (datos, ahora) => {
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
  }

  // ─── procesarVuelta ────────────────────────────────────────────────────────
  const procesarVuelta = (datos, ahora) => {
    const existente = descansosRef.current[datos.dni]
    if (!existente) return

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
    setHistorial((h) => {
      const nuevo = [registro, ...h]
      if (excedido) {
        const vecesExcedido = nuevo.filter(r => String(r.dni) === String(datos.dni) && r.excedido).length
        if (vecesExcedido >= LIMITE_REINCIDENCIAS) {
          setAlertaCritica({
            apellido: registro.apellido,
            nombre:   registro.nombre,
            dni:      registro.dni,
            veces:    vecesExcedido,
          })
        }
      }
      return nuevo
    })
    setEsperando(false)

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

  // ─── procesarScan ──────────────────────────────────────────────────────────
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

    const descansosActuales = descansosRef.current
    const historialActual   = historialRef.current

    // ── Bloqueo 12h ──
    const SEGS_12H = 12 * 60 * 60
    const descansoPrevio = historialActual.find(
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

    // ── Bloqueo de autorización ──
    const estaActivo = descansosActuales[datos.dni]
    if (!estaActivo) {
      const lista = autorizadosRef.current

      if (lista === null) {
        obtenerAutorizados().then((dataFresca) => {
          const listaFresca = Array.isArray(dataFresca) ? dataFresca.map((a) => String(a.dni).trim()) : []
          autorizadosRef.current = listaFresca
          setAutorizados(listaFresca)
          if (!listaFresca.includes(String(datos.dni).trim())) {
            setError(`${datos.apellido} ${datos.nombre} no está autorizado para salir al descanso. Un supervisor debe autorizarlo primero.`)
            setEsperando(true)
            return
          }
          procesarSalida(datos, ahora)
        }).catch(() => procesarSalida(datos, ahora))
        return
      }

      if (!lista.includes(String(datos.dni).trim())) {
        setError(`${datos.apellido} ${datos.nombre} no está autorizado para salir al descanso. Un supervisor debe autorizarlo primero.`)
        setEsperando(true)
        return
      }

      procesarSalida(datos, ahora)
      return
    }

    procesarVuelta(datos, ahora)
  }

  // Actualizar el ref de procesarScan en cada render
  procesarScanRef.current = procesarScan

  // ─── handleSubmitManual ────────────────────────────────────────────────────
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
      nombre:   formData.nombre.trim().toUpperCase(),
      apellido: formData.apellido.trim().toUpperCase(),
      dni:      formData.dni.trim(),
      cuil:     formData.cuil.trim(),
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

    // Bloqueo de autorización (solo para salidas nuevas)
    if (!existente && autorizados !== null && !autorizados.includes(String(datosSimulados.dni).trim())) {
      setError(
        `${datosSimulados.apellido} ${datosSimulados.nombre} no está autorizado para salir al descanso. ` +
        `Un supervisor debe autorizarlo primero.`
      )
      return
    }

    // Validaciones OK — cerrar modal
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

  const cerrarFlash = () => { setFlash(null); setEsperando(true) }

  return {
    descansos,
    historial,
    esperando,
    error, setError,
    flash, cerrarFlash,
    alertaCritica, setAlertaCritica,
    syncStatus,
    cargando,
    formData, setFormData,
    modalAbierto, setModalAbierto,
    procesarScanRef,
    handleSubmitManual,
  }
}
