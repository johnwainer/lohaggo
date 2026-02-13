export type ColombiaBankOption = {
  id: string
  name: string
  accountNumberMinLength: number
  accountNumberMaxLength: number
}

// Fuentes oficiales usadas para construir este catálogo:
// - Banco de la República (Bre-B participantes):
//   https://www.banrep.gov.co/es/bre-b/preguntas-frecuentes/participantes
// - ACH Colombia (entidades financieras de respaldo):
//   https://www.achcolombia.com.co/home
// Actualizado: febrero 2026.
export const COLOMBIA_BANKS: ColombiaBankOption[] = [
  { id: 'ban100', name: 'BAN100', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'bancagrario', name: 'BANCO AGRARIO DE COLOMBIA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'avvillas', name: 'BANCO AV VILLAS', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'cajasocial', name: 'BANCO CAJA SOCIAL', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'contactar', name: 'BANCO CONTACTAR', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'coomeva', name: 'BANCO COOMEVA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'coopcentral', name: 'BANCO COOPERATIVO COOPCENTRAL', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'davivienda', name: 'BANCO DAVIVIENDA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'bogota', name: 'BANCO DE BOGOTA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'bancamia', name: 'BANCO DE LAS MICROFINANZAS BANCAMIA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'occidente', name: 'BANCO DE OCCIDENTE', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'falabella', name: 'BANCO FALABELLA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'finandina', name: 'BANCO FINANDINA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'gnb', name: 'BANCO GNB SUDAMERIS', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'mundomujer', name: 'BANCO MUNDO MUJER', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'pichincha', name: 'BANCO PICHINCHA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'popular', name: 'BANCO POPULAR', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'santander', name: 'BANCO SANTANDER COLOMBIA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'serfinanza', name: 'BANCO SERFINANZA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'union', name: 'BANCO UNION', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'bancow', name: 'BANCO W', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'bancolombia', name: 'BANCOLOMBIA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'bbva', name: 'BBVA COLOMBIA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'citibank', name: 'CITIBANK COLOMBIA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'itau', name: 'ITAU CORPBANCA COLOMBIA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'jpmorgan', name: 'JPMORGAN CHASE BANK COLOMBIA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'lulobank', name: 'LULO BANK', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'nequi', name: 'NEQUI', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
  { id: 'daviplata', name: 'DAVIPLATA', accountNumberMinLength: 8, accountNumberMaxLength: 20 },
]

export function normalizeBankName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function getColombianBankByName(value: string) {
  const normalized = normalizeBankName(value)
  return COLOMBIA_BANKS.find((bank) => normalizeBankName(bank.name) === normalized) || null
}
