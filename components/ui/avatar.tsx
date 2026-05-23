'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
}

function initialsOf(name?: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string | null
  name?: string | null
  alt?: string
  size?: Size
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, src, name, alt, size = 'md', ...props }, ref) => {
    const [errored, setErrored] = React.useState(false)
    const showImage = !!src && !errored

    return (
      <span
        ref={ref}
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 font-semibold text-primary-700 select-none',
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src!}
            alt={alt ?? name ?? ''}
            className="h-full w-full object-cover"
            onError={() => setErrored(true)}
          />
        ) : (
          <span aria-hidden={!name}>{initialsOf(name)}</span>
        )}
      </span>
    )
  },
)
Avatar.displayName = 'Avatar'
