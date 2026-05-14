import type { FeatureCollection } from 'geojson'
import type { CoverageRow, Destination, Scenario, WebConfig, WebData } from './types'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Could not load ${path}: ${res.status}`)
  return res.json() as Promise<T>
}

export async function loadWebData(): Promise<WebData> {
  const [
    config,
    scenarios,
    destinations,
    coverageDestination,
    coverageCategory,
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
    getJson<FeatureCollection>('/data/layers/isochrones.geojson'),
    getJson<FeatureCollection>('/data/layers/isochrones_by_category.geojson'),
    getJson<FeatureCollection>('/data/layers/equipaments.geojson'),
    getJson<FeatureCollection>('/data/layers/espais_entrades.geojson'),
    fetch('/data/layers/espais_polygons.geojson').then(r => r.ok ? r.json() : null),
    fetch('/data/layers/aparcaments.geojson').then(r => r.ok ? r.json() : null)
  ])

  return {
    config,
    scenarios,
    destinations,
    coverageDestination,
    coverageCategory,
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
