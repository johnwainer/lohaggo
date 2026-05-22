'use client'

import { useIconTheme } from '@/lib/icon-theme-context'
import { SERVICE_ICONS, CATEGORY_ICONS, COLOR_CLASSES } from '@/lib/icon-themes'
import type { IconTheme } from '@/lib/icon-themes'
import { CheckCircle2, Loader2 } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'

const THEMES: { id: IconTheme; label: string; description: string }[] = [
  {
    id: 'emoji',
    label: 'Emoji',
    description: 'Íconos clásicos tipo emoji. Coloridos y universales.',
  },
  {
    id: 'moderno',
    label: 'Moderno',
    description: 'Íconos SVG con fondo de color suave. Estilo profesional tipo Rappi.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Íconos SVG sin fondo. Look limpio y simple.',
  },
]

const PREVIEW_SLUGS = ['limpieza-hogar', 'plomeria', 'electricidad', 'peluqueria', 'reparacion-computadoras', 'masajes']

export default function AppearancePage() {
  const { theme, setTheme, saving } = useIconTheme()

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Apariencia</h1>
        <p className="text-gray-500 mt-1">Elige el estilo visual de los íconos de servicios en toda la plataforma.</p>
      </div>

      {/* Theme selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {THEMES.map(t => {
          const active = theme === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              disabled={saving}
              className={`relative flex flex-col gap-4 rounded-2xl border-2 p-5 text-left transition-all ${
                active
                  ? 'border-primary-500 bg-primary-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              {active && (
                <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-primary-500" />
              )}
              <div className="flex gap-2 flex-wrap">
                {PREVIEW_SLUGS.slice(0, 4).map(slug => (
                  <PreviewIcon key={slug} slug={slug} themeOverride={t.id} />
                ))}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{t.label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>
              </div>
            </button>
          )
        })}
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-sm text-primary-600 mb-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          Guardando...
        </div>
      )}

      {/* Full service preview */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Vista previa completa</h2>

        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Categorías</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(CATEGORY_ICONS).map(([slug]) => (
              <div key={slug} className="flex flex-col items-center gap-1.5 w-20">
                <ServiceIcon slug={slug} isCategory size="lg" animate />
                <span className="text-xs text-gray-600 text-center capitalize leading-tight">
                  {slug.replace(/-/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Servicios</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(SERVICE_ICONS).map(([slug]) => (
              <div key={slug} className="flex flex-col items-center gap-1.5 w-24">
                <ServiceIcon slug={slug} size="md" animate />
                <span className="text-xs text-gray-500 text-center leading-tight line-clamp-2">
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

// Static preview that overrides the active theme for comparison
function PreviewIcon({ slug, themeOverride }: { slug: string; themeOverride: IconTheme }) {
  const config = SERVICE_ICONS[slug]
  if (!config) return null
  const colors = COLOR_CLASSES[config.color] ?? COLOR_CLASSES['gray']
  const Icon = config.icon

  if (themeOverride === 'emoji') {
    return <span className="text-2xl">{config.emoji}</span>
  }
  if (themeOverride === 'moderno') {
    return (
      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${colors.bgLight}`}>
        <Icon size={18} className={colors.text} strokeWidth={1.75} />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-9 h-9">
      <Icon size={18} className={colors.text} strokeWidth={1.75} />
    </span>
  )
}
