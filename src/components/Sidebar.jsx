import logo from '../assets/Ocasa.png'

export default function Sidebar({ tab, onTab, esperando, buffer, syncStatus, excedidosCount, onCambiarRol }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={logo} alt="Logo" className="sidebar-logo" />
      </div>
      <nav className="sidebar-nav">
        <button className={`nav-item ${tab === 'dashboard' ? 'nav-active' : ''}`} onClick={() => onTab('dashboard')}>
          <span className="nav-icon">📊</span><span>Dashboard</span>
        </button>
        <button className={`nav-item ${tab === 'historial' ? 'nav-active' : ''}`} onClick={() => onTab('historial')}>
          <span className="nav-icon">📋</span><span>Historial</span>
        </button>
        <button className={`nav-item ${tab === 'excedidos' ? 'nav-active' : ''}`} onClick={() => onTab('excedidos')}>
          <span className="nav-icon">⚠️</span><span>Excedidos</span>
          {excedidosCount > 0 && (
            <span className="nav-badge">{excedidosCount}</span>
          )}
        </button>
      </nav>
      <div className="sidebar-footer">
        <div className="scanner-badge">
          <span className={`scanner-dot ${esperando ? 'dot-waiting' : 'dot-ok'}`} />
          <span>{esperando ? 'Esperando DNI...' : 'DNI leído ✓'}</span>
        </div>
        {buffer.length > 0 && <div className="reading-bar">Leyendo...</div>}
        {syncStatus === 'syncing' && (
          <div className="sync-badge sync-syncing">⏳ Guardando en Sheets...</div>
        )}
        {syncStatus === 'ok' && (
          <div className="sync-badge sync-ok">✅ Guardado en Sheets</div>
        )}
        {syncStatus === 'error' && (
          <div className="sync-badge sync-error">⚠️ Error al guardar en Sheets</div>
        )}
        <button
          className="nav-item"
          style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem' }}
          onClick={onCambiarRol}
        >
          ← Cambiar rol
        </button>
      </div>
    </aside>
  )
}
