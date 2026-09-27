import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, CheckCircle2, Clock, Info, Mail, MessageCircle, ShieldCheck, UserX, Wrench } from 'lucide-react'
import { POLICY_CONTACT_EMAIL, POLICY_SECTIONS, POLICY_SUMMARY } from '@/lib/guarantee/policy'

export const metadata: Metadata = {
  title: 'Garantía: qué hacemos si el socio no llega o el trabajo queda mal',
  description: 'La Garantía LoHaggo: si el socio no llega o el trabajo queda incompleto, te conseguimos otro socio con prioridad, cancelamos sin costo o el mismo socio corrige. Tiempos, límites y cómo reclamar.',
  openGraph: {
    title: 'Garantía LoHaggo',
    description: POLICY_SUMMARY,
    url: 'https://www.lohaggo.com/garantia',
  },
  alternates: { canonical: '/garantia' },
}

const ICONS = [ShieldCheck, Wrench, Clock, Info, UserX, MessageCircle]

export default function GuaranteePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-500 via-secondary-500 to-secondary-500 pb-12 pt-24 text-white sm:pb-16">
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 font-semibold text-white/90 transition-colors hover:text-white sm:mb-8">
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/20 backdrop-blur-md sm:h-16 sm:w-16">
              <ShieldCheck className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-black sm:text-4xl md:text-5xl">Garantía LoHaggo</h1>
              <p className="mt-2 font-medium text-white/90">Qué hacemos si el socio no llega o el trabajo queda mal.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-16">
        <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-primary-100 bg-white p-5 shadow-sm sm:p-8">
            <p className="text-base leading-relaxed text-gray-800 sm:text-lg">{POLICY_SUMMARY}</p>
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                Hoy el pago normal es en efectivo o transferencia <strong>directo al socio</strong>: LoHaggo no tiene ese dinero. Por eso te conseguimos otro socio, cancelamos sin costo, mediamos y sancionamos al socio; el reembolso directo solo aplica cuando pagaste en línea con LoHaggo.
              </p>
            </div>
          </div>

          {POLICY_SECTIONS.map((section, i) => {
            const Icon = ICONS[i] ?? CheckCircle2
            return (
              <div key={section.title} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
                <h2 className="mb-4 flex items-center gap-3 text-xl font-black text-gray-900 sm:text-2xl">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-primary-500 to-secondary-500 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  {section.title}
                </h2>
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-gray-700">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-500" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}

          <div className="flex flex-col items-start gap-3 rounded-3xl bg-gradient-to-r from-primary-500 to-secondary-500 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="text-lg font-black">¿Tuviste un problema con un servicio?</p>
              <p className="text-sm text-white/90">Escríbenos con la referencia de tu reserva, qué pasó y a qué hora.</p>
            </div>
            <a href={`mailto:${POLICY_CONTACT_EMAIL}`} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-primary-600 shadow-sm transition hover:shadow-md">
              <Mail className="h-4 w-4" />
              {POLICY_CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
