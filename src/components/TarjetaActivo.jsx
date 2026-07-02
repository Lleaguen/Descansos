import { useState, useEffect } from 'react'
import { diffSegundos, formatHora, formatDuracionSegundos } from '../utils/formatters.js'
import {
  SEGS_DESCANSO, SEGS_LIMITE,
  COLOR_PRIMARY, COLOR_TOLERANCIA, COLOR_EXCEDIDO,
} from '../constants/index.js'

export default function TarjetaActivo({ persona }) {
  const [segundos, setSegundos] = useState(diffSegundos(persona.salida, new Date()))

  useEffect(() => {
    const id = setInterval(() => setSegundos(diffSegundos(persona.salida, new Date())), 1000)
    return () => clearInterval(id)
  }, [persona.salida])

  const excedido     = segundos > SEGS_LIMITE
  const enTolerancia = segundos > SEGS_DESCANSO && !excedido
  const pct   = Math.min((segundos / SEGS_LIMITE) * 100, 100)
  const color = excedido ? COLOR_EXCEDIDO : enTolerancia ? COLOR_TOLERANCIA : COLOR_PRIMARY
  const bgAvatar = excedido ? '#fee2e2' : enTolerancia ? '#fef9c3' : '#e0f7ff'

  let timerLabel, timerValue
  if (excedido) {
    timerLabel = 'Excedido'
    timerValue = `+${formatDuracionSegundos(segundos - SEGS_LIMITE)}`
  } else if (enTolerancia) {
    timerLabel = 'Tolerancia'
    timerValue = `${formatDuracionSegundos(SEGS_LIMITE - segundos)} restantes`
  } else {
    timerLabel = 'Restante'
    timerValue = formatDuracionSegundos(SEGS_DESCANSO - segundos)
  }

  return (
    <div className={`activo-card ${excedido ? 'activo-excedido' : enTolerancia ? 'activo-tolerancia' : 'activo-normal'}`}>
      <div className="activo-avatar" style={{ background: bgAvatar, color }}>
        {persona.apellido[0]}{persona.nombre[0]}
      </div>
      <div className="activo-info">
        <div className="activo-nombre">{persona.apellido} {persona.nombre}</div>
        <div className="activo-dni">DNI {persona.dni}</div>
        <div className="activo-salida-hora">Salió a las {formatHora(persona.salida)}</div>
        <div className="activo-progress-bar">
          <div className="activo-progress-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      <div className="activo-timer" style={{ color }}>
        <span className="timer-label">{timerLabel}</span>
        <span className="timer-value">{timerValue}</span>
      </div>
    </div>
  )
}
