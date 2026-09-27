'use client'

import { useState } from 'react'
import { Crosshair, Lock, MapPin, Plus } from 'lucide-react'
import type { AddressMode, NewAddressDraft } from '@/lib/service-requests/draft'

export type SavedAddress = {
  id: string
  label: string
  street: string
  number: string
  complement?: string | null
  neighborhood: string
  city: string
  instructions?: string | null
  isPrimary: boolean
}

type Props = {
  addresses: SavedAddress[]
  mode: AddressMode
  selectedAddressId: string
  newAddress: NewAddressDraft
  formatAddress: (a: SavedAddress) => string
  onSelectSaved: (id: string) => void
  onUseNew: () => void
  onNewAddressChange: (next: NewAddressDraft) => void
}

const inputCls = 'w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base text-gray-900 outline-none transition focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20'

export default function AddressStep({ addresses, mode, selectedAddressId, newAddress, formatAddress, onSelectSaved, onUseNew, onNewAddressChange }: Props) {
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoMsg, setGeoMsg] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const showForm = mode === 'new' || addresses.length === 0

  const set = (patch: Partial<NewAddressDraft>) => onNewAddressChange({ ...newAddress, ...patch })

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoMsg({ tone: 'warn', text: 'Tu navegador no comparte la ubicación. Escribe tu dirección.' })
      return
    }
    setGeoLoading(true)
    setGeoMsg(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/public/geo/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`)
          const d = res.ok ? ((await res.json()) as { street?: string; neighborhood?: string }) : {}
          if (d.street || d.neighborhood) {
            onNewAddressChange({
              ...newAddress,
              street: d.street || newAddress.street,
              neighborhood: d.neighborhood || newAddress.neighborhood,
            })
            setGeoMsg({ tone: 'ok', text: 'Revisa la dirección y completa el número, torre o apto.' })
          } else {
            setGeoMsg({ tone: 'warn', text: 'No pudimos leer tu dirección. Escríbela a mano.' })
          }
        } catch {
          setGeoMsg({ tone: 'warn', text: 'No pudimos leer tu dirección. Escríbela a mano.' })
        } finally {
          setGeoLoading(false)
        }
      },
      (err) => {
        setGeoLoading(false)
        setGeoMsg({
          tone: 'warn',
          text: err.code === err.PERMISSION_DENIED
            ? 'No diste permiso de ubicación. Escribe tu dirección.'
            : 'No pudimos obtener tu ubicación. Escribe tu dirección.',
        })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <h3 className="text-lg md:text-xl font-bold text-gray-900">¿Dónde necesitas el servicio?</h3>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
          <Lock size={12} className="shrink-0" />
          Solo compartimos tu dirección exacta con el socio que elijas
        </p>
      </div>

      {addresses.length > 0 && (
        <div className="space-y-2" role="radiogroup" aria-label="Tus direcciones">
          {addresses.map((addr) => {
            const active = mode === 'saved' && selectedAddressId === addr.id
            return (
              <label
                key={addr.id}
                className={`flex items-start gap-3 rounded-2xl border-2 p-3 md:p-4 cursor-pointer transition ${active ? 'border-secondary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}
              >
                <input
                  type="radio"
                  name="address"
                  value={addr.id}
                  checked={active}
                  onChange={() => onSelectSaved(addr.id)}
                  className="mt-1 h-5 w-5 text-secondary-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900">{addr.label}</div>
                  <div className="break-words text-xs md:text-sm text-gray-600">{formatAddress(addr)}</div>
                </div>
              </label>
            )
          })}
          {mode !== 'new' && (
            <button
              type="button"
              onClick={onUseNew}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 py-3 text-sm font-semibold text-secondary-600 transition hover:border-secondary-500 hover:bg-primary-50"
            >
              <Plus size={18} />
              Usar otra dirección
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className={`space-y-3 ${addresses.length > 0 ? 'rounded-2xl border-2 border-secondary-500 bg-primary-50/40 p-3 md:p-4' : ''}`}>
          {addresses.length > 0 && <p className="text-sm font-semibold text-gray-900">Otra dirección</p>}

          <button
            type="button"
            onClick={useMyLocation}
            disabled={geoLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
          >
            {geoLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
            ) : (
              <Crosshair size={18} />
            )}
            {geoLoading ? 'Buscando tu ubicación…' : 'Usar mi ubicación'}
          </button>
          {geoMsg && (
            <p role="status" className={`text-xs ${geoMsg.tone === 'ok' ? 'text-emerald-700' : 'text-amber-700'}`}>{geoMsg.text}</p>
          )}

          <div>
            <label htmlFor="req-street" className="mb-1 block text-sm font-semibold text-gray-700">Dirección</label>
            <div className="relative">
              <MapPin size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="req-street"
                type="text"
                autoComplete="street-address"
                placeholder="Ej: Calle 10 # 43-21, apto 301"
                value={newAddress.street}
                maxLength={200}
                onChange={(e) => set({ street: e.target.value })}
                className={`${inputCls} pl-10`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="req-neighborhood" className="mb-1 block text-sm font-semibold text-gray-700">Barrio</label>
            <input
              id="req-neighborhood"
              type="text"
              placeholder="Ej: Laureles"
              value={newAddress.neighborhood}
              maxLength={100}
              onChange={(e) => set({ neighborhood: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="req-instructions" className="mb-1 block text-sm font-semibold text-gray-700">
              Indicaciones <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              id="req-instructions"
              type="text"
              placeholder="Ej: portería 2, casa esquinera"
              value={newAddress.instructions}
              maxLength={300}
              onChange={(e) => set({ instructions: e.target.value })}
              className={inputCls}
            />
          </div>
          <p className="text-xs text-gray-500">La guardamos en tus direcciones para la próxima vez.</p>
        </div>
      )}
    </div>
  )
}
