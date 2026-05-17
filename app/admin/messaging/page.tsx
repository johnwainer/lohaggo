'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MessageSquare, Phone, Key, CheckCircle2, XCircle, Eye, EyeOff,
  Send, Loader2, RefreshCw, Wifi, WifiOff, AlertTriangle, ChevronDown,
  FileText, Clock, Search, User, X,
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
type WATemplate = {
  sid: string
  name: string
  language: string
  types: string[]
  body: string
  variables: Record<string, string>
  waStatus: 'unsubmitted' | 'pending' | 'approved' | 'rejected'
  waName: string | null
  waCategory: string | null
  waRejectionReason: string | null
}

type Contact = {
  id: string
  name: string
  phone: string
  email: string
  role: string
  city: string | null
  service: string | null
  verified: boolean | null
  fields: Record<string, string>
}

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

// Extract variable numbers from a template body: {{1}}, {{2}}, ...
function extractVars(body: string): string[] {
  const matches = body.match(/\{\{(\d+)\}\}/g) || []
  const nums = [...new Set(matches.map(m => m.replace(/\D/g, '')))]
  return nums.sort((a, b) => Number(a) - Number(b))
}

// Guess which contact field maps to a variable index (heuristic)
function guessField(varNum: string, templateName: string): string {
  if (varNum === '1') return 'nombre'
  if (varNum === '2') {
    if (templateName.includes('login') || templateName.includes('sesion')) return ''
    if (templateName.includes('verificacion')) return ''
    if (templateName.includes('referir')) return ''
    return 'servicio'
  }
  if (varNum === '3') {
    if (templateName.includes('booking') || templateName.includes('confirmacion')) return ''
    return 'ciudad'
  }
  return ''
}

