import type { IsochroneBand, MapLayerVisibility } from '@/lib/types'

type Props = {
  bands: IsochroneBand[]
  visibleBands: IsochroneBand[]
  visibleLayers: MapLayerVisibility
  onToggleBand: (band: IsochroneBand) => void
  onToggleLayer: (layer: keyof MapLayerVisibility) => void
}

const layerLabels: Record<keyof MapLayerVisibility, string> = {
  isochrones: 'Isòcrones',
  equipaments: 'Equipaments',
  espaisEntrades: 'Entrades espais lliures',
  espaisPolygons: 'Polígons espais lliures',
  aparcaments: 'Aparcaments'
}

export function LayerControls({ bands, visibleBands, visibleLayers, onToggleBand, onToggleLayer }: Props) {
  return (
    <section className="cardish layers-panel">
      <div className="section-label">Capes del mapa</div>
      <div className="toggle-group">
        {(Object.keys(layerLabels) as Array<keyof MapLayerVisibility>).map(layer => (
          <label className="check-row" key={layer}>
            <input
              type="checkbox"
              checked={visibleLayers[layer]}
              onChange={() => onToggleLayer(layer)}
            />
            <span>{layerLabels[layer]}</span>
          </label>
        ))}
      </div>
      <div className="mini-divider" />
      <div className="section-label small-label">Temps d'accés</div>
      <div className="band-toggle-row">
        {bands.map(band => (
          <button
            key={band}
            type="button"
            className={visibleBands.includes(band) ? 'band-toggle active' : 'band-toggle'}
            onClick={() => onToggleBand(band)}
            aria-pressed={visibleBands.includes(band)}
          >
            {band} min
          </button>
        ))}
      </div>
    </section>
  )
}
