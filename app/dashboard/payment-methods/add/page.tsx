'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, AlertCircle, Info } from 'lucide-react'
import AccountTopHeader from '@/components/shared/AccountTopHeader'
import AccountPanel from '@/components/shared/AccountPanel'

export default function AddPaymentMethodPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardNumber, setCardNumber] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [expiration, setExpiration] = useState('')
  const [cvv, setCvv] = useState('')
  const [setDefault, toggleDefault] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) return

    const sanitizedNumber = cardNumber.replace(/\s+/g, '')
    const [rawMonth = '', rawYear = ''] = expiration.replace(/\s+/g, '').split('/')
    const month = rawMonth.padStart(2, '0')
    const yearInput = rawYear.length === 2 ? `20${rawYear}` : rawYear
    const year = Number(yearInput)
    const now = new Date()

    if (sanitizedNumber.length < 13 || sanitizedNumber.length > 19) {
      setError('Número de tarjeta inválido')
      return
    }

    if (!cardholderName.trim()) {
      setError('Ingresa el nombre del titular')
      return
    }

    if (month.length !== 2 || Number(month) < 1 || Number(month) > 12 || !year) {
      setError('Fecha de vencimiento inválida')
      return
    }

    if (year < now.getFullYear() || year > now.getFullYear() + 20) {
      setError('Fecha de vencimiento inválida')
      return
    }

    if (cvv.length < 3 || cvv.length > 4) {
      setError('CVV inválido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: sanitizedNumber,
          cardholderName,
          expirationMonth: Number(month),
          expirationYear: year,
          cvv,
          setDefault,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.error || 'No se pudo guardar la tarjeta')
        return
      }

      setCvv('')
      router.push('/dashboard/payment-methods')
      router.refresh()
    } catch (err) {
      setError('Ocurrió un error al guardar la tarjeta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="account-shell">
      <AccountTopHeader
        role="CLIENT"
        title="Agregar tarjeta"
        subtitle="Guarda una tarjeta en tu cuenta"
      />

      <div className="account-main">
        <div className="max-w-2xl mx-auto">
          <AccountPanel>
          <div className="mb-6 text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center" aria-hidden="true">
              <CreditCard size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Guardar una tarjeta</h2>
            <p className="text-gray-600 text-sm">Mercado Pago guarda tu tarjeta; nosotros solo guardamos los últimos 4 dígitos.</p>
          </div>

          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
            <p className="text-sm">
              <span className="font-semibold">Por ahora pagas con Mercado Pago, efectivo o transferencia al terminar el servicio.</span>{' '}
              Las tarjetas guardadas aún no se usan para cobrar.
            </p>
          </div>

          {error && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="text-red-700 flex-shrink-0 mt-0.5" size={20} aria-hidden="true" />
              <div>
                <p className="font-bold text-red-900">No pudimos guardar la tarjeta</p>
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="card-number" className="block text-sm font-bold text-gray-700 mb-2">Número de Tarjeta</label>
              <input
                type="text"
                id="card-number"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={event => {
                  const digits = event.target.value.replace(/[^0-9]/g, '').slice(0, 19)
                  setCardNumber(digits.replace(/(\d{4})(?=\d)/g, '$1 '))
                }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                inputMode="numeric"
                autoComplete="cc-number"
              />
            </div>
            <div>
              <label htmlFor="card-name" className="block text-sm font-bold text-gray-700 mb-2">Nombre del Titular</label>
              <input
                type="text"
                id="card-name"
                placeholder="Como aparece en la tarjeta"
                value={cardholderName}
                onChange={event => setCardholderName(event.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                autoComplete="cc-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="card-exp" className="block text-sm font-bold text-gray-700 mb-2">Fecha de Vencimiento</label>
                <input
                  type="text"
                  id="card-exp"
                  placeholder="MM/AA"
                  value={expiration}
                  onChange={event => {
                    const value = event.target.value.replace(/[^0-9]/g, '').slice(0, 4)
                    setExpiration(value.length <= 2 ? value : `${value.slice(0, 2)}/${value.slice(2)}`)
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                />
              </div>
              <div>
                <label htmlFor="card-cvv" className="block text-sm font-bold text-gray-700 mb-2">CVV</label>
                <input
                  type="password"
                  id="card-cvv"
                  aria-describedby="card-cvv-help"
                  placeholder="123"
                  value={cvv}
                  onChange={event => setCvv(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
                <p id="card-cvv-help" className="mt-1 text-xs text-gray-600">Solo se usa para validar la tarjeta con Mercado Pago; no lo guardamos.</p>
              </div>
            </div>
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={setDefault}
                onChange={event => toggleDefault(event.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              Establecer como método de pago predeterminado
            </label>
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="text-blue-700 flex-shrink-0 mt-0.5" size={20} aria-hidden="true" />
              <div>
                <p className="font-bold text-blue-900 mb-1">Seguridad</p>
                <p className="text-blue-800 text-sm">Procesamos tus datos con Mercado Pago para garantizar la seguridad de tu tarjeta.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 min-h-[44px] px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 transition-all font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 min-h-[44px] bg-primary-600 text-white px-6 py-3 rounded-full hover:bg-primary-700 transition-colors font-bold shadow-card disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Guardando...' : 'Guardar Tarjeta'}
              </button>
            </div>
          </form>
          </AccountPanel>
        </div>
        <div className="mt-6 text-center text-sm text-gray-600">
          ¿Necesitas ayuda?
          <a href="/faq" className="ml-1 text-primary-700 hover:underline font-bold">Visita nuestro FAQ</a>
        </div>
      </div>
    </div>
  )
}
