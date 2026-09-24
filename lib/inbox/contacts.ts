import type { Contact, MessagingChannel, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeContactAddress } from '@/lib/messaging/contact-address'

/**
 * A contact is one person across channels. The phone (E.164) is the base identity: WhatsApp and
 * SMS conversations hang from it; Messenger / Instagram ids are attached to the same contact once a
 * phone is known, so writing by any channel reaches the same record.
 */

export const E164 = /^\+\d{8,15}$/

export function toE164(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const normalized = normalizeContactAddress(raw)
  return E164.test(normalized) ? normalized : null
}

const PHONE_CHANNELS: MessagingChannel[] = ['WHATSAPP', 'SMS']

async function userByPhone(phone: string) {
  return prisma.user.findFirst({ where: { phone }, select: { id: true, name: true, email: true } })
}

/** Names the channels invent when they don't know the person ("Instagram · …1234", "@usuario", "+57…"). */
export function isPlaceholderName(name: string | null | undefined) {
  if (!name?.trim()) return true
  return /^(Instagram|Messenger|WhatsApp|SMS) · /.test(name) || /^\+?\d[\d\s]+$/.test(name.trim()) || /^CO\./.test(name)
}

/** Adds (WHATSAPP, phone) and (SMS, phone) identities to a contact, taking them from any other contact. */
async function attachPhoneIdentities(contactId: string, phone: string) {
  for (const channel of PHONE_CHANNELS) {
    await prisma.contactIdentity.upsert({
      where: { channel_externalId: { channel, externalId: phone } },
      create: { contactId, channel, externalId: phone },
      update: { contactId },
    })
  }
}

/** Keeps the denormalised fields the inbox and the AI read directly on the conversation. */
export async function syncConversationsFromContact(contact: Pick<Contact, 'id' | 'name' | 'userId'>) {
  await prisma.conversation.updateMany({
    where: { contactId: contact.id },
    data: { ...(contact.name ? { contactName: contact.name } : {}), userId: contact.userId },
  })
}

/**
 * Moves everything from `fromId` into `intoId` and deletes the empty contact. Fields of the
 * surviving contact win; empty ones are filled from the absorbed contact.
 */
export async function mergeContacts(intoId: string, fromId: string) {
  if (intoId === fromId) return prisma.contact.findUnique({ where: { id: intoId } })
  const [into, from] = await Promise.all([prisma.contact.findUnique({ where: { id: intoId } }), prisma.contact.findUnique({ where: { id: fromId } })])
  if (!into || !from) return into
  await prisma.$transaction([
    prisma.contactIdentity.updateMany({ where: { contactId: fromId }, data: { contactId: intoId } }),
    prisma.conversation.updateMany({ where: { contactId: fromId }, data: { contactId: intoId } }),
    prisma.contact.delete({ where: { id: fromId } }),
    prisma.contact.update({
      where: { id: intoId },
      data: {
        name: into.name || from.name,
        phone: into.phone || from.phone,
        email: into.email || from.email,
        notes: [into.notes, from.notes].filter(Boolean).join('\n') || null,
        userId: into.userId || from.userId,
      },
    }),
  ])
  const merged = await prisma.contact.findUnique({ where: { id: intoId } })
  if (merged) await syncConversationsFromContact(merged)
  return merged
}

/**
 * Finds or creates the contact behind an inbound message. Order: exact identity on that channel →
 * contact with that phone (WhatsApp/SMS) → new contact. Never creates duplicates for a phone.
 */
export async function resolveInboundContact(params: {
  workspaceId: string
  channel: MessagingChannel
  externalId: string
  nameHint?: string | null
}): Promise<Contact> {
  const identity = await prisma.contactIdentity.findUnique({ where: { channel_externalId: { channel: params.channel, externalId: params.externalId } }, include: { contact: true } })
  if (identity) {
    // A contact may have been renamed by the team: only fill an empty name
    if (!identity.contact.name && params.nameHint) {
      return prisma.contact.update({ where: { id: identity.contactId }, data: { name: params.nameHint } })
    }
    return identity.contact
  }

  const phone = PHONE_CHANNELS.includes(params.channel) ? toE164(params.externalId) : null
  if (phone) {
    const existing = await prisma.contact.findUnique({ where: { workspaceId_phone: { workspaceId: params.workspaceId, phone } } })
    if (existing) {
      await attachPhoneIdentities(existing.id, phone)
      return existing
    }
  }

  const user = phone ? await userByPhone(phone) : null
  // A platform user with that phone: the contact starts with their real name and email
  const contact = await prisma.contact.create({
    data: { workspaceId: params.workspaceId, name: user?.name || params.nameHint || null, phone, email: user?.email ?? null, userId: user?.id ?? null },
  })
  if (phone) await attachPhoneIdentities(contact.id, phone)
  else await prisma.contactIdentity.create({ data: { contactId: contact.id, channel: params.channel, externalId: params.externalId } })
  return contact
}

export type ContactPatch = { name?: string | null; phone?: string | null; email?: string | null; notes?: string | null; userId?: string | null }

