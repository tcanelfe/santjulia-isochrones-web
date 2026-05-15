import { fmtInt, fmtPct } from '@/lib/data'
import type { CoverageRow, IsochroneBand, ScenarioId } from '@/lib/types'

type Props = {
  title: string
  rows: CoverageRow[]
  scenario: ScenarioId
}

type TableMetric = {
  label: string
  field: keyof Pick<CoverageRow, 'persones' | 'dones' | 'homes' | 'infants_0_12' | 'joves' | 'adults' | 'gent_gran'>
}

const bands: IsochroneBand[] = [5, 10, 15]

const metricsByScenario: Record<ScenarioId, TableMetric[]> = {
  everyone: [
    { label: 'Persones', field: 'persones' },
    { label: '  Dones', field: 'dones' },
    { label: '  Homes', field: 'homes' },
    { label: 'Infants 0–12', field: 'infants_0_12' },
    { label: 'Joves 0–18', field: 'joves' },
    { label: 'Adults 18–65', field: 'adults' },
    { label: 'Gent gran 65+', field: 'gent_gran' }
  ],
  older_adults: [{ label: 'Gent gran 65+', field: 'gent_gran' }],
  children_0_12: [{ label: 'Infants 0–12 anys', field: 'infants_0_12' }]
}

function cellFor(rows: CoverageRow[], band: IsochroneBand, field: TableMetric['field']) {
  const row = rows.find(r => r.banda_min === band)
  const value = row?.[field]
  const pct = value !== undefined && row?.denominator ? value / row.denominator * 100 : undefined
  return `${fmtInt(value)} (${fmtPct(pct)})`
}

function splitCell(cell: string) {
  const match = cell.match(/^(.+) \((.+)\)$/)
  return match ? { value: match[1], pct: match[2] } : { value: cell, pct: '' }
}

export function CoveragePanel({ title, rows, scenario }: Props) {
  const metrics = metricsByScenario[scenario]
  return (
    <section className="cardish coverage-panel">
      <div className="section-label">Cobertura poblacional</div>
      <h3 className="coverage-title">{title}</h3>
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
          {metrics.map(metric => (
            <tr key={metric.field}>
              <td>{metric.label}</td>
              {bands.map(band => <td key={band}>{cellFor(rows, band, metric.field)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="coverage-cards">
        {metrics.map(metric => (
          <div className="coverage-card" key={metric.field}>
            <div className="coverage-card-title">{metric.label.trim()}</div>
            <div className="coverage-metrics">
              {bands.map(band => {
                const parsed = splitCell(cellFor(rows, band, metric.field))
                return (
                  <div className="coverage-metric" key={band}>
                    <div className="coverage-time">{band} min</div>
                    <div className="coverage-value">{parsed.value}</div>
                    <div className="coverage-pct">{parsed.pct}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
