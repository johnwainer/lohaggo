'use client'

import { useState } from 'react'
import { Loader2, Send, Trash2 } from 'lucide-react'
import type { ActionBody } from '@/components/admin/requests/types'
import { Sheet, btn, input } from '@/components/admin/requests/ui'

type Run = (body: ActionBody, ok: (r: Record<string, unknown>) => string) => Promise<boolean>
type Reason = Extract<ActionBody, { action: 'close' }>['reason']

const REASONS: Array<{ id: Reason; label: string; hint: string }> = [
  { id: 'spam', label: 'Spam o prueba', hint: 'Texto sin sentido, datos falsos o alguien probando' },
  { id: 'not_serious', label: 'No es seria', hint: 'Broma, precio absurdo o sin intención de contratar' },
  { id: 'duplicate', label: 'Duplicada', hint: 'El cliente ya tiene otra solicitud igual' },
  { id: 'out_of_scope', label: 'Servicio que no ofrecemos', hint: 'Pide algo fuera del catálogo' },
  { id: 'incomplete', label: 'Faltan datos', hint: 'Sin información suficiente para cotizar' },
  { id: 'other', label: 'Otro motivo', hint: 'Escríbelo: lo verá el cliente si le avisas' },
]

const QUICK_MESSAGES = [
  'Hola, somos el equipo de LoHaggo. ¿Nos confirmas los detalles de tu solicitud (qué necesitas, dirección y horario) para enviársela a los socios?',
  'Hola, vimos tu solicitud en LoHaggo. Para ayudarte mejor, ¿nos cuentas un poco más de lo que necesitas y, si puedes, nos envías una foto?',
]

/** «Mensaje al cliente»: straight to their chat when it is open, otherwise in the app with a WhatsApp notice */
export function MessageClientSheet({ busy, run, onClose }: { busy: boolean; run: Run; onClose: () => void }) {
  const [text, setText] = useState('')
  const send = async () => {
    if (await run({ action: 'message_client', text: text.trim() }, (r) => (r.via === 'chat' ? 'Mensaje enviado a su chat de WhatsApp/redes' : 'Mensaje enviado: lo verá en la app y le llegó un aviso por WhatsApp'))) onClose()
  }
  return (
    <Sheet
      title="Mensaje al cliente"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={btn.ghost}>Volver</button>
        <button type="button" disabled={busy || text.trim().length < 2} className={btn.primary} onClick={send}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} Enviar</button>
      </>}
    >
      <p className="text-gray-700">Si escribió por WhatsApp, Messenger o Instagram en las últimas 24 horas, le llega directo a ese chat. Si no, lo ve en la app y le avisamos por WhatsApp.</p>
      <div className="flex flex-col gap-2">
        {QUICK_MESSAGES.map((m) => (
          <button key={m} type="button" onClick={() => setText(m)} className="rounded-2xl border border-gray-200 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50">{m}</button>
        ))}
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">Mensaje</span>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} rows={4} className={`${input} mt-1`} placeholder="Escribe el mensaje para el cliente" />
        <span className="mt-1 block text-right text-[11px] text-gray-500">{text.length}/1000</span>
      </label>
    </Sheet>
  )
}

/** «Cerrar o eliminar»: cancel with a reason, tell the client and the partners, optionally erase it */
export function CloseRequestSheet({ busy, run, onClose, onDeleted }: { busy: boolean; run: Run; onClose: () => void; onDeleted: () => void }) {
  const [reason, setReason] = useState<Reason>('spam')
  const [note, setNote] = useState('')
  const [notifyClient, setNotifyClient] = useState(true)
  const [notifyPartners, setNotifyPartners] = useState(true)
  const [deleteForGood, setDeleteForGood] = useState(false)
  const needsNote = reason === 'other' && note.trim().length < 5

  const submit = async () => {
    const ok = await run({ action: 'close', reason, note: note.trim() || undefined, notifyClient, notifyPartners, deleteForGood }, (r) => {
      const parts = [r.deleted ? 'Solicitud eliminada' : 'Solicitud cerrada']
      if (typeof r.partners === 'number' && r.partners) parts.push(`se avisó a ${r.partners} ${r.partners === 1 ? 'socio' : 'socios'}`)
      if (notifyClient) parts.push(r.clientTold ? 'el cliente recibió el motivo por WhatsApp' : 'el cliente lo verá en la app')
      return parts.join(' · ')
    })
    if (ok) { onClose(); if (deleteForGood) onDeleted() }
  }

  return (
    <Sheet
      title="Cerrar o eliminar la solicitud"
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className={btn.ghost}>Volver</button>
        <button type="button" disabled={busy || needsNote} className={deleteForGood ? btn.danger : btn.primary} onClick={submit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : deleteForGood ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : null}
          {deleteForGood ? 'Eliminar definitivamente' : 'Cerrar solicitud'}
        </button>
      </>}
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold text-gray-600">Motivo</legend>
        {REASONS.map((r) => (
          <label key={r.id} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 ${reason === r.id ? 'border-primary-400 bg-primary-50/40' : 'border-gray-200 hover:bg-gray-50'}`}>
            <input type="radio" name="close-reason" className="mt-1" checked={reason === r.id} onChange={() => setReason(r.id)} />
            <span><span className="block font-semibold text-gray-900">{r.label}</span><span className="block text-xs text-gray-600">{r.hint}</span></span>
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">{reason === 'other' ? 'Motivo (lo verá el cliente)' : 'Nota interna (opcional)'}</span>
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} className={`${input} mt-1`} placeholder={reason === 'other' ? 'Ej.: la dirección no existe' : 'Solo queda en el registro'} />
      </label>
      <label className="flex items-start gap-2 text-gray-800"><input type="checkbox" className="mt-1" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} /><span>Avisar al cliente con el motivo <span className="block text-xs text-gray-600">Por WhatsApp y en la app; puede responder si fue un error.</span></span></label>
      <label className="flex items-start gap-2 text-gray-800"><input type="checkbox" className="mt-1" checked={notifyPartners} onChange={(e) => setNotifyPartners(e.target.checked)} /><span>Avisar a los socios que la recibieron <span className="block text-xs text-gray-600">Les decimos que ya no está disponible, sin dar el motivo.</span></span></label>
      <label className={`flex items-start gap-2 rounded-2xl p-3 ${deleteForGood ? 'bg-red-50 text-red-900' : 'text-gray-800'}`}>
        <input type="checkbox" className="mt-1" checked={deleteForGood} onChange={(e) => setDeleteForGood(e.target.checked)} />
        <span>Eliminar definitivamente <span className="block text-xs">Borra la solicitud, sus propuestas, fotos y chats. No se puede deshacer; queda solo un registro en la auditoría. Si no lo marcas, queda cancelada y visible en el historial.</span></span>
      </label>
    </Sheet>
  )
}
