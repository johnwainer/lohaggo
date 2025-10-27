const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.service.updateMany({
    data: { popular: false }
  })
  
  const popularSlugs = [
    'plomeria',
    'electricidad',
    'limpieza-hogar',
    'carpinteria',
    'pintura',
    'jardineria',
    'fumigacion',
    'lavado-alfombras',
    'reparacion-electrodomesticos',
    'cerrajeria',
    'reparacion-aires',
    'peluqueria',
    'manicure-pedicure',
    'masajes',
    'reparacion-computadoras',
    'mudanzas',
    'clases-particulares',
    'veterinaria',
    'peluqueria-canina',
    'paseo-perros'
  ]
  
  for (const slug of popularSlugs) {
    await prisma.service.updateMany({
      where: { slug },
      data: { popular: true }
    })
  }
  
  console.log('✅ Servicios populares actualizados')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
