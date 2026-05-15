'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Controls } from '@/components/Controls'
import { CoveragePanel } from '@/components/CoveragePanel'
import { ExportPanel } from '@/components/ExportPanel'
import { KpiCards } from '@/components/KpiCards'
import { loadWebData } from '@/lib/data'
import type { CoverageRow, IsochroneBand, MapBaseLayer, MapLayerVisibility, ScenarioId, WebData } from '@/lib/types'

const IsochroneMap = dynamic(() => import('@/components/IsochroneMap').then(m => m.IsochroneMap), { ssr: false })
const DEFAULT_VISIBLE_LAYERS: MapLayerVisibility = {
  isochrones: true,
  equipaments: false,
  espaisEntrades: false,
  espaisPolygons: false,
  aparcaments: false
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
        setScenario((d.scenarios[0]?.id || 'everyone') as ScenarioId)
        setDestination(d.destinations[0]?.nom || '')
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
  }, [])

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
    return <main className="app-page"><div className="cardish">Carregant prototip…</div></main>
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
          <h1 className="app-title">Cobertura poblacional</h1>
          <div className="app-subtitle">{data.config.projectLabel} · prototip web</div>
        </div>
        <div className="app-badge">Migració web v0.1</div>
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
        <section className="main-panel">
          <KpiCards rows={coverageRows} bandColors={data.config.bandColors} />
          <div className="map-card">
            <IsochroneMap
              config={data.config}
              isochrones={data.layers.isochrones}
              isochronesByCategory={data.layers.isochronesByCategory}
              equipaments={data.layers.equipaments}
              espaisEntrades={data.layers.espaisEntrades}
              espaisPolygons={data.layers.espaisPolygons}
              aparcaments={data.layers.aparcaments}
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
            />
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
