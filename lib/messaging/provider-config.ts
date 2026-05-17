import { prisma } from '@/lib/prisma'
import { decryptConfig, encryptConfig } from '@/lib/secure-config'

export type TwilioProviderConfig = {
  accountSid: string
  authToken: string
  smsFrom?: string
  whatsappFrom?: string
}

export type SendgridProviderConfig = {
  apiKey: string
  fromEmail: string
}

export type MessagingProviderRuntimeConfig = {
  twilio: { active: boolean; config: TwilioProviderConfig | null }
  sendgrid: { active: boolean; config: SendgridProviderConfig | null }
}

export async function getMessagingProviderRuntimeConfig(): Promise<MessagingProviderRuntimeConfig> {
  const [twilio, sendgrid] = await Promise.all([
    prisma.messagingProviderConfig.findUnique({ where: { provider: 'TWILIO' } }),
    prisma.messagingProviderConfig.findUnique({ where: { provider: 'SENDGRID' } }),
  ])

  const tryDecrypt = <T>(blob: string | null | undefined): T | null => {
    if (!blob) return null
    try { return decryptConfig<T>(blob) } catch { return null }
  }

  return {
    twilio: {
      active: Boolean(twilio?.isActive),
      config: tryDecrypt<TwilioProviderConfig>(twilio?.configEncrypted),
    },
    sendgrid: {
      active: Boolean(sendgrid?.isActive),
      config: tryDecrypt<SendgridProviderConfig>(sendgrid?.configEncrypted),
    },
  }
}

export async function upsertProviderConfig(params: {
  provider: 'TWILIO' | 'SENDGRID'
  isActive: boolean
  config: unknown
  updatedByEmail?: string | null
}) {
  return prisma.messagingProviderConfig.upsert({
    where: { provider: params.provider },
    update: {
      isActive: params.isActive,
      configEncrypted: encryptConfig(params.config),
      updatedByEmail: params.updatedByEmail || null,
    },
    create: {
      provider: params.provider,
      isActive: params.isActive,
      configEncrypted: encryptConfig(params.config),
      updatedByEmail: params.updatedByEmail || null,
    },
  })
}
