/** Where a search happened (SearchEvent.source). Pure: the admin view imports it in the browser. */
export const SEARCH_SOURCES = ['home', 'servicios', 'chat'] as const
export type SearchSource = (typeof SEARCH_SOURCES)[number]
export const SEARCH_SOURCE_LABEL: Record<string, string> = { home: 'Portada', servicios: 'Catálogo', chat: 'Chat (WhatsApp y redes)' }
