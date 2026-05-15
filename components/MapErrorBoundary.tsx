'use client'

import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class MapErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Surface to the browser console for support diagnostics. We deliberately
    // do not send to a third-party logger here — keep it GDPR-friendly.
    if (typeof console !== 'undefined') console.error('Map error:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="map-error">
          <strong>No s'ha pogut carregar el mapa.</strong>
          <p>Comprova la connexió a internet o torna a carregar la pàgina. Si el problema persisteix, els servidors de teseles (CARTO / Esri) podrien estar momentàniament fora de servei.</p>
          <button type="button" className="export-button primary" onClick={() => window.location.reload()}>
            Tornar a intentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
