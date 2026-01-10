import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Descargar App Android - LoHaggo | Instala la PWA en tu Dispositivo Android',
  description: 'Descarga e instala la app de LoHaggo en tu dispositivo Android. Instalación con 1 clic, acceso rápido a servicios profesionales y notificaciones en tiempo real.',
  openGraph: {
    title: 'Instala LoHaggo en Android - App Progresiva (PWA)',
    description: 'Instala la app de LoHaggo en tu Android con 1 clic. Compatible con Chrome, Edge y Samsung Internet.',
    url: 'https://lohaggo.com/download/android',
  },
  alternates: {
    canonical: '/download/android',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
