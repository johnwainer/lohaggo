import type { Metadata } from 'next'

// The magic link carries the login token in the URL. `no-referrer` ensures the
// token is never leaked to third parties via the Referer header (e.g. when the
// page loads images, fonts, analytics, or the user follows an outbound link).
export const metadata: Metadata = {
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
}

export default function MagicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
