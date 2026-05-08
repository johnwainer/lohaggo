import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 3600

export async function GET() {
  const services = await prisma.service.findMany({
    orderBy: [{ popular: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })
  return NextResponse.json(services)
}
