import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { AppDownloadBanner } from '@/components/AppDownloadBanner'
import { BottomNav } from '@/components/mobile/BottomNav'
import NotificationPermissionPrompt from '@/components/NotificationPermissionPrompt'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import PWARegister from '@/components/PWARegister'
import TermsBanner from '@/components/TermsBanner'
import TestModeBanner from '@/components/TestModeBanner'
import InactiveAccountBanner from '@/components/InactiveAccountBanner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://lohaggo.com'),
  title: {
    default: 'LoHaggo - Encuentra y Contrata Servicios Profesionales en México | Plomeros, Electricistas, Limpieza y Más',
    template: '%s | LoHaggo - Servicios Profesionales'
  },
  description: 'Encuentra y contrata servicios profesionales en México. Plomeros, electricistas, limpieza, reparaciones y más. Expertos verificados, precios transparentes y reservas en minutos. ¡Solicita tu servicio ahora!',
  manifest: '/manifest.json',
  applicationName: 'LoHaggo',
  keywords: [
    'servicios a domicilio',
    'servicios profesionales',
    'contratar servicios',
    'plomero',
    'electricista',
    'carpintero',
    'limpieza',
    'reparaciones',
    'profesionales verificados',
    'servicios en México',
    'contratación de servicios',
    'servicios del hogar',
    'mantenimiento',
    'lohaggo',
    'lo haggo',
    'expertos verificados',
    'jardinería',
    'servicios profesionales México'
  ],
  authors: [{ name: 'LoHaggo', url: 'https://lohaggo.com' }],
  creator: 'LoHaggo',
  publisher: 'LoHaggo',
  alternates: {
    canonical: 'https://lohaggo.com',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LoHaggo',
    startupImage: [
      {
        url: '/apple-icon.png',
        media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
      },
    ],
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  openGraph: {
    type: 'website',
    siteName: 'LoHaggo',
    title: 'LoHaggo - Encuentra Servicios Profesionales en México | Plomeros, Electricistas, Limpieza y Más',
    description: 'Contrata servicios profesionales verificados en México. Plomeros, electricistas, limpieza, reparaciones y más. Cotiza gratis, compara precios y contrata en minutos. ¡Servicio garantizado!',
    locale: 'es_MX',
    url: 'https://lohaggo.com',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'LoHaggo - Plataforma de Servicios Profesionales en México',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LoHaggo - Encuentra Servicios Profesionales en México',
    description: 'Plomeros, electricistas, limpieza, mudanzas y más. Conecta con expertos verificados cerca de ti.',
    images: ['/icon-512.png'],
    creator: '@lohaggo',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'business',
  verification: {
    google: 'google-site-verification-code',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#00B894' },
    { media: '(prefers-color-scheme: dark)', color: '#0066CC' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LoHaggo" />
        <meta name="application-name" content="LoHaggo" />
        <meta name="msapplication-TileColor" content="#00B894" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="format-detection" content="telephone=yes" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "name": "LoHaggo",
              "description": "Professional services platform in Mexico. Connect with verified experts in plumbing, electrical work, cleaning, repairs and more.",
              "url": "https://lohaggo.com",
              "logo": "https://lohaggo.com/icon-512.png",
              "image": "https://lohaggo.com/icon-512.png",
              "telephone": "+52-55-1234-5678",
              "email": "contacto@lohaggo.com",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "MX",
                "addressLocality": "Mexico"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": "19.4326",
                "longitude": "-99.1332"
              },
              "priceRange": "$$",
              "openingHoursSpecification": {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": [
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday"
                ],
                "opens": "00:00",
                "closes": "23:59"
              },
              "sameAs": [
                "https://facebook.com/lohaggo",
                "https://twitter.com/lohaggo",
                "https://instagram.com/lohaggo"
              ],
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "reviewCount": "1250"
              },
              "areaServed": {
                "@type": "Country",
                "name": "Mexico"
              }
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "LoHaggo",
              "url": "https://lohaggo.com",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://lohaggo.com/servicios?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <PWARegister />
          <TestModeBanner />
          <InactiveAccountBanner />
          <Navbar />
          <main className="min-h-screen md:pb-0 pb-16">
            {children}
          </main>
          <AppDownloadBanner />
          <Footer />
          <BottomNav />
          <NotificationPermissionPrompt />
          <PWAInstallPrompt />
          <TermsBanner />
        </Providers>
      </body>
    </html>
  )
}
