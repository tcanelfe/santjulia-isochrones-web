import type { CoverageRow, IsochroneBand, PopulationTotals, Scenario, ScenarioId } from './types'

const SPEED_KMH: Record<ScenarioId, number> = {
  everyone: 5,
  older_adults: 3.5,
  children_0_12: 3.7
}

type CsvCategory = {
  categoria: string
  col: keyof Pick<CoverageRow, 'persones' | 'dones' | 'homes' | 'infants_0_12' | 'joves' | 'adults' | 'gent_gran'>
  den: number
}

function csvEscape(value: string | number | undefined): string {
  const s = value === undefined || value === null ? '' : String(value)
  return /[",\n;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function safeSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'export'
}

function rowForBand(rows: CoverageRow[], band: IsochroneBand): CoverageRow | undefined {
  return rows.find(r => r.banda_min === band)
}

function categoriesForScenario(scenario: ScenarioId, totals: PopulationTotals): CsvCategory[] {
  if (scenario === 'older_adults') {
    return [{ categoria: 'Gent gran 65+', col: 'gent_gran', den: totals.gent_gran }]
  }
  if (scenario === 'children_0_12') {
    return [{ categoria: 'Infants 0-12 anys', col: 'infants_0_12', den: totals.infants_0_12 }]
  }
  return [
    { categoria: 'Persones', col: 'persones', den: totals.persones },
    { categoria: 'Dones', col: 'dones', den: totals.dones },
    { categoria: 'Homes', col: 'homes', den: totals.homes },
    { categoria: 'Infants 0-12', col: 'infants_0_12', den: totals.infants_0_12 },
    { categoria: 'Joves 0-18', col: 'joves', den: totals.joves },
    { categoria: 'Adults 18-65', col: 'adults', den: totals.adults },
    { categoria: 'Gent gran 65+', col: 'gent_gran', den: totals.gent_gran }
  ]
}

export function exportCoverageCsv(args: {
  rows: CoverageRow[]
  scenario: Scenario
  totals: PopulationTotals
  label: string
}) {
  const { rows, scenario, totals, label } = args
  const categories = categoriesForScenario(scenario.id, totals)
  const outRows = categories.flatMap(cat => ([5, 10, 15] as IsochroneBand[]).map(band => {
    const row = rowForBand(rows, band)
    const persones = row ? Number(row[cat.col] || 0) : 0
    const percentatge = cat.den > 0 ? Number((persones / cat.den * 100).toFixed(1)) : ''
    return {
      equipament: label,
      escenari: scenario.label,
      velocitat_kmh: SPEED_KMH[scenario.id],
      data_export: new Date().toISOString().slice(0, 10),
      categoria: cat.categoria,
      banda_min: band,
      persones,
      percentatge,
      denominador: cat.den
    }
  }))

  const headers = ['equipament', 'escenari', 'velocitat_kmh', 'data_export', 'categoria', 'banda_min', 'persones', 'percentatge', 'denominador']
  const csv = [
    headers.join(','),
    ...outRows.map(row => headers.map(h => csvEscape(row[h as keyof typeof row])).join(','))
  ].join('\n')
  downloadText(`${safeSlug(label)}_cobertura.csv`, `${csv}\n`, 'text/csv;charset=utf-8')
}

export function exportKey(scope: 'destination' | 'category', key: string, scenario: ScenarioId): string {
  return `${scope}::${scenario}::${key}`
}
