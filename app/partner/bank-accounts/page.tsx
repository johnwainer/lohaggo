'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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

export default function PartnerBankAccountsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [form, setForm] = useState({
    bankName: '',
    accountType: 'SAVINGS',
    accountNumber: '',
    accountHolderName: '',
    holderDocumentType: 'CC',
    holderDocumentNumber: '',
    mercadoPagoRecipientId: '',
  })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await fetch('/api/partner/bank-accounts')
    const data = await res.json()
    setAccounts(data.accounts || [])
  }

  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'PARTNER') {
        router.push('/dashboard')
      } else {
        load()
      }
    }
  }, [status, session, router])

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/partner/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'No se pudo registrar la cuenta')
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
      }
    } finally {
      setSaving(false)
    }
  }

  const setDefault = async (id: string) => {
    await fetch('/api/partner/bank-accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, setDefault: true }),
    })
    await load()
  }

  const deactivate = async (id: string) => {
    await fetch('/api/partner/bank-accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: false }),
    })
    await load()
  }

  if (status === 'loading') return null

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis cuentas bancarias</h1>
        <p className="text-gray-600">Registra la cuenta colombiana donde recibirás pagos.</p>
      </div>

      <form onSubmit={createAccount} className="grid md:grid-cols-2 gap-3 rounded-xl border bg-white p-4">
        <input className="border rounded-lg px-3 py-2" placeholder="Banco" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} required />
        <select className="border rounded-lg px-3 py-2" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
          <option value="SAVINGS">Ahorros</option>
          <option value="CHECKING">Corriente</option>
        </select>
        <input className="border rounded-lg px-3 py-2" placeholder="Número de cuenta" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} required />
        <input className="border rounded-lg px-3 py-2" placeholder="Titular" value={form.accountHolderName} onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })} required />
        <select className="border rounded-lg px-3 py-2" value={form.holderDocumentType} onChange={(e) => setForm({ ...form, holderDocumentType: e.target.value })}>
          <option value="CC">CC</option>
          <option value="CE">CE</option>
          <option value="NIT">NIT</option>
          <option value="PASSPORT">PASSPORT</option>
        </select>
        <input className="border rounded-lg px-3 py-2" placeholder="Documento" value={form.holderDocumentNumber} onChange={(e) => setForm({ ...form, holderDocumentNumber: e.target.value })} required />
        <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Mercado Pago recipient_id (requerido para live)" value={form.mercadoPagoRecipientId} onChange={(e) => setForm({ ...form, mercadoPagoRecipientId: e.target.value })} />
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
              <p className="font-medium">{acc.bankName} · {acc.accountType}</p>
              <p className="text-sm text-gray-600">****{acc.accountNumber.slice(-4)} · {acc.holderDocumentType} {acc.holderDocumentNumber}</p>
              <p className="text-xs text-gray-500">{acc.isDefault ? 'Predeterminada' : 'Secundaria'} · {acc.isActive ? 'Activa' : 'Inactiva'}</p>
            </div>
            <div className="flex gap-2">
              {!acc.isDefault && acc.isActive && <button onClick={() => setDefault(acc.id)} className="px-3 py-1 border rounded text-sm">Predeterminar</button>}
              {acc.isActive && <button onClick={() => deactivate(acc.id)} className="px-3 py-1 border rounded text-sm text-red-600 border-red-200">Desactivar</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
