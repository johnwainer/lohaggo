'use client'

import { LayoutDashboard, Calendar, Users, UserCheck, Package, FileText, BarChart3, Bell, Settings, LogOut, MessageSquare, Menu, X, Shield, DollarSign, Wallet } from 'lucide-react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useState } from 'react'

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'bookings', label: 'Reservas', icon: Calendar },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'partners', label: 'Socios', icon: UserCheck },
    { id: 'documents', label: 'Verificación', icon: Shield },
    { id: 'services', label: 'Servicios', icon: Package },
    { id: 'payments', label: 'Pagos', icon: DollarSign },
    { id: 'commissions', label: 'Comisiones', icon: DollarSign },
    { id: 'payouts', label: 'Pagos a Socios', icon: Wallet },
    { id: 'analytics', label: 'Analíticas', icon: BarChart3 },
    { id: 'notifications', label: 'Notificaciones', icon: Bell },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ]

  const handleSectionChange = (section: string) => {
    onSectionChange(section)
    setIsOpen(false)
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white p-2.5 rounded-xl shadow-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`w-64 bg-gradient-to-b from-[#FF2D55] to-[#FF6900] text-white h-screen fixed left-0 top-0 flex flex-col shadow-2xl z-40 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-4 sm:p-6 border-b border-white/20">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Haggo Admin</h1>
          <p className="text-white/80 text-xs sm:text-sm mt-1 font-medium">Panel de Control</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 sm:py-6 px-2 sm:px-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleSectionChange(item.id)}
                className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2 transition-all font-semibold text-sm sm:text-base ${
                  isActive
                    ? 'bg-white text-[#FF2D55] shadow-lg scale-105'
                    : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="p-3 sm:p-4 border-t border-white/20">
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl text-white/90 hover:bg-white/10 hover:text-white transition-all font-semibold text-sm sm:text-base"
          >
            <LogOut size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  )
}
