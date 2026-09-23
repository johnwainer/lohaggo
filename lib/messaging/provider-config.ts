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

export type MetaWhatsAppProviderConfig = {
  accessToken: string
  wabaId: string
  phoneNumberId: string
}

export type MetaAppConfig = {
  appId: string
  appSecret: string
  verifyToken: string
  graphVersion?: string
  configId?: string
}

export const META_GRAPH_DEFAULT_VERSION = 'v26.0'

export type MessagingProviderRuntimeConfig = {
  twilio: { active: boolean; config: TwilioProviderConfig | null }
  sendgrid: { active: boolean; config: SendgridProviderConfig | null }
  metaWhatsApp: { active: boolean; config: MetaWhatsAppProviderConfig | null }
  metaApp: { active: boolean; config: MetaAppConfig | null }
}

export async function getMessagingProviderRuntimeConfig(): Promise<MessagingProviderRuntimeConfig> {
  const [twilio, sendgrid, metaWa, metaApp] = await Promise.all([
    prisma.messagingProviderConfig.findUnique({ where: { provider: 'TWILIO' } }),
    prisma.messagingProviderConfig.findUnique({ where: { provider: 'SENDGRID' } }),
    // META_WHATSAPP / META_APP may not exist in the DB enum on older deployments — catch gracefully
    prisma.messagingProviderConfig.findUnique({ where: { provider: 'META_WHATSAPP' } }).catch(() => null),
    prisma.messagingProviderConfig.findUnique({ where: { provider: 'META_APP' } }).catch(() => null),
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
    metaWhatsApp: {
      active: Boolean(metaWa?.isActive),
      config: tryDecrypt<MetaWhatsAppProviderConfig>(metaWa?.configEncrypted),
    },
    metaApp: {
      active: Boolean(metaApp?.isActive),
      config: tryDecrypt<MetaAppConfig>(metaApp?.configEncrypted),
    },
  }
}

export async function getMetaAppConfig(): Promise<MetaAppConfig | null> {
  const row = await prisma.messagingProviderConfig
    .findUnique({ where: { provider: 'META_APP' } })
    .catch(() => null)
  if (!row?.configEncrypted) return null
  try {
    const cfg = decryptConfig<MetaAppConfig>(row.configEncrypted)
    return { ...cfg, graphVersion: cfg.graphVersion || META_GRAPH_DEFAULT_VERSION }
  } catch {
    return null
  }
}

export async function upsertProviderConfig(params: {
  provider: 'TWILIO' | 'SENDGRID' | 'META_WHATSAPP' | 'META_APP'
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
