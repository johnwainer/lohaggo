import { LucideIcon } from 'lucide-react'
import { DESIGN_SYSTEM } from '@/lib/design-system'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  iconColor: string
  iconBgColor: string
  borderColor: string
  trend?: 'up' | 'down'
  trendIcon?: React.ReactNode
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBgColor,
  borderColor,
  trend,
  trendIcon,
}: StatCardProps) {
  return (
    <div
      className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.hover} ${DESIGN_SYSTEM.spacing.card} border-l-4 ${borderColor}`}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 ${iconBgColor} rounded-lg sm:rounded-xl flex items-center justify-center`}
        >
          <Icon className={iconColor} size={20} />
        </div>
        {trendIcon && <div>{trendIcon}</div>}
      </div>
      <p className={`${DESIGN_SYSTEM.typography.bodySmall} font-medium mb-1`}>{label}</p>
      <p className="text-2xl sm:text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
