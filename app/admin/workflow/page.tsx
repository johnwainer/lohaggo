'use client'

import { useEffect, useState } from 'react'

type Booking = {
  id: string
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  totalPrice: number
  updatedAt: string
  user: { name: string; email: string }
  service: { name: string }
}

type Report = {
  funnel: {
    searches: number
    requests: number
    proposals: number
    bookings: number
    completed: number
  }
  quality: {
    avgTimeToFirstProposalMinutes: number | null
    completionRate: number
    cancellationRate: number
  }
}

type RealtimeBusiness = {
  funnel24h: {
    searches: number
    requests: number
    proposals: number
    bookings: number
    approvedPayments: number
    conversionSearchToRequest: number
    conversionRequestToBooking: number
    conversionBookingToPayment: number
  }
}

export default function AdminWorkflowPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [realtime, setRealtime] = useState<RealtimeBusiness | null>(null)

  const load = async () => {
    const [bRes, rRes, rtRes] = await Promise.all([
      fetch('/api/admin/workflow/bookings'),
      fetch('/api/admin/reports/funnel-quality'),
      fetch('/api/admin/reports/realtime-business'),
    ])

    const [bData, rData, rtData] = await Promise.all([bRes.json(), rRes.json(), rtRes.json()])
    setBookings(bData.bookings || [])
    setReport(rData)
    setRealtime(rtData)
  }

  useEffect(() => {
    load()
  }, [])

  const updateStatus = async (id: string, status: Booking['status']) => {
    await fetch('/api/admin/workflow/bookings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Workflow de Reservas</h1>
        <p className="text-gray-600 mt-1">Gestión operativa de reservas y visibilidad de conversión.</p>
      </div>

      {report && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-500">Búsquedas</p><p className="text-2xl font-bold">{report.funnel.searches}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-500">Solicitudes</p><p className="text-2xl font-bold">{report.funnel.requests}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-500">Propuestas</p><p className="text-2xl font-bold">{report.funnel.proposals}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-500">Reservas</p><p className="text-2xl font-bold">{report.funnel.bookings}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-gray-500">Completadas</p><p className="text-2xl font-bold">{report.funnel.completed}</p></div>
        </div>
      )}

      {report && (
        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-gray-500">Tiempo medio a 1ra propuesta</p>
            <p className="text-2xl font-bold">{report.quality.avgTimeToFirstProposalMinutes ?? '-'} min</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-gray-500">Tasa de finalización</p>
            <p className="text-2xl font-bold">{report.quality.completionRate}%</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-gray-500">Tasa de cancelación</p>
            <p className="text-2xl font-bold">{report.quality.cancellationRate}%</p>
          </div>
        </div>
      )}

      {realtime && (
        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-gray-500">Conv. búsqueda → solicitud (24h)</p>
            <p className="text-2xl font-bold">{realtime.funnel24h.conversionSearchToRequest}%</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-gray-500">Conv. solicitud → reserva (24h)</p>
            <p className="text-2xl font-bold">{realtime.funnel24h.conversionRequestToBooking}%</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-sm text-gray-500">Conv. reserva → pago (24h)</p>
            <p className="text-2xl font-bold">{realtime.funnel24h.conversionBookingToPayment}%</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold text-lg mb-3">Workflow de Reservas</h2>
        <div className="space-y-2">
          {bookings.slice(0, 40).map((booking) => (
            <div key={booking.id} className="grid md:grid-cols-[1fr_auto] gap-3 border rounded-lg p-3">
              <div>
                <p className="font-medium">{booking.service.name} · {booking.user.name}</p>
                <p className="text-sm text-gray-500">{booking.user.email} · ${booking.totalPrice.toLocaleString('es-CO')}</p>
              </div>
              <select value={booking.status} onChange={(e) => updateStatus(booking.id, e.target.value as Booking['status'])} className="border rounded px-2 py-1 text-sm h-fit">
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
