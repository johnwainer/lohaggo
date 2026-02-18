'use client'

import { useEffect, useMemo, useState } from 'react'

type AutomationTarget = 'GLOBAL' | 'CLIENT' | 'PARTNER' | 'ADMIN'
type Channel = 'PUSH' | 'EMAIL' | 'WHATSAPP' | 'SMS'
type Role = 'CLIENT' | 'PARTNER' | 'ADMIN'
type NotificationType =
  | 'NEW_SERVICE_REQUEST'
  | 'NEW_PROPOSAL'
  | 'PROPOSAL_ACCEPTED'
  | 'PROPOSAL_REJECTED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_IN_PROGRESS'
  | 'BOOKING_COMPLETED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'NEW_MESSAGE'

type AutomationConfig = {
  target: AutomationTarget
  pushEnabled: boolean
  emailEnabled: boolean
  whatsappEnabled: boolean
  smsEnabled: boolean
  updatedByEmail?: string | null
  updatedAt?: string | null
}

type DeliveryLog = {
  id: string
  userRole: Role
  channel: Channel
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'OPENED' | 'CLICKED' | 'UNSUBSCRIBED' | 'SKIPPED'
  destination: string | null
  provider: string
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  user: { id: string; name: string; email: string }
  notification: { id: string; title: string; message: string; createdAt: string } | null
}

type SummaryItem = {
  channel: Channel
  status: DeliveryLog['status']
  count: number
}

type EmailTemplate = {
  id: string
  key: string
  name: string
  notificationType: NotificationType
  channel: Channel
  role: Role | null
  subjectTemplate: string | null
  bodyTemplate: string
  bodyHtmlTemplate: string | null
  bodyTextTemplate: string | null
  isActive: boolean
  updatedByEmail?: string | null
  updatedAt?: string | null
}

const TARGET_LABEL: Record<AutomationTarget, string> = {
  GLOBAL: 'Global',
  CLIENT: 'Clientes',
  PARTNER: 'Socios',
  ADMIN: 'Admins',
}

const NOTIFICATION_TYPE_OPTIONS: NotificationType[] = [
  'NEW_SERVICE_REQUEST',
  'NEW_PROPOSAL',
  'PROPOSAL_ACCEPTED',
  'PROPOSAL_REJECTED',
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_IN_PROGRESS',
  'BOOKING_COMPLETED',
  'DOCUMENT_APPROVED',
  'DOCUMENT_REJECTED',
  'ACHIEVEMENT_UNLOCKED',
  'NEW_MESSAGE',
]

