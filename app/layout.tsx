import type { Metadata, Viewport } from 'next'
import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'

const SITE_TITLE = 'Accessibilitat peatonal a equipaments parroquial · Sant Julià de Lòria'
const SITE_DESCRIPTION = 'Mapa interactiu d\'accessibilitat a peu als equipaments i espais lliures de Sant Julià de Lòria. Isòcrones de 5, 10 i 15 minuts per a la població general, gent gran i infants.'

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: 'Cobertura Sant Julià',
  authors: [{ name: 'Universitat Carlemany · Comú de Sant Julià de Lòria · Solarc' }],
  keywords: ['Sant Julià de Lòria', 'Andorra', 'isòcrones', 'accessibilitat', 'mobilitat a peu', 'equipaments', 'urbanisme'],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' }
    ]
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: 'website',
    locale: 'ca_AD',
    siteName: 'Cobertura Sant Julià'
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION
  },
  robots: { index: true, follow: true }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1f3a5f'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  )
}
