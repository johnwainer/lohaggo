'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useCity } from '@/lib/city-context'

interface Advertisement {
  id: string
  title: string
  imageUrl: string
  linkUrl: string | null
  placement: string
}

interface AdBannerProps {
  placement: 'HOME' | 'SERVICE'
  serviceId?: string
  className?: string
}

export default function AdBanner({ placement, serviceId, className = '' }: AdBannerProps) {
  const [ads, setAds] = useState<Advertisement[]>([])
  const [currentAdIndex, setCurrentAdIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false)
  const { selectedCity } = useCity()

  useEffect(() => {
    fetchAds()
  }, [placement, serviceId, selectedCity])

  useEffect(() => {
    if (ads.length > 1) {
      const interval = setInterval(() => {
        setCurrentAdIndex((prev) => (prev + 1) % ads.length)
        setHasTrackedImpression(false)
      }, 8000)
      return () => clearInterval(interval)
    }
  }, [ads.length])

  useEffect(() => {
    if (ads.length > 0 && !hasTrackedImpression && isVisible) {
      const timer = setTimeout(() => {
        trackImpression(ads[currentAdIndex].id)
        setHasTrackedImpression(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [currentAdIndex, ads, hasTrackedImpression, isVisible])

  const fetchAds = async () => {
    try {
      let url = `/api/ads?placement=${placement}&city=${selectedCity.toUpperCase()}`
      if (serviceId) {
        url += `&serviceId=${serviceId}`
      }
      const response = await fetch(url)
      const data = await response.json()
      setAds(data)
    } catch (error) {
      console.error('Error fetching ads:', error)
    }
  }

  const trackImpression = async (adId: string) => {
    try {
      await fetch('/api/ads/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId, type: 'impression' })
      })
    } catch (error) {
      console.error('Error tracking impression:', error)
    }
  }

  const trackClick = async (adId: string) => {
    try {
      await fetch('/api/ads/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId, type: 'click' })
      })
    } catch (error) {
      console.error('Error tracking click:', error)
    }
  }

  const handleAdClick = (ad: Advertisement) => {
    trackClick(ad.id)
    if (ad.linkUrl) {
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleClose = () => {
    setIsVisible(false)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`ad-closed-${placement}`, 'true')
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const wasClosed = sessionStorage.getItem(`ad-closed-${placement}`)
      if (wasClosed) {
        setIsVisible(false)
      }
    }
  }, [placement])

  if (!isVisible || ads.length === 0) {
    return null
  }

  const currentAd = ads[currentAdIndex]

  return (
    <div className={`relative animate-fade-in ${className}`}>
      <div className="relative group">
        <div
          onClick={() => handleAdClick(currentAd)}
          className={`relative overflow-hidden rounded-2xl shadow-lg ${
            currentAd.linkUrl ? 'cursor-pointer' : ''
          } transition-transform hover:scale-[1.02]`}
        >
          <img
            src={currentAd.imageUrl}
            alt={currentAd.title}
            className="w-full h-full object-cover"
          />
          
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-medium">
            Publicidad
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClose()
            }}
            className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white p-2 rounded-full hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Cerrar anuncio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {ads.length > 1 && (
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
            {ads.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentAdIndex(index)
                  setHasTrackedImpression(false)
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentAdIndex
                    ? 'bg-white w-6'
                    : 'bg-white/50 hover:bg-white/75'
                }`}
                aria-label={`Ver anuncio ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
