'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { COLOMBIA_BANKS } from '@/lib/banking/colombia'
import AccountTopHeader from '@/components/shared/AccountTopHeader'
import { opportunitiesFromResponse } from '@/lib/partners/opportunities'
import { maskAccountNumber } from '@/lib/admin/pagination'
import { BottomSheet } from '@/components/ui/bottom-sheet'

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

const DOC_TYPE_LABEL: Record<BankAccount['holderDocumentType'], string> = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  NIT: 'NIT',
  PASSPORT: 'Pasaporte',
}

const FIELD = 'w-full border border-gray-300 rounded-xl px-3 min-h-[44px] bg-white text-sm outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'
const LABEL = 'block text-sm font-semibold text-gray-700 mb-1'

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
  const [formOpen, setFormOpen] = useState(false)
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
        setRequestsCount(opportunitiesFromResponse(requestsData).requests.length)
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
        setFormOpen(false)
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
      <div className="panel-page min-h-screen bg-gradient-to-br from-gray-50 to-gray-100" aria-busy="true">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-4">
          <span className="sr-only">Cargando datos bancarios…</span>
          <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
          <div className="h-56 rounded-xl bg-white border border-gray-200 animate-pulse" />
          <div className="h-48 rounded-xl bg-white border border-gray-200 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="account-shell">
      <AccountTopHeader
        role="PARTNER"
        title="Datos Bancarios"
        subtitle="Registra la cuenta colombiana donde recibirás pagos."
        counts={{
          bookings: bookingsCount,
          requests: requestsCount
        }}
      />

      <div className="account-main-narrow space-y-6">
        {feedback && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`rounded-2xl border p-3 text-sm ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="surface-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900">Mis cuentas</h2>
            {accounts.length > 0 && (
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="rounded-full bg-primary-600 text-white px-4 min-h-[44px] text-sm font-semibold hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                + Agregar cuenta
              </button>
            )}
          </div>
          {accounts.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl" aria-hidden="true">🏦</span>
              </div>
              <p className="font-semibold text-gray-900 mb-1">Aún no tienes cuentas registradas</p>
              <p className="text-sm text-gray-600 mb-4">Registra una cuenta en Colombia para recibir tus pagos.</p>
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="inline-flex items-center rounded-full bg-primary-600 text-white px-5 min-h-[48px] text-sm font-semibold hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                + Agregar cuenta bancaria
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {accounts.map((acc) => (
                <li key={acc.id} className="border border-gray-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate" title={acc.bankName}>{acc.bankName} · {acc.accountType === 'SAVINGS' ? 'Ahorros' : 'Corriente'}</p>
                    <p className="text-sm text-gray-600">
                      <span className="sr-only">Cuenta terminada en </span>{maskAccountNumber(acc.accountNumber)} · {acc.holderDocumentType} {maskAccountNumber(acc.holderDocumentNumber)}
                    </p>
                    <p className="text-xs text-gray-600">{acc.isDefault ? 'Predeterminada' : 'Secundaria'} · {acc.isActive ? 'Activa' : 'Inactiva'}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!acc.isDefault && acc.isActive && (
                      <button
                        type="button"
                        onClick={() => setDefault(acc.id)}
                        disabled={processingActionId === acc.id}
                        className="px-4 min-h-[44px] border border-gray-300 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      >
                        {processingActionId === acc.id ? 'Actualizando…' : 'Predeterminar'}
                      </button>
                    )}
                    {acc.isActive && (
                      <button
                        type="button"
                        onClick={() => deactivate(acc.id)}
                        disabled={processingActionId === acc.id}
                        aria-label={`Desactivar cuenta ${acc.bankName} terminada en ${acc.accountNumber.replace(/\D/g, "").slice(-4)}`}
                        className="px-4 min-h-[44px] border border-red-200 rounded-full text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        {processingActionId === acc.id ? 'Actualizando…' : 'Desactivar'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <BottomSheet
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title="Agregar cuenta bancaria"
        >
          <form id="bank-account-form" onSubmit={createAccount} className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label htmlFor="ba-bank" className={LABEL}>Banco en Colombia</label>
              <select
                id="ba-bank"
                className={FIELD}
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                aria-describedby="ba-bank-help"
                required
              >
                <option value="">Selecciona tu banco</option>
                {bankOptions.map((bank) => (
                  <option key={bank.id} value={bank.name}>
                    {bank.name}
                  </option>
                ))}
              </select>
              <p id="ba-bank-help" className="mt-1 text-xs text-gray-600">
                Si tu banco no aparece, escríbenos a soporte.
              </p>
            </div>

            <div>
              <label htmlFor="ba-type" className={LABEL}>Tipo de cuenta</label>
              <select id="ba-type" className={FIELD} value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value as 'SAVINGS' | 'CHECKING' })}>
                {(selectedBank?.supportsSavings ?? true) && <option value="SAVINGS">Ahorros</option>}
                {(selectedBank?.supportsChecking ?? true) && <option value="CHECKING">Corriente</option>}
              </select>
            </div>
            <div>
              <label htmlFor="ba-number" className={LABEL}>Número de cuenta</label>
              <input
                id="ba-number"
                className={FIELD}
                placeholder={selectedBank ? `${selectedBank.accountNumberMinLength} a ${selectedBank.accountNumberMaxLength} dígitos` : 'Solo números'}
                value={form.accountNumber}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={selectedBank?.accountNumberMaxLength || 20}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="ba-holder" className={LABEL}>Titular de la cuenta</label>
              <input id="ba-holder" className={FIELD} placeholder="Nombre como aparece en el banco" autoComplete="name" value={form.accountHolderName} onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })} required />
            </div>
            <div>
              <label htmlFor="ba-doc-type" className={LABEL}>Tipo de documento</label>
              <select id="ba-doc-type" className={FIELD} value={form.holderDocumentType} onChange={(e) => setForm({ ...form, holderDocumentType: e.target.value as 'CC' | 'CE' | 'NIT' | 'PASSPORT' })}>
                {(Object.keys(DOC_TYPE_LABEL) as BankAccount['holderDocumentType'][]).map((k) => (
                  <option key={k} value={k}>{DOC_TYPE_LABEL[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ba-doc" className={LABEL}>Número de documento</label>
              <input
                id="ba-doc"
                className={FIELD}
                placeholder={form.holderDocumentType === 'PASSPORT' ? 'Letras y números' : 'Solo números'}
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
            </div>
            <details className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-700">
              <summary className="cursor-pointer font-semibold px-3 min-h-[44px] flex items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">Formato esperado</summary>
              <ul className="list-disc pl-8 pr-3 pb-3 space-y-1">
                <li>Número de cuenta: solo números ({selectedBank ? `${selectedBank.accountNumberMinLength} a ${selectedBank.accountNumberMaxLength}` : '8 a 20'} dígitos).</li>
                <li>Tipo de cuenta: ahorros o corriente.</li>
                <li>Documento: cédula, cédula de extranjería o NIT con números; pasaporte con letras y números.</li>
              </ul>
            </details>
            <details className="md:col-span-2 rounded-2xl border border-gray-200 bg-white text-sm text-gray-700">
              <summary className="cursor-pointer font-semibold px-3 min-h-[44px] flex items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">Avanzado (solo soporte)</summary>
              <div className="px-3 pb-3">
                <p className="text-xs text-gray-600 mb-2">No necesitas llenar esto. Solo si el equipo de LoHaggo te pide un código de Mercado Pago.</p>
                <label htmlFor="ba-mp" className={LABEL}>Código de Mercado Pago</label>
                <input id="ba-mp" className={FIELD} autoComplete="off" value={form.mercadoPagoRecipientId} onChange={(e) => setForm({ ...form, mercadoPagoRecipientId: e.target.value })} />
              </div>
            </details>
            <div className="md:col-span-2 flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-full border border-gray-300 text-gray-700 px-5 min-h-[44px] text-sm font-semibold hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded-full bg-primary-600 text-white px-5 min-h-[44px] text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">{saving ? 'Guardando…' : 'Guardar cuenta'}</button>
            </div>
          </form>
        </BottomSheet>
      </div>
    </div>
  )
}
