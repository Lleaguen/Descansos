import { useState } from 'react'
import logo from './assets/Ocasa.png'
import './PantallaRol.css'

// Clave hardcodeada para el rol Implant
// No intuitiva: no es "1234" ni "admin" ni el nombre del sistema
const CLAVE_IMPLANT = 'OCA2025#'

export default function PantallaRol({ onSeleccion }) {
  const [mostrarClave, setMostrarClave] = useState(false)
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')

  const handleImplant = (e) => {
    e.preventDefault()
    if (clave === CLAVE_IMPLANT) {
      onSeleccion('implant')
    } else {
      setError('Clave incorrecta')
      setClave('')
    }
  }

  return (
    <div className="rol-screen">
      <div className="rol-container">
        <img src={logo} alt="Logo" className="rol-logo" />
        <h1 className="rol-title">Control de Descansos</h1>
        <p className="rol-sub">Seleccioná tu rol para continuar</p>

        <div className="rol-cards">
          {/* Supervisor — sin clave */}
          <button className="rol-card" onClick={() => onSeleccion('supervisor')}>
            <div className="rol-icon">👔</div>
            <div className="rol-card-title">Supervisor</div>
            <div className="rol-card-desc">Autorizar personal para el descanso</div>
          </button>

          {/* Implant — con clave */}
          <button className="rol-card" onClick={() => setMostrarClave(true)}>
            <div className="rol-icon">🖥️</div>
            <div className="rol-card-title">Implant</div>
            <div className="rol-card-desc">Registrar entradas y salidas al descanso</div>
          </button>
        </div>

        {mostrarClave && (
          <div className="clave-overlay" onClick={() => { setMostrarClave(false); setError(''); setClave('') }}>
            <div className="clave-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Acceso Implant</h3>
              <p>Ingresá la clave de operación</p>
              <form onSubmit={handleImplant}>
                <input
                  type="password"
                  value={clave}
                  onChange={(e) => { setClave(e.target.value); setError('') }}
                  placeholder="••••••••"
                  autoFocus
                  className={error ? 'input-error' : ''}
                />
                {error && <span className="clave-error">{error}</span>}
                <div className="clave-actions">
                  <button type="button" className="btn-cancel" onClick={() => { setMostrarClave(false); setError(''); setClave('') }}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-confirmar">
                    Ingresar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
