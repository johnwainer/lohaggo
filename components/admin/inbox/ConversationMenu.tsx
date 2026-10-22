'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { BellRing, Clock, Mail, MailOpen, MoreVertical, Pin, PinOff } from 'lucide-react'

export type InboxAction =
  | { action: 'pin' } | { action: 'unpin' }
  | { action: 'mark-unread' } | { action: 'mark-read' }
  | { action: 'snooze'; until: '1h' | '3h' | 'tomorrow' } | { action: 'unsnooze' }

type Props = {
  pinned: boolean
  unread: boolean
  snoozedUntil: string | null
  onAction: (a: InboxAction) => void
  /** Accessible name of the trigger (e.g. «Más acciones para Ana») */
  label: string
  className?: string
}

function untilText(iso: string) {
  return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', hour: 'numeric', minute: '2-digit' })
}

/** Row / header menu: pin, mark as unread, snooze. Keyboard: Enter/Space opens, arrows move, Escape closes. */
export default function ConversationMenu({ pinned, unread, snoozedUntil, onAction, label, className }: Props) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus())
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  function run(a: InboxAction) {
    setOpen(false)
    triggerRef.current?.focus()
    onAction(a)
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); triggerRef.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }

  const item = 'flex w-full items-center gap-2 px-3 py-2.5 md:py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-100 focus:outline-none'

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          // Near the bottom of the screen the menu opens upwards (the list scrolls and would hide it)
          const r = triggerRef.current?.getBoundingClientRect()
          setUp(Boolean(r && r.bottom + 320 > window.innerHeight && r.top > 320))
          setOpen((v) => !v)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title="Más acciones"
        className="rounded-lg p-2 md:p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={`absolute right-0 z-30 w-60 ${up ? 'bottom-full mb-1' : 'top-full mt-1'} max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-white py-1 shadow-lg`}
        >
          <button role="menuitem" type="button" className={item} onClick={() => run({ action: pinned ? 'unpin' : 'pin' })}>
            {pinned ? <PinOff className="h-4 w-4 text-gray-400" /> : <Pin className="h-4 w-4 text-gray-400" />}
            {pinned ? 'Desfijar' : 'Fijar arriba'}
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => run({ action: unread ? 'mark-read' : 'mark-unread' })}>
            {unread ? <MailOpen className="h-4 w-4 text-gray-400" /> : <Mail className="h-4 w-4 text-gray-400" />}
            {unread ? 'Marcar como leída' : 'Marcar como no leída'}
          </button>
          <div className="my-1 border-t" role="separator" />
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {snoozedUntil ? `Pospuesta hasta ${untilText(snoozedUntil)}` : 'Posponer'}
          </p>
          <button role="menuitem" type="button" className={item} onClick={() => run({ action: 'snooze', until: '1h' })}>
            <Clock className="h-4 w-4 text-gray-400" /> 1 hora
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => run({ action: 'snooze', until: '3h' })}>
            <Clock className="h-4 w-4 text-gray-400" /> 3 horas
          </button>
          <button role="menuitem" type="button" className={item} onClick={() => run({ action: 'snooze', until: 'tomorrow' })}>
            <Clock className="h-4 w-4 text-gray-400" /> Mañana 8:00 a. m.
          </button>
          {snoozedUntil && (
            <button role="menuitem" type="button" className={item} onClick={() => run({ action: 'unsnooze' })}>
              <BellRing className="h-4 w-4 text-gray-400" /> Quitar posposición
            </button>
          )}
        </div>
      )}
    </div>
  )
}
