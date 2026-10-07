import { describe, expect, it } from 'vitest'
import { getBookingVisualLabel, getBookingVisualState, getNextStep, isPaymentSettled } from '@/lib/booking-status'

const done = (payment?: { status?: string; confirmationStatus?: string } | null, review?: { clientToPartnerRating?: number; partnerToClientRating?: number }) =>
  ({ status: 'COMPLETED', payment, review })

describe('booking visual state', () => {
  it('treats an offline payment confirmed by both sides as paid', () => {
    expect(isPaymentSettled({ status: 'PENDING', confirmationStatus: 'CONFIRMED' })).toBe(true)
    expect(getBookingVisualState('CLIENT', done({ status: 'PENDING', confirmationStatus: 'CONFIRMED' }))).toBe('PAID')
    expect(getBookingVisualState('PARTNER', done({ status: 'PENDING', confirmationStatus: 'CONFIRMED' }))).toBe('PAID')
  })

  it('shows a reported cash payment as reported, not as owed', () => {
    const b = done({ status: 'PENDING', confirmationStatus: 'CLIENT_REPORTED' })
    expect(getBookingVisualState('CLIENT', b)).toBe('PAYMENT_REPORTED')
    expect(getNextStep('CLIENT', b).actor).toBe('them')
    expect(getNextStep('PARTNER', b).actor).toBe('you')
  })

  it('asks the client to pay when nothing was reported', () => {
    const b = done({ status: 'PENDING', confirmationStatus: 'NONE' })
    expect(getBookingVisualLabel(getBookingVisualState('CLIENT', b), 'CLIENT')).toBe('Por pagar')
    expect(getBookingVisualLabel(getBookingVisualState('PARTNER', b), 'PARTNER')).toBe('Por cobrar')
    expect(getNextStep('CLIENT', b).actor).toBe('you')
  })

  it('gives the client the turn when the partner reported the payment', () => {
    expect(getNextStep('CLIENT', done({ confirmationStatus: 'PARTNER_REPORTED' })).actor).toBe('you')
    expect(getNextStep('PARTNER', done({ confirmationStatus: 'PARTNER_REPORTED' })).actor).toBe('them')
  })

  it('is rated only after payment and the own rating', () => {
    expect(getBookingVisualState('CLIENT', done({ status: 'APPROVED' }, { clientToPartnerRating: 5 }))).toBe('RATED')
    expect(getBookingVisualState('PARTNER', done({ status: 'APPROVED' }, { clientToPartnerRating: 5 }))).toBe('PAID')
    expect(getBookingVisualState('PARTNER', done(null, { partnerToClientRating: 4 }))).toBe('COMPLETED')
  })

  it('marks refunds and keeps open bookings waiting on the right side', () => {
    expect(getBookingVisualState('CLIENT', done({ status: 'REFUNDED' }))).toBe('REFUNDED')
    expect(getNextStep('CLIENT', { status: 'PENDING' }).actor).toBe('them')
    expect(getNextStep('PARTNER', { status: 'PENDING' }).actor).toBe('you')
    expect(getNextStep('CLIENT', { status: 'CANCELLED' }).actor).toBe('none')
  })
})
