import { LayoutDashboard, Calendar, Users, UserCheck, Package, BarChart3, Bell, Settings, Shield, DollarSign, Wallet, MapPin, CreditCard, Percent, Megaphone, Activity, HeartPulse, LifeBuoy, ToggleRight, Building2, BookOpen, Smartphone, MessageSquare, Inbox, Link2, Zap, Palette, Send, Share2, Bot, Cpu, Newspaper, type LucideIcon } from 'lucide-react'

export interface MenuItem {
  id: string
  label: string
  icon: LucideIcon
  /** Own page; without it the item is a section of /admin (?section=id) */
  href?: string
}

export interface MenuGroup {
  label: string
  hint: string
  items: MenuItem[]
}

export const ADMIN_MENU: MenuGroup[] = [
  {
    label: 'Panel General',
    hint: 'Vista global y salud del sistema',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'analytics', label: 'Analítica', icon: BarChart3, href: '/admin/analytics' },
      { id: 'system', label: 'Salud del sistema', icon: HeartPulse, href: '/admin/system' },
    ],
  },
  {
    label: 'Operación Diaria',
    hint: 'Reservas, pagos y operaciones',
    items: [
      { id: 'service-requests', label: 'Solicitudes', icon: Send, href: '/admin/service-requests' },
      { id: 'bookings', label: 'Reservas', icon: Calendar },
      { id: 'payments', label: 'Pagos', icon: DollarSign },
      { id: 'payouts', label: 'Pagos a Socios', icon: Wallet },
      { id: 'finance-ops', label: 'Finanzas', icon: CreditCard, href: '/admin/finance-ops' },
      { id: 'operations', label: 'Casos e incidentes', icon: LifeBuoy, href: '/admin/operations' },
    ],
  },
  {
    label: 'Usuarios y Verificación',
    hint: 'Cuentas, socios y cumplimiento',
    items: [
      { id: 'users', label: 'Usuarios', icon: Users },
      { id: 'partners', label: 'Socios', icon: UserCheck },
      { id: 'documents', label: 'Documentos', icon: BookOpen, href: '/admin/documents' },
    ],
  },
  {
    label: 'Servicios y Ubicaciones',
    hint: 'Catálogo y cobertura geográfica',
    items: [
      { id: 'services', label: 'Servicios', icon: Package },
      { id: 'cities', label: 'Ciudades', icon: MapPin },
    ],
  },
  {
    label: 'Marketing y Canales',
    hint: 'Adquisición, comunicación y alcance',
    items: [
      { id: 'marketing', label: 'Publicaciones', icon: Newspaper, href: '/admin/marketing' },
      { id: 'ads', label: 'Publicidad', icon: Megaphone, href: '/admin/ads' },
      { id: 'communications', label: 'Comunicaciones', icon: Bell, href: '/admin/communications' },
      { id: 'inbox', label: 'Bandeja de entrada', icon: Inbox, href: '/admin/inbox' },
      { id: 'ai-agents', label: 'Agentes IA', icon: Bot, href: '/admin/ai-agents' },
      { id: 'messaging', label: 'Mensajería', icon: MessageSquare, href: '/admin/messaging' },
    ],
  },
  {
    label: 'Configuración',
    hint: 'Integraciones, ajustes y plataforma',
    items: [
      { id: 'connections', label: 'Conexiones', icon: Link2, href: '/admin/connections' },
      { id: 'channels', label: 'Canales', icon: Share2, href: '/admin/channels' },
      { id: 'workspaces', label: 'Workspaces', icon: Users, href: '/admin/workspaces' },
      { id: 'automations', label: 'Automatizaciones', icon: Zap, href: '/admin/automations' },
      { id: 'ai-settings', label: 'IA · Plataforma', icon: Cpu, href: '/admin/ai-settings' },
      { id: 'commissions', label: 'Comisiones', icon: Percent },
      { id: 'banks', label: 'Bancos', icon: Building2, href: '/admin/banks' },
      { id: 'notifications', label: 'Notificaciones', icon: Bell },
      { id: 'security', label: 'Seguridad', icon: Shield, href: '/admin/security' },
      { id: 'platform-control', label: 'Funciones y botones', icon: ToggleRight, href: '/admin/platform-control' },
      { id: 'appearance', label: 'Apariencia', icon: Palette, href: '/admin/appearance' },
      { id: 'training', label: 'Entrenamiento', icon: BookOpen, href: '/admin/training' },
      { id: 'settings', label: 'Ajustes', icon: Settings },
    ],
  },
]

const ITEMS = ADMIN_MENU.flatMap((g) => g.items)

/** Pages that belong to a menu item without living under its URL. */
const ALIASES: Array<[prefix: string, id: string]> = [
  ['/admin/users/', 'users'],
  ['/admin/payment-config', 'connections'],
  ['/admin/commissions', 'commissions'],
  ['/admin/payouts', 'payouts'],
  ['/admin/search-analytics', 'analytics'],
  ['/admin/pwa-adoption', 'analytics'],
]

export const itemHref = (item: MenuItem) => item.href ?? `/admin?section=${item.id}`

/**
 * The menu item of the current page: a section of /admin, an alias, or the item whose URL is the
 * longest prefix of the path (so /admin/marketing/posts/x keeps "Publicaciones" active). Any new page
 * added to ADMIN_MENU is detected without touching this.
 */
export function activeSectionFor(pathname: string, section: string | null) {
  if (pathname === '/admin' || pathname === '/admin/') {
    return section && ITEMS.some((i) => i.id === section && !i.href) ? section : 'dashboard'
  }
  for (const [prefix, id] of ALIASES) if (pathname.startsWith(prefix)) return id
  const match = ITEMS.filter((i) => i.href && (pathname === i.href || pathname.startsWith(`${i.href}/`))).sort((a, b) => b.href!.length - a.href!.length)[0]
  return match?.id ?? 'dashboard'
}
