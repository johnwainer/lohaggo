'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Phone, Key, CheckCircle2, XCircle, Eye, EyeOff, Send, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'

type ProviderStatus = {
  active: boolean
  accountSid: string
  smsFrom: string
  whatsappFrom: string
  hasAuthToken: boolean
}

type TestResult = {
  ok: boolean
  provider: string
  providerMessageId?: string
  errorCode?: string
  errorMessage?: string
} | null

export default function MessagingPage() {
  const [status, setStatus] = useState<ProviderStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // form fields
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [smsFrom, setSmsFrom] = useState('')
  const [whatsappFrom, setWhatsappFrom] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [showToken, setShowToken] = useState(false)
  const [editing, setEditing] = useState(false)

  // test
  const [testChannel, setTestChannel] = useState<'SMS' | 'WHATSAPP'>('WHATSAPP')
  const [testTo, setTestTo] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<TestResult>(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/messaging/providers')
      const data = await res.json()
      const twilio = data.providers?.twilio
      setStatus(twilio)
      setAccountSid(twilio?.accountSid || '')
      setSmsFrom(twilio?.smsFrom || '')
      setWhatsappFrom(twilio?.whatsappFrom || '')
      setIsActive(twilio?.active ?? true)
    } catch {
      setMsg({ type: 'error', text: 'Error al cargar configuración' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setMsg(null)
    try {
      const body: Record<string, unknown> = {
        provider: 'TWILIO',
        isActive,
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
      setMsg({ type: 'success', text: 'Configuración guardada correctamente' })
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
        body: JSON.stringify({ channel: testChannel, to: testTo, message: testMessage || undefined }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, provider: 'unknown', errorMessage: 'Error de red' })
    } finally {
      setTestLoading(false)
    }
  }

  const isConfigured = status?.hasAuthToken && status?.accountSid
  const wpConfigured = isConfigured && !!status?.whatsappFrom
  const smsConfigured = isConfigured && !!status?.smsFrom

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mensajería</h1>
          <p className="text-gray-500 text-sm mt-1">Configuración de canales SMS y WhatsApp vía Twilio</p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          title="Recargar"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatusCard
          label="Twilio"
          ok={!!isConfigured && !!status?.active}
          detail={status?.accountSid ? `${status.accountSid.slice(0, 6)}…` : 'No configurado'}
          loading={loading}
        />
        <StatusCard
          label="WhatsApp"
          ok={!!wpConfigured}
          detail={status?.whatsappFrom || 'Sin número'}
          loading={loading}
        />
        <StatusCard
          label="SMS"
          ok={!!smsConfigured}
          detail={status?.smsFrom || 'Sin número'}
          loading={loading}
        />
      </div>

      {/* Credentials */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-gray-500" />
            <h2 className="font-semibold text-gray-800">Credenciales Twilio</h2>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Editar
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Account SID"
              value={accountSid}
              onChange={setAccountSid}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              disabled={!editing}
            />
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">Auth Token</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={authToken}
                  onChange={e => setAuthToken(e.target.value)}
                  disabled={!editing}
                  placeholder={status?.hasAuthToken ? '••••••••••••••••••••••••••••••••' : 'Pega el auth token'}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
                {editing && (
                  <button
                    type="button"
                    onClick={() => setShowToken(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
              {status?.hasAuthToken && !authToken && editing && (
                <p className="text-xs text-gray-400">Dejar vacío para mantener el token actual</p>
              )}
            </div>
            <Field
              label="Número SMS (From)"
              value={smsFrom}
              onChange={setSmsFrom}
              placeholder="+19786445487"
              disabled={!editing}
            />
            <Field
              label="Número WhatsApp (From)"
              value={whatsappFrom}
              onChange={setWhatsappFrom}
              placeholder="+573337507792"
              disabled={!editing}
            />
          </div>

          {editing && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">Proveedor activo</label>
            </div>
          )}

          {msg && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              msg.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {msg.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {msg.text}
            </div>
          )}

          {editing && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setEditing(false); setAuthToken(''); setMsg(null); fetchStatus() }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Guardar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Test send */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Send size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-800">Envío de Prueba</h2>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">Canal</label>
              <div className="flex gap-2">
                {(['WHATSAPP', 'SMS'] as const).map(ch => (
                  <button
                    key={ch}
                    onClick={() => setTestChannel(ch)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium border transition ${
                      testChannel === ch
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {ch === 'WHATSAPP' ? <MessageSquare size={15} /> : <Phone size={15} />}
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <Field
              label="Número destino"
              value={testTo}
              onChange={setTestTo}
              placeholder="+573001234567"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
              Mensaje <span className="text-gray-400 normal-case font-normal">(opcional)</span>
            </label>
            <textarea
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              placeholder="Mensaje de prueba desde LoHaggo Admin…"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <button
            onClick={handleTest}
            disabled={testLoading || !testTo || !isConfigured}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-secondary-600 rounded-lg hover:bg-secondary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Enviar prueba
          </button>

          {!isConfigured && (
            <p className="text-xs text-amber-600">Configura las credenciales de Twilio antes de enviar pruebas.</p>
          )}

          {testResult && (
            <div className={`p-4 rounded-xl border text-sm space-y-1 ${
              testResult.ok
                ? 'bg-green-50 border-green-200 text-green-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              <div className="flex items-center gap-2 font-semibold">
                {testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {testResult.ok ? 'Mensaje enviado correctamente' : 'Error al enviar'}
              </div>
              <div className="text-xs space-y-0.5 opacity-80">
                <p>Proveedor: {testResult.provider}</p>
                {testResult.providerMessageId && <p>ID: {testResult.providerMessageId}</p>}
                {testResult.errorCode && <p>Código: {testResult.errorCode}</p>}
                {testResult.errorMessage && <p>Detalle: {testResult.errorMessage}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusCard({ label, ok, detail, loading }: { label: string; ok: boolean; detail: string; loading: boolean }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${ok ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className={`p-2 rounded-full ${ok ? 'bg-green-100' : 'bg-gray-200'}`}>
        {loading ? (
          <Loader2 size={18} className="animate-spin text-gray-400" />
        ) : ok ? (
          <Wifi size={18} className="text-green-600" />
        ) : (
          <WifiOff size={18} className="text-gray-400" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className={`text-xs truncate ${ok ? 'text-green-700' : 'text-gray-500'}`}>{loading ? '…' : detail}</p>
      </div>
      {!loading && (
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${ok ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
          {ok ? 'OK' : 'Off'}
        </span>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, disabled }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
    </div>
  )
}
