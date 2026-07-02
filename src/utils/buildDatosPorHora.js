// Agrupa historial por hora (HH:00) y cuenta ok / excedidos / tolerancia
export function buildDatosPorHora(historial) {
  const mapa = {}
  historial.forEach((h) => {
    const hora = h.vuelta.getHours()
    const key  = `${String(hora).padStart(2, '0')}:00`
    if (!mapa[key]) mapa[key] = { hora: key, correctos: 0, excedidos: 0, tolerancia: 0 }
    if (h.excedido)          mapa[key].excedidos++
    else if (h.enTolerancia) mapa[key].tolerancia++
    else                     mapa[key].correctos++
  })
  return Object.values(mapa).sort((a, b) => a.hora.localeCompare(b.hora))
}
