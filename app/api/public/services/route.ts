import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 3600

// These appear first, in this exact order, matching the original quick-select chips
const PRIORITY = [
  'Plomería',
  'Electricidad',
  'Limpieza de hogar',
  'Carpintería',
  'Pintura',
  'Jardinería',
  'Mensajería',
]

export async function GET() {
  const services = await prisma.service.findMany({
    orderBy: [{ popular: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })

  const prioritySet = new Set(PRIORITY)
  const priorityMap = new Map(PRIORITY.map((n, i) => [n, i]))

  const priority = services
    .filter((s) => prioritySet.has(s.name))
    .sort((a, b) => (priorityMap.get(a.name) ?? 99) - (priorityMap.get(b.name) ?? 99))

  const rest = services.filter((s) => !prioritySet.has(s.name))

  return NextResponse.json([...priority, ...rest])
}
