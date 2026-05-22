'use client'

import { useIconTheme } from '@/lib/icon-theme-context'
import { SERVICE_ICONS, CATEGORY_ICONS, COLOR_CLASSES, DEFAULT_ICON, DEFAULT_CATEGORY_ICON } from '@/lib/icon-themes'
import type { IconTheme } from '@/lib/icon-themes'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<Size, { wrap: string; icon: number; emoji: string }> = {
  sm:  { wrap: 'w-8 h-8',   icon: 16, emoji: 'text-xl' },
  md:  { wrap: 'w-10 h-10', icon: 20, emoji: 'text-2xl' },
  lg:  { wrap: 'w-14 h-14', icon: 28, emoji: 'text-4xl' },
  xl:  { wrap: 'w-18 h-18', icon: 36, emoji: 'text-5xl' },
}

type Props = {
  slug: string
  size?: Size
  isCategory?: boolean
  className?: string
  animate?: boolean
  themeOverride?: IconTheme
}

export default function ServiceIcon({ slug, size = 'md', isCategory = false, className = '', animate = false, themeOverride }: Props) {
  const { theme: ctxTheme } = useIconTheme()
  const theme = themeOverride ?? ctxTheme

  const config = isCategory
    ? (CATEGORY_ICONS[slug] ?? DEFAULT_CATEGORY_ICON)
    : (SERVICE_ICONS[slug] ?? DEFAULT_ICON)

  const s = SIZE_MAP[size]
  const colors = COLOR_CLASSES[config.color] ?? COLOR_CLASSES['gray']
  const animClass = animate ? 'group-hover:scale-110 transition-transform duration-200' : ''

  if (theme === 'emoji') {
    return (
      <span className={`inline-block ${s.emoji} ${animClass} ${className}`}>
        {config.emoji}
      </span>
    )
  }

  const Icon = config.icon

  if (theme === 'moderno') {
    return (
      <span className={`inline-flex items-center justify-center ${s.wrap} rounded-2xl ${colors.bgLight} ${animClass} flex-shrink-0 ${className}`}>
        <Icon size={s.icon} className={colors.text} strokeWidth={1.75} />
      </span>
    )
  }

  if (theme === 'vivo') {
    return (
      <span
        className={`inline-flex items-center justify-center ${s.wrap} rounded-full ${animClass} flex-shrink-0 shadow-sm ${className}`}
        style={{ background: `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})` }}
      >
        <Icon size={s.icon} className="text-white" strokeWidth={2} />
      </span>
    )
  }

  // minimal
  return (
    <span className={`inline-flex items-center justify-center ${s.wrap} ${animClass} flex-shrink-0 ${className}`}>
      <Icon size={s.icon} className={colors.text} strokeWidth={1.75} />
    </span>
  )
}
