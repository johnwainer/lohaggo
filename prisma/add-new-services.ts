import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Agregando nuevas categorías y servicios...')

  // Verificar y crear categorías si no existen
  console.log('📂 Verificando categorías...')
  
  const categoriasExistentes = await prisma.category.findMany({
    select: { slug: true, id: true, name: true }
  })
  
  console.log('Categorías existentes:', categoriasExistentes.map(c => c.slug))

  // Crear nuevas categorías si no existen
  const nuevasCategorias = [
    { name: 'Hogar', slug: 'hogar', icon: '🏠', description: 'Servicios para el hogar', order: 1 },
    { name: 'Limpieza', slug: 'limpieza', icon: '🧹', description: 'Servicios de limpieza', order: 2 },
    { name: 'Reparaciones', slug: 'reparaciones', icon: '🔧', description: 'Reparaciones y mantenimiento', order: 3 },
    { name: 'Belleza', slug: 'belleza', icon: '💅', description: 'Servicios de belleza', order: 4 },
    { name: 'Salud', slug: 'salud', icon: '⚕️', description: 'Servicios de salud', order: 5 },
    { name: 'Tecnología', slug: 'tecnologia', icon: '💻', description: 'Servicios tecnológicos', order: 6 },
    { name: 'Transporte', slug: 'transporte', icon: '🚗', description: 'Servicios de transporte', order: 7 },
    { name: 'Educación', slug: 'educacion', icon: '📚', description: 'Servicios educativos', order: 8 },
    { name: 'Eventos', slug: 'eventos', icon: '🎉', description: 'Servicios para eventos', order: 9 },
    { name: 'Mascotas', slug: 'mascotas', icon: '🐕', description: 'Servicios para mascotas', order: 10 },
    { name: 'Automotriz', slug: 'automotriz', icon: '🚙', description: 'Servicios automotrices', order: 11 },
    { name: 'Profesional', slug: 'profesional', icon: '💼', description: 'Servicios profesionales', order: 12 },
  ]

  for (const cat of nuevasCategorias) {
    const existe = categoriasExistentes.find(c => c.slug === cat.slug)
    if (!existe) {
      await prisma.category.create({ data: cat })
      console.log(`✅ Categoría creada: ${cat.name}`)
    } else {
      console.log(`⏭️  Categoría ya existe: ${cat.name}`)
    }
  }

  // Obtener IDs de categorías actualizadas
  const categorias = await prisma.category.findMany({
    select: { slug: true, id: true }
  })
  
  const getCategoryId = (slug: string) => {
    const cat = categorias.find(c => c.slug === slug)
    if (!cat) throw new Error(`Categoría no encontrada: ${slug}`)
    return cat.id
  }

  console.log('\n🔧 Agregando nuevos servicios...')

  // Definir todos los nuevos servicios
  const nuevosServicios = [
    // Hogar y Mantenimiento (10 servicios)
    { name: 'Impermeabilización', slug: 'impermeabilizacion', description: 'Protección de techos y terrazas contra filtraciones', icon: '☔', category: 'hogar', basePrice: 120000, duration: 240, popular: true },
    { name: 'Instalación de cortinas', slug: 'instalacion-cortinas', description: 'Medición, instalación y reparación de cortinas y persianas', icon: '🪟', category: 'hogar', basePrice: 35000, duration: 90, popular: false },
    { name: 'Pulido de pisos', slug: 'pulido-pisos', description: 'Pulido y brillado de mármol, granito y madera', icon: '✨', category: 'hogar', basePrice: 80000, duration: 180, popular: false },
    { name: 'Reparación de techos', slug: 'reparacion-techos', description: 'Reparación de goteras, tejas e impermeabilización', icon: '🏠', category: 'hogar', basePrice: 90000, duration: 240, popular: true },
    { name: 'Instalación de cielo raso', slug: 'instalacion-cielo-raso', description: 'Instalación de drywall, PVC y aluminio', icon: '🔨', category: 'hogar', basePrice: 85000, duration: 300, popular: false },
    { name: 'Herrería', slug: 'herreria', description: 'Fabricación de rejas, portones y estructuras metálicas', icon: '🔩', category: 'hogar', basePrice: 95000, duration: 240, popular: false },
    { name: 'Instalación de enchapes', slug: 'instalacion-enchapes', description: 'Enchapes para baños, cocinas y pisos', icon: '🧱', category: 'hogar', basePrice: 75000, duration: 360, popular: false },
    { name: 'Reparación de puertas', slug: 'reparacion-puertas', description: 'Ajustes, cambio de vidrios y reparación de puertas y ventanas', icon: '🚪', category: 'hogar', basePrice: 45000, duration: 90, popular: false },
    { name: 'Instalación de riego', slug: 'instalacion-riego', description: 'Sistemas de riego para jardines y cultivos urbanos', icon: '💧', category: 'hogar', basePrice: 70000, duration: 180, popular: false },
    { name: 'Mantenimiento de piscinas', slug: 'mantenimiento-piscinas', description: 'Limpieza, químicos y reparaciones de piscinas', icon: '🏊', category: 'hogar', basePrice: 60000, duration: 120, popular: false },
    
    // Limpieza Especializada (8 servicios)
    { name: 'Limpieza post-construcción', slug: 'limpieza-post-construccion', description: 'Remoción de escombros y polvo después de obras', icon: '🏗️', category: 'limpieza', basePrice: 90000, duration: 240, popular: false },
    { name: 'Limpieza de tanques', slug: 'limpieza-tanques', description: 'Limpieza y desinfección de tanques de agua', icon: '🚰', category: 'limpieza', basePrice: 70000, duration: 180, popular: true },
    { name: 'Limpieza de fachadas', slug: 'limpieza-fachadas', description: 'Limpieza de edificios, casas y locales comerciales', icon: '🏢', category: 'limpieza', basePrice: 100000, duration: 240, popular: false },
    { name: 'Desinfección', slug: 'desinfeccion', description: 'Desinfección y sanitización profesional', icon: '🧴', category: 'limpieza', basePrice: 55000, duration: 90, popular: true },
    { name: 'Limpieza de tapizados', slug: 'limpieza-tapizados', description: 'Limpieza de sofás, sillas y colchones', icon: '🛋️', category: 'limpieza', basePrice: 45000, duration: 120, popular: false },
    { name: 'Limpieza de cocinas industriales', slug: 'limpieza-cocinas-industriales', description: 'Limpieza profunda de restaurantes y cafeterías', icon: '🍳', category: 'limpieza', basePrice: 120000, duration: 180, popular: false },
    { name: 'Organización del hogar', slug: 'organizacion-hogar', description: 'Organización y orden profesional del hogar', icon: '📦', category: 'limpieza', basePrice: 50000, duration: 180, popular: false },
    { name: 'Limpieza de garajes', slug: 'limpieza-garajes', description: 'Limpieza de garajes y bodegas', icon: '🚗', category: 'limpieza', basePrice: 40000, duration: 120, popular: false },
    
    // Reparaciones y Mantenimiento (8 servicios)
    { name: 'Reparación de lavadoras', slug: 'reparacion-lavadoras', description: 'Servicio especializado en lavadoras', icon: '🌀', category: 'reparaciones', basePrice: 60000, duration: 120, popular: true },
    { name: 'Reparación de neveras', slug: 'reparacion-neveras', description: 'Mantenimiento preventivo y correctivo de refrigeradores', icon: '🧊', category: 'reparaciones', basePrice: 70000, duration: 120, popular: true },
    { name: 'Reparación de estufas', slug: 'reparacion-estufas', description: 'Reparación de estufas a gas y eléctricas', icon: '🔥', category: 'reparaciones', basePrice: 55000, duration: 90, popular: false },
    { name: 'Instalación de gas', slug: 'instalacion-gas', description: 'Instalación y reparación de gas certificada', icon: '⛽', category: 'reparaciones', basePrice: 65000, duration: 120, popular: true },
    { name: 'Reparación de persianas', slug: 'reparacion-persianas', description: 'Reparación de persianas enrollables y verticales', icon: '🪟', category: 'reparaciones', basePrice: 40000, duration: 60, popular: false },
    { name: 'Tapicería de muebles', slug: 'tapiceria-muebles', description: 'Restauración y tapizado de sofás y sillas', icon: '🛋️', category: 'reparaciones', basePrice: 80000, duration: 240, popular: false },
    { name: 'Reparación de bicicletas', slug: 'reparacion-bicicletas', description: 'Mantenimiento y ajustes de bicicletas', icon: '🚴', category: 'reparaciones', basePrice: 30000, duration: 60, popular: false },
    { name: 'Soldadura', slug: 'soldadura', description: 'Reparaciones metálicas y soldadura en general', icon: '🔥', category: 'reparaciones', basePrice: 60000, duration: 90, popular: false },
    
    // Belleza y Bienestar (7 servicios)
    { name: 'Depilación', slug: 'depilacion', description: 'Depilación láser, cera e hilo', icon: '✨', category: 'belleza', basePrice: 35000, duration: 60, popular: true },
    { name: 'Tratamientos faciales', slug: 'tratamientos-faciales', description: 'Limpieza, hidratación y tratamientos anti-edad', icon: '🧖', category: 'belleza', basePrice: 55000, duration: 90, popular: true },
    { name: 'Extensiones de pestañas', slug: 'extensiones-pestanas', description: 'Aplicación de extensiones de pestañas', icon: '👁️', category: 'belleza', basePrice: 60000, duration: 120, popular: true },
    { name: 'Micropigmentación', slug: 'micropigmentacion', description: 'Micropigmentación de cejas, labios y delineado', icon: '💉', category: 'belleza', basePrice: 150000, duration: 180, popular: false },
    { name: 'Tratamientos capilares', slug: 'tratamientos-capilares', description: 'Keratina, botox capilar y tratamientos', icon: '💇', category: 'belleza', basePrice: 80000, duration: 120, popular: true },
    { name: 'Spa a domicilio', slug: 'spa-domicilio', description: 'Paquetes completos de spa y relajación', icon: '🧖', category: 'belleza', basePrice: 120000, duration: 180, popular: false },
    { name: 'Asesoría de imagen', slug: 'asesoria-imagen', description: 'Personal shopper y asesoría de estilismo', icon: '👔', category: 'belleza', basePrice: 70000, duration: 120, popular: false },
    
    // Salud y Cuidado (5 servicios)
    { name: 'Terapia ocupacional', slug: 'terapia-ocupacional', description: 'Rehabilitación funcional y terapia ocupacional', icon: '🏥', category: 'salud', basePrice: 65000, duration: 60, popular: false },
    { name: 'Psicología', slug: 'psicologia', description: 'Consultas psicológicas virtuales o presenciales', icon: '🧠', category: 'salud', basePrice: 80000, duration: 60, popular: true },
    { name: 'Cuidado de adultos mayores', slug: 'cuidado-adultos-mayores', description: 'Acompañamiento y cuidados básicos para adultos mayores', icon: '👴', category: 'salud', basePrice: 50000, duration: 240, popular: true },
    { name: 'Aplicación de inyecciones', slug: 'aplicacion-inyecciones', description: 'Enfermería básica y aplicación de medicamentos', icon: '💉', category: 'salud', basePrice: 25000, duration: 30, popular: false },
    { name: 'Terapia respiratoria', slug: 'terapia-respiratoria', description: 'Terapia respiratoria y rehabilitación pulmonar', icon: '🫁', category: 'salud', basePrice: 60000, duration: 60, popular: false },
    
    // Tecnología y Seguridad (6 servicios)
    { name: 'Instalación de cámaras', slug: 'instalacion-camaras', description: 'Instalación de CCTV y sistemas de alarmas', icon: '📹', category: 'tecnologia', basePrice: 100000, duration: 180, popular: true },
    { name: 'Instalación de TV', slug: 'instalacion-tv', description: 'Montaje en pared y configuración de TV y home theater', icon: '📺', category: 'tecnologia', basePrice: 50000, duration: 90, popular: true },
    { name: 'Reparación de consolas', slug: 'reparacion-consolas', description: 'Reparación de PlayStation, Xbox y Nintendo', icon: '🎮', category: 'tecnologia', basePrice: 55000, duration: 120, popular: false },
    { name: 'Instalación de paneles solares', slug: 'instalacion-paneles-solares', description: 'Instalación de sistemas de energía solar', icon: '☀️', category: 'tecnologia', basePrice: 250000, duration: 480, popular: false },
    { name: 'Smart home', slug: 'smart-home', description: 'Configuración de domótica, Alexa y Google Home', icon: '🏠', category: 'tecnologia', basePrice: 80000, duration: 120, popular: false },
    { name: 'Recuperación de datos', slug: 'recuperacion-datos', description: 'Recuperación de datos de discos duros y celulares', icon: '💾', category: 'tecnologia', basePrice: 90000, duration: 180, popular: false },
    
    // Automotriz (4 servicios)
    { name: 'Mecánica a domicilio', slug: 'mecanica-domicilio', description: 'Reparaciones mecánicas básicas en casa', icon: '🔧', category: 'automotriz', basePrice: 70000, duration: 120, popular: true },
    { name: 'Cambio de aceite', slug: 'cambio-aceite', description: 'Cambio de aceite y filtros a domicilio', icon: '🛢️', category: 'automotriz', basePrice: 45000, duration: 60, popular: true },
    { name: 'Polarizado de vidrios', slug: 'polarizado-vidrios', description: 'Polarizado de autos, casas y oficinas', icon: '🚗', category: 'automotriz', basePrice: 80000, duration: 180, popular: false },
    { name: 'Pintura automotriz', slug: 'pintura-automotriz', description: 'Retoques y reparaciones de pintura automotriz', icon: '🎨', category: 'automotriz', basePrice: 100000, duration: 240, popular: false },
    
    // Profesionales y Consultoría (2 servicios)
    { name: 'Asesoría contable', slug: 'asesoria-contable', description: 'Asesoría contable para independientes y empresas', icon: '💰', category: 'profesional', basePrice: 70000, duration: 60, popular: false },
    { name: 'Arquitectura', slug: 'arquitectura', description: 'Diseño arquitectónico y remodelaciones', icon: '📐', category: 'profesional', basePrice: 120000, duration: 120, popular: false },
  ]

  let serviciosCreados = 0
  let serviciosExistentes = 0

  for (const servicio of nuevosServicios) {
    try {
      const existe = await prisma.service.findUnique({
        where: { slug: servicio.slug }
      })

      if (!existe) {
        await prisma.service.create({
          data: {
            name: servicio.name,
            slug: servicio.slug,
            description: servicio.description,
            icon: servicio.icon,
            categoryId: getCategoryId(servicio.category),
            basePrice: servicio.basePrice,
            duration: servicio.duration,
            popular: servicio.popular,
          }
        })
        console.log(`✅ Servicio creado: ${servicio.name}`)
        serviciosCreados++
      } else {
        console.log(`⏭️  Servicio ya existe: ${servicio.name}`)
        serviciosExistentes++
      }
    } catch (error) {
      console.error(`❌ Error creando servicio ${servicio.name}:`, error)
    }
  }

  console.log('\n📊 Resumen:')
  console.log(`✅ Servicios creados: ${serviciosCreados}`)
  console.log(`⏭️  Servicios existentes: ${serviciosExistentes}`)
  console.log(`📦 Total de servicios procesados: ${nuevosServicios.length}`)
  
  console.log('\n✨ ¡Migración completada!')
}

main()
  .catch((e) => {
    console.error('❌ Error en la migración:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
