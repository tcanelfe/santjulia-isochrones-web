import { fmtInt, fmtPct } from '@/lib/data'
import type { CoverageRow } from '@/lib/types'

type Props = {
  rows: CoverageRow[]
  bandColors: Record<string, string>
}

export function KpiCards({ rows, bandColors }: Props) {
  const bands = [5, 10, 15] as const
  return (
    <div className="kpi-row">
      {bands.map(b => {
        const row = rows.find(r => r.banda_min === b)
        return (
          <div className="kpi-card" key={b} style={{ background: `linear-gradient(135deg, ${bandColors[String(b)]} 0%, ${bandColors[String(b)]}dd 100%)` }}>
            <div className="kpi-label">{b} minuts</div>
            <div className="kpi-value">{fmtInt(row?.value)}</div>
            <div className="kpi-meta">persones · {fmtPct(row?.percentatge)}</div>
          </div>
        )
      })}
    </div>
  )
}
