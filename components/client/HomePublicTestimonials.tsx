'use client'

import { useSession } from 'next-auth/react'
import { Star } from 'lucide-react'

const testimonials = [
  {
    text: 'Contraté un plomero y llegó en menos de 2 horas. Muy profesional y el precio fue justo.',
    name: 'María González',
    initial: 'M',
  },
  {
    text: 'La mejor plataforma para encontrar servicios. Rápida, confiable y con excelentes profesionales.',
    name: 'Juan Pérez',
    initial: 'J',
  },
  {
    text: 'El electricista que contraté fue muy profesional y resolvió mi problema rápidamente.',
    name: 'Ana Martínez',
    initial: 'A',
  },
]

export function HomePublicTestimonials() {
  const { status } = useSession()

  if (status === 'loading') return null
  if (status === 'authenticated') return null

  return (
    <section className="py-12 bg-slate-50 border-t border-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">
          Lo que dicen nuestros clientes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-2xl p-6 shadow-card border border-slate-100"
            >
              <div className="flex gap-0.5 mb-3" aria-label="5 estrellas">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-slate-700 text-sm mb-4 leading-relaxed">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {t.initial}
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-900">{t.name}</div>
                  <div className="text-xs text-slate-400">Cliente verificado</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
