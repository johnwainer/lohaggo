export const ADMIN_PAGE_SIZE = 50
export const ADMIN_MAX_PAGE_SIZE = 200
/** Legacy callers that still expect a plain array get at most this many rows. */
export const ADMIN_LEGACY_CAP = 200

export type AdminPagination = {
  /** true when the caller asked for the paged shape ({ items, total, hasMore }). */
  paged: boolean
  page: number
  take: number
  skip: number
  q: string
}

export function parseAdminPagination(searchParams: URLSearchParams): AdminPagination {
  const pageRaw = searchParams.get('page')
  const paged = pageRaw !== null
  const page = Math.max(1, Math.floor(Number(pageRaw) || 1))
  const takeRaw = Math.floor(Number(searchParams.get('take')) || 0)
  const take = paged
    ? Math.min(ADMIN_MAX_PAGE_SIZE, takeRaw > 0 ? takeRaw : ADMIN_PAGE_SIZE)
    : Math.min(ADMIN_LEGACY_CAP, takeRaw > 0 ? takeRaw : ADMIN_LEGACY_CAP)
  return {
    paged,
    page,
    take,
    skip: paged ? (page - 1) * take : 0,
    q: (searchParams.get('q') || '').trim().slice(0, 120),
  }
}

export function pagedResponse<T>(items: T[], total: number, p: AdminPagination) {
  return { items, total, page: p.page, pageSize: p.take, hasMore: p.skip + items.length < total }
}

/** Shows only the last 4 digits of a bank account number. */
export function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return value ?? null
  const digits = String(value).replace(/\s+/g, '')
  if (digits.length <= 4) return `•••• ${digits}`
  return `•••• ${digits.slice(-4)}`
}
