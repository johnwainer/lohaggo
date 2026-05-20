'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Zap, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  CheckCircle2, XCircle, Clock, Mail, Phone, MessageSquare,
  Bell, RefreshCw, Loader2, AlertCircle, ChevronDown, ChevronUp,
  Users, UserCheck, Info, FileCheck, FileX, CalendarCheck,
  CalendarX, Star, MessageCircle, ShieldCheck,
} from 'lucide-react'

type AutomationTrigger =
  | 'PARTNER_REGISTERED'
  | 'CLIENT_REGISTERED'
  | 'PARTNER_DOCS_REMINDER'
  | 'PARTNER_REFERRAL_REMINDER'
  | 'CLIENT_FIRST_BOOKING_NUDGE'
  | 'CLIENT_REFERRAL_REMINDER'
  | 'PARTNER_DOCS_APPROVED'
  | 'PARTNER_DOCS_REJECTED'
  | 'PARTNER_ACTIVATED'
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_COMPLETED'
  | 'BOOKING_CANCELLED'
  | 'REVIEW_RECEIVED'
  | 'INBOUND_MESSAGE'

type Channel = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH'

interface WaTemplate {
  sid: string
  name: string
  language: string
  waStatus: string
  waCategory: string | null
  source: 'meta' | 'twilio'
  body: string
  variables?: Record<string, string>
}

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
  metadata: string | null
  isActive: boolean
  stats: { total: number; sent: number; failed: number; pending: number; skipped: number }
  createdAt: string
  updatedAt: string
}

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  PARTNER_REGISTERED: 'Socio registrado',
  CLIENT_REGISTERED: 'Cliente registrado',
  PARTNER_DOCS_REMINDER: 'Recordatorio documentos pendientes',
  PARTNER_REFERRAL_REMINDER: 'Recordatorio referidos (socio)',
  CLIENT_FIRST_BOOKING_NUDGE: 'Nudge primer servicio (cliente)',
  CLIENT_REFERRAL_REMINDER: 'Recordatorio referidos (cliente)',
  PARTNER_DOCS_APPROVED: 'Documento aprobado',
  PARTNER_DOCS_REJECTED: 'Documento rechazado',
  PARTNER_ACTIVATED: 'Socio activado',
  BOOKING_CREATED: 'Reserva creada',
  BOOKING_CONFIRMED: 'Reserva confirmada',
  BOOKING_COMPLETED: 'Reserva completada',
  BOOKING_CANCELLED: 'Reserva cancelada',
  REVIEW_RECEIVED: 'Reseña recibida',
  INBOUND_MESSAGE: 'Mensaje entrante (WhatsApp/chat)',
}

const TRIGGER_ICONS: Record<AutomationTrigger, React.ReactNode> = {
  PARTNER_REGISTERED: <UserCheck size={13} />,
  CLIENT_REGISTERED: <Users size={13} />,
  PARTNER_DOCS_REMINDER: <Clock size={13} />,
  PARTNER_REFERRAL_REMINDER: <Clock size={13} />,
  CLIENT_FIRST_BOOKING_NUDGE: <Clock size={13} />,
  CLIENT_REFERRAL_REMINDER: <Clock size={13} />,
  PARTNER_DOCS_APPROVED: <FileCheck size={13} />,
  PARTNER_DOCS_REJECTED: <FileX size={13} />,
  PARTNER_ACTIVATED: <ShieldCheck size={13} />,
  BOOKING_CREATED: <CalendarCheck size={13} />,
  BOOKING_CONFIRMED: <CalendarCheck size={13} />,
  BOOKING_COMPLETED: <CalendarCheck size={13} />,
  BOOKING_CANCELLED: <CalendarX size={13} />,
  REVIEW_RECEIVED: <Star size={13} />,
  INBOUND_MESSAGE: <MessageCircle size={13} />,
}

type TriggerGroup = {
  label: string
  icon: React.ReactNode
  triggers: AutomationTrigger[]
}

