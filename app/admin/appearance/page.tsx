'use client'

import { useState } from 'react'
import { useIconTheme } from '@/lib/icon-theme-context'
import { SERVICE_ICONS, CATEGORY_ICONS } from '@/lib/icon-themes'
import type { IconTheme } from '@/lib/icon-themes'
import { CheckCircle2, Loader2, FlaskConical } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'

const THEMES: { id: IconTheme; label: string; description: string; experimental?: boolean }[] = [
  {
    id: 'emoji',
    label: 'Emoji',
    description: 'Íconos clásicos tipo emoji. Coloridos y universales.',
  },
  {
    id: 'moderno',
    label: 'Moderno',
    description: 'Íconos SVG con fondo suave. Estilo profesional y limpio.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Solo el ícono en color, sin fondo. Look ultra-clean.',
  },
  {
    id: 'rappi',
    label: 'Rappi',
    description: 'Gradiente circular vivo con ícono blanco. Estilo app móvil.',
    experimental: true,
  },
]

const PREVIEW_SLUGS = ['limpieza-hogar', 'plomeria', 'electricidad', 'peluqueria', 'reparacion-computadoras', 'masajes']

export default function AppearancePage() {
  const { theme: activeTheme, setTheme, saving } = useIconTheme()
  const [previewTheme, setPreviewTheme] = useState<IconTheme>(activeTheme)

  const hasChanges = previewTheme !== activeTheme

  const handleApply = async () => {
    await setTheme(previewTheme)
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Apariencia</h1>
          <p className="text-gray-500 mt-1">Elige el estilo visual de los íconos de servicios en toda la plataforma.</p>
        </div>
        <button
          onClick={handleApply}
          disabled={!hasChanges || saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            hasChanges && !saving
              ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Aplicando...</>
            : hasChanges
              ? <><CheckCircle2 className="w-4 h-4" /> Aplicar cambios</>
              : 'Sin cambios'
          }
        </button>
      </div>

      {/* Status bar */}
      {hasChanges && (
        <div className="mb-6 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          Vista previa del tema <strong>{THEMES.find(t => t.id === previewTheme)?.label}</strong>. Presiona <strong>Aplicar cambios</strong> para activarlo en la plataforma.
        </div>
      )}

      {/* Theme selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {THEMES.map(t => {
          const isSelected = previewTheme === t.id
          const isActive = activeTheme === t.id

          return (
            <button
              key={t.id}
              onClick={() => setPreviewTheme(t.id)}
              className={`relative flex flex-col gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              {/* Badges */}
              <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
                {isActive && (
                  <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Activo
                  </span>
                )}
                {t.experimental && (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    <FlaskConical className="w-2.5 h-2.5" />
                    Experimental
                  </span>
                )}
              </div>

              {/* Mini preview */}
              <div className="flex gap-2 flex-wrap pt-4">
                {PREVIEW_SLUGS.slice(0, 4).map(slug => (
                  <ServiceIcon key={slug} slug={slug} size="sm" themeOverride={t.id} />
                ))}
              </div>

              <div>
                <p className="font-semibold text-gray-900 text-sm">{t.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Full preview */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-900">Vista previa completa</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
            {THEMES.find(t => t.id === previewTheme)?.label}
          </span>
        </div>

        <div className="mb-8">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Categorías</p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(CATEGORY_ICONS).map(([slug]) => (
              <div key={slug} className="flex flex-col items-center gap-1.5 w-16">
                <ServiceIcon slug={slug} isCategory size="lg" themeOverride={previewTheme} />
                <span className="text-[10px] text-gray-500 text-center capitalize leading-tight">
                  {slug.replace(/-/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Servicios</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(SERVICE_ICONS).map(([slug]) => (
              <div key={slug} className="flex flex-col items-center gap-1.5 w-20">
                <ServiceIcon slug={slug} size="md" themeOverride={previewTheme} />
                <span className="text-[10px] text-gray-400 text-center leading-tight line-clamp-2">
                  {slug.replace(/-/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
