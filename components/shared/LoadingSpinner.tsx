import { DESIGN_SYSTEM } from '@/lib/design-system'

interface LoadingSpinnerProps {
  message?: string
}

export default function LoadingSpinner({ message = 'Cargando...' }: LoadingSpinnerProps) {
  return (
    <div className={DESIGN_SYSTEM.components.loading.container}>
      <div className="text-center" role="status" aria-live="polite">
        <div className={`${DESIGN_SYSTEM.components.loading.spinner} mx-auto mb-4`} aria-hidden="true"></div>
        {message ? (
          <p className={`${DESIGN_SYSTEM.typography.body} font-medium`}>{message}</p>
        ) : (
          <span className="sr-only">Cargando…</span>
        )}
      </div>
    </div>
  )
}
