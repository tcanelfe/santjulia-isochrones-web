import { fmtInt, fmtPct } from '@/lib/data'
import type { CoverageRow } from '@/lib/types'

type Props = {
  title: string
  rows: CoverageRow[]
}

export function CoveragePanel({ title, rows }: Props) {
  return (
    <section className="cardish coverage-panel">
      <div className="section-label">Cobertura poblacional</div>
      <h3 style={{ fontSize: 14, margin: '0 0 8px', fontWeight: 750 }}>{title}</h3>
      <table className="coverage-table">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>5 min</th>
            <th>10 min</th>
            <th>15 min</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Població</td>
            {[5, 10, 15].map(b => {
              const row = rows.find(r => r.banda_min === b)
              return <td key={b}>{fmtInt(row?.value)} ({fmtPct(row?.percentatge)})</td>
            })}
          </tr>
        </tbody>
      </table>
    </section>
  )
}
