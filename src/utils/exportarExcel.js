import * as XLSX from 'xlsx'
import { SEGS_LIMITE, SEGS_DESCANSO } from '../constants/index.js'
import { formatFecha, formatHora, formatDuracionSegundos } from './formatters.js'

export function exportarExcel(excedidos) {
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
