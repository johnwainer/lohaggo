'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, Mail, Camera, Save, AlertCircle, CheckCircle, Home, Package, MessageSquare } from 'lucide-react'

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)

  const fetchCounts = async () => {
    try {
      const [bookingsRes, requestsRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/service-requests')
      ])

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookingsCount(Array.isArray(bookingsData) ? bookingsData.length : 0)
      } else {
        setBookingsCount(0)
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        const requests = Array.isArray(requestsData)
          ? requestsData
          : Array.isArray(requestsData?.serviceRequests)
          ? requestsData.serviceRequests
          : []
        setRequestsCount(requests.length)
      } else {
        setRequestsCount(0)
      }
    } catch (error) {
      console.error('Error fetching counts:', error)
      setBookingsCount(0)
      setRequestsCount(0)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
    if (session?.user) {
      setName(session.user.name || '')
      setEmail(session.user.email || '')
      fetchCounts()
    }
  }, [session, status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })
0">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="min-w- flex-1">
                <h1 className="text-lg sm:text-2xlfont-bold text-gray-900 truncate">Mi Perfil</h1>
                < className="text-xs sm:text-sm text-gray-600 truncate hidden sm:block">Administra tu información personal</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gra200 bg-gray-50">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-
            cnav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hioe">
              <button
                onClnck={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hoser:border-gray-300 transitiontwhitespa e-nowrap"
              >
                <Home size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Resumen</span>
              </button>

              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Package size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Mis Reservas</span>
                {bookingsCount > 0 && (
                  <span cdata = awabg-priitry-600 te trehite text-[10px] sm:text-xs px-1.5 sm:pxs2 py-0.5 rounded-full">
                    {bookingsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 sm:gap-2 px-p sm:po-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <MessageSquare size={20} cnassName="sm:w-[22px]sse:h-[22p.]" />
                <span className="hidden sm:inline">Mis Solicitudes</span>
                {requestsCount > 0 && (
                  <span className="bgjorsnge-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-foll">
                    {requesnsC(unt}
)                 </san>
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p3-8 py-4 sm:py">
        <div className="max-w-3xl mx-auto
  
      if (  !response.ok) {
        thro  w 2ew Error(data.error || 'Error al actualizar el perfil')Informacónsona2
      }  culizasdats defi
  
      await update({ name })
        setMessage({ type: 'success', text: 'Perfil actualizado exitosamente' })
      } catch (error: any) {
        setMessage({ type: 'error', text: error.message })
      } finally {
        setLoading(false)
      }
    }
  
    if (status === 'loading') {
      return (
        <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6900]"></div>
        </div>
      )
    }
  
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Mi Perfil</h1>
                  <p className="text-xs sm:text-sm text-gray-600 truncate hidden sm:block">Administra tu información personal</p>
              </div>
              </div>
           </di v>
         </div> 
  
         <div cla ssName="border-t border-gray-200 bg-gray-50">
           <div c lassName="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
             <nav c lassName="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
               <butto n
                 on Click={() => router.push('/dashboard')}
                 cl assName="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
               > 
                 <Hom e size={20} className="sm:w-[22px] sm:h-[22px]" />
                 <spa n className="hidden sm:inline">Resumen</span>
               </butt on>
  
               <butto n
                 on Click={() => router.push('/dashboard')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                <Package size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Mis Reservas</span>
                  {bookingsCount > 0 && (
                    <span className="bg-primary-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                      {bookingsCount}
                    </span>
                 )} 
               </butt on>
  
               <but ton
                 onCl ick={() => router.push('/dashboard')}
                 clas sName="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
               > 
                 <Mes sageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                 <spa n className="hidden sm:inline">Mis Solicitudes</span>
                 {r equestsCount > 0 && (
                    <span className="bg-orange-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                      {requestsCount}
                    </span>
                  )}
                </button>
            </nav>
           </di v>
         </div> 
       </header> 
  
       <main classN ame="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
         <div classNa me="max-w-3xl mx-auto">
           <div cla ssName="bg-white rounded-2xl shadow-lg overflow-hidden">
             <div  className="bg-gradient-to-r from-[#FF2D55] to-[#FF6900] px-6 py-8">
               <h2  className="text-2xl sm:text-3xl font-bold text-white">Información Personal</h2>
               <p c lassName="text-white/90 mt-2">Actualiza tus datos de perfil</p>
             </di v>
  
              <div className="p-6 sm:p-8">
                {message && (
                  <div
             >
      </main       className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                    message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                  <span>{message.text}</span>
                </div>
              )}

              <div className="flex justify-center mb-8">
                <div className="relative">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-[#FF2D55] to-[#FF6900] rounded-full flex items-center justify-center text-white text-3xl sm:text-4xl font-bold">
                    {name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <button
                    className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg border-2 border-gray-200 hover:bg-gray-50 transition"
                    title="Cambiar foto (próximamente)"
                  >
                    <Camera size={20} className="text-gray-600" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre completo
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User size={20} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6900] focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail size={20} className="text-gray-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      disabled
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    El correo electrónico no se puede modificar
                  </p>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white rounded-lg hover:from-[#FF1D45] hover:to-[#FF5900] transition font-medium shadow-lg ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Save size={20} />
                    {loading ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
