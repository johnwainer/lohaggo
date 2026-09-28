import { prisma } from '@/lib/prisma'
import { cloudinaryService } from '@/lib/cloudinary'
import { OpsError, actorTypeOf, originColumns, type Actor, type Origin } from '@/lib/ops/origin'
import { assertBookingAccess, loadBooking } from '@/lib/bookings/ops'

export type BookingPhotoKind = 'before' | 'after'

export const BOOKING_PHOTOS_MAX = 10

const KIND_LABEL: Record<BookingPhotoKind, string> = { before: 'antes', after: 'después' }

/** Only photos in LoHaggo's own Cloudinary cloud (res.cloudinary.com is shared by every Cloudinary customer). */
function isOwnPhotoUrl(url: string) {
  const cloud = cloudinaryService.cloudName()
  if (!cloud) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && u.pathname.startsWith(`/${cloud}/image/upload/`)
  } catch {
    return false
  }
}

const PHOTO_SELECT = { id: true, url: true, kind: true, createdAt: true } as const

/** The booking's partner (or an admin) attaches before/after photos of the work: they back it up for the guarantee. */
export async function addBookingPhotos(actor: Actor, bookingId: string, input: { urls: string[]; kind: BookingPhotoKind }, origin: Origin) {
  const booking = await loadBooking(bookingId)
  if (actor.role !== 'ADMIN') {
    if (actor.role !== 'PARTNER' || !actor.partnerId || actor.partnerId !== booking.partnerId) {
      throw new OpsError('Solo el socio de la reserva puede subir fotos del trabajo', 403)
    }
  }
  if (input.kind !== 'before' && input.kind !== 'after') throw new OpsError('El tipo de foto debe ser «antes» o «después»')

  const allowed = input.kind === 'before' ? ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] : ['IN_PROGRESS', 'COMPLETED']
  if (!allowed.includes(booking.status)) {
    throw new OpsError(input.kind === 'before'
      ? 'Las fotos de «antes» se suben con la reserva confirmada, en curso o completada'
      : 'Las fotos de «después» se suben con la reserva en curso o completada')
  }

  const urls = Array.from(new Set((input.urls ?? []).map((u) => String(u).trim()).filter(Boolean)))
  if (!urls.length) throw new OpsError('No llegaron fotos')
  if (urls.some((u) => !isOwnPhotoUrl(u))) throw new OpsError('Alguna foto no es válida; súbela de nuevo desde la app')

  const existing = await prisma.bookingPhoto.count({ where: { bookingId } })
  if (existing + urls.length > BOOKING_PHOTOS_MAX) {
    const left = Math.max(0, BOOKING_PHOTOS_MAX - existing)
    throw new OpsError(left ? `Puedes subir ${left} foto${left === 1 ? '' : 's'} más (máximo ${BOOKING_PHOTOS_MAX} por reserva)` : `La reserva ya tiene el máximo de ${BOOKING_PHOTOS_MAX} fotos`)
  }

  await prisma.$transaction([
    prisma.bookingPhoto.createMany({ data: urls.map((url) => ({ bookingId, url, kind: input.kind, uploadedById: actor.userId })) }),
    prisma.bookingEvent.create({
      data: {
        bookingId,
        type: 'photos',
        actorType: actorTypeOf(actor, origin),
        actorId: actor.userId,
        ...originColumns(origin),
        detail: `${urls.length} foto${urls.length === 1 ? '' : 's'} (${KIND_LABEL[input.kind]})`,
      },
    }),
  ])

  return listPhotosOf(bookingId)
}

/** Photos of the work, for the client who owns the booking, its partner or an admin. */
export async function listBookingPhotos(actor: Actor, bookingId: string) {
  const booking = await loadBooking(bookingId)
  assertBookingAccess(actor, booking)
  return listPhotosOf(bookingId)
}

function listPhotosOf(bookingId: string) {
  return prisma.bookingPhoto.findMany({ where: { bookingId }, select: PHOTO_SELECT, orderBy: { createdAt: 'asc' } })
}
