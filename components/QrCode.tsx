'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

interface QrCodeProps {
  url: string
  size?: number
  className?: string
}

export default function QrCode({ url, size = 240, className }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!url || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: { dark: '#1d4ed8', light: '#ffffff' },
    }).then(() => {
      setDataUrl(canvasRef.current!.toDataURL('image/png'))
    }).catch(() => { /* ignore */ })
  }, [url, size])

  return (
    <div className={className}>
      <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block' }} />
      {dataUrl && (
        <a
          href={dataUrl}
          download="qr-lohaggo.png"
          className="block text-center text-xs text-primary-600 font-semibold py-2 hover:underline"
        >
          ↓ Descargar PNG
        </a>
      )}
    </div>
  )
}
