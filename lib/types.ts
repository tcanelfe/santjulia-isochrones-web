import type { FeatureCollection } from 'geojson'

export type ScenarioId = 'everyone' | 'older_adults' | 'children_0_12'

export type Scenario = {
  id: ScenarioId
  label: string
  note: string
  denominatorLabel: string
  denominator: number
}

export type Destination = {
  nom: string
  us: string
  tipus_desti: 'equipament' | 'espai_lliure'
  n_entrades?: number
}

export type CoverageRow = {
  scope: 'destination' | 'category'
  key: string
  nom?: string
  us?: string
  escenari: ScenarioId
  banda_min: 5 | 10 | 15
  persones: number
  dones: number
  homes: number
  infants_0_12: number
  joves: number
  adults: number
  gent_gran: number
  denominator: number
  value: number
  percentatge: number
}

export type WebConfig = {
  projectLabel: string
  version: string
  bands: number[]
  bandColors: Record<string, string>
  colors: {
    equipaments: string
    espais: string
    selected: string
    aparcaments: string
  }
}

export type WebData = {
  config: WebConfig
  scenarios: Scenario[]
  destinations: Destination[]
  coverageDestination: CoverageRow[]
  coverageCategory: CoverageRow[]
  layers: {
    isochrones: FeatureCollection
    isochronesByCategory: FeatureCollection
    equipaments: FeatureCollection
    espaisEntrades: FeatureCollection
    espaisPolygons: FeatureCollection | null
    aparcaments: FeatureCollection | null
  }
}
