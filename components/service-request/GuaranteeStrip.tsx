import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

/** Compact guarantee line for service pages. Render only when the `trust_guarantee` claim is on. */
export default function GuaranteeStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 ${className}`}>
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <p className="text-sm text-emerald-900">
        <span className="font-semibold">Garantía LoHaggo:</span> si el socio no llega o el trabajo queda mal, te conseguimos otro socio o lo corrige sin costo ·{' '}
        <Link href="/garantia" className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800">
          Ver garantía
        </Link>
      </p>
    </div>
  )
}
