import Link from 'next/link'
import { ShieldCheck, Wallet, Zap, Search, ChevronRight } from 'lucide-react'
import { HeroCityName } from '@/components/client/HeroCityName'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { HOME_WA_MESSAGE } from '@/lib/public/whatsapp'

/**
 * Above-the-fold hero. WhatsApp is the main channel (the AI agent creates the request in the chat), so it
 * leads; searching the catalogue stays right next to it.
 */
export function HomeHeroCTA({ showGuarantee = false, whatsappPhone = null }: { showGuarantee?: boolean; whatsappPhone?: string | null }) {
  return (
    <section className="bg-gradient-to-br from-primary-600 to-secondary-600 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-7 md:pt-10 md:pb-10">
        <h1 className="text-2xl font-black leading-tight md:text-4xl">
          ¿Qué necesitas resolver hoy?
        </h1>
        <p className="mt-1.5 text-sm font-medium text-white/85 md:text-lg">
          Profesionales verificados<HeroCityName />. Reserva rápido y paga al finalizar.
        </p>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <WhatsAppButton phone={whatsappPhone} message={HOME_WA_MESSAGE} refTag="web-home" className="w-full sm:w-auto" trackData={{ placement: 'hero' }} />
          <Link
            href="/#buscar"
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-base font-bold text-primary-700 shadow-lg active:scale-[0.98] transition sm:w-auto"
          >
            <Search className="h-5 w-5" />
            Buscar servicio
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-white/85 md:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Verificados
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wallet className="h-4 w-4" /> Paga al finalizar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-4 w-4" /> Rápido
          </span>
        </div>

        {showGuarantee && (
          <Link
            href="/garantia"
            className="mt-4 flex min-h-[44px] items-center gap-2.5 rounded-2xl bg-white/15 px-3.5 py-2.5 text-xs font-medium text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20 md:text-sm"
          >
            <ShieldCheck className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1">
              Si el socio no llega o el trabajo queda mal, te conseguimos otro o lo corrige sin costo ·{' '}
              <span className="font-bold underline underline-offset-2">Ver garantía</span>
            </span>
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          </Link>
        )}
      </div>
    </section>
  )
}
