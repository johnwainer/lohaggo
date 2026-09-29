'use client'

import Link from 'next/link'
import { ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, LogOut, Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'
import { menuFor, itemHref, type MenuItem } from '@/components/admin/admin-menu'

function useInboxUnread() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    async function fetch_() {
      if (typeof document !== 'undefined' && document.hidden) return
      try {
        const res = await fetch('/api/admin/inbox/unread-count')
        if (res.ok && active) {
          const data = await res.json()
          setCount(data.count ?? 0)
        }
      } catch { /* ignore */ }
    }
    fetch_()
    const id = setInterval(fetch_, 30000)
    const onVisible = () => { if (!document.hidden) fetch_() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { active = false; clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [])
  return count
}

interface SidebarProps {
  activeSection: string
  isSuperAdmin?: boolean
  /** Desktop only: icons-only rail */
  collapsed: boolean
  onToggleCollapsed: () => void
}

const getGroupKey = (label: string) =>
  label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')

export default function Sidebar({ activeSection, isSuperAdmin = false, collapsed, onToggleCollapsed }: SidebarProps) {
  const ADMIN_MENU = useMemo(() => menuFor(isSuperAdmin), [isSuperAdmin])
  const [isOpen, setIsOpen] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const pathname = usePathname()
  const inboxUnread = useInboxUnread()

  useEffect(() => {
    const activeGroup = ADMIN_MENU.find((group) => group.items.some((item) => item.id === activeSection))
    setExpandedGroup(activeGroup ? getGroupKey(activeGroup.label) : null)
  }, [activeSection, ADMIN_MENU])

  // Leaving a page closes the mobile drawer
  useEffect(() => { setIsOpen(false) }, [pathname])

  const toggleGroup = (groupKey: string) => {
    setExpandedGroup((prev) => (prev === groupKey ? null : groupKey))
  }

  // The rail applies on desktop only; the mobile drawer is always full width
  const rail = collapsed && !isOpen
  const currentLabel = ADMIN_MENU.flatMap((g) => g.items).find((i) => i.id === activeSection)?.label ?? 'Panel de control'

  const itemLink = (item: MenuItem, compact: boolean) => {
    const Icon = item.icon
    const isActive = activeSection === item.id
    const href = itemHref(item)
    const badge = item.id === 'inbox' && inboxUnread > 0 ? (inboxUnread > 99 ? '99+' : String(inboxUnread)) : null
    return (
      <Link
        key={item.id}
        href={href}
        // Sections of /admin switch in place
        replace={!item.href && pathname === '/admin'}
        scroll={Boolean(item.href)}
        data-testid={`admin-nav-${item.id}`}
        aria-current={isActive ? 'page' : undefined}
        title={compact ? item.label : undefined}
        onClick={() => setIsOpen(false)}
        className={compact
          ? `relative mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-xl transition ${isActive ? 'bg-white text-primary-600 shadow-lg' : 'text-white/90 hover:bg-white/15 hover:text-white'}`
          : `w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2 transition-all font-semibold text-sm sm:text-base text-left ${isActive ? 'bg-white text-primary-600 shadow-lg' : 'text-white/90 hover:bg-white/15 hover:text-white'}`}
      >
        <Icon size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
        {!compact && <span className="flex-1">{item.label}</span>}
        {badge && (compact
          ? <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">{badge}</span>
          : <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{badge}</span>)}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile top bar: menu button and where you are (it never covers the page's own title) */}
      <header className="lg:hidden fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/95 px-3 backdrop-blur">
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Abrir menú"
          className="relative rounded-xl bg-gradient-to-r from-primary-500 to-secondary-500 p-2 text-white shadow-sm"
        >
          <Menu size={20} />
          {inboxUnread > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{currentLabel}</p>
          <p className="text-[11px] leading-none text-gray-400">LoHaggo Admin</p>
        </div>
      </header>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${rail ? 'w-72 max-w-[85vw] lg:w-20' : 'w-72 max-w-[85vw] lg:w-64'} bg-gradient-to-b from-primary-500 to-secondary-500 text-white h-[100dvh] fixed left-0 top-0 flex flex-col z-50 lg:z-40 transition-all duration-300 ${
        isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0 lg:shadow-2xl'
      }`}>
        <div className={`border-b border-white/20 ${rail ? 'p-4 lg:px-2 lg:py-5' : 'p-4 sm:p-6'}`}>
          {rail ? (
            <>
              <h1 className="text-xl font-black tracking-tight lg:hidden">LoHaggo Admin</h1>
              <p className="hidden text-center text-lg font-black tracking-tight lg:block" title="LoHaggo Admin">LH</p>
            </>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">LoHaggo Admin</h1>
                <p className="text-white/80 text-xs sm:text-sm mt-1 font-medium">Panel de Control</p>
              </div>
              <button onClick={() => setIsOpen(false)} aria-label="Cerrar menú" className="lg:hidden rounded-lg p-1.5 text-white/90 hover:bg-white/15"><X size={22} /></button>
            </div>
          )}
        </div>

        {rail ? (
          <nav className="hidden flex-1 overflow-y-auto py-3 lg:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Menú">
            {ADMIN_MENU.map((group, i) => (
              <div key={group.label} className={i ? 'mt-2 border-t border-white/15 pt-2' : ''} title={group.label}>
                {group.items.map((item) => itemLink(item, true))}
              </div>
            ))}
          </nav>
        ) : null}

        <nav className={`flex-1 overflow-y-auto py-4 sm:py-6 px-2 sm:px-3 ${rail ? 'lg:hidden' : ''}`} aria-label="Menú">
          {ADMIN_MENU.map((group) => {
            const groupKey = getGroupKey(group.label)
            const hasActiveItem = group.items.some((item) => item.id === activeSection)
            const isExpanded = expandedGroup === groupKey

            return (
              <div
                key={group.label}
                className={`mb-3 rounded-xl border transition-all ${
                  hasActiveItem
                    ? 'border-white/35 bg-white/10'
                    : 'border-transparent bg-white/5 hover:bg-white/10'
                }`}
              >
                <button
                  onClick={() => toggleGroup(groupKey)}
                  aria-expanded={isExpanded}
                  aria-controls={`admin-group-${groupKey}`}
                  data-testid={`admin-group-${groupKey}`}
                  className={`w-full flex items-center justify-between px-3 sm:px-4 py-3 transition-colors ${
                    hasActiveItem ? 'text-white' : 'text-white/80 hover:text-white'
                  }`}
                >
                  <div className="min-w-0 text-left">
                    <p className="text-xs sm:text-sm font-bold uppercase tracking-wider">{group.label}</p>
                    <p className="text-[11px] text-white/70 truncate">{group.hint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                      {group.items.length}
                    </span>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>

                <div
                  id={`admin-group-${groupKey}`}
                  aria-hidden={!isExpanded}
                  className={isExpanded ? 'block' : 'hidden'}
                >
                  <div className="mt-1 px-2 pb-2">
                    {group.items.map((item) => itemLink(item, false))}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        <div className={`border-t border-white/20 ${rail ? 'p-3 lg:p-2' : 'p-3 sm:p-4'} space-y-1`}>
          <button
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            className={`hidden lg:flex items-center gap-3 rounded-xl text-white/80 hover:bg-white/10 hover:text-white transition-all text-sm font-semibold ${rail ? 'mx-auto h-10 w-10 justify-center' : 'w-full px-4 py-2.5'}`}
          >
            {collapsed ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} /> <span>Contraer menú</span></>}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            title={rail ? 'Cerrar sesión' : undefined}
            className={`flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl text-white/90 hover:bg-white/10 hover:text-white transition-all font-semibold text-sm sm:text-base ${rail ? 'w-full px-3 py-3 lg:mx-auto lg:h-10 lg:w-10 lg:justify-center lg:p-0' : 'w-full px-3 sm:px-4 py-3 sm:py-3.5'}`}
          >
            <LogOut size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
            <span className={rail ? 'lg:hidden' : ''}>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  )
}
