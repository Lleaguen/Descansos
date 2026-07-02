import { LIMITE_REINCIDENCIAS } from '../constants/index.js'

export default function AlertaCritica({ alerta, onCerrar }) {
  if (!alerta) return null

  return (
    <div className="alerta-critica" role="alert">
      <div className="alerta-critica-icono">🚨</div>
      <div className="alerta-critica-body">
        <div className="alerta-critica-titulo">¡Reincidente crítico!</div>
        <div className="alerta-critica-persona">
          {alerta.apellido} {alerta.nombre}
          <span className="alerta-critica-dni">DNI {alerta.dni}</span>
        </div>
        <div className="alerta-critica-msg">
          Se excedió <strong>{alerta.veces} {alerta.veces === 1 ? 'vez' : 'veces'}</strong> en el descanso.
          {alerta.veces >= LIMITE_REINCIDENCIAS && ' Requiere atención del supervisor.'}
        </div>
      </div>
      <button className="alerta-critica-close" onClick={onCerrar}>✕</button>
    </div>
  )
}
