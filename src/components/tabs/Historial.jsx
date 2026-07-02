import { useState, useEffect } from 'react'
import ColFilterHeader from '../ColFilterHeader.jsx'
import { formatFecha, fmt24, formatDuracionSegundos } from '../../utils/formatters.js'
import { COLOR_PRIMARY, COLOR_TOLERANCIA, COLOR_EXCEDIDO } from '../../constants/index.js'

// ─── helpers locales ──────────────────────────────────────────────────────────
const uniq = arr => [...new Set(arr)].sort()
const mkFull = (vals) => new Set(vals)

function getEstadoLabel(h) {
  return h.excedido ? '⚠️ Excedido' : h.enTolerancia ? '🟡 Tolerancia' : '✅ OK'
}

// Ciclo: null → asc → desc → null
function cycleSort(currentKey, currentDir, newKey, setKey, setDir) {
  if (currentKey !== newKey) { setKey(newKey); setDir('asc'); return }
  if (currentDir === 'asc')  { setDir('desc'); return }
  setKey(null); setDir(null)
}

const sortFns = {
  fecha:    (a, b) => a.vuelta  - b.vuelta,
  salida:   (a, b) => a.salida  - b.salida,
  vuelta:   (a, b) => a.vuelta  - b.vuelta,
  duracion: (a, b) => a.segundosTomados - b.segundosTomados,
  persona:  (a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'),
  dni:      (a, b) => String(a.dni).localeCompare(String(b.dni), undefined, { numeric: true }),
  estado:   (a, b) => getEstadoLabel(a).localeCompare(getEstadoLabel(b)),
}

function applySort(lista, key, dir) {
  if (!key || !dir || !sortFns[key]) return lista
  const fn = sortFns[key]
  return [...lista].sort((a, b) => dir === 'asc' ? fn(a, b) : fn(b, a))
}

export default function Historial({ historial }) {
  // Valores únicos por columna
  const hVals = {
    fecha:    uniq(historial.map(h => formatFecha(h.vuelta))),
    persona:  uniq(historial.map(h => `${h.apellido} ${h.nombre}`.trim())),
    dni:      uniq(historial.map(h => String(h.dni))),
    salida:   uniq(historial.map(h => fmt24(h.salida))),
    vuelta:   uniq(historial.map(h => fmt24(h.vuelta))),
    estado:   ['✅ OK', '🟡 Tolerancia', '⚠️ Excedido'],
  }

  const [fhFecha,   setFhFecha]   = useState(() => mkFull(hVals.fecha))
  const [fhPersona, setFhPersona] = useState(() => mkFull(hVals.persona))
  const [fhDni,     setFhDni]     = useState(() => mkFull(hVals.dni))
  const [fhSalida,  setFhSalida]  = useState(() => mkFull(hVals.salida))
  const [fhVuelta,  setFhVuelta]  = useState(() => mkFull(hVals.vuelta))
  const [fhEstado,  setFhEstado]  = useState(() => mkFull(hVals.estado))

  // Cuando llegan nuevos datos, expandir los Sets para incluir nuevos valores
  useEffect(() => {
    setFhFecha  (prev => mkFull([...new Set([...prev, ...hVals.fecha])]))
    setFhPersona(prev => mkFull([...new Set([...prev, ...hVals.persona])]))
    setFhDni    (prev => mkFull([...new Set([...prev, ...hVals.dni])]))
    setFhSalida (prev => mkFull([...new Set([...prev, ...hVals.salida])]))
    setFhVuelta (prev => mkFull([...new Set([...prev, ...hVals.vuelta])]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historial.length])

  const resetFiltros = () => {
    setFhFecha  (mkFull(hVals.fecha))
    setFhPersona(mkFull(hVals.persona))
    setFhDni    (mkFull(hVals.dni))
    setFhSalida (mkFull(hVals.salida))
    setFhVuelta (mkFull(hVals.vuelta))
    setFhEstado (mkFull(hVals.estado))
  }

  const historialFiltrado = historial.filter(h => {
    if (fhFecha.size   < hVals.fecha.length   && !fhFecha.has(formatFecha(h.vuelta)))                 return false
    if (fhPersona.size < hVals.persona.length && !fhPersona.has(`${h.apellido} ${h.nombre}`.trim())) return false
    if (fhDni.size     < hVals.dni.length     && !fhDni.has(String(h.dni)))                           return false
    if (fhSalida.size  < hVals.salida.length  && !fhSalida.has(fmt24(h.salida)))                      return false
    if (fhVuelta.size  < hVals.vuelta.length  && !fhVuelta.has(fmt24(h.vuelta)))                      return false
    if (fhEstado.size  < hVals.estado.length  && !fhEstado.has(getEstadoLabel(h)))                    return false
    return true
  })

  const hayFiltros = (
    fhFecha.size   < hVals.fecha.length   ||
    fhPersona.size < hVals.persona.length ||
    fhDni.size     < hVals.dni.length     ||
    fhSalida.size  < hVals.salida.length  ||
    fhVuelta.size  < hVals.vuelta.length  ||
    fhEstado.size  < hVals.estado.length
  )

  // Ordenamiento
  const [hSortKey, setHSortKey] = useState(null)
  const [hSortDir, setHSortDir] = useState(null)

  const hSort = (key) => cycleSort(hSortKey, hSortDir, key, setHSortKey, setHSortDir)
  const hSD   = (key) => hSortKey === key ? hSortDir : null

  const historialOrdenado = applySort(historialFiltrado, hSortKey, hSortDir)

  return (
    <section className="section-card">
      <div className="section-header">
        <h2 className="section-title">
          <span className="section-dot" style={{ background: COLOR_PRIMARY }} />Historial completo
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="section-badge" style={{ background: `${COLOR_PRIMARY}22`, color: COLOR_PRIMARY }}>
            {historialFiltrado.length}{hayFiltros ? ` de ${historial.length}` : ''} registro{historial.length !== 1 ? 's' : ''}
          </span>
          {hayFiltros && (
            <button className="btn-clear-filters" onClick={resetFiltros} title="Limpiar filtros">
              ✕ Limpiar filtros
            </button>
          )}
        </div>
      </div>
      {historial.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">Sin registros aún</div>
          <div className="empty-sub">Los descansos completados aparecerán aquí</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>#</th>
                <ColFilterHeader label="Fecha"   values={hVals.fecha}   selected={fhFecha}   onChange={setFhFecha}   sortDir={hSD('fecha')}    onSort={() => hSort('fecha')} />
                <ColFilterHeader label="Persona" values={hVals.persona} selected={fhPersona} onChange={setFhPersona} sortDir={hSD('persona')}  onSort={() => hSort('persona')} />
                <ColFilterHeader label="DNI"     values={hVals.dni}     selected={fhDni}     onChange={setFhDni}     sortDir={hSD('dni')}      onSort={() => hSort('dni')} />
                <ColFilterHeader label="Salida"  values={hVals.salida}  selected={fhSalida}  onChange={setFhSalida}  sortDir={hSD('salida')}   onSort={() => hSort('salida')} />
                <ColFilterHeader label="Vuelta"  values={hVals.vuelta}  selected={fhVuelta}  onChange={setFhVuelta}  sortDir={hSD('vuelta')}   onSort={() => hSort('vuelta')} />
                <th className="th-sortable" onClick={() => hSort('duracion')}>
                  <span>Duración</span>
                  <span className={`th-sort-inline ${hSD('duracion') ? 'th-sort-active' : ''}`}>
                    {hSD('duracion') === 'asc' ? '↑' : hSD('duracion') === 'desc' ? '↓' : '⇅'}
                  </span>
                </th>
                <ColFilterHeader label="Estado"  values={hVals.estado}  selected={fhEstado}  onChange={setFhEstado}  sortDir={hSD('estado')}   onSort={() => hSort('estado')} />
              </tr>
            </thead>
            <tbody>
              {historialOrdenado.length === 0 ? (
                <tr><td colSpan={8} className="td-empty">Sin resultados para los filtros aplicados</td></tr>
              ) : historialOrdenado.map((h, i) => (
                <tr key={i} className={h.excedido ? 'tr-excedido' : h.enTolerancia ? 'tr-tolerancia' : ''}>
                  <td className="td-num">{historialOrdenado.length - i}</td>
                  <td>{formatFecha(h.vuelta)}</td>
                  <td className="td-persona">
                    <div className="tabla-avatar" style={{
                      background: h.excedido ? '#fee2e2' : h.enTolerancia ? '#fef9c3' : '#e0f7ff',
                      color: h.excedido ? COLOR_EXCEDIDO : h.enTolerancia ? COLOR_TOLERANCIA : COLOR_PRIMARY
                    }}>{h.apellido[0]}{h.nombre[0]}</div>
                    <span>{h.apellido} {h.nombre}</span>
                  </td>
                  <td>{h.dni}</td>
                  <td>{fmt24(h.salida)}</td>
                  <td>{fmt24(h.vuelta)}</td>
                  <td className={h.excedido ? 'text-red fw600' : h.enTolerancia ? 'text-warn fw600' : 'text-green fw600'}>
                    {formatDuracionSegundos(h.segundosTomados)}
                  </td>
                  <td>
                    {h.excedido
                      ? <span className="badge badge-exc">⚠️ Excedido</span>
                      : h.enTolerancia
                        ? <span className="badge badge-tol">🟡 Tolerancia</span>
                        : <span className="badge badge-ok">✅ OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
