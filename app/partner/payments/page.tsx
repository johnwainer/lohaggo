'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Wallet, Clock, CheckCircle, TrendingUp, DollarSign, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import PartnerHeader from '@/components/partner/PartnerHeader'

interface PayoutItem {
  id: string
  amount: number
  netAmount: number
  partnerCommissionRate: number
  status: string
  createdAt: string
  processedAt: string | null
  payment: {
    booking: {
      scheduledDate: string
      service: { name: string; icon: string }
      user: { name: string }
    }
  }
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'En proceso',
  COMPLETED: 'Pagado',
  FAILED: 'Fallido',
  CANCELLED: 'Cancelado',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

export default function PartnerPaymentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [payouts, setPayouts] = useState<PayoutItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'PARTNER') router.push('/dashboard')
  }, [status, session])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/partner/payouts')
      .then(r => r.ok ? r.json() : [])
      .then(data => setPayouts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [status])

  const completed = payouts.filter(p => p.status === 'COMPLETED')
  const pending = payouts.filter(p => ['PENDING', 'PROCESSING'].includes(p.status))
  const totalEarned = completed.reduce((s, p) => s + p.netAmount, 0)
  const totalPending = pending.reduce((s, p) => s + p.netAmount, 0)
  const thisMonth = completed
    .filter(p => new Date(p.processedAt ?? p.createdAt).getMonth() === new Date().getMonth())
    .reduce((s, p) => s + p.netAmount, 0)

  return (
    <div className="account-shell">
      <PartnerHeader title="Mis Pagos" subtitle="Historial de ganancias y cobros" showNavigation />

      <main className="max-w-2xl mx-auto px-4 py-4 pb-28 md:pb-8 space-y-4">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-4 text-white col-span-2">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">Total ganado</p>
            <p className="text-3xl font-black">{formatCurrency(totalEarned)}</p>
            <p className="text-white/60 text-xs mt-1">{completed.length} {completed.length === 1 ? 'pago recibido' : 'pagos recibidos'}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-1">Este mes</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(thisMonth)}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
            <p className="text-yellow-700 text-xs mb-1">Por cobrar</p>
            <p className="text-xl font-bold text-yellow-800">{formatCurrency(totalPending)}</p>
          </div>
        </div>

        {/* Payout list */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm">Historial</h3>
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
                <Wallet className="w-7 h-7 text-gray-400" />
              </div>
              <p className="font-semibold text-gray-900 text-sm mb-1">Sin pagos aún</p>
              <p className="text-xs text-gray-500">Tus ganancias aparecerán aquí cuando completes servicios.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {payouts.map((payout) => (
                <div key={payout.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="text-2xl flex-shrink-0">{payout.payment.booking.service.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{payout.payment.booking.service.name}</p>
                    <p className="text-xs text-gray-500 truncate">{payout.payment.booking.user.name} · {payout.payment.booking.scheduledDate}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(payout.netAmount)}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLOR[payout.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[payout.status] ?? payout.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bank account link */}
        <button
          onClick={() => router.push('/partner/bank-accounts')}
          className="w-full bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 hover:border-primary-300 hover:shadow-sm transition"
        >
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-gray-900">Datos bancarios</p>
            <p className="text-xs text-gray-500">Configura tu cuenta para recibir pagos</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>
      </main>
    </div>
  )
}
