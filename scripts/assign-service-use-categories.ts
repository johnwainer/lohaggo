import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type UseCategorySeed = {
  slug: string
  name: string
  icon: string
  description: string
  order: number
}

const USE_CATEGORIES: UseCategorySeed[] = [
  { slug: 'casa', name: 'Casa', icon: '🏠', description: 'Servicios para hogar y residencia', order: 1 },
  { slug: 'oficina', name: 'Oficina', icon: '🏢', description: 'Servicios para empresas y oficinas', order: 2 },
  { slug: 'vehiculo', name: 'Vehículo', icon: '🚗', description: 'Servicios para autos, motos y movilidad', order: 3 },
  { slug: 'mascotas', name: 'Mascotas', icon: '🐾', description: 'Servicios para perros, gatos y otras mascotas', order: 4 },
  { slug: 'salud-belleza', name: 'Salud y Belleza', icon: '💆', description: 'Bienestar personal, salud y estética', order: 5 },
  { slug: 'ninos-educacion', name: 'Niños y Educación', icon: '🧒', description: 'Tutorías, clases y actividades infantiles', order: 6 },
  { slug: 'tecnologia', name: 'Tecnología', icon: '💻', description: 'Soporte técnico, redes y software', order: 7 },
  { slug: 'eventos', name: 'Eventos', icon: '🎉', description: 'Servicios para fiestas y eventos', order: 8 },
  { slug: 'legal-asesoria', name: 'Legal y Asesoría', icon: '⚖️', description: 'Consultoría y asesorías profesionales', order: 9 },
  { slug: 'mudanzas-transporte', name: 'Mudanzas y Transporte', icon: '📦', description: 'Mudanzas, carga y mensajería', order: 10 },
]

const CATEGORY_TO_USE: Record<string, string[]> = {
  hogar: ['casa'],
  limpieza: ['casa', 'oficina'],
  reparaciones: ['casa', 'oficina'],
  belleza: ['salud-belleza'],
  salud: ['salud-belleza'],
  tecnologia: ['tecnologia', 'oficina'],
  transporte: ['mudanzas-transporte', 'vehiculo'],
  educacion: ['ninos-educacion'],
  eventos: ['eventos'],
  mascotas: ['mascotas'],
}

const KEYWORD_RULES: Array<{ slug: string; keywords: string[] }> = [
  { slug: 'vehiculo', keywords: ['auto', 'carro', 'vehic', 'moto', 'lavado-autos'] },
  { slug: 'mascotas', keywords: ['mascota', 'veterin', 'canin', 'perro', 'gato'] },
  { slug: 'tecnologia', keywords: ['software', 'redes', 'comput', 'celular', 'tecnico'] },
  { slug: 'ninos-educacion', keywords: ['clases', 'tutoria', 'idioma', 'musica', 'infantil'] },
  { slug: 'eventos', keywords: ['evento', 'dj', 'catering', 'fotografia', 'decoracion'] },
  { slug: 'legal-asesoria', keywords: ['legal', 'abog', 'asesoria'] },
  { slug: 'salud-belleza', keywords: ['belleza', 'masaje', 'fisioterapia', 'peluquer', 'barber', 'nutric'] },
  { slug: 'oficina', keywords: ['oficina', 'empresa', 'comercial'] },
  { slug: 'mudanzas-transporte', keywords: ['mudanza', 'mensajeria', 'transporte', 'carga'] },
]

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

async function main() {
  const apply = process.argv.includes('--apply')
  const dryRun = process.argv.includes('--dry-run') || !apply

  console.log(dryRun ? '🔍 DRY RUN - no se escribirán cambios' : '✍️ APPLY - escribiendo cambios')

  if (USE_CATEGORIES.length > 10) {
    throw new Error('Solo se permiten máximo 10 categorías rápidas.')
  }

  const categoryBySlug = new Map<string, string>()
  for (const category of USE_CATEGORIES) {
    if (!dryRun) {
      const upserted = await prisma.serviceUseCategory.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          icon: category.icon,
          description: category.description,
          order: category.order,
          isActive: true,
        },
        create: {
          name: category.name,
          slug: category.slug,
          icon: category.icon,
          description: category.description,
          order: category.order,
          isActive: true,
        },
        select: { id: true, slug: true },
      })
      categoryBySlug.set(upserted.slug, upserted.id)
    } else {
      const existing = await prisma.serviceUseCategory.findUnique({
        where: { slug: category.slug },
        select: { id: true, slug: true },
      })
      categoryBySlug.set(category.slug, existing?.id || category.slug)
    }
  }

  const services = await prisma.service.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      category: { select: { slug: true } },
    },
    orderBy: { name: 'asc' },
  })

  let updated = 0
  for (const service of services) {
    const selected = new Set<string>()

    for (const useSlug of CATEGORY_TO_USE[service.category.slug] || []) {
      selected.add(useSlug)
    }

    const source = normalize(`${service.slug} ${service.name} ${service.description}`)
    for (const rule of KEYWORD_RULES) {
      if (rule.keywords.some((keyword) => source.includes(normalize(keyword)))) {
        selected.add(rule.slug)
      }
    }

    if (selected.size === 0) selected.add('casa')

    const categoryIds = Array.from(selected)
      .map((slug) => categoryBySlug.get(slug))
      .filter((id): id is string => Boolean(id))

    if (!dryRun) {
      await prisma.$transaction(async (tx) => {
        await tx.serviceUseCategoryAssignment.deleteMany({ where: { serviceId: service.id } })
        await tx.serviceUseCategoryAssignment.createMany({
          data: categoryIds.map((useCategoryId) => ({ serviceId: service.id, useCategoryId })),
          skipDuplicates: true,
        })
      })
    }

    console.log(`- ${service.slug}: ${Array.from(selected).join(', ')}`)
    updated += 1
  }

  console.log(`✅ Servicios analizados: ${updated}`)
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
