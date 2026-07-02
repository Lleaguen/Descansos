export default function CustomBarTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-title">{label}</div>
        {payload.map((p, i) => (
          <div key={i} className="chart-tooltip-row">
            <span style={{ color: p.color }}>●</span> {p.name}: <strong>{p.value}</strong>
          </div>
        ))}
      </div>
    )
  }
  return null
}
