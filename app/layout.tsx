import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import NotificationPermissionPrompt from '@/components/NotificationPermissionPrompt'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import PWARegister from '@/components/PWARegister'
import TermsBanner from '@/components/TermsBanner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LoHaggo - Lo necesitas',
  description: 'La forma más simple de encontrar cualquier servicio. Conecta con expertos verificados en segundos.',
  manifest: '/manifest.json',
  applicationName: 'LoHaggo',
  keywords: ['servicios', 'profesionales', 'contratación', 'expertos', 'lohaggo', 'reservas'],
  authors: [{ name: 'LoHaggo' }],
  creator: 'LoHaggo',
  publisher: 'LoHaggo',
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
    title: 'LoHaggo - Lo necesitas',
    description: 'La forma más simple de encontrar cualquier servicio. Conecta con expertos verificados en segundos.',
    locale: 'es_MX',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'LoHaggo Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LoHaggo - Lo necesitas',
    description: 'La forma más simple de encontrar cualquier servicio.',
    images: ['/icon-512.png'],
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
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FF6900' },
    { media: '(prefers-color-scheme: dark)', color: '#FF2D55' },
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
        <meta name="msapplication-TileColor" content="#FF6900" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="format-detection" content="telephone=yes" />
      </head>
      <body className={inter.className}>
        <Providers>
          <PWARegister />
          <Navbar />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer />
          <NotificationPermissionPrompt />
          <PWAInstallPrompt />
          <TermsBanner />
        </Providers>
      </body>
    </html>
  )
}
