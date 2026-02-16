import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { AppDownloadBanner } from '@/components/AppDownloadBanner'
import { BottomNav } from '@/components/mobile/BottomNav'
import NotificationPermissionPrompt from '@/components/NotificationPermissionPrompt'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import PWARegister from '@/components/PWARegister'
import PWAOnboardingPrompt from '@/components/PWAOnboardingPrompt'
import TermsBanner from '@/components/TermsBanner'
import TestModeBanner from '@/components/TestModeBanner'
import InactiveAccountBanner from '@/components/InactiveAccountBanner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://www.lohaggo.com'),
  title: {
    default: 'LoHaggo - Servicios Profesionales en Colombia | Plomeros, Electricistas y Más',
    template: '%s | LoHaggo'
  },
  description: 'Contrata servicios profesionales en Colombia: plomeros, electricistas, limpieza y más. Expertos verificados en Medellín con precios transparentes. ¡Reserva en minutos!',
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
    'servicios en Colombia',
    'servicios en Medellín',
    'contratación de servicios',
    'servicios del hogar',
    'mantenimiento',
    'lohaggo',
    'lo haggo',
    'expertos verificados',
    'jardinería',
    'servicios profesionales Colombia',
    'servicios profesionales Medellín'
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
    <html lang="es-CO" translate="no">
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
              "description": "Professional services platform in Colombia. Connect with verified experts in plumbing, electrical work, cleaning, repairs and more in Medellín.",
              "url": "https://www.lohaggo.com",
              "logo": "https://www.lohaggo.com/icon-512.png",
              "image": "https://www.lohaggo.com/icon-512.png",
              "telephone": "+57-4-123-4567",
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
                "@type": "City",
                "name": "Medellín",
                "containedIn": {
                  "@type": "Country",
                  "name": "Colombia"
                }
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
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://www.lohaggo.com/servicios?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
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
              "url": "https://www.lohaggo.com",
              "logo": "https://www.lohaggo.com/icon-512.png",
              "description": "Leading platform in Colombia to hire verified professional services. Plumbers, electricians, cleaning, carpenters and more in Medellín.",
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
                "telephone": "+57-4-123-4567",
                "contactType": "customer service",
                "email": "contacto@lohaggo.com",
                "availableLanguage": ["Spanish", "English"]
              },
              "sameAs": [
                "https://facebook.com/lohaggo",
                "https://twitter.com/lohaggo",
                "https://instagram.com/lohaggo"
              ]
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "Home",
                  "item": "https://www.lohaggo.com"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "Services",
                  "item": "https://www.lohaggo.com/servicios"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": "How It Works",
                  "item": "https://www.lohaggo.com/how-it-works"
                },
                {
                  "@type": "ListItem",
                  "position": 4,
                  "name": "Join as Professional",
                  "item": "https://www.lohaggo.com/partner"
                }
              ]
            })
          }}
        />
      </head>
      <body className={inter.className}>
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
          <PWARegister />
          <TestModeBanner />
          <InactiveAccountBanner />
          <Navbar />
          <main className="min-h-screen pb-24 md:pb-0">
            {children}
          </main>
          <AppDownloadBanner />
          <Footer />
          <BottomNav />
          <NotificationPermissionPrompt />
          <PWAInstallPrompt />
          <PWAOnboardingPrompt />
          <TermsBanner />
        </Providers>
      </body>
    </html>
  )
}
