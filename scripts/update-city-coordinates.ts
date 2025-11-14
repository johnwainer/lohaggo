import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating/updating cities with coordinates...')

  const cities = [
    {
      name: 'Medellín',
      slug: 'medellin',
      status: 'ACTIVE' as const,
      order: 1,
      latitude: 6.2442,
      longitude: -75.5812,
    },
    {
      name: 'Bogotá',
      slug: 'bogota',
      status: 'COMING_SOON' as const,
      order: 2,
      latitude: 4.7110,
      longitude: -74.0721,
    },
    {
      name: 'Cali',
      slug: 'cali',
      status: 'COMING_SOON' as const,
      order: 3,
      latitude: 3.4516,
      longitude: -76.5320,
    },
    {
      name: 'Barranquilla',
      slug: 'barranquilla',
      status: 'COMING_SOON' as const,
      order: 4,
      latitude: 10.9685,
      longitude: -74.7813,
    },
  ]

  for (const city of cities) {
    await prisma.cityConfig.upsert({
      where: { slug: city.slug },
      update: {
        latitude: city.latitude,
        longitude: city.longitude,
        status: city.status,
        order: city.order,
      },
      create: city,
    })
    console.log(`✅ ${city.name} updated/created`)
  }

  console.log('\n✅ All cities updated successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })