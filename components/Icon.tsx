'use client'

import * as LucideIcons from 'lucide-react'
import { LucideProps } from 'lucide-react'

interface IconProps extends Partial<LucideProps> {
  name: string
  className?: string
}

export default function Icon({ name, className = '', ...props }: IconProps) {
  const IconComponent = LucideIcons[name as keyof typeof LucideIcons] as React.ComponentType<LucideProps>

  if (!IconComponent) {
    return <LucideIcons.HelpCircle className={className} {...props} />
  }

  return <IconComponent className={className} {...props} />
}
