import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Descargar App iOS - LoHaggo | Instala la PWA en tu iPhone o iPad',
  description: 'Descarga e instala la app de LoHaggo en tu iPhone o iPad. Instalación desde Safari, acceso rápido a servicios profesionales y experiencia optimizada para iOS.',
  openGraph: {
    title: 'Instala LoHaggo en iOS - App Progresiva (PWA)',
    description: 'Instala la app de LoHaggo en tu iPhone o iPad desde Safari. Sin App Store, instalación directa.',
    url: 'https://www.lohaggo.com/download/ios',
  },
  alternates: {
    canonical: '/download/ios',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
