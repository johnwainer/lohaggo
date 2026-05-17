'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Zap, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  CheckCircle2, XCircle, Clock, Mail, Phone, MessageSquare,
  Bell, RefreshCw, Loader2, AlertCircle, ChevronDown, ChevronUp,
  Users, UserCheck, Info,
} from 'lucide-react'

type AutomationTrigger =
  | 'PARTNER_REGISTERED'
  | 'CLIENT_REGISTERED'
  | 'PARTNER_DOCS_REMINDER'
  | 'PARTNER_REFERRAL_REMINDER'
  | 'CLIENT_FIRST_BOOKING_NUDGE'
  | 'CLIENT_REFERRAL_REMINDER'

type Channel = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH'

interface AutomationRule {
  id: string
  name: string
  description: string | null
  trigger: AutomationTrigger
  targetRole: 'PARTNER' | 'CLIENT' | null
  delayHours: number
  channels: Channel[]
  waTemplateFn: string | null
  customBody: string | null
  subject: string | null
  isActive: boolean
  stats: { total: number; sent: number; failed: number; pending: number; skipped: number }
  createdAt: string
  updatedAt: string
}

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  PARTNER_REGISTERED: 'Socio registrado',
  CLIENT_REGISTERED: 'Cliente registrado',
  PARTNER_DOCS_REMINDER: 'Recordatorio documentos (socio)',
  PARTNER_REFERRAL_REMINDER: 'Recordatorio referidos (socio)',
  CLIENT_FIRST_BOOKING_NUDGE: 'Primer servicio (cliente)',
  CLIENT_REFERRAL_REMINDER: 'Recordatorio referidos (cliente)',
}

const TRIGGER_GROUPS = {
  Socios: ['PARTNER_REGISTERED', 'PARTNER_DOCS_REMINDER', 'PARTNER_REFERRAL_REMINDER'] as AutomationTrigger[],
  Clientes: ['CLIENT_REGISTERED', 'CLIENT_FIRST_BOOKING_NUDGE', 'CLIENT_REFERRAL_REMINDER'] as AutomationTrigger[],
}

const WA_TEMPLATE_OPTIONS = [
  { value: 'sendWelcomePartner', label: 'Bienvenida Socio' },
  { value: 'sendVerificationReminder', label: 'Verificación Documentos' },
  { value: 'sendReferralInvite', label: 'Invitación Referidos' },
]

const CHANNEL_ICONS: Record<Channel, React.ReactNode> = {
  EMAIL: <Mail size={13} />,
  SMS: <Phone size={13} />,
  WHATSAPP: <MessageSquare size={13} />,
  PUSH: <Bell size={13} />,
}

const CHANNEL_COLORS: Record<Channel, string> = {
  EMAIL: 'bg-blue-100 text-blue-700',
  SMS: 'bg-green-100 text-green-700',
  WHATSAPP: 'bg-emerald-100 text-emerald-700',
  PUSH: 'bg-purple-100 text-purple-700',
}

function delayLabel(hours: number) {
  if (hours === 0) return 'Inmediato'
  if (hours < 24) return `${hours}h después`
  return `${hours / 24}d después`
}

