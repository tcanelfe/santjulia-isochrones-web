'use client'

import { useState } from 'react'
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
  const [linkCopied, setLinkCopied] = useState(false)
  const copyLink = async () => {
    if (typeof window === 'undefined') return
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // Clipboard API can fail on non-secure contexts; fall back to a prompt.
      window.prompt('Copia aquest enllaç:', window.location.href)
    }
  }
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
            PNG
          </a>
        ) : (
          <button type="button" className="export-button secondary" disabled title="Executa npm run export:png per generar els PNG oficials">
            PNG
          </button>
        )}
        <button type="button" className="export-button secondary" onClick={copyLink}>
          {linkCopied ? 'Copiat ✓' : 'Copia enllaç'}
        </button>
      </div>
      <p className="help-copy export-note">
        El CSV es genera al navegador. El PNG és el mapa cartogràfic oficial precomputat amb el pipeline R. L'enllaç conserva la vista seleccionada (escenari, destinació, capes).
      </p>
    </section>
  )
}
