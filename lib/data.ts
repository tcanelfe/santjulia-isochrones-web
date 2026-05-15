import type { FeatureCollection } from 'geojson'
import type { CoverageRow, Destination, ExportManifestItem, PopulationTotals, Scenario, WebConfig, WebData } from './types'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Could not load ${path}: ${res.status}`)
  return res.json() as Promise<T>
}

async function getOptionalJson<T>(path: string, fallback: T): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) return fallback
  return res.json() as Promise<T>
}

export async function loadWebData(): Promise<WebData> {
  const [
    config,
    scenarios,
    destinations,
    coverageDestination,
    coverageCategory,
    populationTotalsMaybe,
    exportManifest,
    isochrones,
    isochronesByCategory,
    equipaments,
    espaisEntrades,
    espaisPolygonsMaybe,
    aparcamentsMaybe
  ] = await Promise.all([
    getJson<WebConfig>('/data/config.json'),
    getJson<Scenario[]>('/data/scenarios.json'),
    getJson<Destination[]>('/data/destinations.json'),
    getJson<CoverageRow[]>('/data/coverage_by_destination.json'),
    getJson<CoverageRow[]>('/data/coverage_by_category.json'),
    getOptionalJson<PopulationTotals | null>('/data/population_totals.json', null),
    getOptionalJson<ExportManifestItem[]>('/exports/manifest.json', []),
    getJson<FeatureCollection>('/data/layers/isochrones.geojson'),
    getJson<FeatureCollection>('/data/layers/isochrones_by_category.geojson'),
    getJson<FeatureCollection>('/data/layers/equipaments.geojson'),
    getJson<FeatureCollection>('/data/layers/espais_entrades.geojson'),
    fetch('/data/layers/espais_polygons.geojson').then(r => r.ok ? r.json() : null),
    fetch('/data/layers/aparcaments.geojson').then(r => r.ok ? r.json() : null)
  ])

  const everyone = scenarios.find(s => s.id === 'everyone')?.denominator || 0
  const children = scenarios.find(s => s.id === 'children_0_12')?.denominator || 0
  const older = scenarios.find(s => s.id === 'older_adults')?.denominator || 0
  const populationTotals: PopulationTotals = populationTotalsMaybe || {
    persones: everyone,
    dones: 0,
    homes: 0,
    infants_0_12: children,
    joves: 0,
    adults: 0,
    gent_gran: older
  }

  return {
    config,
    scenarios,
    destinations,
    coverageDestination,
    coverageCategory,
    populationTotals,
    exportManifest,
    layers: {
      isochrones,
      isochronesByCategory,
      equipaments,
      espaisEntrades,
      espaisPolygons: espaisPolygonsMaybe,
      aparcaments: aparcamentsMaybe
    }
  }
}

export function fmtInt(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('ca-AD')
}

export function fmtPct(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)}%`
}
