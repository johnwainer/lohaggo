import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Download Android App - LoHaggo | Install the PWA on Your Android Device',
  description: 'Download and install the LoHaggo app on your Android device. One-click installation, quick access to professional services and real-time notifications.',
  openGraph: {
    title: 'Install LoHaggo on Android - Progressive Web App (PWA)',
    description: 'Install the LoHaggo app on your Android with one click. Compatible with Chrome, Edge and Samsung Internet.',
    url: 'https://www.lohaggo.com/download/android',
  },
  alternates: {
    canonical: '/download/android',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
