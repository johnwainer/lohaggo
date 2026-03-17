import { Metadata } from 'next'
import UneteClient from './UneteClient'

export const metadata: Metadata = {
    title: 'Únete como profesional | LoHaggo',
    description: 'Regístrate en LoHaggo y empieza a recibir clientes hoy mismo.',
}

export default function UnetePage() {
    return <UneteClient />
}
