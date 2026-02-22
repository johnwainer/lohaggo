'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import PartnerDashboardNav from '@/components/PartnerDashboardNav'
import { COLOMBIA_BANKS } from '@/lib/banking/colombia'

type BankAccount = {
  id: string
  bankName: string
  accountType: 'SAVINGS' | 'CHECKING'
  accountNumber: string
  accountHolderName: string
  holderDocumentType: 'CC' | 'CE' | 'NIT' | 'PASSPORT'
  holderDocumentNumber: string
  isDefault: boolean
  isActive: boolean
  mercadoPagoRecipientId?: string | null
}

type BankOption = {
  id: string
  code: string
  name: string
  country: string
  isActive: boolean
  sortOrder: number
  accountNumberMinLength: number
  accountNumberMaxLength: number
  supportsSavings: boolean
  supportsChecking: boolean
}

export default function PartnerBankAccountsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [bankOptions, setBankOptions] = useState<BankOption[]>([])
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)
  const [form, setForm] = useState({
    bankName: '',
    accountType: 'SAVINGS' as 'SAVINGS' | 'CHECKING',
    accountNumber: '',
    accountHolderName: '',
    holderDocumentType: 'CC' as 'CC' | 'CE' | 'NIT' | 'PASSPORT',
    holderDocumentNumber: '',
    mercadoPagoRecipientId: '',
  })
  const [saving, setSaving] = useState(false)
  const [processingActionId, setProcessingActionId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const selectedBank = bankOptions.find((bank) => bank.name === form.bankName) || null

  useEffect(() => {
    if (!selectedBank) return
    if (form.accountType === 'SAVINGS' && !selectedBank.supportsSavings && selectedBank.supportsChecking) {
      setForm((prev) => ({ ...prev, accountType: 'CHECKING' }))
    }
    if (form.accountType === 'CHECKING' && !selectedBank.supportsChecking && selectedBank.supportsSavings) {
      setForm((prev) => ({ ...prev, accountType: 'SAVINGS' }))
    }
  }, [selectedBank, form.accountType])

  const load = async () => {
    const res = await fetch('/api/partner/bank-accounts')
    const data = await res.json()
    setAccounts(data.accounts || [])
    setBankOptions(
      Array.isArray(data.bankOptions) && data.bankOptions.length > 0
        ? data.bankOptions
        : COLOMBIA_BANKS.map((bank, index) => ({
            id: bank.id,
            code: bank.id.toUpperCase(),
            name: bank.name,
            country: 'CO',
            isActive: true,
            sortOrder: index + 1,
            accountNumberMinLength: bank.accountNumberMinLength,
            accountNumberMaxLength: bank.accountNumberMaxLength,
            supportsSavings: true,
            supportsChecking: true,
          }))
    )
  }

  const loadCounts = async () => {
    try {
      const [bookingsRes, requestsRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/partner/service-requests')
      ])

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookingsCount(Array.isArray(bookingsData) ? bookingsData.length : 0)
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        const requests = Array.isArray(requestsData)
          ? requestsData
          : Array.isArray(requestsData?.serviceRequests)
            ? requestsData.serviceRequests
            : []
        setRequestsCount(requests.length)
      }
    } catch (error) {
      console.error('Error loading partner counts:', error)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'PARTNER') {
        router.push('/dashboard')
      } else {
        load()
        loadCounts()
      }
    }
  }, [status, session, router])

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/partner/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'No se pudo registrar la cuenta' })
      } else {
        setForm({
          bankName: '',
          accountType: 'SAVINGS',
          accountNumber: '',
          accountHolderName: '',
          holderDocumentType: 'CC',
          holderDocumentNumber: '',
          mercadoPagoRecipientId: '',
        })
        await load()
        setFeedback({ type: 'success', text: 'Cuenta bancaria registrada correctamente.' })
      }
    } catch (error) {
      console.error('Error creating bank account:', error)
      setFeedback({ type: 'error', text: 'No se pudo registrar la cuenta bancaria' })
    } finally {
      setSaving(false)
    }
  }

  const setDefault = async (id: string) => {
    setProcessingActionId(id)
    setFeedback(null)
    try {
      const res = await fetch('/api/partner/bank-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, setDefault: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar la cuenta')
      }
      await load()
      setFeedback({ type: 'success', text: 'Cuenta marcada como predeterminada.' })
    } catch (error: any) {
      setFeedback({ type: 'error', text: error?.message || 'No se pudo actualizar la cuenta' })
    } finally {
      setProcessingActionId(null)
    }
  }

  const deactivate = async (id: string) => {
    setProcessingActionId(id)
    setFeedback(null)
    try {
      const res = await fetch('/api/partner/bank-accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: false }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo desactivar la cuenta')
      }
      await load()
      setFeedback({ type: 'success', text: 'Cuenta desactivada correctamente.' })
    } catch (error: any) {
      setFeedback({ type: 'error', text: error?.message || 'No se pudo desactivar la cuenta' })
    } finally {
      setProcessingActionId(null)
    }
  }

  if (status === 'loading') {
    return (
      <div className="panel-page min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-4">
          <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
          <div className="h-56 rounded-xl bg-white border border-gray-200 animate-pulse" />
          <div className="h-48 rounded-xl bg-white border border-gray-200 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="panel-page min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <h1 className="panel-title truncate">Datos Bancarios</h1>
                <p className="panel-subtitle truncate hidden sm:block">
                  Registra la cuenta colombiana donde recibirás pagos.
                </p>
              </div>
            </div>
          </div>
        </div>

        <PartnerDashboardNav
          bookingsCount={bookingsCount}
          requestsCount={requestsCount}
        />
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {feedback && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <form onSubmit={createAccount} className="grid md:grid-cols-2 gap-3 rounded-xl border bg-white p-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Banco en Colombia</label>
            <select
              className="w-full border rounded-lg px-3 py-2 bg-white"
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              required
            >
              <option value="">Selecciona tu banco</option>
              {bankOptions.map((bank) => (
                <option key={bank.id} value={bank.name}>
                  {bank.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Catálogo Colombia ({bankOptions.length} bancos). Si tu banco no aparece, contacta soporte.
            </p>
          </div>

          <select className="border rounded-lg px-3 py-2" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value as 'SAVINGS' | 'CHECKING' })}>
            {(selectedBank?.supportsSavings ?? true) && <option value="SAVINGS">Ahorros</option>}
            {(selectedBank?.supportsChecking ?? true) && <option value="CHECKING">Corriente</option>}
          </select>
          <input
            className="border rounded-lg px-3 py-2"
            placeholder={selectedBank ? `Cuenta (${selectedBank.accountNumberMinLength}-${selectedBank.accountNumberMaxLength} dígitos)` : 'Número de cuenta'}
            value={form.accountNumber}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={selectedBank?.accountNumberMaxLength || 20}
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })}
            required
          />
          <input className="border rounded-lg px-3 py-2" placeholder="Titular" value={form.accountHolderName} onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })} required />
          <select className="border rounded-lg px-3 py-2" value={form.holderDocumentType} onChange={(e) => setForm({ ...form, holderDocumentType: e.target.value as 'CC' | 'CE' | 'NIT' | 'PASSPORT' })}>
            <option value="CC">CC</option>
            <option value="CE">CE</option>
            <option value="NIT">NIT</option>
            <option value="PASSPORT">PASSPORT</option>
          </select>
          <input
            className="border rounded-lg px-3 py-2"
            placeholder={form.holderDocumentType === 'PASSPORT' ? 'Pasaporte (letras y números)' : 'Documento'}
            value={form.holderDocumentNumber}
            inputMode={form.holderDocumentType === 'PASSPORT' ? 'text' : 'numeric'}
            onChange={(e) =>
              setForm({
                ...form,
                holderDocumentNumber: form.holderDocumentType === 'PASSPORT'
                  ? e.target.value.toUpperCase()
                  : e.target.value.replace(/\D/g, ''),
              })
            }
            required
          />
          <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Mercado Pago recipient_id (requerido para live)" value={form.mercadoPagoRecipientId} onChange={(e) => setForm({ ...form, mercadoPagoRecipientId: e.target.value })} />
          <div className="md:col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <p className="font-semibold mb-1">Formato esperado</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Número de cuenta: solo números ({selectedBank ? `${selectedBank.accountNumberMinLength}-${selectedBank.accountNumberMaxLength}` : '8-20'} dígitos).</li>
              <li>Tipo de cuenta: ahorros o corriente.</li>
              <li>Documento: CC/CE/NIT numérico o pasaporte alfanumérico.</li>
            </ul>
          </div>
          <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-semibold">¿Dónde saco mi `recipient_id` de Mercado Pago?</p>
            <ol className="list-decimal pl-5 mt-1 space-y-1 text-blue-800">
              <li>Entra al panel de desarrolladores de Mercado Pago con tu cuenta.</li>
              <li>Configura la cuenta receptora para transferencias/payouts.</li>
              <li>Copia el identificador del receptor (`recipient_id`) y pégalo aquí.</li>
            </ol>
            <a
              href="https://www.mercadopago.com.co/developers/es/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 font-semibold text-blue-700 underline"
            >
              Ver documentación oficial de Mercado Pago
            </a>
          </div>
          <button disabled={saving} className="md:col-span-2 rounded-lg bg-primary-600 text-white px-4 py-2 disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar cuenta'}</button>
        </form>

        <div className="rounded-xl border bg-white p-4 space-y-2">
          {accounts.length === 0 ? (
            <p className="text-gray-500">Aún no tienes cuentas registradas.</p>
          ) : accounts.map((acc) => (
            <div key={acc.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{acc.bankName} · {acc.accountType === 'SAVINGS' ? 'Ahorros' : 'Corriente'}</p>
                <p className="text-sm text-gray-600">****{acc.accountNumber.slice(-4)} · {acc.holderDocumentType} {acc.holderDocumentNumber}</p>
                <p className="text-xs text-gray-500">{acc.isDefault ? 'Predeterminada' : 'Secundaria'} · {acc.isActive ? 'Activa' : 'Inactiva'}</p>
              </div>
              <div className="flex gap-2">
                {!acc.isDefault && acc.isActive && (
                  <button
                    onClick={() => setDefault(acc.id)}
                    disabled={processingActionId === acc.id}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingActionId === acc.id ? 'Actualizando...' : 'Predeterminar'}
                  </button>
                )}
                {acc.isActive && (
                  <button
                    onClick={() => deactivate(acc.id)}
                    disabled={processingActionId === acc.id}
                    className="px-3 py-1 border rounded text-sm text-red-600 border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingActionId === acc.id ? 'Actualizando...' : 'Desactivar'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
