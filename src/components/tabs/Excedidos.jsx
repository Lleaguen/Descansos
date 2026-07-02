import { useState, useEffect } from 'react'
import ColFilterHeader from '../ColFilterHeader.jsx'
import { formatFecha, fmt24, formatDuracionSegundos } from '../../utils/formatters.js'
import { exportarExcel } from '../../utils/exportarExcel.js'
import { COLOR_EXCEDIDO, SEGS_LIMITE, SEGS_DESCANSO } from '../../constants/index.js'

// ─── helpers locales ──────────────────────────────────────────────────────────
const uniq = arr => [...new Set(arr)].sort()
const mkFull = (vals) => new Set(vals)

function getEstadoLabel(h) {
  return h.excedido ? '⚠️ Excedido' : '🟡 Tolerancia'
}

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
  apellido: (a, b) => (a.apellido || '').localeCompare(b.apellido || '', 'es'),
  nombre:   (a, b) => (a.nombre   || '').localeCompare(b.nombre   || '', 'es'),
  dni:      (a, b) => String(a.dni).localeCompare(String(b.dni), undefined, { numeric: true }),
  cuil:     (a, b) => String(a.cuil || '').localeCompare(String(b.cuil || ''), undefined, { numeric: true }),
  estado:   (a, b) => getEstadoLabel(a).localeCompare(getEstadoLabel(b)),
}

function applySort(lista, key, dir) {
  if (!key || !dir || !sortFns[key]) return lista
  const fn = sortFns[key]
  return [...lista].sort((a, b) => dir === 'asc' ? fn(a, b) : fn(b, a))
}

