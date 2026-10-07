'use client'

import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useDialog } from '@/components/ui/use-dialog'

interface Photo {
  id: string
  url: string
  order: number
  alt?: string
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
  const { dialogProps } = useDialog(true, onClose)

  useEffect(() => {
    // Reset zoom when changing images
    setZoom(1)
  }, [currentIndex])

  // Escape, scroll lock and focus are handled by useDialog; arrows move between photos.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevious()
      if (e.key === 'ArrowRight') goToNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [photos.length])

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

  const total = sortedPhotos.length
  const current = sortedPhotos[currentIndex]
  const btn = 'inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'

  return (
    <div
      {...dialogProps}
      aria-labelledby={undefined}
      aria-label="Galería de fotos"
      className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4 focus:outline-none"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className={`absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 ${btn}`}
        aria-label="Cerrar galería"
      >
        <X size={26} aria-hidden="true" />
      </button>

      {/* Zoom controls */}
      <div className="absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleZoomOut()
          }}
          className={btn}
          aria-label="Alejar"
        >
          <ZoomOut size={22} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleZoomIn()
          }}
          className={btn}
          aria-label="Acercar"
        >
          <ZoomIn size={22} aria-hidden="true" />
        </button>
        <span className="text-white bg-black/60 rounded-full px-3 py-2 text-sm" aria-live="polite">
          <span className="sr-only">Zoom </span>{Math.round(zoom * 100)}%
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
          src={current?.url}
          alt={current?.alt || `Foto ${currentIndex + 1} de ${total}`}
          className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
          draggable={false}
          style={{ transform: `scale(${zoom})` }}
          onError={(e) => {
            console.error('Error loading image:', sortedPhotos[currentIndex]?.url)
            e.currentTarget.src = '/placeholder-image.png'
          }}
        />

        {/* Navigation buttons */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
              className={`absolute left-4 top-1/2 -translate-y-1/2 !h-12 !w-12 ${btn}`}
              aria-label="Foto anterior"
            >
              <ChevronLeft size={30} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
              className={`absolute right-4 top-1/2 -translate-y-1/2 !h-12 !w-12 ${btn}`}
              aria-label="Foto siguiente"
            >
              <ChevronRight size={30} aria-hidden="true" />
            </button>

            {/* Image counter */}
            <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium" aria-live="polite">
              <span className="sr-only">Foto </span>{currentIndex + 1}<span aria-hidden="true"> / </span><span className="sr-only"> de </span>{total}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
