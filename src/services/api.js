// Reemplaza esto con la URL larga que te dio Google al implementar (termina en /exec)
const URL_API = "https://script.google.com/macros/s/AKfycbyaY7zwcCizy7rgT7LQ_vlztAX139tVUMAGNoMwhblmamam-6bj-VWEJZiwH70ReYIT/exec"
/*
// ─── POST: Registrar cuando alguien SALE a descansar ───────────────────────
export async function registrarSalidaEnSheet(persona) {
  const datos = {
    fecha: new Date().toLocaleDateString('es-AR'),
    hora: new Date().toLocaleTimeString('es-AR'),
    nombre: persona.nombre,
    apellido: persona.apellido,
    dni: persona.dni,
    cuil: persona.cuil || '',
    ida_al_descanso: new Date().toLocaleTimeString('es-AR')
  }

  try {
    const response = await fetch(URL_API, {
      method: "POST",
      redirect: "follow", // Crítico para que Google Sheets no de error de CORS
      body: JSON.stringify(datos)
    })
    return await response.json()
  } catch (error) {
    console.error("Error al guardar salida en Google Sheets:", error)
    return { error }
  }
}

// ─── POST: Registrar cuando alguien VUELVE del descanso ─────────────────────
export async function registrarVueltaEnSheet(dni, estadoExcedidoTexto) {
  const datos = {
    accion: "REGISTRAR_VUELTA",
    dni: dni,
    vuelta_al_descanso: new Date().toLocaleTimeString('es-AR'),
    excedido: estadoExcedidoTexto
  }

  try {
    const response = await fetch(URL_API, {
      method: "POST",
      redirect: "follow",
      body: JSON.stringify(datos)
    })
    return await response.json()
  } catch (error) {
    console.error("Error al actualizar vuelta en Google Sheets:", error)
    return { error }
  }
}

// ─── GET: Obtener todos los registros actuales (Por si los necesitas en pantalla) ───
export async function obtenerRegistrosSheet() {
  try {
    const response = await fetch(URL_API)
    return await response.json()
  } catch (error) {
    console.error("Error al traer datos de Google Sheets:", error)
    return []
  }
}
*/

// Helper: hora actual en formato 24h "HH:MM:SS" sin AM/PM
function horaActual24h() {
  const d = new Date()
  const h  = String(d.getHours()).padStart(2, '0')
  const m  = String(d.getMinutes()).padStart(2, '0')
  const s  = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

// Guardar nueva salida (Crea una fila nueva)
export async function registrarSalidaEnSheet(persona) {
  const ahora = horaActual24h()
  const datos = {
    accion: "REGISTRAR_SALIDA",
    fecha: new Date().toLocaleDateString('es-AR'),
    hora: ahora,
    nombre: persona.nombre,
    apellido: persona.apellido,
    dni: persona.dni,
    cuil: persona.cuil || '',
    ida_al_descanso: ahora
  };

  try {
    const response = await fetch(URL_API, {
      method: "POST",
      redirect: "follow",
      body: JSON.stringify(datos)
    });
    return await response.json();
  } catch (error) {
    console.error("Error de red al registrar salida:", error);
    return { estatus: "ERROR" };
  }
}

// Obtener todos los registros del día actual
export async function obtenerRegistrosSheet() {
  try {
    const response = await fetch(URL_API)
    return await response.json()
  } catch (error) {
    console.error("Error de red al obtener registros:", error)
    return []
  }
}

// Guardar regreso (Busca la fila por DNI y la edita)
export async function registrarVueltaEnSheet(dni, textoExcedido) {
  const datos = {
    accion: "REGISTRAR_VUELTA",
    dni: dni,
    vuelta_al_descanso: horaActual24h(),
    excedido: textoExcedido
  };

  try {
    const response = await fetch(URL_API, {
      method: "POST",
      redirect: "follow",
      body: JSON.stringify(datos)
    });
    return await response.json();
  } catch (error) {
    console.error("Error de red al registrar vuelta:", error);
    return { estatus: "ERROR" };
  }
}
