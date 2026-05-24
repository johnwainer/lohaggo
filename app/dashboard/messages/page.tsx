'use client'

import Link from 'next/link'
import { MessageSquare, Package, ArrowRight } from 'lucide-react'
import AccountTopHeader from '@/components/shared/AccountTopHeader'
import AccountPanel from '@/components/shared/AccountPanel'

export default function ClientMessagesPage() {
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <AccountTopHeader role="CLIENT" title="Chats" subtitle="Conversaciones con tus profesionales" />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <AccountPanel
          title="Bandeja unificada"
          subtitle="Estamos preparando un inbox para todos tus chats con socios"
        >
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <MessageSquare className="h-8 w-8" strokeWidth={1.8} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">Próximamente</h3>
            <p className="mt-2 max-w-sm text-sm text-slate-600">
              Por ahora, puedes abrir el chat de cada servicio desde la card de la reserva o solicitud correspondiente.
            </p>

            <div className="mt-6 grid w-full max-w-sm gap-2">
              <Link
                href="/dashboard?tab=bookings"
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-primary-300 hover:bg-primary-50/40"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                    <Package className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-slate-900">Ir a Mis pedidos</span>
                    <span className="block text-xs text-slate-500">Abre el chat desde cada reserva</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
              </Link>
            </div>
          </div>
        </AccountPanel>
      </main>
    </div>
  )
}
