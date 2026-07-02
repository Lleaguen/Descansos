export default function ModalManual({ formData, onChange, onSubmit, onCerrar, error }) {
  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Registrar manualmente</h3>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>
        <form className="modal-form" onSubmit={onSubmit}>
          <div className="form-group">
            <label>Apellido *</label>
            <input
              type="text"
              value={formData.apellido}
              onChange={(e) => onChange({ ...formData, apellido: e.target.value })}
              placeholder="PÉREZ"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Nombre *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => onChange({ ...formData, nombre: e.target.value })}
              placeholder="JUAN CARLOS"
              required
            />
          </div>
          <div className="form-group">
            <label>DNI *</label>
            <input
              type="text"
              value={formData.dni}
              onChange={(e) => onChange({ ...formData, dni: e.target.value.replace(/\D/g, '') })}
              placeholder="12345678"
              required
              maxLength={8}
            />
          </div>
          <div className="form-group">
            <label>CUIL (opcional)</label>
            <input
              type="text"
              value={formData.cuil}
              onChange={(e) => onChange({ ...formData, cuil: e.target.value.replace(/\D/g, '') })}
              placeholder="20123456789"
              maxLength={11}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
