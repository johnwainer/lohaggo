'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Package, MessageSquare, ChevronRight } from 'lucide-react'
import { useClientNavCounts } from '@/hooks/useClientNavCounts'

export function HomeActiveBookingsBanner() {
  const { data: session, status } = useSession()
  const counts = useClientNavCounts()

  if (status !== 'authenticated') return null
  if (session?.user?.role !== 'CLIENT') return null

  const hasBookings = counts.bookings > 0
  const hasRequests = counts.requests > 0

  if (!hasBookings && !hasRequests) return null

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">
      <div className="mx-auto max-w-6xl grid gap-3 grid-cols-1 sm:grid-cols-2">
        {hasBookings && (
          <Link
            href="/dashboard?tab=bookings"
            className="group flex items-center gap-3 rounded-2xl bg-white border border-slate-100 shadow-card p-4 transition-all hover:shadow-cardHover active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <Package className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {counts.bookings === 1
                  ? 'Tienes 1 reserva activa'
                  : `Tienes ${counts.bookings} reservas activas`}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Ver el estado y detalles</p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>
        )}

        {hasRequests && (
          <Link
            href="/dashboard?tab=requests"
            className="group flex items-center gap-3 rounded-2xl bg-white border border-slate-100 shadow-card p-4 transition-all hover:shadow-cardHover active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {counts.requests === 1
                  ? 'Tienes 1 solicitud abierta'
                  : `Tienes ${counts.requests} solicitudes abiertas`}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Revisar propuestas recibidas</p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>
        )}
      </div>
    </div>
  )
}
