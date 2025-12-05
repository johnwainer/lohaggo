'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Upload, RotateCw, Check, X, Loader2 } from 'lucide-react'

interface ImageEditorProps {
  onImageUploaded: (url: string) => void
  onCancel: () => void
  placement: 'HOME' | 'SERVICE'
}

const BANNER_DIMENSIONS = {
  HOME: { width: 1200, height: 200, aspectRatio: 6 },
  SERVICE: { width: 1200, height: 200, aspectRatio: 6 }
}

export default function ImageEditor({ onImageUploaded, onCancel, placement }: ImageEditorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageSrc, setImageSrc] = useState<string>('')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [uploading, setUploading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const dimensions = BANNER_DIMENSIONS[placement]

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen es demasiado grande. Máximo 5MB')
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      // Set initial crop
      setCrop({
        unit: '%',
        width: 90,
        height: 90,
        x: 5,
        y: 5
      })
    }
    reader.readAsDataURL(file)
  }

  const getCroppedImg = useCallback(async (): Promise<Blob | null> => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) {
      return null
    }

    const image = imgRef.current
    const canvas = canvasRef.current
    const crop = completedCrop

    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    const ctx = canvas.getContext('2d')

    if (!ctx) return null

    canvas.width = dimensions.width
    canvas.height = dimensions.height

    ctx.imageSmoothingQuality = 'high'

    // Apply filters
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`

    // Draw cropped and resized image
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      dimensions.width,
      dimensions.height
    )

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob)
        },
        'image/jpeg',
        0.95
      )
    })
  }, [completedCrop, brightness, contrast, dimensions])

  const handleUpload = async () => {
    try {
      setUploading(true)

      let fileToUpload: File

      if (completedCrop && imgRef.current) {
        // Get cropped and edited image
        const croppedBlob = await getCroppedImg()
        if (!croppedBlob) {
          alert('Error al procesar la imagen')
          return
        }
        fileToUpload = new File([croppedBlob], selectedFile!.name, {
          type: 'image/jpeg'
        })
      } else {
        // Use original file
        fileToUpload = selectedFile!
      }

      const formData = new FormData()
      formData.append('file', fileToUpload)

      const response = await fetch('/api/ads/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al subir la imagen')
      }

      const data = await response.json()
      onImageUploaded(data.url)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert(error instanceof Error ? error.message : 'Error al subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Editor de Imagen</h2>
              <p className="text-sm text-gray-600 mt-1">
                Dimensiones recomendadas: {dimensions.width}x{dimensions.height}px
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {!imageSrc ? (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Selecciona una imagen
              </h3>
              <p className="text-gray-600 mb-4">
                JPG, PNG o WebP (máx. 5MB)
              </p>
              <label className="inline-block bg-gradient-to-r from-[#FF2D55] via-[#FF3D00] to-[#FF6900] text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all cursor-pointer font-semibold">
                Seleccionar Archivo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Image Preview with Crop */}
              <div className="bg-gray-100 rounded-xl p-4">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={dimensions.aspectRatio}
                >
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Preview"
                    style={{
                      filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                      transform: `rotate(${rotation}deg)`,
                      maxHeight: '400px',
                      width: 'auto'
                    }}
                  />
                </ReactCrop>
              </div>

              {/* Editing Tools */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Brightness */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Brillo: {brightness}%
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Contrast */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Contraste: {contrast}%
                  </label>
                  <input
                    type="range"
                    min="50"
                    max="150"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleRotate}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-semibold"
                >
                  <RotateCw className="w-5 h-5" />
                  Rotar 90°
                </button>
                <button
                  onClick={() => {
                    setBrightness(100)
                    setContrast(100)
                    setRotation(0)
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-semibold"
                >
                  Restablecer
                </button>
              </div>

              {/* Hidden canvas for processing */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
        </div>

        {imageSrc && (
          <div className="p-6 border-t border-gray-200 flex gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 bg-gradient-to-r from-[#FF2D55] via-[#FF3D00] to-[#FF6900] text-white py-3 rounded-xl hover:shadow-lg transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Guardar y Usar
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={uploading}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-semibold disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