export default function MessagingPage() {
  const [provider, setProvider] = useState<TwilioProvider | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editing, setEditing] = useState(false)

  const [smsNumbers, setSmsNumbers] = useState<PhoneNumber[]>([])
  const [waSenders, setWaSenders] = useState<WASender[]>([])
  const [numbersLoading, setNumbersLoading] = useState(false)

  const [waTemplates, setWaTemplates] = useState<WATemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)

  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [smsFrom, setSmsFrom] = useState('')
  const [whatsappFrom, setWhatsappFrom] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [showToken, setShowToken] = useState(false)

  // test state
  const [testChannel, setTestChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP')
  const [testFrom, setTestFrom] = useState('')
  const [testContentSid, setTestContentSid] = useState('')
  const [testVars, setTestVars] = useState<Record<string, string>>({}) // {1: val, 2: val}
  const [testMessage, setTestMessage] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<TestResult>(null)

  // contact picker
  const [contactSearch, setContactSearch] = useState('')
  const [contactRole, setContactRole] = useState<'ALL' | 'PARTNER' | 'CLIENT'>('ALL')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [customPhone, setCustomPhone] = useState('')
  const [phoneMode, setPhoneMode] = useState<'contact' | 'custom'>('custom')
  const [showContactList, setShowContactList] = useState(false)
  const contactRef = useRef<HTMLDivElement>(null)

  const fetchContacts = useCallback(async (q: string, role: string) => {
    setContactsLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (role !== 'ALL') params.set('role', role)
      const res = await fetch(`/api/admin/messaging/contacts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setContacts(data.contacts || [])
      }
    } finally {
      setContactsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (phoneMode === 'contact') {
      fetchContacts(contactSearch, contactRole)
    }
  }, [contactSearch, contactRole, phoneMode, fetchContacts])

  // Auto-fill vars when contact or template changes
  const activeTemplate = waTemplates.find(t => t.sid === testContentSid)
  useEffect(() => {
    if (!activeTemplate || !selectedContact) return
    const varNums = extractVars(activeTemplate.body)
    const filled: Record<string, string> = {}
    for (const num of varNums) {
      const field = guessField(num, activeTemplate.name)
      const val = field ? (selectedContact.fields[field] || '') : ''
      // Only auto-fill if not already manually set
      filled[num] = testVars[num] !== undefined ? testVars[num] : val
    }
    setTestVars(filled)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testContentSid, selectedContact?.id])

  // Reset vars when template changes
  useEffect(() => {
    setTestVars({})
  }, [testContentSid])

  // Close contact dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setShowContactList(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  const fetchWaTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const res = await fetch('/api/admin/messaging/wa-templates')
      if (res.ok) {
        const data = await res.json()
        setWaTemplates(data.templates || [])
      }
    } finally {
      setTemplatesLoading(false)
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
    fetchWaTemplates()
  }, [fetchStatus, fetchNumbers, fetchWaTemplates])

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

  const effectiveTo = phoneMode === 'contact' ? (selectedContact?.phone || '') : customPhone

  async function handleTest() {
    if (!effectiveTo) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/messaging/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: testChannel,
          to: effectiveTo,
          fromOverride: testFrom || undefined,
          contentSid: testContentSid || undefined,
          contentVariables: testContentSid && Object.keys(testVars).length ? testVars : undefined,
          message: !testContentSid ? (testMessage || undefined) : undefined,
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
  const effectiveTestFrom = testFrom || (testChannel === 'WHATSAPP' ? provider?.whatsappFrom : provider?.smsFrom) || ''
  const approvedTemplates = waTemplates.filter(t => t.waStatus === 'approved')

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mensajería</h1>
          <p className="text-gray-500 text-sm mt-0.5">Twilio · WhatsApp Business · SMS</p>
        </div>
        <button
          onClick={() => { fetchStatus(); fetchNumbers(); fetchWaTemplates() }}
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
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Auth Token</label>
              <div className="relative">
                <input type={showToken ? 'text' : 'password'} value={authToken}
                  onChange={e => setAuthToken(e.target.value)} disabled={!editing}
                  placeholder={provider?.hasAuthToken ? '••••••••••••••••••••••••••••••••' : 'Pega el auth token'}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500" />
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
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Número SMS activo</label>
              {editing && smsNumbers.length > 0 ? (
                <SelectOrInput value={smsFrom} onChange={setSmsFrom}
                  options={smsNumbers.map(n => ({ value: n.number, label: `${n.number} — ${n.friendly}` }))}
                  placeholder="+19786445487" />
              ) : (
                <Field value={smsFrom} onChange={setSmsFrom} placeholder="+19786445487" disabled={!editing} />
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Sender WhatsApp activo</label>
              {editing && waSenders.length > 0 ? (
                <SelectOrInput value={whatsappFrom} onChange={setWhatsappFrom}
                  options={waSenders.map(s => ({ value: s.number, label: s.label }))}
                  placeholder="+573337507792" />
              ) : (
                <Field value={whatsappFrom} onChange={setWhatsappFrom} placeholder="+573337507792" disabled={!editing} />
              )}
              {!editing && provider?.whatsappFrom?.includes('15558464003') && (
                <p className="text-xs text-amber-600">⚠️ Sandbox activo — requiere opt-in</p>
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

      {/* ── TEST SEND ── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 font-semibold text-gray-800">
          <Send size={16} className="text-gray-400" /> Envío de Prueba
        </div>

        <div className="p-5 space-y-5">

          {/* Row 1: Canal + Sender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Canal</label>
              <div className="flex gap-2">
                {(['WHATSAPP', 'SMS'] as const).map(ch => (
                  <button key={ch} onClick={() => { setTestChannel(ch); setTestFrom(''); setTestContentSid(''); setTestVars({}) }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium border transition ${
                      testChannel === ch ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}>
                    {ch === 'WHATSAPP' ? <MessageSquare size={14} /> : <Phone size={14} />}
                    {ch}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                Enviar desde <span className="text-gray-400 normal-case font-normal">(opcional)</span>
              </label>
              {testChannel === 'WHATSAPP' && waSenders.length > 0 ? (
                <SelectOrInput value={testFrom} onChange={setTestFrom}
                  options={[
                    { value: '', label: `Default: ${provider?.whatsappFrom || '—'}` },
                    ...waSenders.map(s => ({ value: s.number, label: s.label })),
                  ]} placeholder={`Default: ${effectiveTestFrom}`} />
              ) : testChannel === 'SMS' && smsNumbers.length > 0 ? (
                <SelectOrInput value={testFrom} onChange={setTestFrom}
                  options={[
                    { value: '', label: `Default: ${provider?.smsFrom || '—'}` },
                    ...smsNumbers.map(n => ({ value: n.number, label: `${n.number} — ${n.friendly}` })),
                  ]} placeholder={`Default: ${effectiveTestFrom}`} />
              ) : (
                <input type="text" value={testFrom} onChange={e => setTestFrom(e.target.value)}
                  placeholder={`Default: ${effectiveTestFrom}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              )}
            </div>
          </div>

          {/* Row 2: Destination — Contact picker or custom */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">Destinatario</label>
              <div className="flex gap-1">
                {(['contact', 'custom'] as const).map(mode => (
                  <button key={mode} onClick={() => { setPhoneMode(mode); setSelectedContact(null); setCustomPhone('') }}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium border transition ${
                      phoneMode === mode ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}>
                    {mode === 'contact' ? 'Buscar socio/cliente' : 'Número personalizado'}
                  </button>
                ))}
              </div>
            </div>

            {phoneMode === 'custom' ? (
              <input type="text" value={customPhone} onChange={e => setCustomPhone(e.target.value)}
                placeholder="+573001234567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            ) : (
              <div ref={contactRef} className="relative">
                {/* Selected contact chip */}
                {selectedContact ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-green-300 bg-green-50 rounded-lg">
                    <User size={14} className="text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-green-900">{selectedContact.name}</span>
                      <span className="text-xs text-green-700 ml-2">{selectedContact.phone}</span>
                      <span className="text-xs text-green-600 ml-1 opacity-70">
                        {selectedContact.role === 'PARTNER' ? '· Socio' : '· Cliente'}
                        {selectedContact.service ? ` · ${selectedContact.service}` : ''}
                      </span>
                    </div>
                    <button onClick={() => { setSelectedContact(null); setTestVars({}) }}
                      className="text-green-600 hover:text-green-800 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={contactSearch}
                        onChange={e => { setContactSearch(e.target.value); setShowContactList(true) }}
                        onFocus={() => { setShowContactList(true); fetchContacts(contactSearch, contactRole) }}
                        placeholder="Buscar por nombre, teléfono o email…"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <select value={contactRole} onChange={e => setContactRole(e.target.value as any)}
                      className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="ALL">Todos</option>
                      <option value="PARTNER">Socios</option>
                      <option value="CLIENT">Clientes</option>
                    </select>
                  </div>
                )}

                {/* Dropdown */}
                {showContactList && !selectedContact && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {contactsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={16} className="animate-spin text-gray-400" />
                      </div>
                    ) : contacts.length === 0 ? (
                      <p className="text-sm text-gray-500 px-4 py-3">Sin resultados</p>
                    ) : (
                      contacts.map(c => (
                        <button key={c.id} onClick={() => { setSelectedContact(c); setShowContactList(false); setContactSearch('') }}
                          className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left">
                          <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white ${
                            c.role === 'PARTNER' ? 'bg-primary-500' : 'bg-secondary-500'
                          }`}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                            <p className="text-xs text-gray-500">
                              {c.phone}
                              {c.service ? ` · ${c.service}` : ''}
                              {c.city ? ` · ${c.city}` : ''}
                            </p>
                          </div>
                          <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                            c.role === 'PARTNER' ? 'bg-primary-100 text-primary-700' : 'bg-secondary-100 text-secondary-700'
                          }`}>
                            {c.role === 'PARTNER' ? 'Socio' : 'Cliente'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {effectiveTo && (
              <p className="text-xs text-gray-500">
                Enviará a: <span className="font-mono font-medium">{effectiveTo}</span>
              </p>
            )}
          </div>

          {/* Row 3: Template picker (WA only) */}
          {testChannel === 'WHATSAPP' && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                Plantilla <span className="text-gray-400 normal-case font-normal">(requerida para iniciar conversación)</span>
              </label>
              {approvedTemplates.length === 0 ? (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <Clock size={12} /> Sin plantillas aprobadas aún — usa texto libre (requiere sesión abierta)
                </p>
              ) : (
                <SelectOrInput
                  value={testContentSid}
                  onChange={v => { setTestContentSid(v); setTestVars({}) }}
                  options={[
                    { value: '', label: 'Sin plantilla — texto libre (solo en sesión activa)' },
                    ...approvedTemplates.map(t => ({
                      value: t.sid,
                      label: `${t.waName || t.name}${t.waCategory ? ` — ${t.waCategory}` : ''}`,
                    })),
                  ]}
                />
              )}
            </div>
          )}

          {/* Row 4: Template variables editor */}
          {testContentSid && activeTemplate && (() => {
            const varNums = extractVars(activeTemplate.body)
            if (varNums.length === 0) return null

            // Available contact fields for binding
            const contactFieldOptions = selectedContact
              ? Object.entries(selectedContact.fields)
                  .filter(([, v]) => v)
                  .map(([k, v]) => ({ label: `${k}: "${v}"`, value: v }))
              : []

            return (
              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                {/* Template body preview */}
                <div className="text-xs text-gray-500 font-mono bg-white border border-gray-200 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                  {activeTemplate.body.replace(/\{\{(\d+)\}\}/g, (_, n) =>
                    testVars[n] ? `[${testVars[n]}]` : `{{${n}}}`
                  )}
                </div>

                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Variables de la plantilla</p>

                {varNums.map(num => (
                  <div key={num} className="grid grid-cols-[80px_1fr] gap-2 items-start">
                    <span className="text-xs font-mono font-bold text-primary-600 bg-primary-50 border border-primary-200 rounded px-2 py-1.5 text-center">
                      {`{{${num}}}`}
                    </span>
                    <div className="space-y-1.5">
                      {/* If contact selected, show field picker */}
                      {contactFieldOptions.length > 0 && (
                        <select
                          value={testVars[num] !== undefined ? (
                            contactFieldOptions.find(o => o.value === testVars[num]) ? testVars[num] : '__custom__'
                          ) : ''}
                          onChange={e => {
                            if (e.target.value !== '__custom__') {
                              setTestVars(v => ({ ...v, [num]: e.target.value }))
                            }
                          }}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">— elige un campo del contacto —</option>
                          {contactFieldOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                          <option value="__custom__">✏️ Escribir manualmente</option>
                        </select>
                      )}
                      <input
                        type="text"
                        value={testVars[num] || ''}
                        onChange={e => setTestVars(v => ({ ...v, [num]: e.target.value }))}
                        placeholder={`Valor para {{${num}}}${
                          num === '1' ? ' (ej: Carlos)' :
                          num === '2' ? ' (ej: Plomería)' :
                          num === '3' ? ' (ej: martes 20 de mayo)' : ''
                        }`}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Row 5: Free text (no template) */}
          {!testContentSid && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                Mensaje <span className="text-gray-400 normal-case font-normal">(opcional — solo funciona si el usuario escribió primero)</span>
              </label>
              <textarea value={testMessage} onChange={e => setTestMessage(e.target.value)}
                placeholder="Mensaje de prueba desde LoHaggo Admin…" rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
            </div>
          )}

          {/* Send button */}
          <button onClick={handleTest}
            disabled={testLoading || !effectiveTo || !isConfigured}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-secondary-600 rounded-lg hover:bg-secondary-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {testLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Enviar prueba
            {effectiveTo && <span className="text-secondary-200 text-xs ml-1">→ {effectiveTo}</span>}
          </button>

          {!isConfigured && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={13} /> Configura las credenciales de Twilio antes de enviar.
            </p>
          )}

          {testResult && <TestResultCard result={testResult} />}
        </div>
      </section>

      {/* WA Templates section */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-800 text-sm flex items-center gap-2">
          <FileText size={15} className="text-gray-400" />
          Plantillas WhatsApp
          {templatesLoading && <Loader2 size={13} className="animate-spin text-gray-400 ml-auto" />}
          {!templatesLoading && (
            <button onClick={fetchWaTemplates} className="ml-auto text-gray-400 hover:text-gray-600">
              <RefreshCw size={13} />
            </button>
          )}
        </div>
        {waTemplates.length === 0 && !templatesLoading ? (
          <p className="px-5 py-4 text-sm text-gray-500">No hay plantillas en Twilio Content API.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {waTemplates.map(t => {
              const statusBadge: Record<WATemplate['waStatus'], string> = {
                approved: 'bg-green-100 text-green-700',
                pending: 'bg-yellow-100 text-yellow-700',
                rejected: 'bg-red-100 text-red-700',
                unsubmitted: 'bg-gray-100 text-gray-500',
              }
              return (
                <div key={t.sid} className="px-5 py-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-800">{t.waName || t.name}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge[t.waStatus]}`}>
                      {t.waStatus === 'approved' ? '✓ Aprobada' :
                       t.waStatus === 'pending' ? '⏳ En revisión' :
                       t.waStatus === 'rejected' ? '✗ Rechazada' : 'Sin enviar'}
                    </span>
                    {t.waCategory && <span className="text-xs text-gray-400">{t.waCategory}</span>}
                    {t.waStatus === 'approved' && (
                      <button
                        onClick={() => { setTestContentSid(t.sid); setTestVars({}); window.scrollTo({ top: 400, behavior: 'smooth' }) }}
                        className="ml-auto text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Usar en prueba ↑
                      </button>
                    )}
                  </div>
                  {t.body && (
                    <p className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100 line-clamp-2">
                      {t.body}
                    </p>
                  )}
                  {t.waStatus === 'rejected' && t.waRejectionReason && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle size={11} /> {t.waRejectionReason}
                    </p>
                  )}
                  {t.waStatus === 'pending' && (
                    <p className="text-xs text-yellow-600 flex items-center gap-1">
                      <Clock size={11} /> En revisión — las UTILITY suelen aprobarse en minutos
                    </p>
                  )}
                  <p className="text-xs text-gray-400 font-mono">{t.sid}</p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Registered WA senders */}
      {waSenders.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-800 text-sm flex items-center gap-2">
            <MessageSquare size={15} className="text-gray-400" />
            Senders WhatsApp
            {numbersLoading && <Loader2 size={13} className="animate-spin text-gray-400 ml-auto" />}
          </div>
          <div className="divide-y divide-gray-100">
            {waSenders.map(s => (
              <div key={s.number} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.number}</p>
                  {s.isSandbox && <p className="text-xs text-amber-600">Sandbox — requiere opt-in</p>}
                </div>
                {provider?.whatsappFrom === s.number ? (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Activo</span>
                ) : (
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

/* ── Sub-components ── */

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
