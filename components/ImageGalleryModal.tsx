'use client'

import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

interface Photo {
  id: string
  url: string
  order: number
}

interface ImageGalleryModalProps {
  photos: Photo[]
  initialIndex: number
  onClose: () => void
}

export default function ImageGalleryModal({ photos, initialIndex, onClose }: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const gestureStartX = useRef<number | null>(null)
  const gestureDeltaX = useRef(0)
  const isGestureActive = useRef(false)

  useEffect(() => {
    // Reset zoom when changing images
    setZoom(1)
  }, [currentIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goToPrevious()
      if (e.key === 'ArrowRight') goToNext()
    }

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentIndex])

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length)
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5))
  }

  const handleGestureStart = (clientX: number) => {
    if (zoom !== 1 || photos.length <= 1) return
    gestureStartX.current = clientX
    gestureDeltaX.current = 0
    isGestureActive.current = true
  }

  const handleGestureMove = (clientX: number) => {
    if (!isGestureActive.current || gestureStartX.current === null) return
    gestureDeltaX.current = clientX - gestureStartX.current
  }

  const handleGestureEnd = () => {
    if (!isGestureActive.current) return

    const SWIPE_THRESHOLD = 50
    if (Math.abs(gestureDeltaX.current) >= SWIPE_THRESHOLD) {
      if (gestureDeltaX.current > 0) {
        goToPrevious()
      } else {
        goToNext()
      }
    }

    isGestureActive.current = false
    gestureStartX.current = null
    gestureDeltaX.current = 0
  }

  const sortedPhotos = [...photos].sort((a, b) => a.order - b.order)

  if (!sortedPhotos || sortedPhotos.length === 0) {
    return null
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition z-10 bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70"
        aria-label="Cerrar"
      >
        <X size={32} />
      </button>

      {/* Zoom controls */}
      <div className="absolute top-4 left-4 flex gap-2 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleZoomOut()
          }}
          className="text-white hover:text-gray-300 transition bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70"
          aria-label="Alejar"
        >
          <ZoomOut size={24} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleZoomIn()
          }}
          className="text-white hover:text-gray-300 transition bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70"
          aria-label="Acercar"
        >
          <ZoomIn size={24} />
        </button>
        <span className="text-white bg-black bg-opacity-50 rounded-full px-3 py-2 text-sm">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Image container */}
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => handleGestureStart(e.touches[0].clientX)}
        onTouchMove={(e) => handleGestureMove(e.touches[0].clientX)}
        onTouchEnd={handleGestureEnd}
        onMouseDown={(e) => handleGestureStart(e.clientX)}
        onMouseMove={(e) => handleGestureMove(e.clientX)}
        onMouseUp={handleGestureEnd}
        onMouseLeave={handleGestureEnd}
        style={{ touchAction: zoom === 1 ? 'pan-y' : 'none' }}
      >
        <img
          src={sortedPhotos[currentIndex]?.url}
          alt={`Foto ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
          draggable={false}
          style={{ transform: `scale(${zoom})` }}
          onError={(e) => {
            console.error('Error loading image:', sortedPhotos[currentIndex]?.url)
            e.currentTarget.src = '/placeholder-image.png'
          }}
        />

        {/* Navigation buttons */}
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition"
              aria-label="Imagen anterior"
            >
              <ChevronLeft size={32} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition"
              aria-label="Imagen siguiente"
            >
              <ChevronRight size={32} />
            </button>

            {/* Image counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full text-sm font-medium">
              {currentIndex + 1} / {photos.length}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
