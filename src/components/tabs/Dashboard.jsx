import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts'
import KpiCard from '../KpiCard.jsx'
import TarjetaActivo from '../TarjetaActivo.jsx'
import CustomBarTooltip from '../CustomBarTooltip.jsx'
import { formatDuracionSegundos, getNombreCorto } from '../../utils/formatters.js'
import { buildDatosPorHora } from '../../utils/buildDatosPorHora.js'
import {
  MINUTOS_DESCANSO, MINUTOS_TOLERANCIA,
  SEGS_DESCANSO, SEGS_LIMITE,
  COLOR_PRIMARY, COLOR_OK, COLOR_TOLERANCIA, COLOR_EXCEDIDO, COLOR_WARN, COLOR_CRITICO,
  LIMITE_REINCIDENCIAS,
} from '../../constants/index.js'

export default function Dashboard({
  historial,
  activosArray,
  busquedaActivos,
  onBusquedaActivos,
}) {
  // ─── Métricas ───────────────────────────────────────────────────────────────
  const totalDescansos   = historial.length
  const excedidosCount   = historial.filter((h) => h.excedido).length
  const toleranciaCount  = historial.filter((h) => h.enTolerancia).length
  const okCount          = totalDescansos - excedidosCount - toleranciaCount
  const tiempoPromedioSegs = totalDescansos > 0
    ? Math.round(historial.reduce((a, h) => a + h.segundosTomados, 0) / totalDescansos)
    : 0

  // Pie
  const pieData = [
    { name: 'A tiempo',   value: okCount },
    { name: 'Tolerancia', value: toleranciaCount },
    { name: 'Excedido',   value: excedidosCount },
  ]

  // Bar — últimos 8 (en minutos para mejor legibilidad)
  const barData = [...historial].reverse().slice(-8).map((h) => ({
    nombre:       getNombreCorto(h),
    'Duración':   +(h.segundosTomados / 60).toFixed(1),
    'Límite':     MINUTOS_DESCANSO,
    'Tolerancia': MINUTOS_TOLERANCIA,
  }))

  // Line — correctos y excedidos por hora
  const datosPorHora = buildDatosPorHora(historial)

  // Lista excedidos para top 5
  const listaExcedidos = historial.filter((h) => h.excedido || h.enTolerancia)
    .sort((a, b) => b.segundosTomados - a.segundosTomados)
  const topExcedidos = listaExcedidos.slice(0, 5)

  // ─── Reincidentes ────────────────────────────────────────────────────────────
  const conteoExcesosPorDni = historial.reduce((acc, h) => {
    if (!h.excedido) return acc
    const key = String(h.dni)
    if (!acc[key]) acc[key] = { apellido: h.apellido, nombre: h.nombre, dni: h.dni, veces: 0 }
    acc[key].veces++
    return acc
  }, {})
  const reincidentes = Object.values(conteoExcesosPorDni)
    .filter(r => r.veces >= LIMITE_REINCIDENCIAS)
    .sort((a, b) => b.veces - a.veces)

  // Filtrar activos por búsqueda
  const filtrar = (lista, q) => {
    if (!q.trim()) return lista
    const t = q.toLowerCase().trim()
    return lista.filter((h) =>
      (h.apellido || '').toLowerCase().includes(t) ||
      (h.nombre   || '').toLowerCase().includes(t) ||
      String(h.dni).includes(t)
    )
  }
  const activosFiltrados = filtrar(activosArray, busquedaActivos)

  return (
    <>
      <div className="kpi-grid">
        <KpiCard icon="☕" label="Total descansos"   value={totalDescansos}  sub="en el día"                              color={COLOR_PRIMARY} />
        <KpiCard icon="✅" label="A tiempo"          value={okCount}         sub={`hasta ${MINUTOS_DESCANSO} min`}        color={COLOR_OK} />
        <KpiCard icon="🟡" label="En tolerancia"     value={toleranciaCount} sub={`hasta ${MINUTOS_DESCANSO + MINUTOS_TOLERANCIA} min`} color={COLOR_TOLERANCIA} />
        <KpiCard icon="⚠️" label="Excedidos"         value={excedidosCount}  sub={`más de ${MINUTOS_DESCANSO + MINUTOS_TOLERANCIA} min`} color={COLOR_EXCEDIDO} />
        <KpiCard icon="⏱"  label="Tiempo promedio"   value={formatDuracionSegundos(tiempoPromedioSegs)} sub="por descanso" color={COLOR_WARN} />
        <KpiCard icon="🧑" label="En descanso ahora" value={activosArray.length} sub="personas activas"                  color={COLOR_PRIMARY} />
        <KpiCard icon="🔴" label="Reincidentes"      value={reincidentes.length} sub={`≥${LIMITE_REINCIDENCIAS} excesos`} color={COLOR_CRITICO} />
      </div>

      {activosArray.length > 0 && (
        <section className="section-card">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-dot" style={{ background: COLOR_WARN }} />En descanso ahora
            </h2>
            <span className="section-badge" style={{ background: `${COLOR_WARN}22`, color: COLOR_WARN }}>
              {activosArray.length} persona{activosArray.length !== 1 ? 's' : ''}
            </span>
          </div>
          <input
            className="search-input"
            type="search"
            placeholder="Buscar por nombre, apellido o DNI..."
            value={busquedaActivos}
            onChange={(e) => onBusquedaActivos(e.target.value)}
          />
          <div className="activos-grid">
            {activosFiltrados.length === 0
              ? <div className="search-empty">Sin resultados para "{busquedaActivos}"</div>
              : activosFiltrados.map((p) => <TarjetaActivo key={p.dni} persona={p} />)
            }
          </div>
        </section>
      )}

      {totalDescansos > 0 && (
        <>
          {/* Pie + Bar */}
          <div className="charts-grid">
            <div className="section-card">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-dot" style={{ background: COLOR_PRIMARY }} />Distribución del día
                </h2>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                      paddingAngle={4} dataKey="value"
                      label={({ name, percent }) => percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                      labelLine={false}>
                      <Cell key="ok"  fill={COLOR_OK} />
                      <Cell key="tol" fill={COLOR_TOLERANCIA} />
                      <Cell key="exc" fill={COLOR_EXCEDIDO} />
                    </Pie>
                    <Tooltip formatter={(v) => [v, 'cantidad']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-legend">
                  <div className="pie-legend-item"><span style={{ background: COLOR_OK }} />A tiempo: <strong>{okCount}</strong></div>
                  <div className="pie-legend-item"><span style={{ background: COLOR_TOLERANCIA }} />Tolerancia: <strong>{toleranciaCount}</strong></div>
                  <div className="pie-legend-item"><span style={{ background: COLOR_EXCEDIDO }} />Excedidos: <strong>{excedidosCount}</strong></div>
                </div>
              </div>
            </div>

            <div className="section-card">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-dot" style={{ background: COLOR_PRIMARY }} />Últimos descansos (minutos)
                </h2>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barData} margin={{ top: 8, right: 16, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#6b7280' }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} unit=" min" />
                    <Tooltip content={<CustomBarTooltip />} formatter={(v) => [`${v} min`]} />
                    <Legend verticalAlign="top" height={28} iconSize={10} />
                    <Bar dataKey="Duración"   fill={COLOR_PRIMARY}    radius={[4,4,0,0]} />
                    <Bar dataKey="Límite"     fill={COLOR_OK}         radius={[4,4,0,0]} opacity={0.45} />
                    <Bar dataKey="Tolerancia" fill={COLOR_TOLERANCIA} radius={[4,4,0,0]} opacity={0.45} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Line chart por hora */}
          <div className="section-card">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-dot" style={{ background: COLOR_PRIMARY }} />Descansos por hora
              </h2>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={datosPorHora} margin={{ top: 8, right: 24, left: -10, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hora" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend verticalAlign="top" height={28} iconSize={10} />
                  <Line type="monotone" dataKey="correctos"  name="A tiempo"   stroke={COLOR_OK}         strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="tolerancia" name="Tolerancia" stroke={COLOR_TOLERANCIA} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="excedidos"  name="Excedidos"  stroke={COLOR_EXCEDIDO}   strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {topExcedidos.length > 0 && (
        <section className="section-card">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-dot" style={{ background: COLOR_EXCEDIDO }} />Mayores excedidos del día
            </h2>
          </div>
          <div className="rank-list">
            {topExcedidos.map((h, i) => (
              <div key={i} className="rank-item">
                <div className="rank-pos" style={{
                  background: i === 0 ? (h.excedido ? COLOR_EXCEDIDO : COLOR_TOLERANCIA) : (h.excedido ? '#fee2e2' : '#fef9c3'),
                  color: i === 0 ? '#fff' : (h.excedido ? COLOR_EXCEDIDO : COLOR_TOLERANCIA)
                }}>{i + 1}</div>
                <div className="rank-info">
                  <div className="rank-nombre">{h.apellido} {h.nombre}</div>
                  <div className="rank-dni">DNI {h.dni}</div>
                </div>
                <div className="rank-tiempo">
                  <div className={`rank-duracion ${h.excedido ? 'text-red' : 'text-warn'}`}>{formatDuracionSegundos(h.segundosTomados)}</div>
                  <div className="rank-extra">
                    {h.excedido
                      ? `+${formatDuracionSegundos(h.segundosTomados - SEGS_LIMITE)} sobre límite`
                      : `+${formatDuracionSegundos(h.segundosTomados - SEGS_DESCANSO)} en tolerancia`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {totalDescansos === 0 && activosArray.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">☕</div>
          <div className="empty-title">Sin registros aún</div>
          <div className="empty-sub">Escaneá el DNI de un empleado para comenzar</div>
        </div>
      )}

      {/* ── Reincidentes críticos ── */}
      {reincidentes.length > 0 && (
        <section className="section-card section-card-critico">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-dot" style={{ background: COLOR_CRITICO }} />
              🔴 Reincidentes críticos
            </h2>
            <span className="section-badge" style={{ background: `${COLOR_CRITICO}18`, color: COLOR_CRITICO }}>
              {reincidentes.length} persona{reincidentes.length !== 1 ? 's' : ''} — ≥{LIMITE_REINCIDENCIAS} excesos
            </span>
          </div>
          <div className="rank-list">
            {reincidentes.map((r) => (
              <div key={r.dni} className="rank-item rank-item-critico">
                <div className="rank-pos" style={{ background: COLOR_CRITICO, color: '#fff' }}>
                  {r.veces}×
                </div>
                <div className="rank-info">
                  <div className="rank-nombre" style={{ color: COLOR_CRITICO }}>{r.apellido} {r.nombre}</div>
                  <div className="rank-dni">DNI {r.dni}</div>
                </div>
                <div className="rank-tiempo">
                  <span className="badge badge-critico">⚠️ {r.veces} excesos</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
