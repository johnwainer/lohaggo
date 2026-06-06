import Link from 'next/link'
import { ShieldCheck, Wallet, Zap, ArrowRight } from 'lucide-react'

/**
 * Above-the-fold hero with a single dominant call to action. Heatmaps showed
 * users clicking the hamburger menu and category filters instead of hiring, so
 * the booking path needs one unmistakable primary button before the catalogue.
 */
export function HomeHeroCTA() {
  return (
    <section className="bg-gradient-to-br from-primary-600 to-secondary-600 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 pb-7 md:pt-10 md:pb-10">
        <h1 className="text-2xl font-black leading-tight md:text-4xl">
          ¿Qué necesitas resolver hoy?
        </h1>
        <p className="mt-1.5 text-sm font-medium text-white/85 md:text-lg">
          Profesionales verificados en Medellín. Reserva en minutos y paga al finalizar.
        </p>

        <Link
          href="/#buscar"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-base font-bold text-primary-700 shadow-lg active:scale-[0.98] transition md:w-auto"
        >
          Solicitar un servicio
          <ArrowRight className="h-5 w-5" />
        </Link>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-white/85 md:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Verificados
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wallet className="h-4 w-4" /> Paga al finalizar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-4 w-4" /> En minutos
          </span>
        </div>
      </div>
    </section>
  )
}
