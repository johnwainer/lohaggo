import * as React from 'react'
import { cn } from '@/lib/utils'

type Tone = 'primary' | 'secondary' | 'danger' | 'glass' | 'light'
type Size = 'sm' | 'md' | 'lg'

/** All tones keep white (or brand) text at 4.5:1 or more */
const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary-600 text-white',
  secondary: 'bg-secondary-700 text-white',
  danger: 'bg-red-600 text-white',
  /** On a colored chip: translucent white */
  glass: 'bg-white/25 text-white',
  /** On a light chip: white with the brand color */
  light: 'bg-white text-primary-700',
}

/**
 * Height equals the minimum width, so one digit is a perfect circle; longer counts grow sideways and
 * keep the same height and round ends. The line height is 1 so the number sits centered, not low.
 */
const sizeClasses: Record<Size, string> = {
  sm: 'h-4 min-w-4 px-1 text-[10px]',
  md: 'h-5 min-w-5 px-1.5 text-[11px]',
  lg: 'h-6 min-w-6 px-2 text-xs',
}

export interface CountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number
  /** Over this the badge shows «max+» (99 by default) */
  max?: number
  /** Show the badge also at 0 (a filter chip's «0 resultados»); by default 0 renders nothing */
  showZero?: boolean
  tone?: Tone
  size?: Size
  pulse?: boolean
  /** What is counted, read by screen readers after the number: «mensajes sin leer», «reservas por atender» */
  label?: string
}

/** The number bubble of unread messages, pending bookings, new proposals: the same shape everywhere. Renders nothing at 0. */
export function CountBadge({ count, max = 99, tone = 'primary', size = 'md', pulse, showZero, label, className, ...props }: CountBadgeProps) {
  if (!count || count <= 0) { if (!showZero) return null }
  const shown = count > max ? `${max}+` : String(count ?? 0)
  return (
    <span
      className={cn(
        // relative: the hidden screen-reader text stays inside the badge instead of widening a scrolling row
        'relative inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none tabular-nums',
        toneClasses[tone],
        sizeClasses[size],
        pulse && 'animate-pulse motion-reduce:animate-none',
        className,
      )}
      {...props}
    >
      <span aria-hidden={label ? true : undefined}>{shown}</span>
      {label && <span className="sr-only">{` ${count} ${label}`}</span>}
    </span>
  )
}
