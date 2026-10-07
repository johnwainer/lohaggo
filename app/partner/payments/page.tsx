'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Wallet, DollarSign, ChevronRight, AlertCircle } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'
import { formatCurrency } from '@/lib/utils'
import { formatCalendarDay } from '@/lib/bookings/when'
import PartnerHeader from '@/components/partner/PartnerHeader'

interface PayoutItem {
  id: string
  amount: number
  partnerCommission: number
  netAmount: number
  partnerCommissionRate: number
  status: string
  createdAt: string
  processedAt: string | null
  payment: {
    booking: {
      id: string
      scheduledDate: string
      scheduledTime: string
      service: { name: string; slug: string; icon: string }
      user: { name: string }
    }
  }
}

interface UnpaidBooking {
  id: string
  status: string
  scheduledDate: string
  totalPrice: number
  service: { name: string; slug: string; icon: string }
  user: { name: string | null }
  payment: { status: string; totalAmount: number; confirmationStatus: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'En proceso',
  COMPLETED: 'Pagado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PROCESSING: 'bg-sky-100 text-sky-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
}

const formatRate = (rate: number) => `${Number.isInteger(rate) ? rate : rate.toFixed(1)} %`

export default function PartnerPaymentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [payouts, setPayouts] = useState<PayoutItem[]>([])
  const [unpaid, setUnpaid] = useState<UnpaidBooking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'PARTNER') router.push('/dashboard')
  }, [status, session])

  useEffect(() => {
    if (status !== 'authenticated') return
    const payoutsReq = fetch('/api/partner/payouts')
      .then(r => r.ok ? r.json() : [])
      .then(data => setPayouts(Array.isArray(data) ? data : []))
    const unpaidReq = fetch('/api/bookings?status=COMPLETED')
      .then(r => r.ok ? r.json() : [])
      .then((data: UnpaidBooking[]) => {
        const list = Array.isArray(data) ? data : []
        setUnpaid(list.filter(b =>
          b.payment
            ? b.payment.status !== 'APPROVED' && ['NONE', 'CLIENT_REPORTED'].includes(b.payment.confirmationStatus)
            : true,
        ))
      })
      .catch(() => setUnpaid([]))
    Promise.allSettled([payoutsReq, unpaidReq]).finally(() => setLoading(false))
  }, [status])

  const completed = payouts.filter(p => p.status === 'COMPLETED')
  const pending = payouts.filter(p => ['PENDING', 'PROCESSING'].includes(p.status))
  const totalEarned = completed.reduce((s, p) => s + p.netAmount, 0)
  const totalPending = pending.reduce((s, p) => s + p.netAmount, 0)
  const now = new Date()
  const thisMonth = completed
    .filter(p => {
      const d = new Date(p.processedAt ?? p.createdAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, p) => s + p.netAmount, 0)

  return (
    <div className="account-shell">
      <PartnerHeader title="Ingresos" subtitle="Tus ganancias y lo que te falta por recibir" showNavigation />

      <div className="max-w-2xl md:max-w-3xl mx-auto px-4 md:px-6 py-4 pb-8 space-y-4">

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-4 text-white col-span-2">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wide mb-1">Total ganado</p>
            <p className="text-3xl font-black">{formatCurrency(totalEarned)}</p>
            <p className="text-white/80 text-xs mt-1">{completed.length} {completed.length === 1 ? 'pago recibido' : 'pagos recibidos'}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-gray-600 text-xs mb-1">Este mes</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(thisMonth)}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-amber-800 text-xs font-semibold mb-1">Pendiente de LoHaggo</p>
            <p className="text-xl font-bold text-amber-900">{formatCurrency(totalPending)}</p>
            <p className="text-amber-800 text-[11px] mt-1 leading-snug">Lo que LoHaggo te transferirá cuando el pago se procese.</p>
          </div>
        </div>

        {!loading && unpaid.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden" aria-labelledby="unpaid-title">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 id="unpaid-title" className="font-bold text-gray-900 text-sm">Cobros pendientes a clientes</h2>
              <p className="text-xs text-gray-600 mt-0.5">Servicios terminados que el cliente aún no te ha pagado o cuyo pago falta confirmar.</p>
            </div>
            <ul className="divide-y divide-gray-50">
              {unpaid.map(b => {
                const reported = b.payment?.confirmationStatus === 'CLIENT_REPORTED'
                return (
                  <li key={b.id} className="px-4 py-3 flex items-start gap-3">
                    <ServiceIcon slug={b.service.slug} emoji={b.service.icon} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate" title={b.service.name}>{b.service.name}</p>
                      <p className="text-xs text-gray-600 truncate">{b.user?.name ?? 'Cliente'} · {formatCalendarDay(b.scheduledDate)}</p>
                      {reported && (
                        <Link
                          href="/partner?tab=bookings"
                          className="mt-1.5 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          <AlertCircle className="w-4 h-4" aria-hidden="true" />
                          El cliente reportó el pago: confírmalo
                        </Link>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-900 flex-shrink-0">{formatCurrency(b.payment?.totalAmount ?? b.totalPrice)}</p>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden" aria-labelledby="history-title" aria-busy={loading}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 id="history-title" className="font-bold text-gray-900 text-sm">Historial</h2>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                  <div className="h-5 bg-gray-100 rounded w-16" />
                </div>
              ))}
            </div>
          ) : payouts.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Wallet className="w-7 h-7 text-gray-500" aria-hidden="true" />
              </div>
              <p className="font-semibold text-gray-900 text-sm mb-1">Sin pagos aún</p>
              <p className="text-xs text-gray-600">Tus ganancias aparecerán aquí cuando completes servicios.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {payouts.map((payout) => {
                const booking = payout.payment.booking
                return (
                  <li key={payout.id} className="px-4 py-3 flex items-start gap-3">
                    <ServiceIcon slug={booking.service.slug} emoji={booking.service.icon} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate" title={booking.service.name}>{booking.service.name}</p>
                      <p className="text-xs text-gray-600 truncate">{booking.user?.name ?? 'Cliente'} · {formatCalendarDay(booking.scheduledDate)}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Bruto {formatCurrency(payout.amount)} · Comisión {formatRate(payout.partnerCommissionRate)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">Neto {formatCurrency(payout.netAmount)}</p>
                      <span className={`mt-1 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[payout.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABEL[payout.status] ?? payout.status}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <button
          onClick={() => router.push('/partner/bank-accounts')}
          className="w-full bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 hover:border-primary-300 hover:shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary-600" aria-hidden="true" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-gray-900">Datos bancarios</p>
            <p className="text-xs text-gray-600">Configura tu cuenta para recibir pagos</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
