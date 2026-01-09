'use client'

import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { GeolocationService } from './geolocation-service'
import { StorageService } from './storage-service'
import { apiClient } from './api-client'

export type CityStatus = 'ACTIVE' | 'INACTIVE' | 'COMING_SOON'
export type CityOption = {
  id: string
  slug: string
  name: string
  status: CityStatus
  order: number
  latitude?: number
  longitude?: number
  lanzamiento?: boolean
  fechaLanzamiento?: string | null
}

type CityContextValue = {
  selectedCity: string
  setSelectedCity: (citySlug: string) => void
  cities: CityOption[]
  loading: boolean
  getActiveCities: () => CityOption[]
  getCityBySlug: (slug: string) => CityOption | undefined
  isGeolocating: boolean
  geolocateCity: () => Promise<void>
  showCityModal: boolean
  setShowCityModal: (show: boolean) => void
}

const CityContext = createContext<CityContextValue | undefined>(undefined)

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [selectedCity, setSelectedCityState] = useState<string>('')
  const [cities, setCities] = useState<CityOption[]>([])
  const [loading, setLoading] = useState(true)
  const [isGeolocating, setIsGeolocating] = useState(false)
  const [showCityModal, setShowCityModal] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const fetchCities = async () => {
      try {
        const data = await apiClient.get('/cities')
        const cityList: CityOption[] = data.map((city: any) => ({
          id: city.id,
          name: city.name,
          slug: city.slug,
          status: city.status,
          latitude: city.latitude,
          longitude: city.longitude
        }))

        setCities(cityList)

        if (typeof window !== 'undefined') {
          const savedCity = await StorageService.get('selectedCity')
          if (savedCity) {
            const cityExists = cityList.find(c => c.slug === savedCity && c.status === 'ACTIVE')
            if (cityExists) {
              setSelectedCityState(savedCity)
            } else {
              await StorageService.remove('selectedCity')
              setShowCityModal(true)
            }
          } else {
            setShowCityModal(true)
          }
        } else {
          const firstCity = cityList.find(c => c.status === 'ACTIVE')
          if (firstCity) {
            setSelectedCityState(firstCity.slug)
          }
        }

        setLoading(false)
      } catch (error: any) {
        if (error.name === 'AbortError') return
        setLoading(false)
      }
    }

    fetchCities()

    return () => {
      controller.abort()
    }
  }, [])

  const tryGeolocation = async (cityList: CityOption[]) => {
    setIsGeolocating(true)

    try {
      const position = await GeolocationService.getCurrentPosition({
        timeout: 5000,
        maximumAge: 300000,
        enableHighAccuracy: false
      })

      const { latitude, longitude } = position.coords
      const nearestCity = findNearestCity(latitude, longitude, cityList)

      if (nearestCity && nearestCity.status === 'ACTIVE') {
        setSelectedCityState(nearestCity.slug)
        if (typeof window !== 'undefined') {
          await StorageService.set('selectedCity', nearestCity.slug)
        }
      } else {
        setShowCityModal(true)
        selectDefaultCity(cityList)
      }
    } catch (error) {
      console.error('Geolocation error:', error)
      setShowCityModal(true)
      selectDefaultCity(cityList)
    } finally {
      setIsGeolocating(false)
    }
  }

  const findNearestCity = (lat: number, lon: number, cityList: CityOption[]): CityOption | null => {
    const activeCities = cityList.filter(c => c.status === 'ACTIVE' && c.latitude && c.longitude)

    if (activeCities.length === 0) return null

    let nearest = activeCities[0]
    let minDistance = calculateDistance(lat, lon, nearest.latitude!, nearest.longitude!)

    for (const city of activeCities) {
      const distance = calculateDistance(lat, lon, city.latitude!, city.longitude!)
      if (distance < minDistance) {
        minDistance = distance
        nearest = city
      }
    }

    return minDistance < 100 ? nearest : null
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const toRad = (value: number): number => {
    return (value * Math.PI) / 180
  }

  const selectDefaultCity = (cityList: CityOption[]) => {
    const activeCity = cityList.find(c => c.status === 'ACTIVE')
    const defaultCity = activeCity || cityList[0]
    if (defaultCity) {
      setSelectedCityState(defaultCity.slug)
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedCity', defaultCity.slug)
      }
    }
  }

  const setSelectedCity = (citySlug: string) => {
    const city = cities.find(c => c.slug === citySlug)
    if (city && city.status === 'ACTIVE') {
      setSelectedCityState(citySlug)
      if (typeof window !== 'undefined') {
        StorageService.set('selectedCity', citySlug)
      }
      setShowCityModal(false)
    }
  }

  const geolocateCity = async () => {
    await tryGeolocation(cities)
  }

  const getActiveCities = () => {
    return cities.filter(c => c.status === 'ACTIVE')
  }

  const getCityBySlug = (slug: string) => {
    return cities.find(c => c.slug === slug)
  }

  const value = useMemo(
    () => ({
      selectedCity,
      setSelectedCity,
      cities,
      loading,
      getActiveCities,
      getCityBySlug,
      isGeolocating,
      geolocateCity,
      showCityModal,
      setShowCityModal,
    }),
    [selectedCity, cities, loading, isGeolocating, showCityModal]
  )

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>
}

export function useCity() {
  const context = useContext(CityContext)
  if (!context) {
    throw new Error('useCity debe usarse dentro de un CityProvider')
  }
  return context
}