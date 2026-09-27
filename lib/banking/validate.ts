/** Pure validation of a Colombian bank account, shared by the partner route, the ops and the AI tools. */

export type BankRule = { accountNumberMinLength: number; accountNumberMaxLength: number }

export type BankAccountInput = {
  bankName: string
  accountType: string
  accountNumber: string
  accountHolderName: string
  holderDocumentType: string
  holderDocumentNumber: string
}

export const ACCOUNT_TYPES = ['SAVINGS', 'CHECKING'] as const
export const HOLDER_DOCUMENT_TYPES = ['CC', 'CE', 'NIT', 'PASSPORT'] as const

export function normalizeAccountNumber(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

/** Passports keep letters (upper case); every other document is digits only. */
export function normalizeHolderDocumentNumber(type: string, raw: string | null | undefined) {
  return type === 'PASSPORT' ? String(raw ?? '').trim().toUpperCase() : normalizeAccountNumber(raw)
}

/**
 * Returns the first problem in Spanish or null when the account is valid. `bank` is the catalog entry
 * for `input.bankName` (null when the bank is unknown), resolved by the caller.
 */
export function validateColombianBankAccount(input: BankAccountInput, bank: BankRule | null): string | null {
  const accountNumber = normalizeAccountNumber(input.accountNumber)
  const rawDocNumber = String(input.holderDocumentNumber || '').trim()
  const docNumber = normalizeAccountNumber(rawDocNumber)

  if (!input.bankName?.trim()) return 'Banco requerido'
  if (!bank) return 'Selecciona un banco colombiano válido'
  if (!ACCOUNT_TYPES.includes(input.accountType as (typeof ACCOUNT_TYPES)[number])) return 'Tipo de cuenta inválido'
  if (accountNumber.length < bank.accountNumberMinLength || accountNumber.length > bank.accountNumberMaxLength) {
    return `El número de cuenta debe tener entre ${bank.accountNumberMinLength} y ${bank.accountNumberMaxLength} dígitos`
  }
  if (!input.accountHolderName?.trim()) return 'Titular requerido'
  if (!HOLDER_DOCUMENT_TYPES.includes(input.holderDocumentType as (typeof HOLDER_DOCUMENT_TYPES)[number])) return 'Tipo de documento inválido'
  if (input.holderDocumentType === 'PASSPORT') {
    if (!/^[A-Z0-9]{5,20}$/i.test(rawDocNumber)) return 'Pasaporte inválido'
  } else if (docNumber.length < 5 || docNumber.length > 15) {
    return 'Número de documento inválido'
  }
  return null
}
