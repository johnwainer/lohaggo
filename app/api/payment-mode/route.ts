import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const config = await prisma.paymentConfig.findFirst()
    
    return NextResponse.json({
      isTestMode: !config || config.environment === 'TEST'
    })
  } catch (error) {
    return NextResponse.json({ isTestMode: true }, { status: 200 })
  }
}
