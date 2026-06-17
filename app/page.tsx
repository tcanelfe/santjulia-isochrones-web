'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccessPanel } from '@/components/AccessPanel'
import { Controls } from '@/components/Controls'
import { CoveragePanel } from '@/components/CoveragePanel'
import { ExportPanel } from '@/components/ExportPanel'
import { KpiCards } from '@/components/KpiCards'
import { MapErrorBoundary } from '@/components/MapErrorBoundary'
import { loadWebData } from '@/lib/data'
import type { CoverageRow, IsochroneBand, MapBaseLayer, MapLayerVisibility, ScenarioId, WebData } from '@/lib/types'

const IsochroneMap = dynamic(() => import('@/components/IsochroneMap').then(m => m.IsochroneMap), { ssr: false })
const DEFAULT_VISIBLE_LAYERS: MapLayerVisibility = {
  isochrones: true,
  equipaments: false,
  espaisEntrades: false,
  espaisPolygons: false,
  aparcaments: false,
  busInterparroquial: false,
  busComunal: false
}

function activeCoverage(data: WebData, scenario: ScenarioId, category: string, destination: string): CoverageRow[] {
  if (category !== 'TOTS' && destination === '_CAT_') {
    return data.coverageCategory.filter(r => r.escenari === scenario && r.key === category)
  }
  return data.coverageDestination.filter(r => r.escenari === scenario && r.key === destination)
}

