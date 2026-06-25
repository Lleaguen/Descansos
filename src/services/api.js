// Reemplazá esto con la URL larga que te dio Google al implementar (termina en /exec)
const URL_API = "https://script.google.com/macros/s/AKfycbzTQzTGPbUTblLj31JgcJfUXQ1_d3N4b5UtCeXfFttX9IjwAYzp4Vu72gjRrohiZlQh/exec"

// Helper: hora actual en formato 24h "HH:MM:SS" sin AM/PM
function horaActual24h() {
  const d = new Date()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

// ─── POST: Registrar cuando alguien SALE a descansar ──────────────────────────
export async function registrarSalidaEnSheet(persona) {
  const ahora = horaActual24h()
  const datos = {
    fecha: new Date().toLocaleDateString('es-AR'),
    hora: ahora,
    nombre: persona.nombre,
    apellido: persona.apellido,
    dni: persona.dni,
    cuil: persona.cuil || '',
    ida_al_descanso: ahora
  }

  try {
    const response = await fetch(URL_API, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(datos)
    })
    return await response.json()
  } catch (error) {
    console.error('Error de red al registrar salida:', error)
    return { estatus: 'ERROR' }
  }
}

// ─── POST: Registrar cuando alguien VUELVE del descanso ──────────────────────
export async function registrarVueltaEnSheet(dni, estadoExcedidoTexto) {
  const datos = {
    accion: 'REGISTRAR_VUELTA',
    dni: dni,
    vuelta_al_descanso: horaActual24h(),
    excedido: estadoExcedidoTexto
  }

  try {
    const response = await fetch(URL_API, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(datos)
    })
    return await response.json()
  } catch (error) {
    console.error('Error de red al registrar vuelta:', error)
    return { estatus: 'ERROR' }
  }
}

// ─── GET: Todos los registros del día ─────────────────────────────────────────
export async function obtenerRegistrosSheet() {
  try {
    const response = await fetch(URL_API)
    return await response.json()
  } catch (error) {
    console.error('Error de red al obtener registros:', error)
    return []
  }
}

// ─── GET: Lista de autorizados (hoja AUTORIZADOS) ─────────────────────────────
export async function obtenerAutorizados() {
  try {
    const response = await fetch(`${URL_API}?accion=obtenerAutorizados&t=${Date.now()}`, {
      cache: 'no-store'
    })
    return await response.json()
  } catch (error) {
    console.error('Error de red al obtener autorizados:', error)
    return []
  }
}

// ─── POST: Registrar persona autorizada en hoja AUTORIZADOS ──────────────────
export async function registrarAutorizado(persona) {
  const datos = {
    accion: 'REGISTRAR_AUTORIZADO',
    fecha: new Date().toLocaleDateString('es-AR'),
    hora: horaActual24h(),
    nombre: persona.nombre,
    apellido: persona.apellido,
    dni: persona.dni
  }

  try {
    const response = await fetch(URL_API, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(datos)
    })
    return await response.json()
  } catch (error) {
    console.error('Error de red al registrar autorizado:', error)
    return { estatus: 'ERROR' }
  }
}
