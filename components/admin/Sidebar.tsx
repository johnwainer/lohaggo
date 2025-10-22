'use client'

import { LayoutDashboard, Calendar, Users, UserCheck, Package, FileText, BarChart3, Bell, Settings, LogOut, MessageSquare } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'bookings', label: 'Reservas', icon: Calendar },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'partners', label: 'Socios', icon: UserCheck },
    { id: 'services', label: 'Servicios', icon: Package },
    { id: 'requests', label: 'Solicitudes', icon: FileText },
    { id: 'analytics', label: 'Analíticas', icon: BarChart3 },
    { id: 'notifications', label: 'Notificaciones', icon: Bell },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ]

  return (
    <div className="w-64 bg-gradient-to-b from-[#FF2D55] to-[#FF6900] text-white h-screen fixed left-0 top-0 flex flex-col shadow-2xl">
      <div className="p-6 border-b border-white/20">
        <h1 className="text-2xl font-black tracking-tight">Haggo Admin</h1>
        <p className="text-white/80 text-sm mt-1 font-medium">Panel de Control</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl mb-2 transition-all font-semibold ${
                isActive
                  ? 'bg-white text-[#FF2D55] shadow-lg scale-105'
                  : 'text-white/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/20">
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-white/90 hover:bg-white/10 hover:text-white transition-all font-semibold"
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  )
}
