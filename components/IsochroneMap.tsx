'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl, { Map } from 'maplibre-gl'
import bbox from '@turf/bbox'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { ScenarioId, WebConfig } from '@/lib/types'

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
  onSelectDestination: (name: string) => void
}

function filterFeatures(fc: FeatureCollection, predicate: (f: Feature) => boolean): FeatureCollection {
  return { type: 'FeatureCollection', features: fc.features.filter(predicate) }
}

function emptyFc(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}

function destinationFilter(destination: string, category: string) {
  return (f: Feature) => {
    const p = f.properties || {}
    if (category !== 'TOTS' && destination === '_CAT_') return p.us === category
    return p.nom === destination
  }
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
  onSelectDestination
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
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
          positron: {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap © CARTO'
          }
        },
        layers: [{ id: 'positron', type: 'raster', source: 'positron' }]
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
          paint: { 'fill-color': config.colors.aparcaments, 'fill-opacity': 0.35, 'fill-outline-color': config.colors.aparcaments }
        })
      }
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

      for (const layerId of ['equipaments', 'espais-entrades', 'espais-polygons']) {
        if (!map.getLayer(layerId)) continue
        map.on('click', layerId, e => {
          const name = e.features?.[0]?.properties?.nom
          if (name) onSelectDestination(String(name))
        })
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
      }
      setMapReady(true)
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
    for (const b of [15, 10, 5]) {
      const bandData = filterFeatures(selectedIso, f => Number(f.properties?.banda_min) === b)
      const source = map.getSource(`iso-${b}`) as maplibregl.GeoJSONSource | undefined
      source?.setData(bandData)
    }
    const selectedPieces: Feature<Geometry>[] = []
    if (category !== 'TOTS' && destination === '_CAT_') {
      selectedPieces.push(...filterFeatures(equipaments, f => f.properties?.us === category).features as Feature<Geometry>[])
      selectedPieces.push(...filterFeatures(espaisEntrades, f => f.properties?.us === category).features as Feature<Geometry>[])
      if (espaisPolygons) selectedPieces.push(...filterFeatures(espaisPolygons, f => f.properties?.us === category || selectedIso.features.some(x => x.properties?.nom === f.properties?.nom)).features as Feature<Geometry>[])
    } else {
      selectedPieces.push(...filterFeatures(equipaments, f => f.properties?.nom === destination).features as Feature<Geometry>[])
      selectedPieces.push(...filterFeatures(espaisEntrades, f => f.properties?.nom === destination).features as Feature<Geometry>[])
      if (espaisPolygons) selectedPieces.push(...filterFeatures(espaisPolygons, f => f.properties?.nom === destination).features as Feature<Geometry>[])
    }
    const selectedFc: FeatureCollection = { type: 'FeatureCollection', features: selectedPieces }
    ;(map.getSource('selected') as maplibregl.GeoJSONSource | undefined)?.setData(selectedFc)
    if (selectedIso.features.length > 0) {
      const [minX, minY, maxX, maxY] = bbox(selectedIso)
      map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 40, duration: 550 })
    }
    setTimeout(() => map.resize(), 50)
  }, [category, destination, equipaments, espaisEntrades, espaisPolygons, isochrones, isochronesByCategory, scenario, mapReady])

  return <div ref={elRef} className="map-wrap"><div className="map-loading">Carregant mapa…</div></div>
}