const TRIGGER_GROUPS: TriggerGroup[] = [
  {
    label: 'Registro',
    icon: <UserCheck size={13} />,
    triggers: ['PARTNER_REGISTERED', 'CLIENT_REGISTERED'],
  },
  {
    label: 'Recordatorios programados',
    icon: <Clock size={13} />,
    triggers: ['PARTNER_DOCS_REMINDER', 'PARTNER_REFERRAL_REMINDER', 'CLIENT_FIRST_BOOKING_NUDGE', 'CLIENT_REFERRAL_REMINDER'],
  },
  {
    label: 'Documentos y verificación',
    icon: <FileCheck size={13} />,
    triggers: ['PARTNER_DOCS_APPROVED', 'PARTNER_DOCS_REJECTED', 'PARTNER_ACTIVATED'],
  },
  {
    label: 'Reservas',
    icon: <CalendarCheck size={13} />,
    triggers: ['BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_COMPLETED', 'BOOKING_CANCELLED'],
  },
  {
    label: 'Reseñas',
    icon: <Star size={13} />,
    triggers: ['REVIEW_RECEIVED'],
  },
  {
    label: 'Mensajería',
    icon: <MessageCircle size={13} />,
    triggers: ['INBOUND_MESSAGE'],
  },
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

function waTemplateName(sid: string | null, waTemplates: WaTemplate[]): string {
  if (!sid) return '—'
  const found = waTemplates.find(t => t.sid === sid)
  if (found) return `${found.name} (${found.language}) [${found.source === 'meta' ? 'Meta' : 'Twilio'}]`
  const legacyMap: Record<string, string> = {
    sendWelcomePartner: 'Bienvenida Socio',
    sendVerificationReminder: 'Verificación Documentos',
    sendReferralInvite: 'Invitación Referidos',
  }
  return legacyMap[sid] ?? sid
}

/** Extract {{N}} variable placeholders from a template body, sorted numerically */
function extractVarNumbers(body: string): number[] {
  const nums = new Set<number>()
  let m: RegExpExecArray | null
  const re = /\{\{(\d+)\}\}/g
  while ((m = re.exec(body)) !== null) nums.add(Number(m[1]))
  return Array.from(nums).sort((a, b) => a - b)
}

function RuleCard({
  rule,
  waTemplates,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: AutomationRule
  waTemplates: WaTemplate[]
  onToggle: (id: string, val: boolean) => void
  onEdit: (rule: AutomationRule) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const waTemplate = rule.waTemplateFn ? waTemplates.find(t => t.sid === rule.waTemplateFn) : null

  let extraVars: Record<string, string> = {}
  try { if (rule.metadata) extraVars = JSON.parse(rule.metadata)?.waVars ?? {} } catch { /* */ }

  return (
    <div className={`bg-white rounded-2xl border-2 transition-all ${rule.isActive ? 'border-gray-100' : 'border-dashed border-gray-200 opacity-60'}`}>
      <div className="p-5 flex items-start gap-4">
        <button
          onClick={() => onToggle(rule.id, !rule.isActive)}
          className={`mt-0.5 flex-shrink-0 transition-colors ${rule.isActive ? 'text-primary-600' : 'text-gray-300'}`}
          title={rule.isActive ? 'Desactivar' : 'Activar'}
        >
          {rule.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {rule.targetRole && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rule.targetRole === 'PARTNER' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                {rule.targetRole === 'PARTNER'
                  ? <><UserCheck size={10} className="inline mr-1" />Socio</>
                  : <><Users size={10} className="inline mr-1" />Cliente</>}
              </span>
            )}
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
              {TRIGGER_ICONS[rule.trigger]}
              {TRIGGER_LABELS[rule.trigger]}
            </span>
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
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
            {rule.channels.includes('WHATSAPP') && (
              <div>
                <span className="font-semibold text-gray-700">Plantilla WA:</span>{' '}
                {waTemplateName(rule.waTemplateFn, waTemplates)}
              </div>
            )}
            {waTemplate?.body && (
              <div>
                <span className="font-semibold text-gray-700 block mb-1">Vista previa:</span>
                <pre className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 whitespace-pre-wrap font-sans text-gray-600 text-[11px]">
                  {waTemplate.body.replace(/\{\{1\}\}/g, '[nombre]').replace(/\{\{(\d+)\}\}/g, (_, n) => extraVars[n] ? `[${extraVars[n]}]` : `[var${n}]`)}
                </pre>
              </div>
            )}
            {Object.keys(extraVars).length > 0 && (
              <div>
                <span className="font-semibold text-gray-700">Variables configuradas:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(extraVars).map(([k, v]) => (
                    <span key={k} className="bg-gray-100 text-gray-600 rounded px-2 py-0.5 text-[10px] font-mono">
                      {`{{${k}}}`} = {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {rule.subject && <div><span className="font-semibold text-gray-700">Asunto:</span> {rule.subject}</div>}
            {rule.customBody && (
              <div>
                <span className="font-semibold text-gray-700 block mb-1">Mensaje (SMS/Email):</span>
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

  // Parse existing waVars from metadata
  let initialWaVars: Record<string, string> = {}
  try { if (rule?.metadata) initialWaVars = JSON.parse(rule.metadata)?.waVars ?? {} } catch { /* */ }

  const [form, setForm] = useState({
    name: rule?.name ?? '',
    description: rule?.description ?? '',
    trigger: rule?.trigger ?? 'PARTNER_REGISTERED' as AutomationTrigger,
    targetRole: rule?.targetRole ?? null as 'PARTNER' | 'CLIENT' | null,
    delayHours: rule?.delayHours ?? 0,
    channels: rule?.channels ?? [] as Channel[],
    waTemplateFn: rule?.waTemplateFn ?? '',
    customBody: rule?.customBody ?? '',
    subject: rule?.subject ?? '',
    isActive: rule?.isActive ?? true,
  })
  const [waVars, setWaVars] = useState<Record<string, string>>(initialWaVars)
  const [saving, setSaving] = useState(false)
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([])
  const [waLoading, setWaLoading] = useState(false)

  const hasWhatsApp = form.channels.includes('WHATSAPP')

  useEffect(() => {
    if (!hasWhatsApp) return
    setWaLoading(true)
    fetch('/api/admin/messaging/wa-templates')
      .then(r => r.json())
      .then(d => setWaTemplates((d.templates ?? []).filter((t: WaTemplate) => t.waStatus === 'approved')))
      .catch(() => {})
      .finally(() => setWaLoading(false))
  }, [hasWhatsApp])

  const toggleChannel = (ch: Channel) => {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter(c => c !== ch) : [...f.channels, ch],
      waTemplateFn: ch === 'WHATSAPP' && f.channels.includes(ch) ? '' : f.waTemplateFn,
    }))
    if (ch === 'WHATSAPP' && form.channels.includes('WHATSAPP')) setWaVars({})
  }

  const selectedTemplate = waTemplates.find(t => t.sid === form.waTemplateFn)

  // Get variable numbers from selected template body, excluding {{1}} (auto-filled)
  const extraVarNums = selectedTemplate?.body
    ? extractVarNumbers(selectedTemplate.body).filter(n => n !== 1)
    : []

  // When template changes, reset vars
  const handleTemplateChange = (sid: string) => {
    setForm(f => ({ ...f, waTemplateFn: sid }))
    setWaVars({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const metadata = Object.keys(waVars).length > 0 ? JSON.stringify({ waVars }) : null
    await onSave({ ...form, id: rule?.id, metadata })
    setSaving(false)
  }

  const metaTemplates = waTemplates.filter(t => t.source === 'meta')
  const twilioTemplates = waTemplates.filter(t => t.source === 'twilio')

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Nueva regla de automatización' : 'Editar regla'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Descripción</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Evento (Trigger) *</label>
            <select
              value={form.trigger}
              onChange={e => setForm(f => ({ ...f, trigger: e.target.value as AutomationTrigger }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              {TRIGGER_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.triggers.map(t => (
                    <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Target role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Dirigido a</label>
            <div className="flex gap-2">
              {([null, 'PARTNER', 'CLIENT'] as const).map(role => (
                <button
                  key={String(role)}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, targetRole: role }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                    form.targetRole === role
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {role === null ? 'Todos' : role === 'PARTNER' ? 'Socios' : 'Clientes'}
                </button>
              ))}
            </div>
          </div>

          {/* Delay */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Demora</label>
            <input
              type="number"
              min={0}
              value={form.delayHours}
              onChange={e => setForm(f => ({ ...f, delayHours: Number(e.target.value) }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">0 = inmediato · 24 = 1 día · 168 = 7 días</p>
          </div>

          {/* Channels */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Canales *</label>
            <div className="flex flex-wrap gap-2">
              {(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] as Channel[]).map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                    form.channels.includes(ch)
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {CHANNEL_ICONS[ch]}{ch}
                </button>
              ))}
            </div>
          </div>

          {/* WhatsApp template section */}
          {hasWhatsApp && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">Plantilla WhatsApp</span>
              </div>

              {waLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 size={13} className="animate-spin" /> Cargando plantillas…
                </div>
              ) : waTemplates.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No hay plantillas aprobadas. Verifica la configuración de proveedores.
                </p>
              ) : (
                <select
                  value={form.waTemplateFn}
                  onChange={e => handleTemplateChange(e.target.value)}
                  className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 outline-none bg-white"
                >
                  <option value="">— Selecciona una plantilla —</option>
                  {metaTemplates.length > 0 && (
                    <optgroup label="Meta (WhatsApp Business)">
                      {metaTemplates.map(t => (
                        <option key={t.sid} value={t.sid}>
                          {t.name} · {t.language} · {t.waCategory ?? ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {twilioTemplates.length > 0 && (
                    <optgroup label="Twilio Content">
                      {twilioTemplates.map(t => (
                        <option key={t.sid} value={t.sid}>
                          {t.name} · {t.language}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}

              {/* Body preview */}
              {selectedTemplate?.body && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Vista previa:</p>
                  <pre className="bg-white border border-emerald-200 rounded-xl p-3 text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {selectedTemplate.body
                      .replace(/\{\{1\}\}/g, '[nombre auto]')
                      .replace(/\{\{(\d+)\}\}/g, (_, n) => waVars[n] ? `[${waVars[n]}]` : `{{${n}}}`)}
                  </pre>
                </div>
              )}

              {/* Extra variable inputs ({{2}}, {{3}}, etc.) */}
              {extraVarNums.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    <Info size={13} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Variables de la plantilla:</strong>{' '}
                      <code className="bg-amber-100 px-1 rounded">{'{{1}}'}</code> se rellena automáticamente con el nombre del usuario.
                      Configura los demás valores estáticos aquí.
                    </div>
                  </div>
                  {extraVarNums.map(n => (
                    <div key={n}>
                      <label className="block text-xs font-semibold text-emerald-700 mb-1">
                        Variable <code className="bg-emerald-100 px-1 rounded">{`{{${n}}}`}</code>
                      </label>
                      <input
                        type="text"
                        placeholder={`Valor para {{${n}}}…`}
                        value={waVars[String(n)] ?? ''}
                        onChange={e => setWaVars(v => ({ ...v, [String(n)]: e.target.value }))}
                        className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 outline-none bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}

              {form.waTemplateFn && (
                <p className="text-[10px] text-emerald-600">
                  <code className="bg-emerald-100 px-1 rounded">{'{{1}}'}</code> = nombre real del usuario al enviar.
                </p>
              )}
            </div>
          )}

          {/* Email subject */}
          {form.channels.includes('EMAIL') && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Asunto (Email)</label>
              <input
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="Usa {{name}} para el nombre"
              />
            </div>
          )}

          {/* SMS / Email body */}
          {(form.channels.includes('EMAIL') || form.channels.includes('SMS')) && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Mensaje{' '}
                {form.channels.includes('EMAIL') && form.channels.includes('SMS')
                  ? '(SMS y Email)'
                  : form.channels.includes('SMS') ? '(SMS)' : '(Email)'}
              </label>
              <textarea
                rows={4}
                value={form.customBody}
                onChange={e => setForm(f => ({ ...f, customBody: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                placeholder="Usa {{name}} para el nombre del usuario"
              />
            </div>
          )}

          {/* Active */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 rounded accent-primary-600"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Regla activa</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.channels.length}
              className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'Guardando…' : isNew ? 'Crear regla' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [editRule, setEditRule] = useState<Partial<AutomationRule> | null | false>(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rulesRes, waRes] = await Promise.all([
        fetch('/api/admin/automations'),
        fetch('/api/admin/messaging/wa-templates'),
      ])
      const [rulesData, waData] = await Promise.all([rulesRes.json(), waRes.json()])
      setRules(rulesData.rules ?? [])
      setWaTemplates(waData.templates ?? [])
    } catch {
      setError('Error cargando automatizaciones')
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

  // Group rules by trigger group
  const grouped = TRIGGER_GROUPS.map(group => ({
    ...group,
    rules: rules.filter(r => group.triggers.includes(r.trigger)),
  })).filter(g => g.rules.length > 0)

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
          <p>
            Al ocurrir un evento (registro, aprobación de documentos, reserva completada, mensaje entrante, etc.)
            el sistema crea ejecuciones para cada canal activo. Un cron las procesa cada hora.
            Para WhatsApp selecciona una plantilla aprobada. <code className="bg-blue-100 px-1 rounded">{'{{1}}'}</code> siempre es el nombre del usuario.
          </p>
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
          {grouped.map(({ label, icon, rules: groupRules }) => (
            <div key={label}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                {icon}
                {label}
                <span className="bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 text-[10px] font-bold">{groupRules.length}</span>
              </h2>
              <div className="space-y-3">
                {groupRules.sort((a, b) => a.delayHours - b.delayHours).map(rule => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    waTemplates={waTemplates}
                    onToggle={handleToggle}
                    onEdit={r => setEditRule(r)}
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
