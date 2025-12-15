'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CreditCard, Plus, Trash2, Check, AlertCircle, Home, Package, MessageSquare, Heart } from 'lucide-react'
import Link from 'next/link'
interface PaymentMethod { id: string; lastFourDigits: string; cardBrand: string; cardholderName: string; expirationMonth: number; expirationYear: number; isDefault: boolean; isActive: boolean; createdAt: string }
export default function PaymentMethodsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)
  const [favoritesCount, setFavoritesCount] = useState(0)
  const fetchMethods = async (options?: { preserveSuccess?: boolean }) => {
    const { preserveSuccess = false } = options ?? {}
    setLoading(true)
    setError(null)
    if (!preserveSuccess) {
      setSuccess(null)
    }
    try {
      const res = await fetch('/api/payment-methods')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al obtener métodos de pago')
      }
      const methods = await res.json()
      setPaymentMethods(Array.isArray(methods) ? methods : [])
    } catch (err: any) {
      setError(err.message || 'Error al cargar métodos de pago')
    } finally {
      setLoading(false)
    }
  }
  const fetchCounts = async () => {
    try {
      const [bookingsRes, requestsRes, favoritesRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/service-requests'),
        fetch('/api/favorites')
      ])

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookingsCount(Array.isArray(bookingsData) ? bookingsData.length : 0)
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        const requests = Array.isArray(requestsData) ? requestsData : Array.isArray(requestsData?.serviceRequests) ? requestsData.serviceRequests : []
        setRequestsCount(requests.length)
      }

      if (favoritesRes.ok) {
        const favorites = await favoritesRes.json()
        setFavoritesCount(Array.isArray(favorites) ? favorites.length : 0)
      }
    } catch (err: any) {
      console.error('Error fetching counts:', err)
    }
  }
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      fetchMethods()
      fetchCounts()
    }
  }, [status, router])
  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(null), 4000)
    return () => clearTimeout(timer)
  }, [success])
  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/payment-methods/${id}/set-default`, { method: 'PATCH' })
      if (!res.ok) throw new Error('No se pudo actualizar el método')
      setSuccess('Método predeterminado actualizado')
      await fetchMethods({ preserveSuccess: true })
    } catch (err: any) {
      setSuccess(null)
      setError(err.message || 'Error al actualizar método')
    }
  }
  const handleDelete = async (method: PaymentMethod) => {
    if (!confirm('¿Eliminar este método de pago?')) return
    try {
      const res = await fetch(`/api/payment-methods/${method.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'No se pudo eliminar el método de pago')
      }
      setSuccess('Método de pago eliminado')
      await fetchMethods({ preserveSuccess: true })
    } catch (err: any) {
      setSuccess(null)
      setError(err.message || 'Error al eliminar método')
    }
  }
  if (status === 'loading' || loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="h-12 w-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin" /></div>
  const navItems = [{ icon: Home, label: 'Resumen', href: '/dashboard' }, { icon: Package, label: 'Mis Reservas', href: '/dashboard?tab=bookings', count: bookingsCount }, { icon: MessageSquare, label: 'Mis Solicitudes', href: '/dashboard?tab=requests', count: requestsCount }, { icon: Heart, label: 'Favoritos', href: '/dashboard?tab=favorites', count: favoritesCount }]
  const formatExpiry = (month: number, year: number) => `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-bold text-gray-900">Métodos de Pago</h1><p className="text-sm text-gray-600">Administra tus tarjetas guardadas</p></div>
          <Link href="/dashboard/payment-methods/add" className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-white font-semibold hover:bg-primary-600 transition-colors"><Plus className="w-4 h-4" />Agregar método</Link>
        </div>
        <div className="border-t border-gray-200 bg-gray-50"><div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto px-2 py-2">{navItems.map(item => (<button key={item.label} onClick={() => router.push(item.href)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white transition-colors whitespace-nowrap"><item.icon className="w-5 h-5" />{item.label}{'count' in item && item.count !== undefined && item.count > 0 && <span className={`text-white text-xs px-2 py-0.5 rounded-full ${item.label === 'Favoritos' ? 'bg-red-500' : item.label === 'Mis Solicitudes' ? 'bg-orange-500' : 'bg-primary-600'}`}>{item.count}</span>}</button>))}</div></div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        {error && <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"><AlertCircle className="w-5 h-5 mt-0.5" /><div><p className="font-semibold">Hubo un problema</p><p className="text-sm">{error}</p></div></div>}
        {success && <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"><Check className="w-5 h-5 mt-0.5" /><p className="font-semibold">{success}</p></div>}
        {paymentMethods.length === 0 ? <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center space-y-3"><CreditCard className="mx-auto h-12 w-12 text-gray-300" /><p className="text-lg font-semibold text-gray-900">Aún no tienes métodos de pago guardados</p><p className="text-sm text-gray-600">Agrega una tarjeta para pagar tus servicios de forma segura.</p><Link href="/dashboard/payment-methods/add" className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-white font-semibold hover:bg-primary-600 transition-colors"><Plus className="w-4 h-4" />Agregar método de pago</Link></div> : <div className="grid gap-4 md:grid-cols-2">{paymentMethods.map(method => (<div key={method.id} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary-500/10 p-3 text-primary-600"><CreditCard className="w-6 h-6" /></div><div><p className="text-xs uppercase text-gray-500">{method.cardBrand}</p><p className="text-xl font-semibold tracking-widest">**** **** **** {method.lastFourDigits}</p><p className="text-sm text-gray-600">{method.cardholderName}</p></div></div>{method.isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"><Check className="w-4 h-4" />Predeterminado</span>}</div><div className="flex justify-between text-sm text-gray-600"><span>Vence {formatExpiry(method.expirationMonth, method.expirationYear)}</span><span>{method.isActive ? 'Activa' : 'Inactiva'}</span></div><div className="flex justify-between text-xs text-gray-500">Creada {new Date(method.createdAt).toLocaleDateString('es-CO')}</div><div className="flex flex-wrap gap-3">{!method.isDefault && <button onClick={() => handleSetDefault(method.id)} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"><Check className="w-4 h-4" />Predeterminar</button>}<button onClick={() => handleDelete(method)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" />Eliminar</button></div></div>))}</div>}
      </main>
    </div>
  )
}
