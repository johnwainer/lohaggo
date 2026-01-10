'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Smartphone } from 'lucide-react'

export function AppDownloadBanner() {
  const pathname = usePathname()

  if (pathname?.startsWith('/admin') || pathname?.startsWith('/dashboard') || pathname?.startsWith('/partner')) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-500 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-4">
              <Smartphone className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-bold">Disponible en tu móvil</span>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
              Descarga la App de LoHaggo
            </h2>
            <p className="text-white/90 text-lg font-medium max-w-2xl">
              Accede más rápido a todos los servicios. Instala nuestra app en tu dispositivo y disfruta de una experiencia optimizada.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/download/android"
              className="group relative bg-white hover:bg-gray-50 text-gray-900 px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4483-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4483.9993.9993 0 .5511-.4483.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.2439 13.8533 7.8508 12 7.8508s-3.5902.3931-5.1367 1.0989L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3435-4.1021-2.6892-7.5743-6.1185-9.4396"/>
                </svg>
              </div>
              <div className="text-left">
                <div className="text-xs text-gray-500 font-semibold">Descargar para</div>
                <div className="text-xl font-black">Android</div>
              </div>
            </Link>

            <Link
              href="/download/ios"
              className="group relative bg-white hover:bg-gray-50 text-gray-900 px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              </div>
              <div className="text-left">
                <div className="text-xs text-gray-500 font-semibold">Descargar para</div>
                <div className="text-xl font-black">iOS</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