export default function Excedidos({ historial }) {
  const listaExcedidos = historial
    .filter((h) => h.excedido || h.enTolerancia)
    .sort((a, b) => b.segundosTomados - a.segundosTomados)

  // Valores únicos por columna
  const eVals = {
    fecha:    uniq(listaExcedidos.map(h => formatFecha(h.vuelta))),
    apellido: uniq(listaExcedidos.map(h => h.apellido || '')),
    nombre:   uniq(listaExcedidos.map(h => h.nombre   || '')),
    dni:      uniq(listaExcedidos.map(h => String(h.dni))),
    cuil:     uniq(listaExcedidos.map(h => h.cuil || '—')),
    salida:   uniq(listaExcedidos.map(h => fmt24(h.salida))),
    vuelta:   uniq(listaExcedidos.map(h => fmt24(h.vuelta))),
    estado:   ['🟡 Tolerancia', '⚠️ Excedido'],
  }

  const [feApellido, setFeApellido] = useState(() => mkFull(eVals.apellido))
  const [feNombre,   setFeNombre]   = useState(() => mkFull(eVals.nombre))
  const [feDni,      setFeDni]      = useState(() => mkFull(eVals.dni))
  const [feCuil,     setFeCuil]     = useState(() => mkFull(eVals.cuil))
  const [feFecha,    setFeFecha]    = useState(() => mkFull(eVals.fecha))
  const [feSalida,   setFeSalida]   = useState(() => mkFull(eVals.salida))
  const [feVuelta,   setFeVuelta]   = useState(() => mkFull(eVals.vuelta))
  const [feEstado,   setFeEstado]   = useState(() => mkFull(eVals.estado))

  useEffect(() => {
    setFeApellido(prev => mkFull([...new Set([...prev, ...eVals.apellido])]))
    setFeNombre  (prev => mkFull([...new Set([...prev, ...eVals.nombre])]))
    setFeDni     (prev => mkFull([...new Set([...prev, ...eVals.dni])]))
    setFeCuil    (prev => mkFull([...new Set([...prev, ...eVals.cuil])]))
    setFeFecha   (prev => mkFull([...new Set([...prev, ...eVals.fecha])]))
    setFeSalida  (prev => mkFull([...new Set([...prev, ...eVals.salida])]))
    setFeVuelta  (prev => mkFull([...new Set([...prev, ...eVals.vuelta])]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaExcedidos.length])

  const resetFiltros = () => {
    setFeApellido(mkFull(eVals.apellido))
    setFeNombre  (mkFull(eVals.nombre))
    setFeDni     (mkFull(eVals.dni))
    setFeCuil    (mkFull(eVals.cuil))
    setFeFecha   (mkFull(eVals.fecha))
    setFeSalida  (mkFull(eVals.salida))
    setFeVuelta  (mkFull(eVals.vuelta))
    setFeEstado  (mkFull(eVals.estado))
  }

  const excedidosFiltrados = listaExcedidos.filter(h => {
    if (feFecha.size    < eVals.fecha.length    && !feFecha.has(formatFecha(h.vuelta)))   return false
    if (feApellido.size < eVals.apellido.length && !feApellido.has(h.apellido || ''))     return false
    if (feNombre.size   < eVals.nombre.length   && !feNombre.has(h.nombre     || ''))     return false
    if (feDni.size      < eVals.dni.length      && !feDni.has(String(h.dni)))             return false
    if (feCuil.size     < eVals.cuil.length     && !feCuil.has(h.cuil || '—'))            return false
    if (feSalida.size   < eVals.salida.length   && !feSalida.has(fmt24(h.salida)))        return false
    if (feVuelta.size   < eVals.vuelta.length   && !feVuelta.has(fmt24(h.vuelta)))        return false
    if (feEstado.size   < eVals.estado.length   && !feEstado.has(getEstadoLabel(h)))      return false
    return true
  })

  const hayFiltros = (
    feFecha.size    < eVals.fecha.length    ||
    feApellido.size < eVals.apellido.length ||
    feNombre.size   < eVals.nombre.length   ||
    feDni.size      < eVals.dni.length      ||
    feCuil.size     < eVals.cuil.length     ||
    feSalida.size   < eVals.salida.length   ||
    feVuelta.size   < eVals.vuelta.length   ||
    feEstado.size   < eVals.estado.length
  )

  // Ordenamiento
  const [eSortKey, setESortKey] = useState(null)
  const [eSortDir, setESortDir] = useState(null)

  const eSort = (key) => cycleSort(eSortKey, eSortDir, key, setESortKey, setESortDir)
  const eSD   = (key) => eSortKey === key ? eSortDir : null

  const excedidosOrdenados = applySort(excedidosFiltrados, eSortKey, eSortDir)

  return (
    <section className="section-card">
      <div className="section-header">
        <h2 className="section-title">
          <span className="section-dot" style={{ background: COLOR_EXCEDIDO }} />Registro de excedidos y tolerancia
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {hayFiltros && (
            <button className="btn-clear-filters" onClick={resetFiltros} title="Limpiar filtros">
              ✕ Limpiar filtros
            </button>
          )}
          <button
            className="btn-export"
            onClick={() => exportarExcel(excedidosFiltrados)}
            disabled={excedidosFiltrados.length === 0}
          >
            📥 Exportar Excel
          </button>
        </div>
      </div>
      {listaExcedidos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <div className="empty-title">Sin excedidos aún</div>
          <div className="empty-sub">Todos los descansos están dentro del tiempo permitido</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>#</th>
                <ColFilterHeader label="Fecha"     values={eVals.fecha}    selected={feFecha}    onChange={setFeFecha}    sortDir={eSD('fecha')}     onSort={() => eSort('fecha')} />
                <ColFilterHeader label="Apellido"  values={eVals.apellido} selected={feApellido} onChange={setFeApellido} sortDir={eSD('apellido')}  onSort={() => eSort('apellido')} />
                <ColFilterHeader label="Nombre"    values={eVals.nombre}   selected={feNombre}   onChange={setFeNombre}   sortDir={eSD('nombre')}    onSort={() => eSort('nombre')} />
                <ColFilterHeader label="DNI"       values={eVals.dni}      selected={feDni}      onChange={setFeDni}      sortDir={eSD('dni')}       onSort={() => eSort('dni')} />
                <ColFilterHeader label="CUIL"      values={eVals.cuil}     selected={feCuil}     onChange={setFeCuil}     sortDir={eSD('cuil')}      onSort={() => eSort('cuil')} />
                <ColFilterHeader label="H. Salida" values={eVals.salida}   selected={feSalida}   onChange={setFeSalida}   sortDir={eSD('salida')}    onSort={() => eSort('salida')} />
                <ColFilterHeader label="H. Vuelta" values={eVals.vuelta}   selected={feVuelta}   onChange={setFeVuelta}   sortDir={eSD('vuelta')}    onSort={() => eSort('vuelta')} />
                <th className="th-sortable" onClick={() => eSort('duracion')}>
                  <span>Duración</span>
                  <span className={`th-sort-inline ${eSD('duracion') ? 'th-sort-active' : ''}`}>
                    {eSD('duracion') === 'asc' ? '↑' : eSD('duracion') === 'desc' ? '↓' : '⇅'}
                  </span>
                </th>
                <th>Se pasó</th>
                <ColFilterHeader label="Estado"    values={eVals.estado}   selected={feEstado}   onChange={setFeEstado}   sortDir={eSD('estado')}    onSort={() => eSort('estado')} />
              </tr>
            </thead>
            <tbody>
              {excedidosOrdenados.length === 0 ? (
                <tr><td colSpan={11} className="td-empty">Sin resultados para los filtros aplicados</td></tr>
              ) : excedidosOrdenados.map((h, i) => (
                <tr key={i} className={h.excedido ? 'tr-excedido' : 'tr-tolerancia'}>
                  <td className="td-num">{i + 1}</td>
                  <td>{formatFecha(h.vuelta)}</td>
                  <td className="fw600">{h.apellido}</td>
                  <td>{h.nombre}</td>
                  <td>{h.dni}</td>
                  <td>{h.cuil || '—'}</td>
                  <td>{fmt24(h.salida)}</td>
                  <td>{fmt24(h.vuelta)}</td>
                  <td className={h.excedido ? 'text-red fw600' : 'text-warn fw600'}>
                    {formatDuracionSegundos(h.segundosTomados)}
                  </td>
                  <td className={h.excedido ? 'text-red fw600' : 'text-warn fw600'}>
                    +{h.excedido
                      ? formatDuracionSegundos(h.segundosTomados - SEGS_LIMITE)
                      : formatDuracionSegundos(h.segundosTomados - SEGS_DESCANSO)}
                  </td>
                  <td>
                    {h.excedido
                      ? <span className="badge badge-exc">⚠️ Excedido</span>
                      : <span className="badge badge-tol">🟡 Tolerancia</span>}
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
