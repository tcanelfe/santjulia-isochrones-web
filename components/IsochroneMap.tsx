'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl, { Map } from 'maplibre-gl'
import bbox from '@turf/bbox'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { CoverageRow, IsochroneBand, MapBaseLayer, MapLayerVisibility, ScenarioId, WebConfig } from '@/lib/types'

type Props = {
  config: WebConfig
  isochrones: FeatureCollection
  isochronesByCategory: FeatureCollection
  equipaments: FeatureCollection
  espaisEntrades: FeatureCollection
  espaisPolygons: FeatureCollection | null
  aparcaments: FeatureCollection | null
  scenario: ScenarioId
  destination: string
  category: string
  visibleBands: IsochroneBand[]
  visibleLayers: MapLayerVisibility
  baseLayer: MapBaseLayer
  onBaseLayer: (layer: MapBaseLayer) => void
  onToggleBand: (band: IsochroneBand) => void
  onToggleLayer: (layer: keyof MapLayerVisibility) => void
  onSelectDestination: (name: string) => void
  coverageRows: CoverageRow[]
  selectedLabel: string
}

function filterFeatures(fc: FeatureCollection, predicate: (f: Feature) => boolean): FeatureCollection {
  return { type: 'FeatureCollection', features: fc.features.filter(predicate) }
}

