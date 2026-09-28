import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { isZoneKey } from '@/lib/geo/zones'
import { OpsError, type Actor, type Origin } from '@/lib/ops/origin'
import { parseSchedule, toMinutes, type ScheduleRange } from '@/lib/partners/coverage-core'

/**
 * Coverage zones and weekly schedule of a partner (Availability rows with no partnerService). Shared by
 * /api/partner/coverage and the admin; they validate and throw OpsError in Spanish, the caller audits.
 */

const logger = createLogger('partners-coverage')

export type PartnerCoverage = { zones: string[]; schedule: ScheduleRange[] }

/** The partner the actor may edit: their own profile, or any (by actor.partnerId) for an admin. */
async function targetPartner(actor: Actor) {
  if (actor.role === 'ADMIN') {
    if (!actor.partnerId) throw new OpsError('Falta el socio', 400)
    const p = await prisma.partnerProfile.findUnique({ where: { id: actor.partnerId }, select: { id: true } })
    if (!p) throw new OpsError('Socio no encontrado', 404)
    return p.id
  }
  const where = actor.partnerId ? { id: actor.partnerId } : { userId: actor.userId }
  const p = await prisma.partnerProfile.findUnique({ where, select: { id: true, userId: true } })
  if (!p || p.userId !== actor.userId) throw new OpsError('No eres socio', 403)
  return p.id
}

export async function getPartnerCoverage(partnerId: string): Promise<PartnerCoverage> {
  const p = await prisma.partnerProfile.findUnique({
    where: { id: partnerId },
    select: {
      coverageZones: true,
      availability: { where: { active: true, partnerServiceId: null }, select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  })
  if (!p) throw new OpsError('Socio no encontrado', 404)
  const schedule = p.availability
    .map((a) => ({ dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMinutes(a.startTime) - toMinutes(b.startTime))
  return { zones: p.coverageZones ?? [], schedule }
}

/** Replaces the partner's zones. An empty list = the whole city. */
export async function setPartnerZones(actor: Actor, zones: unknown, origin: Origin): Promise<PartnerCoverage> {
  if (!Array.isArray(zones)) throw new OpsError('Las zonas deben ser una lista', 400)
  const bad = zones.filter((z) => !isZoneKey(z))
  if (bad.length > 0) throw new OpsError(`Zona desconocida: ${bad.map(String).slice(0, 3).join(', ')}`, 400)
  const partnerId = await targetPartner(actor)
  const unique = Array.from(new Set(zones as string[]))
  await prisma.partnerProfile.update({ where: { id: partnerId }, data: { coverageZones: unique } })
  logger.info('Partner zones changed', { partnerId, zones: unique.length, via: origin.via })
  return getPartnerCoverage(partnerId)
}

/** Replaces the partner's general weekly schedule. An empty schedule = no restriction. */
export async function setPartnerSchedule(actor: Actor, schedule: unknown, origin: Origin): Promise<PartnerCoverage> {
  const parsed = parseSchedule(schedule)
  if (!parsed.ok) throw new OpsError(parsed.error, 400)
  const partnerId = await targetPartner(actor)
  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { partnerId, partnerServiceId: null } }),
    prisma.availability.createMany({ data: parsed.schedule.map((r) => ({ partnerId, dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime, active: true })) }),
  ])
  logger.info('Partner schedule changed', { partnerId, ranges: parsed.schedule.length, via: origin.via })
  return getPartnerCoverage(partnerId)
}
