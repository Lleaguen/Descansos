export function parsearDNI(raw) {
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

  // ── CASO D: FORMATOS CON SEPARADORES (", @, ,, |, ;) ──────────────────────
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
      const camposTexto = partes
        .slice(0, dniIdx)
        .filter(p => {
          return /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü\s]+$/.test(p) && p.length > 1
        })

      const apellido = camposTexto[0] || ''
      const nombre   = camposTexto[1] || ''

      if (!apellido && !nombre) {
        const textoFallback = partes.filter(p =>
          /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü\s]+$/.test(p) &&
          p.length > 1 &&
          !/^\d/.test(p)
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
