import { useState } from 'react'
import { useAutorizados } from './hooks/useAutorizados.js'
import { useDescansos } from './hooks/useDescansos.js'
import { useScanner } from './hooks/useScanner.js'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/tabs/Dashboard.jsx'
import Historial from './components/tabs/Historial.jsx'
import Excedidos from './components/tabs/Excedidos.jsx'
import FlashNotification from './components/FlashNotification.jsx'
import AlertaCritica from './components/AlertaCritica.jsx'
import ModalManual from './components/ModalManual.jsx'
import { MINUTOS_DESCANSO, MINUTOS_TOLERANCIA } from './constants/index.js'
import './App.css'

export default function App({ onCambiarRol }) {
  const [tab, setTab] = useState('dashboard')
  const [busquedaActivos, setBusquedaActivos] = useState('')

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { autorizados, setAutorizados, autorizadosRef } = useAutorizados()

  const {
    descansos,
    historial,
    esperando,
    error, setError,
    flash, cerrarFlash,
    alertaCritica, setAlertaCritica,
    syncStatus,
    cargando,
    formData, setFormData,
    modalAbierto, setModalAbierto,
    procesarScanRef,
    handleSubmitManual,
  } = useDescansos({ autorizados, setAutorizados, autorizadosRef })

  const { buffer } = useScanner(procesarScanRef)

  // ── Datos derivados ────────────────────────────────────────────────────────
  const activosArray   = Object.values(descansos)
  const listaExcedidos = historial.filter((h) => h.excedido || h.enTolerancia)

  return (
    <div className="dashboard">
      {/* ── Sidebar ── */}
      <Sidebar
        tab={tab}
        onTab={setTab}
        esperando={esperando}
        buffer={buffer}
        syncStatus={syncStatus}
        excedidosCount={listaExcedidos.length}
        onCambiarRol={onCambiarRol}
      />

      {/* ── Main ── */}
      <main className="main-content">
        <header className="main-header">
          <div>
            <h1 className="header-title">Sistema de Descansos</h1>
            <p className="header-sub">
              Descanso: <strong>{MINUTOS_DESCANSO} min</strong>
              &nbsp;·&nbsp;Tolerancia: <strong>{MINUTOS_TOLERANCIA} min</strong>
              &nbsp;·&nbsp;
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="header-scanner-status">
            <span className={`pulso-dot ${esperando ? '' : 'pulso-green'}`} />
            {esperando ? 'Listo para escanear' : 'Documento leído'}
          </div>
        </header>

        {cargando && (
          <div className="alert-info">
            ⏳ Cargando registros del día desde Google Sheets...
          </div>
        )}

        {error && (
          <div className="alert-error">
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')} className="alert-close">✕</button>
          </div>
        )}

        <FlashNotification flash={flash} onCerrar={cerrarFlash} />

        <AlertaCritica alerta={alertaCritica} onCerrar={() => setAlertaCritica(null)} />

        {/* ── Tabs ── */}
        {tab === 'dashboard' && (
          <Dashboard
            historial={historial}
            activosArray={activosArray}
            busquedaActivos={busquedaActivos}
            onBusquedaActivos={setBusquedaActivos}
          />
        )}

        {tab === 'historial' && (
          <Historial historial={historial} />
        )}

        {tab === 'excedidos' && (
          <Excedidos historial={historial} />
        )}
      </main>

      {/* ── Bottom nav mobile ── */}
      <nav className="mobile-nav">
        <button className={`mobile-nav-item ${tab === 'dashboard' ? 'nav-active' : ''}`} onClick={() => setTab('dashboard')}>
          <span className="nav-icon">📊</span>
          <span>Inicio</span>
        </button>
        <button className={`mobile-nav-item ${tab === 'historial' ? 'nav-active' : ''}`} onClick={() => setTab('historial')}>
          <span className="nav-icon">📋</span>
          <span>Historial</span>
        </button>
        <button className={`mobile-nav-item ${tab === 'excedidos' ? 'nav-active' : ''}`} onClick={() => setTab('excedidos')}>
          <span className="nav-icon">⚠️</span>
          <span>Excedidos</span>
          {listaExcedidos.length > 0 && (
            <span className="mobile-nav-badge">{listaExcedidos.length}</span>
          )}
        </button>
      </nav>

      {/* ── Botón flotante para carga manual ── */}
      <button
        className="btn-flotante"
        onClick={() => setModalAbierto(true)}
        title="Registrar sin DNI"
      >
        ➕
      </button>

      {/* ── Modal de carga manual ── */}
      {modalAbierto && (
        <ModalManual
          formData={formData}
          onChange={setFormData}
          onSubmit={handleSubmitManual}
          onCerrar={() => setModalAbierto(false)}
          error={error}
        />
      )}
    </div>
  )
}
