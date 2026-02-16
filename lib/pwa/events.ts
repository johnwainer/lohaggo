export const PWA_EVENTS = {
  SIGNUP_COMPLETED: 'signup_completed',
  LOGIN_COMPLETED: 'login_completed',
  INSTALL_PROMPT_SHOWN: 'install_prompt_shown',
  INSTALL_PROMPT_DISMISSED: 'install_prompt_dismissed',
  INSTALL_CLICKED: 'install_clicked',
  PWA_INSTALLED: 'pwa_installed',
  CONTEXT_CLIENT_REQUEST_CREATED: 'context_client_request_created',
  CONTEXT_CLIENT_PROPOSAL_RECEIVED: 'context_client_proposal_received',
  CONTEXT_PARTNER_LEAD_RECEIVED: 'context_partner_lead_received',
  CONTEXT_PARTNER_BOOKING_STATUS_CHANGED: 'context_partner_booking_status_changed',
  PUSH_PROMPT_SHOWN: 'push_prompt_shown',
  PUSH_PERMISSION_GRANTED: 'push_permission_granted',
  PUSH_PERMISSION_DENIED: 'push_permission_denied',
  PUSH_SUBSCRIPTION_CREATED: 'push_subscription_created',
  PUSH_SUBSCRIPTION_REMOVED: 'push_subscription_removed',
} as const

export type PwaEventName = (typeof PWA_EVENTS)[keyof typeof PWA_EVENTS]
