import { fmtInt } from '@/lib/data'
import type { AccessRow, ScenarioId } from '@/lib/types'

type Props = {
  rows: AccessRow[]
  scenario: ScenarioId
  scenarioLabel: string
  destination: string
}

// 5-minute access summary for the selected destination, for the active
// population scenario: parkings (and their spaces) and comunal-bus stops
// reachable within a 5-minute walk. Mirrors the report's per-fitxa table.
export function AccessPanel({ rows, scenario, scenarioLabel, destination }: Props) {
  const row = rows.find(r => r.key === destination && r.escenari === scenario)
  if (!row) return null
  return (
    <section className="cardish access-panel">
      <div className="section-label">Accés en 5 min a peu · {scenarioLabel}</div>
      <div className="access-grid">
        <div className="access-item">
          <span className="access-num">{fmtInt(row.aparcaments)}</span>
          <span className="access-lab">aparcaments<br />({fmtInt(row.places)} places)</span>
        </div>
        <div className="access-item">
          <span className="access-num">{fmtInt(row.bus_comunal)}</span>
          <span className="access-lab">parades de<br />bus comunal</span>
        </div>
      </div>
    </section>
  )
}
