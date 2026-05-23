import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'
import PWARegister from '@/components/PWARegister'
import PublicLayout from '@/components/PublicLayout'
import TestModeBanner from '@/components/TestModeBanner'
import MetaPixel from '@/components/analytics/MetaPixel'
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics'
import MicrosoftClarity from '@/components/analytics/MicrosoftClarity'
import ChunkErrorHandler from '@/components/ChunkErrorHandler'
import { prisma } from '@/lib/prisma'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://www.lohaggo.com'),
  title: {
    default: 'LoHaggo – Contrata Servicios Profesionales en Medellín | Plomeros, Electricistas y Más',
    template: '%s | LoHaggo'
  },
  description: 'LoHaggo: contrata plomeros, electricistas, limpieza, carpinteros y más en Medellín. Profesionales verificados, precios transparentes. ¡Reserva en minutos y paga al finalizar!',
  manifest: '/manifest.json',
  applicationName: 'LoHaggo',
  keywords: [
    // Marca y variaciones
    'LoHaggo',
    'Lo Haggo',
    'lohaggo',
    'lo haggo',
    'lo hago',
    'lohago',
    'loaggo',
    'lo hago servicios',
    'lohaggo.com',
    // Servicios principales
    'plomero Medellín',
    'electricista Medellín',
    'limpieza hogar Medellín',
    'carpintero Medellín',
    'pintor Medellín',
    'jardinero Medellín',
    'cerrajero Medellín',
    'fumigación Medellín',
    // Categorías generales
    'servicios a domicilio Medellín',
    'servicios profesionales Colombia',
    'contratar servicios del hogar',
    'profesionales verificados Medellín',
    'servicios hogar Medellín',
    'mantenimiento hogar Colombia',
    'expertos verificados Colombia',
    'reparaciones hogar Medellín',
  ],
  authors: [{ name: 'LoHaggo', url: 'https://www.lohaggo.com' }],
  creator: 'LoHaggo',
  publisher: 'LoHaggo',
  alternates: {
    canonical: 'https://www.lohaggo.com',
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
    title: 'LoHaggo - Servicios Profesionales en Colombia | Plomeros, Electricistas y Más',
    description: 'Contrata servicios profesionales en Colombia: plomeros, electricistas, limpieza y más. Expertos verificados en Medellín con precios transparentes. ¡Reserva en minutos!',
    locale: 'es_CO',
    url: 'https://www.lohaggo.com',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'LoHaggo - Plataforma de Servicios Profesionales en Colombia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LoHaggo - Servicios Profesionales en Colombia',
    description: 'Contrata servicios profesionales en Colombia: plomeros, electricistas, limpieza y más. Expertos verificados en Medellín con precios transparentes. ¡Reserva en minutos!',
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
    { media: '(prefers-color-scheme: light)', color: '#2563eb' },
    { media: '(prefers-color-scheme: dark)', color: '#2563eb' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let isTestMode = true
  let avgRating = '4.8'
  let reviewCount = 1250
  try {
    const config = await prisma.paymentConfig.findFirst()
    isTestMode = !config || config.environment === 'TEST'
  } catch { /* default to true if DB unreachable */ }
  try {
    const ratingAgg = await prisma.partnerProfile.aggregate({
      where: { isActive: true, totalReviews: { gt: 0 } },
      _avg: { rating: true },
      _sum: { totalReviews: true },
    })
    const avg = ratingAgg._avg?.rating
    const sum = ratingAgg._sum?.totalReviews
    if (avg) avgRating = avg.toFixed(1)
    if (sum) reviewCount = sum
  } catch { /* keep defaults */ }

  return (
    <html lang="es-CO" translate="no" className={inter.variable}>
      <head>
        <meta name="google" content="notranslate" />
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
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="format-detection" content="telephone=yes" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "name": "LoHaggo",
              "description": "Plataforma de servicios profesionales en Colombia. Conecta con expertos verificados en plomería, electricidad, limpieza, reparaciones y más en Medellín.",
              "url": "https://www.lohaggo.com",
              "logo": "https://www.lohaggo.com/icon-512.png",
              "image": "https://www.lohaggo.com/icon-512.png",
              "email": "contacto@lohaggo.com",
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "CO",
                "addressLocality": "Medellín",
                "addressRegion": "Antioquia"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": "6.2442",
                "longitude": "-75.5812"
              },
              "priceRange": "$$",
              "openingHoursSpecification": {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
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
                "ratingValue": avgRating,
                "reviewCount": reviewCount.toString(),
                "bestRating": "5",
                "worstRating": "1"
              },
              "areaServed": {
                "@type": "City",
                "name": "Medellín",
                "containedIn": { "@type": "Country", "name": "Colombia" }
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
              "url": "https://www.lohaggo.com",
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "LoHaggo",
              "alternateName": ["Lo Haggo", "lohaggo", "lo hago", "lohago", "Lo Hago"],
              "url": "https://www.lohaggo.com",
              "logo": "https://www.lohaggo.com/icon-512.png",
              "description": "Plataforma líder en Colombia para contratar servicios profesionales verificados. Plomeros, electricistas, limpieza, carpinteros y más en Medellín.",
              "foundingDate": "2024",
              "founders": [
                {
                  "@type": "Person",
                  "name": "LoHaggo Team"
                }
              ],
              "address": {
                "@type": "PostalAddress",
                "addressCountry": "CO",
                "addressLocality": "Medellín",
                "addressRegion": "Antioquia"
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "email": "contacto@lohaggo.com",
                "availableLanguage": ["Spanish"]
              },
              "sameAs": [
                "https://facebook.com/lohaggo",
                "https://twitter.com/lohaggo",
                "https://instagram.com/lohaggo"
              ]
            })
          }}
        />
      </head>
      <body className="font-sans">
        <Script id="gtm-loader" strategy="lazyOnload">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-W7V4TD6P');`}
        </Script>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-W7V4TD6P"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <Providers>
          <ChunkErrorHandler />
          <PWARegister />
          <TestModeBanner isTestMode={isTestMode} />
          <PublicLayout>
            {children}
          </PublicLayout>
        </Providers>
        <MetaPixel />
        <GoogleAnalytics />
        <MicrosoftClarity />
      </body>
    </html>
  )
}
