'use client'

import { exportCoverageCsv, exportKey } from '@/lib/exports'
import type { CoverageRow, ExportManifestItem, PopulationTotals, Scenario } from '@/lib/types'

type Props = {
  rows: CoverageRow[]
  scenario: Scenario
  totals: PopulationTotals
  label: string
  scope: 'destination' | 'category'
  manifest: ExportManifestItem[]
}

export function ExportPanel({ rows, scenario, totals, label, scope, manifest }: Props) {
  const png = manifest.find(item => exportKey(item.scope, item.key, item.scenario) === exportKey(scope, label, scenario.id))
  return (
    <section className="cardish export-panel">
      <div className="section-label">Exportació</div>
      <div className="export-actions">
        <button
          type="button"
          className="export-button primary"
          onClick={() => exportCoverageCsv({ rows, scenario, totals, label })}
        >
          CSV
        </button>
        {png ? (
          <a className="export-button secondary" href={png.href} download>
            JPG
          </a>
        ) : (
          <button type="button" className="export-button secondary" disabled title="Executa npm run export:png per generar els mapes oficials">
            JPG
          </button>
        )}
      </div>
      <p className="help-copy export-note">
        L'exportació correspon a la vista seleccionada al mapa (escenari, destinació o categoria). El CSV es genera al navegador; el JPG és la imatge cartogràfica oficial precomputada amb el pipeline R (300 DPI).
      </p>
    </section>
  )
}
