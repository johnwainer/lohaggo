import * as React from 'react'
import { cn } from '@/lib/utils'

type Tone = 'primary' | 'secondary' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary-600 text-white',
  secondary: 'bg-secondary-600 text-white',
  danger: 'bg-red-500 text-white',
}

/**
 * Height equals the minimum width, so one digit is a perfect circle; longer counts grow sideways and
 * keep the same height and round ends. The line height is 1 so the number sits centered, not low.
 */
const sizeClasses: Record<Size, string> = {
  sm: 'h-4 min-w-4 px-1 text-[9px]',
  md: 'h-5 min-w-5 px-1.5 text-[10px]',
  lg: 'h-6 min-w-6 px-2 text-[11px]',
}

export interface CountBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  count: number
  /** Over this the badge shows «max+» (99 by default; 9 in tight spots) */
  max?: number
  tone?: Tone
  size?: Size
  pulse?: boolean
}

/** The number bubble of unread messages, pending bookings, new proposals: the same shape everywhere. Renders nothing at 0. */
export function CountBadge({ count, max = 99, tone = 'primary', size = 'md', pulse, className, ...props }: CountBadgeProps) {
  if (!count || count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none tabular-nums',
        toneClasses[tone],
        sizeClasses[size],
        pulse && 'animate-pulse',
        className,
      )}
      {...props}
    >
      {count > max ? `${max}+` : count}
    </span>
  )
}
