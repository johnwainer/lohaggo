import { LucideIcon } from 'lucide-react'
import { DESIGN_SYSTEM } from '@/lib/design-system'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.spacing.card} text-center py-12`}>
      <div className="flex flex-col items-center justify-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Icon className="text-gray-400" size={32} />
        </div>
        <h3 className={`${DESIGN_SYSTEM.typography.h3} mb-2`}>{title}</h3>
        <p className={`${DESIGN_SYSTEM.typography.body} max-w-md mb-6`}>{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className={DESIGN_SYSTEM.components.button.primary}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
