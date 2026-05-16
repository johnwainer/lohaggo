'use client'

import { useEffect } from 'react'

export default function ChunkErrorHandler() {
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      const isChunkError =
        e.message?.includes('ChunkLoadError') ||
        e.message?.includes('Loading chunk') ||
        (e.filename?.includes('_next/static/chunks') && e.message?.includes('MIME type'))

      if (isChunkError) {
        window.location.reload()
      }
    }

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      if (e.reason?.name === 'ChunkLoadError' || e.reason?.message?.includes('Loading chunk')) {
        window.location.reload()
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}
