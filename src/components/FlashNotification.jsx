import { formatHora, formatDuracionSegundos } from '../utils/formatters.js'
import { SEGS_LIMITE, SEGS_DESCANSO } from '../constants/index.js'

export default function FlashNotification({ flash, onCerrar }) {
  if (!flash) return null

  const tipoClase = flash.tipo === 'vuelta'
    ? flash.datos.excedido ? 'excedido' : flash.datos.enTolerancia ? 'tolerancia' : 'vuelta'
    : flash.tipo

  return (
    <div className={`flash-notification flash-${tipoClase}`}>
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
      <button className="flash-close" onClick={onCerrar}>✕</button>
    </div>
  )
}
