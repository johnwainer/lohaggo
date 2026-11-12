import { NOINDEX_METADATA } from '@/lib/seo/noindex'

export const metadata = NOINDEX_METADATA

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
