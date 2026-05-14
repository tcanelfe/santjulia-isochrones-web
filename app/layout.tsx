import type { Metadata } from 'next'
import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'

export const metadata: Metadata = {
  title: 'Cobertura poblacional · Sant Julià de Lòria',
  description: 'Prototype web migration of the Sant Julià isochrone Shiny app.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  )
}
