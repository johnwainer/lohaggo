import Link from 'next/link'
import { fmtCount } from '@/lib/public/claims'
import { citiesLine, clientPayment, guarantee, verificationLong, type TrustLike } from '@/lib/public/copy'

/**
 * Bloque factual «Qué es LoHaggo», renderizado en el servidor (buscadores y asistentes de IA lo leen tal cual).
 * Solo afirma lo que respaldan los interruptores de claims y las cifras reales por encima de su mínimo.
 */
export function WhatIsLoHaggo({ trust, className = '' }: { trust: TrustLike; className?: string }) {
  const coverage = citiesLine(trust)
  const guaranteeText = guarantee(trust)
  const partners = trust.stats.verifiedPartners
  const facts: Array<[string, string]> = [
    ['Cobertura', coverage ? `${coverage} y el Valle de Aburrá.` : 'Medellín y el Valle de Aburrá.'],
    ['Socios', partners !== null ? `Hoy hay ${fmtCount(partners)} socios verificados. ${verificationLong(trust)}` : verificationLong(trust)],
    ['Pago', clientPayment(trust)],
    ...(guaranteeText ? [['Garantía', guaranteeText] as [string, string]] : []),
  ]

  return (
    <section aria-labelledby="que-es-lohaggo" className={`bg-white px-4 py-10 ${className}`}>
      <div className="mx-auto max-w-3xl">
        <h2 id="que-es-lohaggo" className="text-2xl font-bold text-gray-900">Qué es LoHaggo</h2>
        <p className="mt-3 leading-7 text-gray-700">
          LoHaggo es una plataforma colombiana para contratar servicios a domicilio: plomería, electricidad, limpieza, pintura,
          carpintería, jardinería, cerrajería y más. Cuentas qué necesitas, recibes propuestas con precio de socios verificados,
          comparas y eliges. LoHaggo conecta a clientes con profesionales independientes y empresas; el servicio lo presta el socio.
        </p>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <dt className="text-sm font-semibold text-gray-900">{k}</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-600">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-sm text-gray-600">
          <Link href="/how-it-works" className="font-semibold text-primary-700 underline underline-offset-2">Cómo funciona</Link>
          {' · '}
          <Link href="/precios" className="font-semibold text-primary-700 underline underline-offset-2">Precios de referencia</Link>
          {' · '}
          <Link href="/servicios" className="font-semibold text-primary-700 underline underline-offset-2">Todos los servicios</Link>
        </p>
      </div>
    </section>
  )
}
