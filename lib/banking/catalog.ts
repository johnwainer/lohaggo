import { prisma } from '@/lib/prisma'
import { COLOMBIA_BANKS, normalizeBankName } from '@/lib/banking/colombia'

export type CatalogBankOption = {
  id: string
  code: string
  name: string
  country: string
  isActive: boolean
  sortOrder: number
  accountNumberMinLength: number
  accountNumberMaxLength: number
  supportsSavings: boolean
  supportsChecking: boolean
}

function getFallbackColombiaCatalog(): CatalogBankOption[] {
  return COLOMBIA_BANKS.map((bank, index) => ({
    id: bank.id,
    code: bank.id.toUpperCase(),
    name: bank.name,
    country: 'CO',
    isActive: true,
    sortOrder: index + 1,
    accountNumberMinLength: bank.accountNumberMinLength,
    accountNumberMaxLength: bank.accountNumberMaxLength,
    supportsSavings: true,
    supportsChecking: true,
  }))
}

export async function ensureColombiaBankCatalogSeed() {
  const existingCount = await prisma.bankCatalog.count({ where: { country: 'CO' } })
  if (existingCount > 0) return

  await prisma.bankCatalog.createMany({
    data: COLOMBIA_BANKS.map((bank, index) => ({
      code: bank.id.toUpperCase(),
      name: bank.name,
      country: 'CO',
      isActive: true,
      sortOrder: index + 1,
      accountNumberMinLength: bank.accountNumberMinLength,
      accountNumberMaxLength: bank.accountNumberMaxLength,
      supportsSavings: true,
      supportsChecking: true,
    })),
    skipDuplicates: true,
  })
}

export async function getColombiaBankCatalog(): Promise<CatalogBankOption[]> {
  try {
    await ensureColombiaBankCatalogSeed()
    return await prisma.bankCatalog.findMany({
      where: { country: 'CO', isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  } catch {
    // Fallback for environments where migration hasn't been applied yet.
    return getFallbackColombiaCatalog()
  }
}

export async function findColombiaBankByName(name: string) {
  const normalized = normalizeBankName(name)
  const catalog = await getColombiaBankCatalog()
  return catalog.find((bank) => normalizeBankName(bank.name) === normalized) || null
}
