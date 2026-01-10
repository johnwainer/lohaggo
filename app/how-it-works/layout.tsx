import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cómo Funciona LoHaggo | Guía Completa para Contratar Servicios Profesionales',
  description: 'Aprende cómo funciona LoHaggo paso a paso. Busca servicios, compara profesionales, agenda y paga de forma segura. Guía completa para clientes y profesionales.',
  openGraph: {
    title: 'Cómo Funciona LoHaggo - Guía Paso a Paso',
    description: 'Descubre lo fácil que es contratar servicios profesionales con LoHaggo. Busca, compara, agenda y paga en minutos.',
    url: 'https://lohaggo.com/how-it-works',
  },
  alternates: {
    canonical: '/how-it-works',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
