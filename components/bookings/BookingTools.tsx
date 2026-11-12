'use client'

import { CalendarPlus, Navigation, Phone } from 'lucide-react'
import { buildIcs, googleMapsUrl, telHref, wazeUrl } from '@/lib/bookings/directions'

type Props = {
  booking: {
    id: string
    scheduledDate: string
    scheduledTime: string
    address: string
    city?: string | null
    notes?: string | null
    status: string
    serviceName: string
    clientName: string
    /** Only passed once the booking exists (the platform already shares it with the partner then) */
    clientPhone?: string | null
  }
}

const chip = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'

/** The partner's field tools for a booking: how to get there, call, and put it in the calendar (once confirmed). */
export default function BookingTools({ booking }: Props) {
  const active = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(booking.status)
  if (!active) return null
  const tel = telHref(booking.clientPhone)
  const confirmed = booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS'

  const downloadIcs = () => {
    const ics = buildIcs({
      id: booking.id,
      title: `${booking.serviceName} · ${booking.clientName}`,
      scheduledDate: booking.scheduledDate,
      scheduledTime: booking.scheduledTime,
      address: [booking.address, booking.city].filter(Boolean).join(', '),
      notes: booking.notes,
    })
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `reserva-${booking.id.slice(-6)}.ics`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Herramientas de la reserva">
      <a href={googleMapsUrl(booking.address, booking.city)} target="_blank" rel="noopener noreferrer" className={chip}>
        <Navigation className="h-4 w-4" aria-hidden="true" /> Cómo llegar
      </a>
      <a href={wazeUrl(booking.address, booking.city)} target="_blank" rel="noopener noreferrer" className={chip}>
        <Navigation className="h-4 w-4" aria-hidden="true" /> Abrir en Waze
      </a>
      {tel && (
        <a href={tel} className={chip}>
          <Phone className="h-4 w-4" aria-hidden="true" /> Llamar
        </a>
      )}
      {confirmed && (
        <button type="button" onClick={downloadIcs} className={`${chip} ${tel ? '' : 'col-span-2'}`}>
          <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Agregar al calendario
        </button>
      )}
    </div>
  )
}
