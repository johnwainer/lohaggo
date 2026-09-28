import Link from 'next/link'
import type { FaqItem } from '@/lib/public/serviceZones'

export function HowItWorks({ serviceName }: { serviceName: string }) {
  const steps = [
    { n: 1, title: 'Pides el servicio', desc: `Cuéntanos qué necesitas de ${serviceName.toLowerCase()}, tu dirección y cuándo te sirve.` },
    { n: 2, title: 'Recibes propuestas', desc: 'Socios verificados te envían su propuesta con precio y fecha.' },
    { n: 3, title: 'Eliges', desc: 'Comparas, eliges la que más te convenga y coordinas por el chat.' },
  ]
  return (
    <section aria-labelledby="como-funciona" className="mt-8">
      <h2 id="como-funciona" className="text-xl font-bold text-gray-900">Cómo funciona</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">{s.n}</span>
            <p className="mt-3 font-semibold text-gray-900">{s.title}</p>
            <p className="mt-1 text-sm leading-6 text-gray-600">{s.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function FaqList({ items, title = 'Preguntas frecuentes' }: { items: FaqItem[]; title?: string }) {
  if (!items.length) return null
  return (
    <section aria-labelledby="faq" className="mt-8">
      <h2 id="faq" className="text-xl font-bold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((i) => (
          <details key={i.q} className="group rounded-2xl border border-gray-100 bg-white p-4 shadow-sm [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-semibold text-gray-900">
              <span>{i.q}</span>
              <span aria-hidden className="mt-0.5 shrink-0 text-primary-600 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-sm leading-6 text-gray-600">{i.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function ZoneLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  if (!links.length) return null
  return (
    <section aria-label={title} className="mt-8">
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="inline-flex min-h-[40px] items-center rounded-full border border-primary-100 bg-primary-50 px-4 text-sm font-semibold text-primary-700 hover:bg-primary-100">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