export default function Page() {
  const [data, setData] = useState<WebData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scenario, setScenario] = useState<ScenarioId>('everyone')
  const [destType, setDestType] = useState('TOTS')
  const [category, setCategory] = useState('TOTS')
  const [destination, setDestination] = useState('')
  const [visibleLayers, setVisibleLayers] = useState<MapLayerVisibility>(DEFAULT_VISIBLE_LAYERS)
  const [visibleBands, setVisibleBands] = useState<IsochroneBand[]>([5, 10, 15])
  const [baseLayer, setBaseLayer] = useState<MapBaseLayer>('light')

  useEffect(() => {
    loadWebData()
      .then(d => {
        setData(d)
        // Hydrate state from URL params if present, else fall back to defaults.
        // Validation happens against the loaded data so we never restore a
        // destination/scenario that has been removed since the link was shared.
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
        const validScenarios = new Set(d.scenarios.map(s => s.id))
        const urlScenario = params?.get('scenario')
        setScenario(urlScenario && validScenarios.has(urlScenario as ScenarioId)
          ? (urlScenario as ScenarioId)
          : ((d.scenarios[0]?.id || 'everyone') as ScenarioId))

        const urlDestType = params?.get('destType')
        if (urlDestType === 'equipament' || urlDestType === 'espai_lliure' || urlDestType === 'bus_interparroquial' || urlDestType === 'TOTS') {
          setDestType(urlDestType)
        }

        const urlCategory = params?.get('category') || 'TOTS'
        const allCategories = new Set(d.destinations.map(x => x.us))
        if (urlCategory === 'TOTS' || allCategories.has(urlCategory)) setCategory(urlCategory)

        const urlDest = params?.get('dest')
        const validDestNames = new Set(d.destinations.map(x => x.nom))
        if (urlDest === '_CAT_' && urlCategory !== 'TOTS') {
          setDestination('_CAT_')
        } else if (urlDest && validDestNames.has(urlDest)) {
          setDestination(urlDest)
        } else {
          setDestination(d.destinations[0]?.nom || '')
        }

        const urlBase = params?.get('base')
        if (urlBase === 'light' || urlBase === 'osm' || urlBase === 'satellite') setBaseLayer(urlBase)

        const urlBands = params?.get('bands')
        if (urlBands) {
          const parsed = urlBands.split(',').map(Number).filter(n => n === 5 || n === 10 || n === 15) as IsochroneBand[]
          if (parsed.length > 0) setVisibleBands(parsed.sort((a, b) => a - b))
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  // Mirror state to the URL so any view can be copy-pasted as a permalink.
  // Uses replaceState (not pushState) so the browser back button keeps its
  // usual semantics rather than scrolling through every filter tweak.
  useEffect(() => {
    if (!data || !destination || typeof window === 'undefined') return
    const params = new URLSearchParams()
    if (scenario !== 'everyone') params.set('scenario', scenario)
    if (destType !== 'TOTS') params.set('destType', destType)
    if (category !== 'TOTS') params.set('category', category)
    if (destination) params.set('dest', destination)
    if (baseLayer !== 'light') params.set('base', baseLayer)
    const bandsKey = visibleBands.join(',')
    if (bandsKey !== '5,10,15') params.set('bands', bandsKey)
    const qs = params.toString()
    const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}`
    if (nextUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, '', nextUrl)
    }
  }, [data, scenario, destType, category, destination, baseLayer, visibleBands])

  const filteredDests = useMemo(() => {
    if (!data) return []
    return data.destinations.filter(d =>
      (destType === 'TOTS' || d.tipus_desti === destType) &&
      (category === 'TOTS' || d.us === category)
    )
  }, [category, data, destType])

  useEffect(() => {
    if (!data) return
    if (category !== 'TOTS') {
      if (destination === '' || !filteredDests.some(d => d.nom === destination)) setDestination('_CAT_')
    } else if (!filteredDests.some(d => d.nom === destination)) {
      setDestination(filteredDests[0]?.nom || '')
    }
  }, [category, data, destination, filteredDests])

  // Stable handler refs — inline arrows would change identity every render,
  // churning the MapLibre mount effect (map.remove() + rebuild). Must be
  // declared before any early return so hook order stays constant.
  const handleDestType = useCallback((v: string) => { setDestType(v); setCategory('TOTS') }, [])
  const handleSelectDestination = useCallback((name: string) => { setCategory('TOTS'); setDestination(name) }, [])
  const handleToggleLayer = useCallback((layer: keyof MapLayerVisibility) => {
    setVisibleLayers(prev => ({ ...prev, [layer]: !prev[layer] }))
  }, [])
  const handleToggleBand = useCallback((band: IsochroneBand) => {
    setVisibleBands(prev => {
      const next = prev.includes(band) ? prev.filter(b => b !== band) : [...prev, band]
      return next.sort((a, b) => a - b)
    })
  }, [])

  if (error) {
    return <main className="app-page"><div className="cardish">No s'han pogut carregar les dades web: {error}<br />Executa primer <code>npm run export:data</code> quan R estigui disponible.</div></main>
  }
  if (!data || !destination) {
    return <main className="app-page"><div className="cardish">Carregant mapa…</div></main>
  }

  const coverageRows = activeCoverage(data, scenario, category, destination)
  const selectedScenario = data.scenarios.find(s => s.id === scenario) || data.scenarios[0]
  const exportScope = category !== 'TOTS' && destination === '_CAT_' ? 'category' : 'destination'
  const exportLabel = exportScope === 'category' ? category : destination
  const coverageTitle = exportScope === 'category'
    ? `Cobertura: ${category} (unió)`
    : 'Cobertura poblacional'

  return (
    <main className="app-page">
      <header className="app-header">
        <div>
          <h1 className="app-title">Accessibilitat peatonal a equipaments parroquial</h1>
          <div className="app-subtitle">Sant Julià de Lòria</div>
        </div>
        {data.config.dataVintage && (
          <div className="app-badge">Dades {data.config.dataVintage}</div>
        )}
      </header>
      <div className="app-shell">
        <Controls
          scenarios={data.scenarios}
          destinations={data.destinations}
          scenario={scenario}
          destType={destType}
          category={category}
          destination={destination}
          onScenario={setScenario}
          onDestType={handleDestType}
          onCategory={setCategory}
          onDestination={setDestination}
        />
        <CoveragePanel title={coverageTitle} rows={coverageRows} scenario={scenario} />
        {exportScope === 'destination' && (
          <AccessPanel
            rows={data.coverageAccess}
            scenario={scenario}
            scenarioLabel={selectedScenario?.label || ''}
            destination={destination}
          />
        )}
        <section className="main-panel">
          <KpiCards rows={coverageRows} bandColors={data.config.bandColors} />
          <div className="map-card">
            <MapErrorBoundary>
              <IsochroneMap
                config={data.config}
                isochrones={data.layers.isochrones}
                isochronesByCategory={data.layers.isochronesByCategory}
                equipaments={data.layers.equipaments}
                espaisEntrades={data.layers.espaisEntrades}
                espaisPolygons={data.layers.espaisPolygons}
                aparcaments={data.layers.aparcaments}
                busInterparroquial={data.layers.busInterparroquial}
                busComunal={data.layers.busComunal}
                scenario={scenario}
                destination={destination}
                category={category}
                visibleBands={visibleBands}
                visibleLayers={visibleLayers}
                baseLayer={baseLayer}
                onBaseLayer={setBaseLayer}
                onToggleBand={handleToggleBand}
                onToggleLayer={handleToggleLayer}
                onSelectDestination={handleSelectDestination}
                coverageRows={coverageRows}
                selectedLabel={exportLabel}
              />
            </MapErrorBoundary>
          </div>
        </section>
        <ExportPanel
          rows={coverageRows}
          scenario={selectedScenario}
          totals={data.populationTotals}
          label={exportLabel}
          scope={exportScope}
          manifest={data.exportManifest}
        />
        <section className="cardish help-copy help-panel">
          <div className="section-label">Com llegir el mapa</div>
          <strong>Zones blaves</strong>: isòcrones de 5, 10 i 15 minuts. El blau fosc és més proper.<br />
          <span className="legend-dot" style={{ background: data.config.colors.equipaments }} />Equipament&nbsp;&nbsp;
          <span className="legend-dot" style={{ background: data.config.colors.espais, borderRadius: 2 }} />Espai lliure&nbsp;&nbsp;
          <span className="legend-dot" style={{ background: data.config.colors.aparcaments, borderRadius: 2 }} />Aparcament<br /><br />
          <strong>Escenaris</strong><br />
          {data.scenarios.map(s => <span key={s.id}>{s.label}: {s.note}.<br /></span>)}
          <br />
          <span style={{ color: '#667685' }}>Cens: {data.scenarios[0] ? data.scenarios[0].denominator.toLocaleString('ca-AD') : '—'} persones · 0–12: {data.scenarios.find(s => s.id === 'children_0_12')?.denominator.toLocaleString('ca-AD') || '—'} · 65+: {data.scenarios.find(s => s.id === 'older_adults')?.denominator.toLocaleString('ca-AD') || '—'}</span>
          <p className="method-note">Les isòcrones representen accessibilitat potencial a peu segons la xarxa i els supòsits de velocitat; no incorporen condicions reals de seguretat, confort o estat del carrer.</p>
          <div className="logo-strip">
            <img src="/logos/logo_carlemany.png" alt="Universitat Carlemany" />
            <img src="/logos/logo_santjulia.png" alt="Sant Julià de Lòria" />
            <img src="/logos/solarc.png" alt="Solarc" />
          </div>
        </section>
      </div>
    </main>
  )
}
