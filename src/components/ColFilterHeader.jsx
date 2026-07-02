import { useState, useEffect, useRef } from 'react'

// sortDir: null | 'asc' | 'desc'
export default function ColFilterHeader({ label, values, selected, onChange, sortDir, onSort }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = search.trim()
    ? values.filter(v => v.toLowerCase().includes(search.toLowerCase()))
    : values

  const allSelected  = values.every(v => selected.has(v))
  const someSelected = !allSelected && values.some(v => selected.has(v))
  const isActive     = !allSelected

  const toggleAll = () => onChange(allSelected ? new Set() : new Set(values))
  const toggleOne = (v) => {
    const next = new Set(selected)
    next.has(v) ? next.delete(v) : next.add(v)
    onChange(next)
  }

  return (
    <th ref={ref} className="th-filter" style={{ position: 'relative', userSelect: 'none' }}>
      <div className="th-filter-cell">
        {/* Área de filtro */}
        <button
          className={`th-filter-btn ${isActive ? 'th-filter-active' : ''}`}
          onClick={() => setOpen(o => !o)}
          title={isActive ? 'Filtro activo' : 'Filtrar'}
        >
          <span className="th-label">{label}</span>
          <span className={`th-funnel ${isActive ? 'funnel-active' : ''}`} />
        </button>
        {/* Botón de ordenamiento */}
        {onSort && (
          <button
            className={`th-sort-btn ${sortDir ? 'th-sort-active' : ''}`}
            onClick={onSort}
            title={sortDir === 'asc' ? 'Orden ascendente — click para descendente' : sortDir === 'desc' ? 'Orden descendente — click para quitar' : 'Ordenar'}
          >
            {sortDir === 'asc'  ? '↑' :
             sortDir === 'desc' ? '↓' :
             <span className="sort-idle">⇅</span>}
          </button>
        )}
      </div>

      {open && (
        <div className="col-dropdown">
          <div className="col-dropdown-search">
            <input
              autoFocus
              type="text"
              placeholder="Buscar valor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="col-dropdown-list">
            <label className="col-dd-item col-dd-all">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected }}
                onChange={toggleAll}
              />
              <span>(Seleccionar todo)</span>
            </label>
            {filtered.length === 0 && <div className="col-dd-empty">Sin resultados</div>}
            {filtered.map(v => (
              <label key={v} className="col-dd-item">
                <input type="checkbox" checked={selected.has(v)} onChange={() => toggleOne(v)} />
                <span>{v}</span>
              </label>
            ))}
          </div>
          <div className="col-dropdown-footer">
            <span className="col-dd-selected-count">{selected.size} de {values.length} seleccionados</span>
            <button className="col-dd-btn-ok" onClick={() => setOpen(false)}>Aceptar</button>
          </div>
        </div>
      )}
    </th>
  )
}
