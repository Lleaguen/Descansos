export function ahoraDate() { return new Date() }

export function formatHora(d) {
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatFecha(d) {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function diffSegundos(inicio, fin) {
  return Math.floor((fin - inicio) / 1000)
}

export function formatDuracionSegundos(segundos) {
  const s = Math.abs(segundos)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  if (h > 0) return `${h}h ${m}min ${seg}s`
  if (m > 0) return `${m}min ${seg}s`
  return `${seg}s`
}

export function getNombreCorto(p) {
  return `${p.apellido} ${p.nombre.split(' ')[0]}`
}

// Formato hora 24h "HH:MM" — usa el objeto Date completo para respetar la fecha
export function fmt24(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
