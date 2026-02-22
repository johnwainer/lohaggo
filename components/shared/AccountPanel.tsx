'use client'

interface AccountPanelProps {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export default function AccountPanel({
  title,
  subtitle,
  action,
  children,
  className = '',
  noPadding = false
}: AccountPanelProps) {
  return (
    <section className={`surface-card overflow-hidden ${className}`}>
      {(title || subtitle || action) && (
        <div className="border-b border-slate-200/80 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title ? <h2 className="panel-section-title">{title}</h2> : null}
              {subtitle ? <p className="panel-caption mt-1">{subtitle}</p> : null}
            </div>
            {action ? <div className="flex-shrink-0">{action}</div> : null}
          </div>
        </div>
      )}
      <div className={noPadding ? '' : 'p-4 sm:p-6'}>{children}</div>
    </section>
  )
}