function RuleCard({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: AutomationRule
  onToggle: (id: string, val: boolean) => void
  onEdit: (rule: AutomationRule) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all ${rule.isActive ? 'border-gray-100' : 'border-dashed border-gray-200 opacity-60'}`}>
      <div className="p-5 flex items-start gap-4">
        {/* Toggle */}
        <button
          onClick={() => onToggle(rule.id, !rule.isActive)}
          className={`mt-0.5 flex-shrink-0 transition-colors ${rule.isActive ? 'text-primary-600' : 'text-gray-300'}`}
          title={rule.isActive ? 'Desactivar' : 'Activar'}
        >
          {rule.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rule.targetRole === 'PARTNER' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
              {rule.targetRole === 'PARTNER' ? <><UserCheck size={10} className="inline mr-1" />Socio</> : <><Users size={10} className="inline mr-1" />Cliente</>}
            </span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              <Clock size={10} className="inline mr-1" />{delayLabel(rule.delayHours)}
            </span>
            {rule.channels.map(ch => (
              <span key={ch} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${CHANNEL_COLORS[ch]}`}>
                {CHANNEL_ICONS[ch]}{ch}
              </span>
            ))}
          </div>
          <h3 className="font-bold text-gray-900 text-sm">{rule.name}</h3>
          {rule.description && <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>}

          {/* Stats */}
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-green-500" />{rule.stats.sent} enviados</span>
            <span className="flex items-center gap-1"><Clock size={12} className="text-yellow-500" />{rule.stats.pending} pendientes</span>
            {rule.stats.failed > 0 && <span className="flex items-center gap-1"><XCircle size={12} className="text-red-500" />{rule.stats.failed} fallidos</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(e => !e)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={() => onEdit(rule)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
            <Pencil size={15} />
          </button>
          <button onClick={() => onDelete(rule.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-gray-50 mt-2">
          <div className="space-y-2 text-xs text-gray-600 mt-3">
            <div><span className="font-semibold text-gray-700">Trigger:</span> {TRIGGER_LABELS[rule.trigger]}</div>
            {rule.waTemplateFn && <div><span className="font-semibold text-gray-700">Plantilla WA:</span> {WA_TEMPLATE_OPTIONS.find(o => o.value === rule.waTemplateFn)?.label ?? rule.waTemplateFn}</div>}
            {rule.subject && <div><span className="font-semibold text-gray-700">Asunto:</span> {rule.subject}</div>}
            {rule.customBody && (
              <div>
                <span className="font-semibold text-gray-700 block mb-1">Mensaje:</span>
                <pre className="bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-sans text-gray-600">{rule.customBody}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RuleModal({
  rule,
  onSave,
  onClose,
}: {
  rule: Partial<AutomationRule> | null
  onSave: (data: any) => Promise<void>
  onClose: () => void
}) {
  const isNew = !rule?.id
  const [form, setForm] = useState({
    name: rule?.name ?? '',
    description: rule?.description ?? '',
    trigger: rule?.trigger ?? 'PARTNER_REGISTERED' as AutomationTrigger,
    delayHours: rule?.delayHours ?? 0,
    channels: rule?.channels ?? [] as Channel[],
    waTemplateFn: rule?.waTemplateFn ?? '',
    customBody: rule?.customBody ?? '',
    subject: rule?.subject ?? '',
    isActive: rule?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)

  const toggleChannel = (ch: Channel) => {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSave({ ...form, id: rule?.id })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Nueva regla' : 'Editar regla'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Descripción</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Disparador (Trigger) *</label>
            <select value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value as AutomationTrigger }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Demora (horas después del trigger)</label>
            <input type="number" min={0} value={form.delayHours} onChange={e => setForm(f => ({ ...f, delayHours: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            <p className="text-xs text-gray-400 mt-1">0 = inmediato. 24 = 1 día. 168 = 7 días.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Canales *</label>
            <div className="flex flex-wrap gap-2">
              {(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] as Channel[]).map(ch => (
                <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${form.channels.includes(ch) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {CHANNEL_ICONS[ch]}{ch}
                </button>
              ))}
            </div>
          </div>
          {form.channels.includes('WHATSAPP') && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Plantilla WhatsApp</label>
              <select value={form.waTemplateFn} onChange={e => setForm(f => ({ ...f, waTemplateFn: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="">— Sin plantilla WA —</option>
                {WA_TEMPLATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          {(form.channels.includes('EMAIL') || form.channels.includes('SMS')) && (
            <>
              {form.channels.includes('EMAIL') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Asunto (Email)</label>
                  <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Usa {{name}} para el nombre" />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mensaje (SMS / Email)</label>
                <textarea rows={4} value={form.customBody} onChange={e => setForm(f => ({ ...f, customBody: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none" placeholder="Usa {{name}} para el nombre del usuario" />
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 rounded" />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Activa</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all">Cancelar</button>
            <button type="submit" disabled={saving || !form.channels.length} className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-all disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : isNew ? 'Crear regla' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [editRule, setEditRule] = useState<Partial<AutomationRule> | null | false>(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/automations')
      const data = await res.json()
      setRules(data.rules ?? [])
    } catch {
      setError('Error cargando reglas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const seed = async () => {
    setSeeding(true)
    await fetch('/api/admin/automations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'seed' }) })
    await load()
    setSeeding(false)
  }

  const handleToggle = async (id: string, val: boolean) => {
    await fetch('/api/admin/automations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, isActive: val }) })
    setRules(r => r.map(rule => rule.id === id ? { ...rule, isActive: val } : rule))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta regla? Las ejecuciones pendientes también se eliminarán.')) return
    await fetch(`/api/admin/automations?id=${id}`, { method: 'DELETE' })
    setRules(r => r.filter(rule => rule.id !== id))
  }

  const handleSave = async (data: any) => {
    const method = data.id ? 'PATCH' : 'POST'
    await fetch('/api/admin/automations', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    setEditRule(false)
    await load()
  }

  const grouped = Object.entries(TRIGGER_GROUPS).map(([group, triggers]) => ({
    group,
    rules: rules.filter(r => triggers.includes(r.trigger)),
  }))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap size={22} className="text-primary-500" /> Automatizaciones
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Mensajes automáticos que se envían a socios y clientes en momentos clave del ciclo de vida.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
          <button onClick={seed} disabled={seeding} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-all disabled:opacity-50">
            {seeding ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Cargar reglas por defecto
          </button>
          <button onClick={() => setEditRule({})} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-all">
            <Plus size={15} /> Nueva regla
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 flex gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        <Info size={18} className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-0.5">¿Cómo funciona?</p>
          <p>Cuando un socio o cliente se registra, el sistema crea ejecuciones programadas para cada regla activa. Un cron job las procesa cada hora. Usa <code className="bg-blue-100 px-1 rounded">{"{{name}}"}</code> en el texto para personalizar el nombre del usuario.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Cargando reglas…
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <Zap size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">Sin reglas de automatización</p>
          <p className="text-sm text-gray-400 mt-1">Carga las reglas por defecto o crea una nueva.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ group, rules: groupRules }) => groupRules.length > 0 && (
            <div key={group}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                {group === 'Socios' ? <UserCheck size={13} /> : <Users size={13} />}
                {group}
                <span className="bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 text-[10px] font-bold">{groupRules.length}</span>
              </h2>
              <div className="space-y-3">
                {groupRules.sort((a, b) => a.delayHours - b.delayHours).map(rule => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onToggle={handleToggle}
                    onEdit={(r) => setEditRule(r)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editRule !== false && (
        <RuleModal
          rule={editRule}
          onSave={handleSave}
          onClose={() => setEditRule(false)}
        />
      )}
    </div>
  )
}