/**
 * Edits from the inbox. Setting a phone attaches the WhatsApp/SMS identities (merging with a contact
 * that already owns that phone) so the person is recognised when they write on WhatsApp, and lets the
 * team open a WhatsApp conversation with them. Linking a platform user syncs role data everywhere.
 */
export async function updateContact(id: string, patch: ContactPatch): Promise<Contact> {
  const contact = await prisma.contact.findUnique({ where: { id } })
  if (!contact) throw new Error('Contacto no encontrado')
  const data: Prisma.ContactUpdateInput = {}
  let survivorId = id

  if (patch.phone !== undefined) {
    const phone = toE164(patch.phone)
    if (patch.phone && !phone) throw new Error('Teléfono inválido: usa el formato +57 300 123 4567')
    if (phone && phone !== contact.phone) {
      const owner = await prisma.contact.findUnique({ where: { workspaceId_phone: { workspaceId: contact.workspaceId, phone } } })
      if (owner && owner.id !== id) {
        // The phone already belongs to another contact (e.g. they wrote on WhatsApp before): become one
        const merged = await mergeContacts(id, owner.id)
        survivorId = merged?.id ?? id
      }
      await prisma.contact.update({ where: { id: survivorId }, data: { phone } })
      await attachPhoneIdentities(survivorId, phone)
      // Existing WhatsApp/SMS conversations with that phone now belong to this contact
      await prisma.conversation.updateMany({ where: { channel: { in: PHONE_CHANNELS }, contactPhone: phone, workspaceId: contact.workspaceId }, data: { contactId: survivorId } })
      if (!contact.userId && !patch.userId) {
        const user = await userByPhone(phone)
        if (user) {
          data.user = { connect: { id: user.id } }
          if (patch.name === undefined && isPlaceholderName(contact.name)) data.name = user.name
          if (patch.email === undefined && !contact.email && user.email) data.email = user.email.toLowerCase()
        }
      }
    } else if (!phone && contact.phone) {
      data.phone = null
      await prisma.contactIdentity.deleteMany({ where: { contactId: id, channel: { in: PHONE_CHANNELS } } })
    }
  }
  if (patch.name !== undefined) data.name = patch.name?.trim().slice(0, 120) || null
  if (patch.email !== undefined) {
    const email = patch.email?.trim().toLowerCase() || null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Correo inválido')
    data.email = email
  }
  if (patch.notes !== undefined) data.notes = patch.notes?.trim().slice(0, 2000) || null
  let userPhone: string | null = null
  if (patch.userId !== undefined) {
    if (patch.userId) {
      const user = await prisma.user.findUnique({ where: { id: patch.userId }, select: { id: true, name: true, phone: true, email: true } })
      if (!user) throw new Error('Usuario no encontrado')
      data.user = { connect: { id: user.id } }
      // What the platform already knows about the person fills the gaps in the contact
      if (patch.name === undefined && isPlaceholderName(contact.name)) data.name = user.name
      if (patch.email === undefined && !contact.email && user.email) data.email = user.email.toLowerCase()
      if (patch.phone === undefined && !contact.phone) userPhone = toE164(user.phone)
    } else {
      data.user = { disconnect: true }
    }
  }

  const updated = await prisma.contact.update({ where: { id: survivorId }, data })
  await syncConversationsFromContact(updated)
  // The user's phone makes them reachable (and recognised) on WhatsApp, merging with a contact that already has it
  if (userPhone) return updateContact(updated.id, { phone: userPhone })
  return updated
}

/** WhatsApp conversation for a contact with a phone; created empty if they never wrote there. */
export async function ensureWhatsAppConversation(contactId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact) throw new Error('Contacto no encontrado')
  if (!contact.phone) throw new Error('El contacto no tiene teléfono')
  const existing = await prisma.conversation.findUnique({ where: { channel_contactPhone: { channel: 'WHATSAPP', contactPhone: contact.phone } } })
  if (existing) {
    if (existing.contactId !== contact.id) await prisma.conversation.update({ where: { id: existing.id }, data: { contactId: contact.id } })
    return existing
  }
  await attachPhoneIdentities(contact.id, contact.phone)
  return prisma.conversation.create({
    data: {
      channel: 'WHATSAPP', workspaceId: contact.workspaceId, contactPhone: contact.phone, contactName: contact.name,
      userId: contact.userId, contactId: contact.id, status: 'OPEN', unreadCount: 0,
    },
  })
}

export const contactInclude = {
  identities: { select: { id: true, channel: true, externalId: true } },
  conversations: { select: { id: true, channel: true, status: true, lastMessageAt: true, connection: { select: { name: true } } }, orderBy: { lastMessageAt: 'desc' as const } },
  user: {
    select: {
      id: true, name: true, email: true, phone: true, image: true, role: true, isActive: true, createdAt: true,
      partnerProfile: { select: { verified: true, isActive: true, city: true, rating: true, totalReviews: true } },
      _count: { select: { bookings: true, serviceRequests: true } },
    },
  },
} satisfies Prisma.ContactInclude

export async function getContactDetail(id: string) {
  return prisma.contact.findUnique({ where: { id }, include: contactInclude })
}
