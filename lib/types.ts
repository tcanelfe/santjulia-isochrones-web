import type { FeatureCollection } from 'geojson'

export type ScenarioId = 'everyone' | 'older_adults' | 'children_0_12'
export type IsochroneBand = 5 | 10 | 15
export type MapBaseLayer = 'light' | 'osm' | 'satellite'

export type MapLayerVisibility = {
  isochrones: boolean
  equipaments: boolean
  espaisEntrades: boolean
  espaisPolygons: boolean
  aparcaments: boolean
}

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
  banda_min: IsochroneBand
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

export type PopulationTotals = {
  persones: number
  dones: number
  homes: number
  infants_0_12: number
  joves: number
  adults: number
  gent_gran: number
}

export type ExportManifestItem = {
  scope: 'destination' | 'category'
  key: string
  scenario: ScenarioId
  href: string
}

export type WebData = {
  config: WebConfig
  scenarios: Scenario[]
  destinations: Destination[]
  coverageDestination: CoverageRow[]
  coverageCategory: CoverageRow[]
  populationTotals: PopulationTotals
  exportManifest: ExportManifestItem[]
  layers: {
    isochrones: FeatureCollection
    isochronesByCategory: FeatureCollection
    equipaments: FeatureCollection
    espaisEntrades: FeatureCollection
    espaisPolygons: FeatureCollection | null
    aparcaments: FeatureCollection | null
  }
}
