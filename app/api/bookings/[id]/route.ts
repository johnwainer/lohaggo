import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { notifyBookingStatusChange } from "@/lib/notifications/notificationService"
import { createLogger } from '@/lib/logger'
import { computeRefundPolicy, calculateSlaDueAt } from '@/lib/launch-ops'
import { recordPromptContext } from '@/lib/pwa/adoption-strategy'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'

export const dynamic = 'force-dynamic'


const logger = createLogger('bookings-id')

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status } = body

    const booking = await prisma.booking.findUnique({
      where: { id }
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 }
      )
    }

    if (user.role === "CLIENT" && booking.userId !== user.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      )
    }

    if (user.role === "PARTNER") {
      if (!user.partnerProfile) {
        return NextResponse.json(
          { error: "Perfil de socio no encontrado" },
          { status: 403 }
        )
      }
      if (booking.partnerId !== user.partnerProfile.id) {
        return NextResponse.json(
          { error: "No autorizado" },
          { status: 403 }
        )
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        service: true,
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          }
        }
      }
    })

    await notifyBookingStatusChange(id, status)

    if (user.role === 'PARTNER') {
      await recordPromptContext(user.id, 'PARTNER_BOOKING_STATUS_CHANGED', {
        bookingId: id,
        status,
      }).catch(() => undefined)
    }

    // Dispatch automation triggers per booking status change
    const triggerMap: Record<string, 'BOOKING_CONFIRMED' | 'BOOKING_COMPLETED' | 'BOOKING_CANCELLED'> = {
      CONFIRMED: 'BOOKING_CONFIRMED',
      COMPLETED: 'BOOKING_COMPLETED',
      CANCELLED: 'BOOKING_CANCELLED',
    }
    const automationTrigger = triggerMap[status]
    if (automationTrigger) {
      // Fire for the client
      scheduleAutomationsForUser(updatedBooking.userId, automationTrigger, {
        targetRole: 'CLIENT',
        contextId: id,
      }).catch(() => null)
      // Fire for the partner if known
      if (updatedBooking.partnerId) {
        const partnerUser = await prisma.partnerProfile.findUnique({
          where: { id: updatedBooking.partnerId },
          select: { userId: true },
        })
        if (partnerUser) {
          scheduleAutomationsForUser(partnerUser.userId, automationTrigger, {
            targetRole: 'PARTNER',
            contextId: id,
          }).catch(() => null)
        }
      }
    }

    return NextResponse.json(updatedBooking)
  } catch (error) {
    logger.error('Error updating booking:', error)
    return NextResponse.json(
      { error: "Error al actualizar reserva" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    const booking = await prisma.booking.findUnique({
      where: { id }
    })

    if (!booking) {
      return NextResponse.json(
        { error: "Reserva no encontrada" },
        { status: 404 }
      )
    }

    // Solo el cliente o admin pueden cancelar
    if (user.role === "CLIENT" && booking.userId !== user.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      )
    }

    if (user.role === "PARTNER") {
      if (!user.partnerProfile) {
        return NextResponse.json(
          { error: "Perfil de socio no encontrado" },
          { status: 403 }
        )
      }
      if (booking.partnerId !== user.partnerProfile.id) {
        return NextResponse.json(
          { error: "No autorizado" },
          { status: 403 }
        )
      }
    }

    // Update booking status to CANCELLED instead of deleting
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' }
    })

    const payment = await prisma.payment.findUnique({
      where: { bookingId: id },
      select: {
        id: true,
        status: true,
        totalAmount: true,
      },
    })

    if (payment && payment.status === 'APPROVED') {
      const policy = computeRefundPolicy({
        bookingStatus: booking.status,
        totalAmount: Number(payment.totalAmount),
        scheduledDate: booking.scheduledDate,
      })

      const refundCase = await prisma.refundCase.create({
        data: {
          bookingId: booking.id,
          paymentId: payment.id,
          userId: booking.userId,
          partnerId: booking.partnerId || null,
          reason: 'Cancelación de reserva',
          policyCode: policy.policyCode,
          status: policy.requiresManualReview ? 'UNDER_REVIEW' : 'APPROVED',
          requestedAmount: Number(payment.totalAmount),
          approvedAmount: policy.requiresManualReview ? null : policy.refundableAmount,
          requestedBy: user.email,
          reviewNotes: policy.reason,
          metadata: JSON.stringify({
            source: 'booking-cancel',
            cancelledByRole: user.role,
            refundableAmount: policy.refundableAmount,
          }),
        },
      })

      const incident = await prisma.paymentIncident.create({
        data: {
          paymentId: payment.id,
          bookingId: booking.id,
          userId: booking.userId,
          partnerId: booking.partnerId || null,
          incidentType: 'REFUND_DISPUTE',
          status: policy.requiresManualReview ? 'ACTION_REQUIRED' : 'RESOLVED',
          severity: policy.requiresManualReview ? 'HIGH' : 'MEDIUM',
          source: 'booking-cancel',
          title: 'Caso de reembolso por cancelación',
          description: policy.reason,
          assignedTo: 'ops@lohaggo.com',
          slaDueAt: calculateSlaDueAt(policy.requiresManualReview ? 'HIGH' : 'MEDIUM'),
          metadata: JSON.stringify({ refundCaseId: refundCase.id }),
        },
      })

      await prisma.paymentIncidentEvent.create({
        data: {
          incidentId: incident.id,
          actorEmail: user.email,
          action: 'REFUND_CASE_CREATED',
          note: `Caso ${refundCase.id} creado por cancelación`,
        },
      })

      await prisma.adminSupportCase.create({
        data: {
          userId: booking.userId,
          bookingId: booking.id,
          priority: policy.requiresManualReview ? 'HIGH' : 'MEDIUM',
          status: 'OPEN',
          queue: 'REFUNDS',
          subject: `Reembolso por cancelación #${booking.id}`,
          description: `${policy.reason}. Monto solicitado: ${payment.totalAmount}`,
          assignedTo: 'ops@lohaggo.com',
          slaDueAt: calculateSlaDueAt(policy.requiresManualReview ? 'HIGH' : 'MEDIUM'),
        },
      })
    }

    // Notify partner/client about cancellation
    await notifyBookingStatusChange(id, 'CANCELLED')

    return NextResponse.json({ message: "Reserva cancelada" })
  } catch (error) {
    logger.error('Error cancelling booking:', error)
    return NextResponse.json(
      { error: "Error al cancelar reserva" },
      { status: 500 }
    )
  }
}