function formatDate(value: string | null | undefined) {
  if (!value) return 'n/a'
  return new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

export default function NotificationsSection() {
  const [configs, setConfigs] = useState<AutomationConfig[]>([])
  const [logs, setLogs] = useState<DeliveryLog[]>([])
  const [summary7d, setSummary7d] = useState<SummaryItem[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [savingTarget, setSavingTarget] = useState<AutomationTarget | null>(null)
  const [filterRole, setFilterRole] = useState<'ALL' | Role>('ALL')
  const [filterChannel, setFilterChannel] = useState<'ALL' | Channel>('ALL')
  const [filterStatus, setFilterStatus] = useState<'ALL' | DeliveryLog['status']>('ALL')
  const [templateFeedback, setTemplateFeedback] = useState<{ type: 'ok' | 'error'; message: string } | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [tplForm, setTplForm] = useState({
    key: '',
    name: '',
    notificationType: 'BOOKING_CONFIRMED' as NotificationType,
    channel: 'EMAIL' as Channel,
    role: '' as '' | Role,
    subjectTemplate: '',
    bodyTemplate: '',
    bodyHtmlTemplate: '',
    bodyTextTemplate: '',
    isActive: true,
  })

  const load = async () => {
    setLoading(true)
    try {
      const [cfgRes, logsRes, tplRes] = await Promise.all([
        fetch('/api/admin/notifications/automation', { cache: 'no-store' }),
        fetch('/api/admin/notifications/delivery-logs?limit=150', { cache: 'no-store' }),
        fetch('/api/admin/notifications/email-templates', { cache: 'no-store' }),
      ])
      const [cfgData, logsData, tplData] = await Promise.all([cfgRes.json(), logsRes.json(), tplRes.json()])
      setConfigs(Array.isArray(cfgData?.configs) ? cfgData.configs : [])
      setLogs(Array.isArray(logsData?.logs) ? logsData.logs : [])
      setSummary7d(Array.isArray(logsData?.summary7d) ? logsData.summary7d : [])
      setTemplates(Array.isArray(tplData?.templates) ? tplData.templates : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterRole !== 'ALL' && log.userRole !== filterRole) return false
      if (filterChannel !== 'ALL' && log.channel !== filterChannel) return false
      if (filterStatus !== 'ALL' && log.status !== filterStatus) return false
      return true
    })
  }, [logs, filterRole, filterChannel, filterStatus])

  const success7d = summary7d.filter((row) => row.status === 'SENT' || row.status === 'DELIVERED').reduce((acc, row) => acc + row.count, 0)
  const failed7d = summary7d.filter((row) => row.status === 'FAILED').reduce((acc, row) => acc + row.count, 0)
  const skipped7d = summary7d.filter((row) => row.status === 'SKIPPED' || row.status === 'UNSUBSCRIBED').reduce((acc, row) => acc + row.count, 0)

  const updateTarget = async (target: AutomationTarget, patch: Partial<AutomationConfig>) => {
    const current = configs.find((item) => item.target === target)
    if (!current) return

    const next = {
      ...current,
      ...patch,
    }

    setConfigs((prev) => prev.map((item) => (item.target === target ? next : item)))
    setSavingTarget(target)

    const response = await fetch('/api/admin/notifications/automation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target,
        pushEnabled: next.pushEnabled,
        emailEnabled: next.emailEnabled,
        whatsappEnabled: next.whatsappEnabled,
        smsEnabled: next.smsEnabled,
      }),
    })

    if (!response.ok) {
      await load()
    } else {
      const data = await response.json().catch(() => null)
      if (Array.isArray(data?.configs)) {
        setConfigs(data.configs)
      }
    }

    setSavingTarget(null)
  }

  const startEditTemplate = (template: EmailTemplate) => {
    setEditingTemplateId(template.id)
    setTplForm({
      key: template.key,
      name: template.name,
      notificationType: template.notificationType,
      channel: template.channel,
      role: (template.role || '') as '' | Role,
      subjectTemplate: template.subjectTemplate || '',
      bodyTemplate: template.bodyTemplate,
      bodyHtmlTemplate: template.bodyHtmlTemplate || '',
      bodyTextTemplate: template.bodyTextTemplate || '',
      isActive: template.isActive,
    })
    setTemplateFeedback(null)
  }

  const resetTemplateForm = () => {
    setEditingTemplateId(null)
    setTplForm({
      key: '',
      name: '',
      notificationType: 'BOOKING_CONFIRMED',
      channel: 'EMAIL',
      role: '',
      subjectTemplate: '',
      bodyTemplate: '',
      bodyHtmlTemplate: '',
      bodyTextTemplate: '',
      isActive: true,
    })
  }

  const saveTemplate = async () => {
    setTemplateFeedback(null)
    const endpoint = '/api/admin/notifications/email-templates'
    const method = editingTemplateId ? 'PATCH' : 'POST'

    const payload = {
      ...(editingTemplateId ? { id: editingTemplateId } : {}),
      key: tplForm.key.trim(),
      name: tplForm.name.trim(),
      notificationType: tplForm.notificationType,
      channel: tplForm.channel,
      role: tplForm.role || null,
      subjectTemplate: tplForm.subjectTemplate || null,
      bodyTemplate: tplForm.bodyTemplate,
      bodyHtmlTemplate: tplForm.bodyHtmlTemplate,
      bodyTextTemplate: tplForm.bodyTextTemplate || null,
      isActive: tplForm.isActive,
    }

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setTemplateFeedback({ type: 'error', message: data.error || 'No se pudo guardar plantilla' })
      return
    }

    setTemplateFeedback({ type: 'ok', message: editingTemplateId ? 'Plantilla actualizada' : 'Plantilla creada' })
    resetTemplateForm()
    await load()
  }

  const deleteTemplate = async (id: string) => {
    setTemplateFeedback(null)
    const response = await fetch(`/api/admin/notifications/email-templates?id=${id}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setTemplateFeedback({ type: 'error', message: data.error || 'No se pudo eliminar plantilla' })
      return
    }

    if (editingTemplateId === id) resetTemplateForm()
    setTemplateFeedback({ type: 'ok', message: 'Plantilla eliminada' })
    await load()
  }

  const rows = ['GLOBAL', 'CLIENT', 'PARTNER', 'ADMIN'] as AutomationTarget[]

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-900">Notificaciones Automáticas</h1>
        <p className="text-gray-600">
          Configura canales por audiencia y administra las plantillas de email para notificaciones automáticas.
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6">Cargando configuración...</div>
      ) : (
        <>
          <section className="rounded-xl border bg-white p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Entregas OK (7d)</p>
                <p className="text-2xl font-bold text-emerald-800">{success7d}</p>
              </div>
              <div className="rounded-lg border bg-rose-50 p-3">
                <p className="text-xs text-rose-700">Fallidas (7d)</p>
                <p className="text-2xl font-bold text-rose-800">{failed7d}</p>
              </div>
              <div className="rounded-lg border bg-amber-50 p-3">
                <p className="text-xs text-amber-700">Sin envío (7d)</p>
                <p className="text-2xl font-bold text-amber-800">{skipped7d}</p>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900">Matriz de canales por audiencia</h2>
              <p className="text-sm text-gray-600">GLOBAL actúa como interruptor principal. CLIENT/PARTNER/ADMIN refinan por rol.</p>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Audiencia</th>
                    <th className="px-3 py-2 text-left font-medium">Push</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">WhatsApp</th>
                    <th className="px-3 py-2 text-left font-medium">SMS</th>
                    <th className="px-3 py-2 text-left font-medium">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((target) => {
                    const row = configs.find((item) => item.target === target)
                    if (!row) return null

                    return (
                      <tr key={target} className="border-t">
                        <td className="px-3 py-2 font-semibold text-gray-900">{TARGET_LABEL[target]}</td>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={row.pushEnabled} disabled={savingTarget === target} onChange={(e) => void updateTarget(target, { pushEnabled: e.target.checked })} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={row.emailEnabled} disabled={savingTarget === target} onChange={(e) => void updateTarget(target, { emailEnabled: e.target.checked })} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={row.whatsappEnabled} disabled={savingTarget === target} onChange={(e) => void updateTarget(target, { whatsappEnabled: e.target.checked })} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={row.smsEnabled} disabled={savingTarget === target} onChange={(e) => void updateTarget(target, { smsEnabled: e.target.checked })} />
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">{formatDate(row.updatedAt)} {row.updatedByEmail ? `· ${row.updatedByEmail}` : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Plantillas por canal (Notificaciones Automáticas)</h2>
              <p className="text-sm text-gray-600">{'Variables disponibles: {{user_name}}, {{title}}, {{message}}, {{notifications_url}}, {{year}}'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input className="border rounded px-2 py-2 text-sm" placeholder="Key" value={tplForm.key} onChange={(e) => setTplForm((p) => ({ ...p, key: e.target.value }))} />
              <input className="border rounded px-2 py-2 text-sm" placeholder="Nombre" value={tplForm.name} onChange={(e) => setTplForm((p) => ({ ...p, name: e.target.value }))} />
              <select className="border rounded px-2 py-2 text-sm" value={tplForm.notificationType} onChange={(e) => setTplForm((p) => ({ ...p, notificationType: e.target.value as NotificationType }))}>
                {NOTIFICATION_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select className="border rounded px-2 py-2 text-sm" value={tplForm.channel} onChange={(e) => setTplForm((p) => ({ ...p, channel: e.target.value as Channel }))}>
                <option value="EMAIL">EMAIL</option>
                <option value="PUSH">PUSH</option>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="SMS">SMS</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className="border rounded px-2 py-2 text-sm" value={tplForm.role} onChange={(e) => setTplForm((p) => ({ ...p, role: e.target.value as '' | Role }))}>
                <option value="">Todos los roles</option>
                <option value="CLIENT">CLIENT</option>
                <option value="PARTNER">PARTNER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <label className="flex items-center gap-2 text-sm border rounded px-3 py-2">
                <input type="checkbox" checked={tplForm.isActive} onChange={(e) => setTplForm((p) => ({ ...p, isActive: e.target.checked }))} />
                Activa
              </label>
              <input className="border rounded px-2 py-2 text-sm" placeholder="Subject template (PUSH/EMAIL)" value={tplForm.subjectTemplate} onChange={(e) => setTplForm((p) => ({ ...p, subjectTemplate: e.target.value }))} />
            </div>

            <textarea className="w-full border rounded px-2 py-2 text-sm min-h-[90px]" placeholder="Body template (texto base para todos los canales)" value={tplForm.bodyTemplate} onChange={(e) => setTplForm((p) => ({ ...p, bodyTemplate: e.target.value }))} />
            <textarea className="w-full border rounded px-2 py-2 text-sm min-h-[120px]" placeholder="Body HTML template (opcional para EMAIL)" value={tplForm.bodyHtmlTemplate} onChange={(e) => setTplForm((p) => ({ ...p, bodyHtmlTemplate: e.target.value }))} />
            <textarea className="w-full border rounded px-2 py-2 text-sm min-h-[70px]" placeholder="Body text template (opcional)" value={tplForm.bodyTextTemplate} onChange={(e) => setTplForm((p) => ({ ...p, bodyTextTemplate: e.target.value }))} />

            <div className="flex flex-wrap gap-2">
              <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={saveTemplate}>
                {editingTemplateId ? 'Guardar cambios' : 'Crear plantilla'}
              </button>
              {editingTemplateId && (
                <button className="border rounded px-3 py-2 text-sm" onClick={resetTemplateForm}>
                  Cancelar edición
                </button>
              )}
            </div>

            {templateFeedback && (
              <p className={`text-sm ${templateFeedback.type === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {templateFeedback.message}
              </p>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Nombre</th>
                    <th className="px-3 py-2 text-left font-medium">Key</th>
                    <th className="px-3 py-2 text-left font-medium">Evento</th>
                    <th className="px-3 py-2 text-left font-medium">Canal</th>
                    <th className="px-3 py-2 text-left font-medium">Rol</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                    <th className="px-3 py-2 text-left font-medium">Actualizado</th>
                    <th className="px-3 py-2 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id} className="border-t">
                      <td className="px-3 py-2 font-medium text-gray-900">{template.name}</td>
                      <td className="px-3 py-2">{template.key}</td>
                      <td className="px-3 py-2">{template.notificationType}</td>
                      <td className="px-3 py-2">{template.channel}</td>
                      <td className="px-3 py-2">{template.role || 'ALL'}</td>
                      <td className="px-3 py-2">{template.isActive ? 'ACTIVA' : 'INACTIVA'}</td>
                      <td className="px-3 py-2 text-gray-500">{formatDate(template.updatedAt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button className="border rounded px-2 py-1" onClick={() => startEditTemplate(template)}>Editar</button>
                          <button className="border border-rose-300 text-rose-700 rounded px-2 py-1" onClick={() => void deleteTemplate(template.id)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {templates.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-gray-500" colSpan={8}>No hay plantillas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Bitácora de envíos automáticos</h2>
              <button className="border rounded px-3 py-2 text-sm" onClick={() => void load()}>Recargar</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className="border rounded px-2 py-2 text-sm" value={filterRole} onChange={(e) => setFilterRole(e.target.value as any)}>
                <option value="ALL">Todos los roles</option>
                <option value="CLIENT">Clientes</option>
                <option value="PARTNER">Socios</option>
                <option value="ADMIN">Admins</option>
              </select>
              <select className="border rounded px-2 py-2 text-sm" value={filterChannel} onChange={(e) => setFilterChannel(e.target.value as any)}>
                <option value="ALL">Todos los canales</option>
                <option value="PUSH">Push</option>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="SMS">SMS</option>
              </select>
              <select className="border rounded px-2 py-2 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                <option value="ALL">Todos los estados</option>
                <option value="SENT">SENT</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="FAILED">FAILED</option>
                <option value="OPENED">OPENED</option>
                <option value="CLICKED">CLICKED</option>
                <option value="UNSUBSCRIBED">UNSUBSCRIBED</option>
                <option value="SKIPPED">SKIPPED</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium">Usuario</th>
                    <th className="px-3 py-2 text-left font-medium">Evento</th>
                    <th className="px-3 py-2 text-left font-medium">Canal</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                    <th className="px-3 py-2 text-left font-medium">Destino</th>
                    <th className="px-3 py-2 text-left font-medium">Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="border-t align-top">
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-900">{log.user?.name || 'Usuario'}</p>
                        <p className="text-gray-500">{log.userRole} · {log.user?.email || '-'}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-900">{log.notification?.title || '-'}</p>
                        <p className="text-gray-500 line-clamp-2 max-w-[280px]">{log.notification?.message || '-'}</p>
                      </td>
                      <td className="px-3 py-2">{log.channel}</td>
                      <td className={`px-3 py-2 font-semibold ${log.status === 'FAILED' ? 'text-rose-700' : log.status === 'SKIPPED' || log.status === 'UNSUBSCRIBED' ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {log.status}
                        {log.errorCode ? <p className="font-normal text-gray-500">{log.errorCode}</p> : null}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{log.destination || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{log.provider}</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-gray-500" colSpan={7}>No hay registros para los filtros actuales.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
