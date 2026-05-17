import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'

async function twilioFetch(path: string, accountSid: string, authToken: string) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}${path}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
    },
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  const conf = runtimeConfig.twilio.config
  if (!conf?.accountSid || !conf?.authToken) {
    return NextResponse.json({ smsNumbers: [], whatsappSenders: [] })
  }

  const { accountSid, authToken } = conf

  // Fetch owned phone numbers (for SMS)
  const phoneData = await twilioFetch('/IncomingPhoneNumbers.json?PageSize=50', accountSid, authToken)
  const smsNumbers: { number: string; friendly: string; capabilities: string[] }[] = []
  for (const n of phoneData?.incoming_phone_numbers ?? []) {
    const caps: string[] = []
    if (n.capabilities?.sms) caps.push('SMS')
    if (n.capabilities?.mms) caps.push('MMS')
    if (n.capabilities?.voice) caps.push('Voz')
    smsNumbers.push({ number: n.phone_number, friendly: n.friendly_name, capabilities: caps })
  }

  // Discover WhatsApp senders from recent message log (both outbound and known senders)
  const msgData = await twilioFetch(
    '/Messages.json?PageSize=100&Direction=outbound-api',
    accountSid,
    authToken
  )
  const seenWA = new Set<string>()
  for (const m of msgData?.messages ?? []) {
    const from: string = m.from ?? ''
    if (from.startsWith('whatsapp:')) {
      seenWA.add(from.replace('whatsapp:', ''))
    }
  }

  // Also include inbound WA to detect the sandbox number
  const inboundData = await twilioFetch(
    '/Messages.json?PageSize=100&Direction=inbound',
    accountSid,
    authToken
  )
  for (const m of inboundData?.messages ?? []) {
    const to: string = m.to ?? ''
    if (to.startsWith('whatsapp:')) {
      seenWA.add(to.replace('whatsapp:', ''))
    }
  }

  const knownSandbox = '+15558464003'
  seenWA.add(knownSandbox)

  const whatsappSenders = Array.from(seenWA).map((number) => ({
    number,
    label: number === knownSandbox ? `${number} (Sandbox Twilio)` : number,
    isSandbox: number === knownSandbox,
  }))

  return NextResponse.json({ smsNumbers, whatsappSenders })
}
