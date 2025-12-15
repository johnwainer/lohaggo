'use client'

import { useCity } from '@/lib/city-context'
import { MapPin, Navigation, X } from 'lucide-react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CityModal() {
  const router = useRouter()
  const {
    cities,
    selectedCity,
    setSelectedCity,
    showCityModal,
    setShowCityModal,
    isGeolocating,
    geolocateCity
  } = useCity()

  useEffect(() => {
    if (showCityModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showCityModal])

  if (!showCityModal) return null

  const activeCities = cities.filter(c => c.status === 'ACTIVE')
  const comingSoonCities = cities.filter(c => c.status === 'COMING_SOON')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-6 relative">
          <button
            onClick={() => setShowCityModal(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition"
          >
            <X size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-xl">
              <MapPin size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Selecciona tu ciudad</h2>
              <p className="text-white/90 text-sm">Para mostrarte los servicios disponibles</p>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <button
            onClick={geolocateCity}
            disabled={isGeolocating}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            <Navigation size={20} className={isGeolocating ? 'animate-spin' : ''} />
            {isGeolocating ? 'Detectando ubicación...' : 'Detectar mi ubicación'}
          </button>

          {activeCities.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Ciudades disponibles
              </h3>
              <div className="space-y-2">
                {activeCities.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => setSelectedCity(city.slug)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                      city.slug === selectedCity
                        ? 'border-primary-500 bg-primary-500/5 text-primary-600'
                        : 'border-gray-200 hover:border-primary-500/30 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin size={20} className={city.slug === selectedCity ? 'text-primary-600' : 'text-gray-400'} />
                      <span className="font-semibold">{city.name}</span>
                    </div>
                    {city.slug === selectedCity && (
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {comingSoonCities.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Próximamente
              </h3>
              <div className="space-y-2">
                {comingSoonCities.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => {
                      setShowCityModal(false)
                      router.push(`/ciudad/${city.slug}`)
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin size={20} className="text-orange-500" />
                      <span className="font-semibold text-gray-700">{city.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-orange-600 bg-orange-200 px-3 py-1 rounded-full">
                      Pronto
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
