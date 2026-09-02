'use client'

export type SpendPieSlice = {
  key: string
  label: string
  value: number
  color: string
}

const polar = (cx: number, cy: number, r: number, angle: number) => {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

const describeSlice = (
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string => {
  const start = polar(cx, cy, r, endAngle)
  const end = polar(cx, cy, r, startAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`
}

type SpendPieChartProps = {
  slices: SpendPieSlice[]
  totalLabel: string
  emptyLabel?: string
}

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const SpendPieChart = ({
  slices,
  totalLabel,
  emptyLabel = 'No Studio spend this month yet.',
}: SpendPieChartProps) => {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const size = 196
  const cx = size / 2
  const cy = size / 2
  const r = 78

  if (total <= 0 || slices.length === 0) {
    return (
      <div className="spend-pie spend-pie-empty">
        <p className="page-lede">{emptyLabel}</p>
      </div>
    )
  }

  let angle = 0
  const paths =
    slices.length === 1
      ? [
          {
            ...slices[0],
            d: `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`,
            pct: 100,
          },
        ]
      : slices.map((slice) => {
          const sweep = (slice.value / total) * 360
          const start = angle
          const end = angle + sweep
          angle = end
          return {
            ...slice,
            d: describeSlice(cx, cy, r, start, end),
            pct: (slice.value / total) * 100,
          }
        })

  return (
    <div className="spend-pie">
      <div className="spend-pie-visual">
        <svg
          className="spend-pie-svg"
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Studio project spend this month, total ${totalLabel}`}
        >
          {paths.map((slice) => (
            <path key={slice.key} d={slice.d} fill={slice.color}>
              <title>
                {slice.label}: {gbp.format(slice.value)} ({slice.pct.toFixed(1)}%)
              </title>
            </path>
          ))}
          <circle cx={cx} cy={cy} r={44} fill="var(--sw-surface-2)" />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="spend-pie-center-value"
            fill="currentColor"
          >
            {totalLabel}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="spend-pie-center-caption"
            fill="currentColor"
          >
            this month
          </text>
        </svg>
      </div>
      <ul className="spend-pie-legend">
        {paths.map((slice) => (
          <li key={slice.key} className="spend-pie-legend-item">
            <span className="spend-pie-swatch" style={{ background: slice.color }} aria-hidden />
            <span className="spend-pie-legend-copy">
              <strong className="spend-pie-legend-label">{slice.label}</strong>
              <span className="spend-pie-legend-meta tabular-nums">
                {slice.pct.toFixed(0)}% · {gbp.format(slice.value)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const SPEND_PIE_COLORS = [
  '#4c8dff',
  '#6ba0ff',
  '#54d68a',
  '#e8a85c',
  '#c084fc',
  '#e5646c',
  '#5eead4',
  '#f0b429',
] as const
