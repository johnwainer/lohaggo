'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { CreditCard, Plus, Trash2, Check, AlertCircle, Info } from 'lucide-react'
import Link from 'next/link'
import AccountTopHeader from '@/components/shared/AccountTopHeader'
import AccountPanel from '@/components/shared/AccountPanel'
import ConfirmModal from '@/components/ConfirmModal'
interface PaymentMethod { id: string; lastFourDigits: string; cardBrand: string; cardholderName: string; expirationMonth: number; expirationYear: number; isDefault: boolean; isActive: boolean; createdAt: string }
export default function PaymentMethodsPage() {
  const { status } = useSession()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null)
  const fetchMethods = async (options?: { preserveSuccess?: boolean }) => {
    const { preserveSuccess = false } = options ?? {}
    setLoading(true)
    setError(null)
    if (!preserveSuccess) {
      setSuccess(null)
    }
    try {
      const res = await fetch('/api/payment-methods')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al obtener métodos de pago')
      }
      const methods = await res.json()
      setPaymentMethods(Array.isArray(methods) ? methods : [])
    } catch (err: any) {
      setError(err.message || 'Error al cargar métodos de pago')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (status === 'authenticated') {
      fetchMethods()
    }
  }, [status])
  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(null), 4000)
    return () => clearTimeout(timer)
  }, [success])
  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/payment-methods/${id}/set-default`, { method: 'PATCH' })
      if (!res.ok) throw new Error('No se pudo actualizar el método')
      setSuccess('Método predeterminado actualizado')
      await fetchMethods({ preserveSuccess: true })
    } catch (err: any) {
      setSuccess(null)
      setError(err.message || 'Error al actualizar método')
    }
  }
  const handleDelete = async (method: PaymentMethod) => {
    try {
      const res = await fetch(`/api/payment-methods/${method.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo eliminar el método de pago')
      }
      setSuccess('Método de pago eliminado')
      await fetchMethods({ preserveSuccess: true })
    } catch (err: any) {
      setSuccess(null)
      setError(err.message || 'Error al eliminar método')
    }
  }
  if (status === 'loading' || loading) return <div className="panel-page min-h-screen flex items-center justify-center bg-gray-50"><div role="status" aria-label="Cargando métodos de pago" className="h-12 w-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" /></div>
  const formatExpiry = (month: number, year: number) => `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`
  return (
    <div className="account-shell">
      <AccountTopHeader
        role="CLIENT"
        title="Métodos de pago"
        subtitle="Administra tus tarjetas guardadas"
        action={
          <Link href="/dashboard/payment-methods/add" className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm text-white font-semibold hover:bg-primary-700 transition-colors whitespace-nowrap">
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Agregar método</span>
            <span className="sm:hidden">Agregar</span>
          </Link>
        }
      />
      <div className="account-main space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
          <p className="text-sm">
            <span className="font-semibold">Por ahora pagas con Mercado Pago, efectivo o transferencia al terminar el servicio.</span>{' '}
            Las tarjetas guardadas aún no se usan para cobrar.
          </p>
        </div>
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
            <div><p className="font-semibold">Hubo un problema</p><p className="text-sm">{error}</p></div>
          </div>
        )}
        {success && (
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800">
            <Check className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="font-semibold">{success}</p>
          </div>
        )}
        {paymentMethods.length === 0 ? (
          <AccountPanel className="border-dashed border-2 border-gray-200 text-center">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400" aria-hidden="true" />
            <p className="text-lg font-semibold text-gray-900 mt-2">No tienes tarjetas guardadas</p>
            <p className="text-sm text-gray-600">Puedes guardar una tarjeta para cuando habilitemos el cobro con tarjeta guardada.</p>
            <Link href="/dashboard/payment-methods/add" className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-white font-semibold hover:bg-primary-700 transition-colors">
              <Plus className="w-4 h-4" aria-hidden="true" />Agregar tarjeta
            </Link>
          </AccountPanel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {paymentMethods.map(method => (
              <div key={method.id} className="surface-card p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-xl bg-primary-500/10 p-3 text-primary-600" aria-hidden="true"><CreditCard className="w-6 h-6" /></div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase text-gray-600">{method.cardBrand}</p>
                      <p className="text-xl font-semibold tracking-widest" aria-label={`Tarjeta terminada en ${method.lastFourDigits}`}>**** {method.lastFourDigits}</p>
                      <p className="text-sm text-gray-600 truncate">{method.cardholderName}</p>
                    </div>
                  </div>
                  {method.isDefault && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"><Check className="w-4 h-4" aria-hidden="true" />Predeterminada</span>}
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Vence {formatExpiry(method.expirationMonth, method.expirationYear)}</span>
                  <span>{method.isActive ? 'Activa' : 'Inactiva'}</span>
                </div>
                <p className="text-xs text-gray-600">Guardada el {new Date(method.createdAt).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</p>
                <div className="flex flex-wrap gap-3">
                  {!method.isDefault && (
                    <button type="button" onClick={() => handleSetDefault(method.id)} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                      <Check className="w-4 h-4" aria-hidden="true" />Predeterminar
                    </button>
                  )}
                  <button type="button" onClick={() => setDeleting(method)} aria-label={`Eliminar tarjeta terminada en ${method.lastFourDigits}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" aria-hidden="true" />Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) void handleDelete(deleting) }}
        title="Eliminar tarjeta"
        message={deleting ? `¿Eliminar la tarjeta terminada en ${deleting.lastFourDigits}?` : ''}
        confirmText="Sí, eliminar"
        cancelText="No, mantener"
        type="danger"
      />
    </div>
  )
}
