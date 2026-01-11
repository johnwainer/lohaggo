import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'How LoHaggo Works | Complete Guide to Hiring Professional Services',
  description: 'Learn how LoHaggo works step by step. Search services, compare professionals, schedule and pay securely. Complete guide for clients and professionals.',
  openGraph: {
    title: 'How LoHaggo Works - Step by Step Guide',
    description: 'Discover how easy it is to hire professional services with LoHaggo. Search, compare, schedule and pay in minutes.',
    url: 'https://www.lohaggo.com/how-it-works',
  },
  alternates: {
    canonical: '/how-it-works',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
