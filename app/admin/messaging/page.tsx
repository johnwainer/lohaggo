'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare, Phone, Key, CheckCircle2, XCircle, Eye, EyeOff,
  Send, Loader2, RefreshCw, Wifi, WifiOff, AlertTriangle, ChevronDown,
} from 'lucide-react'

type TwilioProvider = {
  active: boolean
  accountSid: string
  smsFrom: string
  whatsappFrom: string
  hasAuthToken: boolean
}

type PhoneNumber = { number: string; friendly: string; capabilities: string[] }
type WASender = { number: string; label: string; isSandbox: boolean }

type TestResult = {
  ok: boolean
  provider: string
  providerMessageId?: string
  twilioStatus?: string
  from?: string
  to?: string
  errorCode?: string
  errorMessage?: string
  errorExplanation?: string
} | null

const STATUS_COLOR: Record<string, string> = {
  queued: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  sent: 'text-blue-700 bg-blue-50 border-blue-200',
  delivered: 'text-green-700 bg-green-50 border-green-200',
  undelivered: 'text-red-700 bg-red-50 border-red-200',
  failed: 'text-red-700 bg-red-50 border-red-200',
}

export default function MessagingPage() {
  const [provider, setProvider] = useState<TwilioProvider | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editing, setEditing] = useState(false)

  // numbers from Twilio
  const [smsNumbers, setSmsNumbers] = useState<PhoneNumber[]>([])
  const [waSenders, setWaSenders] = useState<WASender[]>([])
  const [numbersLoading, setNumbersLoading] = useState(false)

  // form
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [smsFrom, setSmsFrom] = useState('')
  const [whatsappFrom, setWhatsappFrom] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [showToken, setShowToken] = useState(false)

  // test
  const [testChannel, setTestChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP')
  const [testTo, setTestTo] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [testFrom, setTestFrom] = useState('') // override sender for test
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<TestResult>(null)

  const fetchNumbers = useCallback(async () => {
    setNumbersLoading(true)
    try {
      const res = await fetch('/api/admin/messaging/numbers')
      if (res.ok) {
        const data = await res.json()
        setSmsNumbers(data.smsNumbers || [])
        setWaSenders(data.whatsappSenders || [])
      }
    } finally {
      setNumbersLoading(false)
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/messaging/providers')
      const data = await res.json()
      const twilio: TwilioProvider = data.providers?.twilio
      setProvider(twilio)
      setAccountSid(twilio?.accountSid || '')
      setSmsFrom(twilio?.smsFrom || '')
      setWhatsappFrom(twilio?.whatsappFrom || '')
      setIsActive(twilio?.active ?? true)
    } catch {
      setMsg({ type: 'error', text: 'Error al cargar configuración' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchNumbers()
  }, [fetchStatus, fetchNumbers])

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const body: Record<string, unknown> = {
        provider: 'TWILIO', isActive,
        smsFrom: smsFrom || undefined,
        whatsappFrom: whatsappFrom || undefined,
      }
      if (accountSid && !accountSid.includes('*')) body.accountSid = accountSid
      if (authToken) body.authToken = authToken

      const res = await fetch('/api/admin/messaging/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }
      setMsg({ type: 'success', text: 'Configuración guardada' })
      setAuthToken('')
      setEditing(false)
      await fetchStatus()
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!testTo) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/messaging/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: testChannel,
          to: testTo,
          message: testMessage || undefined,
          fromOverride: testFrom || undefined,
        }),
      })
      setTestResult(await res.json())
    } catch {
      setTestResult({ ok: false, provider: 'unknown', errorMessage: 'Error de red al llamar API' })
    } finally {
      setTestLoading(false)
    }
  }

  const isConfigured = provider?.hasAuthToken && provider?.accountSid
  const wpConfigured = isConfigured && !!provider?.whatsappFrom
  const smsConfigured = isConfigured && !!provider?.smsFrom

  // Determine the "from" shown in test based on channel
  const effectiveTestFrom = testFrom || (testChannel === 'WHATSAPP' ? provider?.whatsappFrom : provider?.smsFrom) || ''

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mensajería</h1>
          <p className="text-gray-500 text-sm mt-0.5">Twilio · WhatsApp Business · SMS</p>
        </div>
        <button
          onClick={() => { fetchStatus(); fetchNumbers() }}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          title="Recargar"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatusCard label="Twilio" ok={!!isConfigured && !!provider?.active}
          detail={provider?.accountSid ? `${provider.accountSid.slice(0, 6)}…` : 'No config'} loading={loading} />
        <StatusCard label="WhatsApp" ok={!!wpConfigured}
          detail={provider?.whatsappFrom || 'Sin número'} loading={loading} />
        <StatusCard label="SMS" ok={!!smsConfigured}
          detail={provider?.smsFrom || 'Sin número'} loading={loading} />
      </div>

      {/* Credentials */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 font-semibold text-gray-800">
            <Key size={16} className="text-gray-400" /> Credenciales Twilio
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-sm font-medium text-primary-600 hover:text-primary-700">
              Editar
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Account SID" value={accountSid} onChange={setAccountSid}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" disabled={!editing} />

            {/* Auth Token */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Auth Token</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={authToken}
                  onChange={e => setAuthToken(e.target.value)}
                  disabled={!editing}
                  placeholder={provider?.hasAuthToken ? '••••••••••••••••••••••••••••••••' : 'Pega el auth token'}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
                {editing && (
                  <button type="button" onClick={() => setShowToken(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
              {provider?.hasAuthToken && !authToken && editing && (
                <p className="text-xs text-gray-400">Dejar vacío para mantener el actual</p>
              )}
            </div>

            {/* SMS From */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                Número SMS activo
              </label>
              {editing && smsNumbers.length > 0 ? (
                <SelectOrInput
                  value={smsFrom}
                  onChange={setSmsFrom}
                  options={smsNumbers.map(n => ({ value: n.number, label: `${n.number} — ${n.friendly}` }))}
                  placeholder="+19786445487"
                />
              ) : (
                <Field value={smsFrom} onChange={setSmsFrom} placeholder="+19786445487" disabled={!editing} />
              )}
            </div>

            {/* WhatsApp From */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                Sender WhatsApp activo
              </label>
              {editing && waSenders.length > 0 ? (
                <SelectOrInput
                  value={whatsappFrom}
                  onChange={setWhatsappFrom}
                  options={waSenders.map(s => ({ value: s.number, label: s.label }))}
                  placeholder="+573337507792"
                />
              ) : (
                <Field value={whatsappFrom} onChange={setWhatsappFrom} placeholder="+573337507792" disabled={!editing} />
              )}
              {!editing && provider?.whatsappFrom && (
                <p className="text-xs text-gray-400">
                  {provider.whatsappFrom.includes('15558464003') ? '⚠️ Sandbox activo — solo funciona con opt-in' : ''}
                </p>
              )}
            </div>
          </div>

          {editing && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
              Proveedor activo
            </label>
          )}

          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
              msg.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              {msg.type === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              {msg.text}
            </div>
          )}

          {editing && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setEditing(false); setAuthToken(''); setMsg(null); fetchStatus() }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Guardar
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Test send */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 font-semibold text-gray-800">
          <Send size={16} className="text-gray-400" /> Envío de Prueba
        </div>

        <div className="p-5 space-y-4">
          {/* Channel + From picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Canal</label>
              <div className="flex gap-2">
                {(['WHATSAPP', 'SMS'] as const).map(ch => (
                  <button key={ch} onClick={() => { setTestChannel(ch); setTestFrom('') }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium border transition ${
                      testChannel === ch ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}>
                    {ch === 'WHATSAPP' ? <MessageSquare size={14} /> : <Phone size={14} />}
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {/* Sender override for test */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                Enviar desde <span className="text-gray-400 normal-case font-normal">(opcional, sobreescribe el activo)</span>
              </label>
              {testChannel === 'WHATSAPP' && waSenders.length > 0 ? (
                <SelectOrInput
                  value={testFrom}
                  onChange={setTestFrom}
                  options={[
                    { value: '', label: `Default: ${provider?.whatsappFrom || '—'}` },
                    ...waSenders.map(s => ({ value: s.number, label: s.label })),
                  ]}
                  placeholder={`Default: ${provider?.whatsappFrom || '—'}`}
                />
              ) : testChannel === 'SMS' && smsNumbers.length > 0 ? (
                <SelectOrInput
                  value={testFrom}
                  onChange={setTestFrom}
                  options={[
                    { value: '', label: `Default: ${provider?.smsFrom || '—'}` },
                    ...smsNumbers.map(n => ({ value: n.number, label: `${n.number} — ${n.friendly}` })),
                  ]}
                  placeholder={`Default: ${provider?.smsFrom || '—'}`}
                />
              ) : (
                <input
                  type="text" value={testFrom} onChange={e => setTestFrom(e.target.value)}
                  placeholder={`Default: ${effectiveTestFrom}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              )}
            </div>
          </div>

          <Field label="Número destino" value={testTo} onChange={setTestTo} placeholder="+573001234567" />

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              Mensaje <span className="text-gray-400 normal-case font-normal">(opcional)</span>
            </label>
            <textarea value={testMessage} onChange={e => setTestMessage(e.target.value)}
              placeholder="Mensaje de prueba desde LoHaggo Admin…" rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>

          <button onClick={handleTest} disabled={testLoading || !testTo || !isConfigured}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-secondary-600 rounded-lg hover:bg-secondary-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {testLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Enviar prueba
          </button>

          {!isConfigured && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={13} /> Configura las credenciales de Twilio antes de enviar pruebas.
            </p>
          )}

          {testResult && <TestResultCard result={testResult} />}
        </div>
      </section>

      {/* Registered senders list */}
      {waSenders.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-800 text-sm flex items-center gap-2">
            <MessageSquare size={15} className="text-gray-400" />
            Senders WhatsApp detectados en cuenta
            {numbersLoading && <Loader2 size={13} className="animate-spin text-gray-400 ml-auto" />}
          </div>
          <div className="divide-y divide-gray-100">
            {waSenders.map(s => (
              <div key={s.number} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.number}</p>
                  {s.isSandbox && <p className="text-xs text-amber-600">Sandbox — requiere opt-in del destinatario</p>}
                </div>
                {provider?.whatsappFrom === s.number && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Activo</span>
                )}
                {!editing && provider?.whatsappFrom !== s.number && (
                  <button
                    onClick={async () => {
                      setSaving(true)
                      await fetch('/api/admin/messaging/providers', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ provider: 'TWILIO', whatsappFrom: s.number }),
                      })
                      await fetchStatus()
                      setSaving(false)
                    }}
                    disabled={saving}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                  >
                    Usar este
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/* ---- Sub-components ---- */

function StatusCard({ label, ok, detail, loading }: { label: string; ok: boolean; detail: string; loading: boolean }) {
  return (
    <div className={`rounded-xl border p-3 sm:p-4 flex items-center gap-3 ${ok ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className={`p-2 rounded-full flex-shrink-0 ${ok ? 'bg-green-100' : 'bg-gray-200'}`}>
        {loading ? <Loader2 size={16} className="animate-spin text-gray-400" /> :
          ok ? <Wifi size={16} className="text-green-600" /> : <WifiOff size={16} className="text-gray-400" />}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{label}</p>
        <p className={`text-xs truncate ${ok ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
          {loading ? '…' : detail}
        </p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, disabled }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>}
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500" />
    </div>
  )
}

function SelectOrInput({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; placeholder?: string
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

function TestResultCard({ result }: { result: NonNullable<TestResult> }) {
  const statusCls = result.twilioStatus ? (STATUS_COLOR[result.twilioStatus] || 'text-gray-700 bg-gray-50 border-gray-200') : ''

  return (
    <div className={`rounded-xl border p-4 text-sm space-y-2 ${result.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className={`flex items-center gap-2 font-semibold ${result.ok ? 'text-green-900' : 'text-red-900'}`}>
        {result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
        {result.ok ? 'Mensaje enviado' : 'Error al enviar'}
        {result.twilioStatus && (
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full border ${statusCls}`}>
            {result.twilioStatus.toUpperCase()}
          </span>
        )}
      </div>

      <div className="text-xs space-y-0.5 text-gray-700">
        {result.from && <p><span className="font-medium">From:</span> {result.from}</p>}
        {result.to && <p><span className="font-medium">To:</span> {result.to}</p>}
        {result.providerMessageId && <p><span className="font-medium">SID:</span> {result.providerMessageId}</p>}
        {result.errorCode && <p><span className="font-medium">Código error:</span> {result.errorCode}</p>}
        {result.errorMessage && <p><span className="font-medium">Error Twilio:</span> {result.errorMessage}</p>}
      </div>

      {result.errorExplanation && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          {result.errorExplanation}
        </div>
      )}
    </div>
  )
}
