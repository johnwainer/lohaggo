export const PWA_EVENTS = {
  SIGNUP_COMPLETED: 'signup_completed',
  LOGIN_COMPLETED: 'login_completed',
  INSTALL_PROMPT_SHOWN: 'install_prompt_shown',
  INSTALL_PROMPT_DISMISSED: 'install_prompt_dismissed',
  INSTALL_CLICKED: 'install_clicked',
  PWA_INSTALLED: 'pwa_installed',
  PUSH_PROMPT_SHOWN: 'push_prompt_shown',
  PUSH_PERMISSION_GRANTED: 'push_permission_granted',
  PUSH_PERMISSION_DENIED: 'push_permission_denied',
  PUSH_SUBSCRIPTION_CREATED: 'push_subscription_created',
  PUSH_SUBSCRIPTION_REMOVED: 'push_subscription_removed',
} as const

export type PwaEventName = (typeof PWA_EVENTS)[keyof typeof PWA_EVENTS]
