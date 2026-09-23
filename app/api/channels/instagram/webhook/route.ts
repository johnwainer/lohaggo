export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { handleMetaWebhookEvent, handleMetaWebhookVerify } from '@/lib/messaging/meta-webhook-handler'

export async function GET(request: NextRequest) {
  return handleMetaWebhookVerify(request, 'INSTAGRAM')
}

export async function POST(request: NextRequest) {
  return handleMetaWebhookEvent(request, 'INSTAGRAM')
}
