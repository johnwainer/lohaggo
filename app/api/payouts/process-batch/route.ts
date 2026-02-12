import { NextRequest } from 'next/server'
import { POST as processPayoutPost } from '@/app/api/payouts/process/route'

export async function POST(req: NextRequest) {
  return processPayoutPost(req)
}
