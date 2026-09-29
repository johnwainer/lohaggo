import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Viewport } from 'next'
import AdminLayoutClient from '@/components/admin/AdminLayoutClient'

/** Admin only: on Android the keyboard resizes the page (the inbox is a fixed-height chat), like iOS does. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/')
  }

  const me = session.user.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { isSuperAdmin: true } }).catch(() => null)
    : null

  return <AdminLayoutClient isSuperAdmin={Boolean(me?.isSuperAdmin)}>{children}</AdminLayoutClient>
}