function emptyFc(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function propString(f: Feature, ...keys: string[]): string | undefined {
  const p = f.properties || {}
  for (const key of keys) {
    const value = p[key]
    if (value !== undefined && value !== null) return String(value)
  }
}

function featureName(f: Feature): string | undefined {
  return propString(f, 'nom', 'Nom', 'name', 'Name', 'Tipologia', 'tipus', 'type')
}

function featureCategory(f: Feature): string | undefined {
  return propString(f, 'us', 'Us')
}

function destinationFilter(destination: string, category: string) {
  return (f: Feature) => {
    if (category !== 'TOTS' && destination === '_CAT_') return featureCategory(f) === category
    return featureName(f) === destination
  }
}

function safeFitBounds(map: Map, fc: FeatureCollection) {
  if (fc.features.length === 0) return
  map.resize()
  const canvas = map.getCanvas()
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (width < 120 || height < 120) return

  const [minX, minY, maxX, maxY] = bbox(fc)
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return
  if (minX === maxX || minY === maxY) return

  const padding = Math.max(12, Math.min(40, Math.floor(Math.min(width, height) * 0.08)))
  map.fitBounds([[minX, minY], [maxX, maxY]], { padding, duration: 550 })
}

export function IsochroneMap({
  config,
  isochrones,
  isochronesByCategory,
  equipaments,
  espaisEntrades,
  espaisPolygons,
  aparcaments,
  scenario,
  destination,
  category,
  visibleBands,
  visibleLayers,
  baseLayer,
  onBaseLayer,
  onToggleBand,
  onToggleLayer,
  onSelectDestination,
  coverageRows,
  selectedLabel
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
  // Latest coverage + label, kept in a ref so the iso-band click handler
  // (registered once on map load) reads current values without re-binding.
  const coverageRef = useRef<{ rows: CoverageRow[]; label: string }>({ rows: coverageRows, label: selectedLabel })
  useEffect(() => { coverageRef.current = { rows: coverageRows, label: selectedLabel } }, [coverageRows, selectedLabel])
  // Flips true once the map's 'load' event has created all sources/layers.
  // The data-sync effect gates on this instead of map.loaded() — otherwise
  // it races the async load on mount and never re-fires.
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: elRef.current,
      style: {
        version: 8,
        sources: {
          light: {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap © CARTO'
          },
          osm: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap © CARTO'
          },
          satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          }
        },
        layers: [
          { id: 'base-light', type: 'raster', source: 'light' },
          { id: 'base-osm', type: 'raster', source: 'osm', layout: { visibility: 'none' } },
          { id: 'base-satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } }
        ]
      },
      center: [1.491, 42.464],
      zoom: 14,
      attributionControl: {}
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

    map.on('load', () => {
      for (const b of [15, 10, 5]) {
        map.addSource(`iso-${b}`, { type: 'geojson', data: emptyFc() })
        map.addLayer({
          id: `iso-${b}`,
          type: 'fill',
          source: `iso-${b}`,
          paint: {
            'fill-color': config.bandColors[String(b)],
            'fill-opacity': 0.58,
            'fill-outline-color': '#ffffff'
          }
        })
      }
      if (espaisPolygons) {
        map.addSource('espais-polygons', { type: 'geojson', data: espaisPolygons })
        map.addLayer({
          id: 'espais-polygons',
          type: 'fill',
          source: 'espais-polygons',
          paint: { 'fill-color': config.colors.espais, 'fill-opacity': 0.22, 'fill-outline-color': config.colors.espais }
        })
      }
      if (aparcaments) {
        map.addSource('aparcaments', { type: 'geojson', data: aparcaments })
        map.addLayer({
          id: 'aparcaments',
          type: 'fill',
          source: 'aparcaments',
          paint: { 'fill-color': config.colors.aparcaments, 'fill-opacity': 0.48, 'fill-outline-color': config.colors.aparcaments }
        })
        map.addLayer({
          id: 'aparcaments-line',
          type: 'line',
          source: 'aparcaments',
          paint: { 'line-color': config.colors.aparcaments, 'line-width': 2.2, 'line-opacity': 0.9 }
        })
      }
      map.addSource('equipaments', { type: 'geojson', data: equipaments })
      map.addLayer({
        id: 'equipaments',
        type: 'circle',
        source: 'equipaments',
        paint: {
          'circle-radius': 5,
          'circle-color': config.colors.equipaments,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1
        }
      })
      map.addSource('espais-entrades', { type: 'geojson', data: espaisEntrades })
      map.addLayer({
        id: 'espais-entrades',
        type: 'circle',
        source: 'espais-entrades',
        paint: {
          'circle-radius': 4,
          'circle-color': config.colors.espais,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1
        }
      })
      map.addSource('selected', { type: 'geojson', data: emptyFc() })
      map.addLayer({
        id: 'selected-fill',
        type: 'fill',
        source: 'selected',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': config.colors.selected, 'fill-opacity': 0.45, 'fill-outline-color': '#000000' }
      })
      map.addLayer({
        id: 'selected-point',
        type: 'circle',
        source: 'selected',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 8, 'circle-color': config.colors.selected, 'circle-stroke-color': '#000000', 'circle-stroke-width': 1.5 }
      })
      map.addLayer({
        id: 'selected-label',
        type: 'symbol',
        source: 'selected',
        layout: {
          'text-field': ['coalesce', ['get', 'nom'], ['get', 'Nom'], ['get', 'name'], ['get', 'Name'], 'Seleccionat'],
          'text-size': 12,
          'text-anchor': 'top',
          'text-offset': [0, 1.2],
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#17212b',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5
        }
      })

      for (const layerId of ['equipaments', 'espais-entrades', 'espais-polygons', 'aparcaments']) {
        if (!map.getLayer(layerId)) continue
        map.on('click', layerId, e => {
          const feature = e.features?.[0]
          const name = feature ? featureName(feature) : undefined
          const label = name || (layerId === 'aparcaments' ? 'Aparcament' : undefined)
          if (!label) return
          new maplibregl.Popup({ closeButton: false, closeOnClick: true, offset: 8 })
            .setLngLat(e.lngLat)
            .setText(label)
            .addTo(map)
          if (layerId !== 'aparcaments' && name) onSelectDestination(name)
        })
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
      }

      // Click on an isochrone band → popup with coverage for that band.
      for (const b of [5, 10, 15] as IsochroneBand[]) {
        const layerId = `iso-${b}`
        map.on('click', layerId, e => {
          const { rows, label } = coverageRef.current
          const row = rows.find(r => r.banda_min === b)
          if (!row) return
          const value = Number(row.value || 0)
          const pct = Number.isFinite(row.percentatge) ? row.percentatge.toFixed(1) : '—'
          const html = `
            <div class="map-popup">
              <div class="map-popup-title">${escapeHtml(label)}</div>
              <div class="map-popup-band">${b} min a peu</div>
              <div class="map-popup-stat"><strong>${value.toLocaleString('ca-AD')}</strong> persones</div>
              <div class="map-popup-pct">${pct}% de l'univers seleccionat</div>
            </div>`
          new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 4, maxWidth: '240px' })
            .setLngLat(e.lngLat)
            .setHTML(html)
            .addTo(map)
        })
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
      }
      requestAnimationFrame(() => {
        map.resize()
        setMapReady(true)
      })
    })
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; setMapReady(false) }
  }, [aparcaments, config, equipaments, espaisEntrades, espaisPolygons, onSelectDestination])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const pred = destinationFilter(destination, category)
    const isoSource = category !== 'TOTS' && destination === '_CAT_' ? isochronesByCategory : isochrones
    const selectedIso = filterFeatures(isoSource, f => f.properties?.escenari === scenario && pred(f))
    const selectedVisibleIso = filterFeatures(selectedIso, f => visibleBands.includes(Number(f.properties?.banda_min) as IsochroneBand))
    for (const b of [15, 10, 5] as IsochroneBand[]) {
      const bandData = visibleLayers.isochrones && visibleBands.includes(b)
        ? filterFeatures(selectedIso, f => Number(f.properties?.banda_min) === b)
        : emptyFc()
      const source = map.getSource(`iso-${b}`) as maplibregl.GeoJSONSource | undefined
      source?.setData(bandData)
    }

    const selectedPieces: Feature<Geometry>[] = []
    if (category !== 'TOTS' && destination === '_CAT_') {
      selectedPieces.push(...filterFeatures(equipaments, f => featureCategory(f) === category).features as Feature<Geometry>[])
      if (espaisPolygons) selectedPieces.push(...filterFeatures(espaisPolygons, f => featureCategory(f) === category || selectedIso.features.some(x => featureName(x) === featureName(f))).features as Feature<Geometry>[])
      if (!espaisPolygons) selectedPieces.push(...filterFeatures(espaisEntrades, f => featureCategory(f) === category).features as Feature<Geometry>[])
    } else {
      selectedPieces.push(...filterFeatures(equipaments, f => featureName(f) === destination).features as Feature<Geometry>[])
      if (espaisPolygons) selectedPieces.push(...filterFeatures(espaisPolygons, f => featureName(f) === destination).features as Feature<Geometry>[])
      if (!espaisPolygons) selectedPieces.push(...filterFeatures(espaisEntrades, f => featureName(f) === destination).features as Feature<Geometry>[])
    }
    const selectedFc: FeatureCollection = { type: 'FeatureCollection', features: selectedPieces }
    ;(map.getSource('selected') as maplibregl.GeoJSONSource | undefined)?.setData(selectedFc)

    map.setLayoutProperty('base-light', 'visibility', baseLayer === 'light' ? 'visible' : 'none')
    map.setLayoutProperty('base-osm', 'visibility', baseLayer === 'osm' ? 'visible' : 'none')
    map.setLayoutProperty('base-satellite', 'visibility', baseLayer === 'satellite' ? 'visible' : 'none')

    map.setLayoutProperty('equipaments', 'visibility', visibleLayers.equipaments ? 'visible' : 'none')
    map.setLayoutProperty('espais-entrades', 'visibility', 'none')
    if (map.getLayer('espais-polygons')) map.setLayoutProperty('espais-polygons', 'visibility', visibleLayers.espaisPolygons ? 'visible' : 'none')
    if (map.getLayer('aparcaments')) map.setLayoutProperty('aparcaments', 'visibility', visibleLayers.aparcaments ? 'visible' : 'none')
    if (map.getLayer('aparcaments-line')) map.setLayoutProperty('aparcaments-line', 'visibility', visibleLayers.aparcaments ? 'visible' : 'none')

    for (const layerId of ['espais-polygons', 'aparcaments', 'aparcaments-line', 'equipaments', 'selected-fill', 'selected-point', 'selected-label']) {
      if (map.getLayer(layerId)) map.moveLayer(layerId)
    }

    requestAnimationFrame(() => safeFitBounds(map, selectedVisibleIso))
  }, [baseLayer, category, destination, equipaments, espaisEntrades, espaisPolygons, isochrones, isochronesByCategory, scenario, visibleBands, visibleLayers, mapReady])

  const visibleDestinationLegend = [
    visibleLayers.equipaments && ['Equipaments', config.colors.equipaments, 'circle'],
    visibleLayers.espaisPolygons && ['Espais lliures', config.colors.espais, 'square'],
    visibleLayers.aparcaments && ['Aparcaments', config.colors.aparcaments, 'square']
  ].filter(Boolean) as string[][]

  return (
    <div className="map-wrap">
      <div ref={elRef} className="map-canvas"><div className="map-loading">Carregant mapa…</div></div>
      <div className="map-floating-control map-layer-control" aria-label="Capes del mapa">
        <div className="map-control-title">Mapa base</div>
        <div className="map-base-row">
          {([
            ['light', 'Clar'],
            ['osm', 'Carrer'],
            ['satellite', 'Satèl·lit']
          ] as Array<[MapBaseLayer, string]>).map(([id, label]) => (
            <button key={id} type="button" className={baseLayer === id ? 'mini-toggle active' : 'mini-toggle'} onClick={() => onBaseLayer(id)}>{label}</button>
          ))}
        </div>
        <div className="mini-divider" />
        <div className="map-control-title">Capes</div>
        {([
          ['isochrones', 'Isòcrones'],
          ['equipaments', 'Equipaments'],
          ['espaisPolygons', 'Espais lliures'],
          ['aparcaments', 'Aparcaments']
        ] as Array<[keyof MapLayerVisibility, string]>).map(([id, label]) => (
          <label className="map-check-row" key={id}>
            <input type="checkbox" checked={visibleLayers[id]} onChange={() => onToggleLayer(id)} />
            <span>{label}</span>
          </label>
        ))}
        <div className="mini-divider" />
        <div className="map-band-row">
          {([5, 10, 15] as IsochroneBand[]).map(band => (
            <button key={band} type="button" className={visibleBands.includes(band) ? 'mini-toggle active' : 'mini-toggle'} onClick={() => onToggleBand(band)}>{band}'</button>
          ))}
        </div>
      </div>
      <div className="map-floating-control map-legend">
        <div className="map-control-title">Temps a peu</div>
        {([5, 10, 15] as IsochroneBand[]).map(band => (
          <div className="legend-row" key={band}>
            <span className="legend-swatch square" style={{ background: config.bandColors[String(band)] }} />{band} min
          </div>
        ))}
        {visibleDestinationLegend.length > 0 && <div className="mini-divider" />}
        {visibleDestinationLegend.map(([label, color, shape]) => (
          <div className="legend-row" key={label}>
            <span className={`legend-swatch ${shape}`} style={{ background: color }} />{label}
          </div>
        ))}
      </div>
    </div>
  )
}
