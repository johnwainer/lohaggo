import type { RequestCase } from '@/lib/admin/request-360'
import type { AttentionFlag, Intervention } from '@/lib/admin/attention-core'

/** JSON over the wire: dates arrive as strings */
type Wire<T> = T extends Date ? string : T extends Array<infer U> ? Array<Wire<U>> : T extends object ? { [K in keyof T]: Wire<T[K]> } : T

export type Case = Wire<RequestCase>
export type CaseProposal = Case['proposals'][number]
export type CaseBooking = NonNullable<Case['booking']>
export type CaseMessage = NonNullable<CaseProposal['chat']>['messages'][number]

export type AttentionItem = {
  id: string
  ref: string
  service: string
  client: string | null
  status: string
  bookingStatus: string | null
  createdAt: string
  flags: AttentionFlag[]
}

export type { AttentionFlag, Intervention }

export type ActionBody =
  | { action: 'chat_message'; proposalId: string; text: string; to: 'client' | 'partner' | 'both' }
  | { action: 'renotify' }
  | { action: 'reactivate' }
  | { action: 'booking_status'; bookingId: string; status: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'; reason?: string; reopen?: boolean }
  | { action: 'reschedule'; bookingId: string; date: string; time: string }
  | { action: 'open_case'; subject: string; description: string; priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }

export type Recipient = 'client' | 'partner' | 'both'
