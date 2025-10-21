const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const categories = [
  { name: "Hogar", slug: "hogar", icon: "🏠", order: 1 },
  { name: "Limpieza", slug: "limpieza", icon: "🧹", order: 2 },
  { name: "Reparaciones", slug: "reparaciones", icon: "🔧", order: 3 },
  { name: "Belleza", slug: "belleza", icon: "💅", order: 4 },
  { name: "Salud", slug: "salud", icon: "⚕️", order: 5 },
  { name: "Tecnología", slug: "tecnologia", icon: "💻", order: 6 },
  { name: "Transporte", slug: "transporte", icon: "🚗", order: 7 },
  { name: "Educación", slug: "educacion", icon: "📚", order: 8 },
  { name: "Eventos", slug: "eventos", icon: "🎉", order: 9 },
  { name: "Mascotas", slug: "mascotas", icon: "🐕", order: 10 },
]

const services = [
  { name: "Plomería", slug: "plomeria", description: "Reparación de tuberías, grifos y sistemas de agua", icon: "🚰", category: "hogar", basePrice: 100000, duration: 120, popular: true },
  { name: "Electricidad", slug: "electricidad", description: "Instalación y reparación eléctrica", icon: "⚡", category: "hogar", basePrice: 120000, duration: 90, popular: true },
  { name: "Limpieza de hogar", slug: "limpieza-hogar", description: "Limpieza profunda de casas y apartamentos", icon: "🧹", category: "limpieza", basePrice: 80000, duration: 180, popular: true },
  { name: "Limpieza de oficinas", slug: "limpieza-oficinas", description: "Limpieza profesional de espacios comerciales", icon: "🏢", category: "limpieza", basePrice: 160000, duration: 240, popular: false },
  { name: "Carpintería", slug: "carpinteria", description: "Fabricación y reparación de muebles", icon: "🪚", category: "hogar", basePrice: 140000, duration: 180, popular: false },
  { name: "Pintura", slug: "pintura", description: "Pintura de interiores y exteriores", icon: "🎨", category: "hogar", basePrice: 200000, duration: 480, popular: true },
  { name: "Jardinería", slug: "jardineria", description: "Mantenimiento de jardines y áreas verdes", icon: "🌱", category: "hogar", basePrice: 90000, duration: 120, popular: false },
  { name: "Fumigación", slug: "fumigacion", description: "Control de plagas y fumigación", icon: "🦟", category: "hogar", basePrice: 110000, duration: 90, popular: false },
  { name: "Lavado de alfombras", slug: "lavado-alfombras", description: "Limpieza profunda de alfombras y tapetes", icon: "🧼", category: "limpieza", basePrice: 70000, duration: 60, popular: false },
  { name: "Limpieza de ventanas", slug: "limpieza-ventanas", description: "Limpieza de ventanas y cristales", icon: "🪟", category: "limpieza", basePrice: 60000, duration: 90, popular: false },
  { name: "Reparación de electrodomésticos", slug: "reparacion-electrodomesticos", description: "Reparación de lavadoras, refrigeradores, etc.", icon: "🔌", category: "reparaciones", basePrice: 130000, duration: 120, popular: true },
  { name: "Cerrajería", slug: "cerrajeria", description: "Apertura y cambio de cerraduras", icon: "🔑", category: "reparaciones", basePrice: 100000, duration: 60, popular: true },
  { name: "Reparación de aires acondicionados", slug: "reparacion-aires", description: "Mantenimiento y reparación de AC", icon: "❄️", category: "reparaciones", basePrice: 150000, duration: 120, popular: true },
  { name: "Reparación de calentadores", slug: "reparacion-calentadores", description: "Reparación de calentadores de agua", icon: "🔥", category: "reparaciones", basePrice: 120000, duration: 90, popular: false },
  { name: "Instalación de muebles", slug: "instalacion-muebles", description: "Armado e instalación de muebles", icon: "🛋️", category: "hogar", basePrice: 80000, duration: 120, popular: false },
  { name: "Peluquería a domicilio", slug: "peluqueria", description: "Corte y peinado en tu hogar", icon: "💇", category: "belleza", basePrice: 50000, duration: 60, popular: true },
  { name: "Manicure y pedicure", slug: "manicure-pedicure", description: "Cuidado de uñas profesional", icon: "💅", category: "belleza", basePrice: 60000, duration: 90, popular: true },
  { name: "Masajes", slug: "masajes", description: "Masajes terapéuticos y relajantes", icon: "💆", category: "belleza", basePrice: 100000, duration: 60, popular: true },
  { name: "Maquillaje", slug: "maquillaje", description: "Maquillaje profesional para eventos", icon: "💄", category: "belleza", basePrice: 90000, duration: 90, popular: false },
  { name: "Barbería", slug: "barberia", description: "Corte y arreglo de barba", icon: "✂️", category: "belleza", basePrice: 40000, duration: 45, popular: false },
  { name: "Enfermería a domicilio", slug: "enfermeria", description: "Cuidados de enfermería en casa", icon: "💉", category: "salud", basePrice: 120000, duration: 60, popular: false },
  { name: "Fisioterapia", slug: "fisioterapia", description: "Terapia física y rehabilitación", icon: "🏥", category: "salud", basePrice: 140000, duration: 60, popular: false },
  { name: "Nutrición", slug: "nutricion", description: "Consultas nutricionales personalizadas", icon: "🥗", category: "salud", basePrice: 100000, duration: 60, popular: false },
  { name: "Entrenador personal", slug: "entrenador-personal", description: "Entrenamiento físico personalizado", icon: "💪", category: "salud", basePrice: 80000, duration: 60, popular: true },
  { name: "Yoga", slug: "yoga", description: "Clases de yoga a domicilio", icon: "🧘", category: "salud", basePrice: 70000, duration: 60, popular: false },
  { name: "Reparación de computadoras", slug: "reparacion-computadoras", description: "Reparación y mantenimiento de PC", icon: "💻", category: "tecnologia", basePrice: 100000, duration: 120, popular: true },
  { name: "Reparación de celulares", slug: "reparacion-celulares", description: "Reparación de smartphones y tablets", icon: "📱", category: "tecnologia", basePrice: 80000, duration: 60, popular: true },
  { name: "Instalación de software", slug: "instalacion-software", description: "Instalación y configuración de programas", icon: "⚙️", category: "tecnologia", basePrice: 70000, duration: 90, popular: false },
  { name: "Soporte técnico", slug: "soporte-tecnico", description: "Asistencia técnica remota o presencial", icon: "🖥️", category: "tecnologia", basePrice: 90000, duration: 60, popular: false },
  { name: "Instalación de redes", slug: "instalacion-redes", description: "Configuración de redes WiFi y cableado", icon: "📡", category: "tecnologia", basePrice: 120000, duration: 120, popular: false },
  { name: "Mudanzas", slug: "mudanzas", description: "Servicio de mudanzas local", icon: "📦", category: "transporte", basePrice: 300000, duration: 480, popular: true },
  { name: "Transporte de carga", slug: "transporte-carga", description: "Transporte de mercancías", icon: "🚚", category: "transporte", basePrice: 160000, duration: 180, popular: false },
  { name: "Mensajería", slug: "mensajeria", description: "Entrega de paquetes y documentos", icon: "📮", category: "transporte", basePrice: 30000, duration: 60, popular: true },
  { name: "Clases particulares", slug: "clases-particulares", description: "Tutorías académicas personalizadas", icon: "👨‍🏫", category: "educacion", basePrice: 60000, duration: 60, popular: true },
  { name: "Clases de idiomas", slug: "clases-idiomas", description: "Enseñanza de idiomas extranjeros", icon: "🗣️", category: "educacion", basePrice: 70000, duration: 60, popular: true },
  { name: "Clases de música", slug: "clases-musica", description: "Clases de instrumentos musicales", icon: "🎸", category: "educacion", basePrice: 80000, duration: 60, popular: false },
  { name: "Clases de cocina", slug: "clases-cocina", description: "Aprende a cocinar con profesionales", icon: "👨‍🍳", category: "educacion", basePrice: 90000, duration: 120, popular: false },
  { name: "Catering", slug: "catering", description: "Servicio de comida para eventos", icon: "🍽️", category: "eventos", basePrice: 400000, duration: 240, popular: true },
  { name: "Fotografía", slug: "fotografia", description: "Fotografía profesional para eventos", icon: "📷", category: "eventos", basePrice: 300000, duration: 240, popular: true },
  { name: "DJ", slug: "dj", description: "Música y animación para fiestas", icon: "🎧", category: "eventos", basePrice: 360000, duration: 240, popular: false },
  { name: "Decoración de eventos", slug: "decoracion-eventos", description: "Decoración profesional para eventos", icon: "🎈", category: "eventos", basePrice: 240000, duration: 180, popular: false },
  { name: "Animación infantil", slug: "animacion-infantil", description: "Entretenimiento para fiestas infantiles", icon: "🤡", category: "eventos", basePrice: 200000, duration: 180, popular: false },
  { name: "Veterinaria a domicilio", slug: "veterinaria", description: "Atención veterinaria en casa", icon: "🐾", category: "mascotas", basePrice: 120000, duration: 60, popular: true },
  { name: "Peluquería canina", slug: "peluqueria-canina", description: "Baño y corte para mascotas", icon: "🐕", category: "mascotas", basePrice: 70000, duration: 90, popular: true },
  { name: "Paseo de perros", slug: "paseo-perros", description: "Paseo y ejercicio para tu mascota", icon: "🦮", category: "mascotas", basePrice: 30000, duration: 60, popular: true },
  { name: "Entrenamiento canino", slug: "entrenamiento-canino", description: "Adiestramiento profesional de perros", icon: "🎾", category: "mascotas", basePrice: 100000, duration: 60, popular: false },
  { name: "Cuidado de mascotas", slug: "cuidado-mascotas", description: "Cuidado temporal de mascotas", icon: "🏠", category: "mascotas", basePrice: 50000, duration: 480, popular: false },
  { name: "Lavado de autos", slug: "lavado-autos", description: "Lavado y detallado de vehículos", icon: "🚗", category: "transporte", basePrice: 60000, duration: 90, popular: true },
  { name: "Costura y arreglos", slug: "costura", description: "Arreglos de ropa y confección", icon: "🧵", category: "hogar", basePrice: 40000, duration: 60, popular: false },
  { name: "Asesoría legal", slug: "asesoria-legal", description: "Consultas legales básicas", icon: "⚖️", category: "educacion", basePrice: 160000, duration: 60, popular: false },
]

// Datos de socios con sus especialidades
const partnersData = [
  { email: 'socio1@test.com', name: 'María García', bio: 'Experta en servicios del hogar con 10 años de experiencia', rating: 4.8, reviews: 45, services: ['plomeria', 'cerrajeria', 'instalacion-muebles'] },
  { email: 'socio2@test.com', name: 'Carlos Rodríguez', bio: 'Electricista certificado, servicio rápido y confiable', rating: 4.9, reviews: 67, services: ['electricidad', 'instalacion-redes', 'soporte-tecnico'] },
  { email: 'socio3@test.com', name: 'Ana Martínez', bio: 'Especialista en limpieza profunda con productos ecológicos', rating: 4.7, reviews: 38, services: ['limpieza-hogar', 'limpieza-oficinas', 'lavado-alfombras', 'limpieza-ventanas'] },
  { email: 'socio4@test.com', name: 'Luis Fernández', bio: 'Pintor y carpintero profesional con acabados de alta calidad', rating: 4.6, reviews: 29, services: ['pintura', 'carpinteria', 'instalacion-muebles'] },
  { email: 'socio5@test.com', name: 'Roberto Díaz', bio: 'Técnico en reparación de electrodomésticos con garantía', rating: 4.9, reviews: 52, services: ['reparacion-electrodomesticos', 'reparacion-aires', 'reparacion-calentadores'] },
  { email: 'socio6@test.com', name: 'Laura Gómez', bio: 'Estilista profesional con cortes modernos y tratamientos', rating: 4.8, reviews: 41, services: ['peluqueria', 'manicure-pedicure', 'maquillaje'] },
  { email: 'socio7@test.com', name: 'Diego Torres', bio: 'Técnico en computadoras y redes, soporte remoto disponible', rating: 4.7, reviews: 35, services: ['reparacion-computadoras', 'reparacion-celulares', 'instalacion-software', 'soporte-tecnico'] },
  { email: 'socio8@test.com', name: 'Carmen Ruiz', bio: 'Veterinaria con 12 años de experiencia en atención a domicilio', rating: 4.9, reviews: 58, services: ['veterinaria', 'peluqueria-canina', 'cuidado-mascotas'] },
  { email: 'socio9@test.com', name: 'Pedro Soto', bio: 'Plomero y electricista con servicio de emergencia 24/7', rating: 4.8, reviews: 43, services: ['plomeria', 'electricidad', 'reparacion-calentadores'] },
  { email: 'socio10@test.com', name: 'Isabel Morales', bio: 'Especialista en limpieza y organización del hogar', rating: 4.7, reviews: 36, services: ['limpieza-hogar', 'limpieza-ventanas', 'lavado-alfombras'] },
  { email: 'socio11@test.com', name: 'Javier Ramírez', bio: 'Cerrajero profesional con servicio rápido y garantizado', rating: 4.9, reviews: 51, services: ['cerrajeria', 'instalacion-muebles', 'reparacion-electrodomesticos'] },
  { email: 'socio12@test.com', name: 'Sofía Castro', bio: 'Masajista terapéutica certificada con técnicas especializadas', rating: 4.8, reviews: 47, services: ['masajes', 'fisioterapia', 'yoga'] },
  { email: 'socio13@test.com', name: 'Miguel Ángel Vargas', bio: 'Jardinero y paisajista con diseños creativos', rating: 4.6, reviews: 32, services: ['jardineria', 'fumigacion', 'limpieza-hogar'] },
  { email: 'socio14@test.com', name: 'Patricia Herrera', bio: 'Profesora de idiomas con metodología dinámica', rating: 4.9, reviews: 55, services: ['clases-idiomas', 'clases-particulares', 'clases-cocina'] },
  { email: 'socio15@test.com', name: 'Fernando Ortiz', bio: 'Fotógrafo profesional especializado en eventos', rating: 4.8, reviews: 44, services: ['fotografia', 'decoracion-eventos', 'catering'] },
  { email: 'socio16@test.com', name: 'Gabriela Mendoza', bio: 'Entrenadora personal certificada con planes personalizados', rating: 4.9, reviews: 49, services: ['entrenador-personal', 'yoga', 'nutricion'] },
  { email: 'socio17@test.com', name: 'Ricardo Silva', bio: 'Conductor profesional con vehículo amplio para mudanzas', rating: 4.7, reviews: 39, services: ['mudanzas', 'transporte-carga', 'mensajeria'] },
  { email: 'socio18@test.com', name: 'Mónica Reyes', bio: 'Barbera profesional con técnicas modernas de corte', rating: 4.8, reviews: 42, services: ['barberia', 'peluqueria', 'maquillaje'] },
  { email: 'socio19@test.com', name: 'Andrés Gutiérrez', bio: 'Técnico en aires acondicionados y refrigeración', rating: 4.9, reviews: 53, services: ['reparacion-aires', 'reparacion-electrodomesticos', 'reparacion-calentadores'] },
  { email: 'socio20@test.com', name: 'Valentina Flores', bio: 'Animadora infantil con shows creativos y divertidos', rating: 4.8, reviews: 46, services: ['animacion-infantil', 'decoracion-eventos', 'catering'] },
  { email: 'socio21@test.com', name: 'Héctor Jiménez', bio: 'Paseador de perros profesional con experiencia en adiestramiento', rating: 4.7, reviews: 37, services: ['paseo-perros', 'entrenamiento-canino', 'cuidado-mascotas'] },
  { email: 'socio22@test.com', name: 'Daniela Rojas', bio: 'Costurera experta en arreglos y confección a medida', rating: 4.8, reviews: 40, services: ['costura', 'limpieza-hogar', 'instalacion-muebles'] },
  { email: 'socio23@test.com', name: 'Sergio Medina', bio: 'DJ profesional con amplio repertorio musical', rating: 4.9, reviews: 50, services: ['dj', 'fotografia', 'decoracion-eventos'] },
  { email: 'socio24@test.com', name: 'Carolina Vega', bio: 'Enfermera con experiencia en cuidados domiciliarios', rating: 4.8, reviews: 48, services: ['enfermeria', 'fisioterapia', 'nutricion'] },
  { email: 'socio25@test.com', name: 'Arturo Campos', bio: 'Profesor de música con clases personalizadas', rating: 4.7, reviews: 34, services: ['clases-musica', 'clases-particulares', 'clases-idiomas'] },
  { email: 'socio26@test.com', name: 'Natalia Paredes', bio: 'Chef profesional con clases de cocina internacional', rating: 4.9, reviews: 54, services: ['clases-cocina', 'catering', 'nutricion'] },
  { email: 'socio27@test.com', name: 'Raúl Domínguez', bio: 'Especialista en lavado y detallado de autos', rating: 4.8, reviews: 41, services: ['lavado-autos', 'mensajeria', 'transporte-carga'] },
  { email: 'socio28@test.com', name: 'Lorena Aguilar', bio: 'Abogada con asesoría legal personalizada', rating: 4.9, reviews: 56, services: ['asesoria-legal', 'clases-particulares'] },
  { email: 'socio29@test.com', name: 'Gustavo Núñez', bio: 'Instalador de redes y sistemas de seguridad', rating: 4.7, reviews: 38, services: ['instalacion-redes', 'instalacion-software', 'reparacion-computadoras'] },
  { email: 'socio30@test.com', name: 'Alejandra Ríos', bio: 'Nutricionista con planes alimenticios personalizados', rating: 4.8, reviews: 45, services: ['nutricion', 'clases-cocina', 'entrenador-personal'] },
]

async function main() {
  console.log('🌱 Iniciando seed...')

  // Limpiar base de datos
  await prisma.booking.deleteMany()
  await prisma.availability.deleteMany()
  await prisma.partnerService.deleteMany()
  await prisma.service.deleteMany()
  await prisma.category.deleteMany()
  await prisma.partnerProfile.deleteMany()
  await prisma.user.deleteMany()

  console.log('✅ Base de datos limpiada')

  // Crear categorías
  const categoryMap = {}
  for (const cat of categories) {
    const category = await prisma.category.create({
      data: cat
    })
    categoryMap[cat.slug] = category.id
  }
  console.log('✅ Categorías creadas')

  // Crear servicios
  const serviceMap = {}
  for (const service of services) {
    const createdService = await prisma.service.create({
      data: {
        name: service.name,
        slug: service.slug,
        description: service.description,
        icon: service.icon,
        categoryId: categoryMap[service.category],
        basePrice: service.basePrice,
        duration: service.duration,
        popular: service.popular,
      }
    })
    serviceMap[service.slug] = createdService
  }
  console.log('✅ Servicios creados')

  // Crear usuarios de prueba
  const hashedPassword = await bcrypt.hash('password123', 10)

  // Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@servicios.com',
      name: 'Administrador',
      password: hashedPassword,
      phone: '+1234567890',
      role: 'ADMIN',
    }
  })
  console.log('✅ Usuario admin creado')

  // Clientes
  const client1 = await prisma.user.create({
    data: {
      email: 'cliente@test.com',
      name: 'Juan Pérez',
      password: hashedPassword,
      phone: '+1234567891',
      role: 'CLIENT',
    }
  })

  const client2 = await prisma.user.create({
    data: {
      email: 'maria.lopez@test.com',
      name: 'María López',
      password: hashedPassword,
      phone: '+1234567899',
      role: 'CLIENT',
    }
  })

  const client3 = await prisma.user.create({
    data: {
      email: 'pedro.sanchez@test.com',
      name: 'Pedro Sánchez',
      password: hashedPassword,
      phone: '+1234567898',
      role: 'CLIENT',
    }
  })

  console.log('✅ Usuarios clientes creados')

  // Crear socios
  const partners = []
  for (let i = 0; i < partnersData.length; i++) {
    const partnerData = partnersData[i]
    const partner = await prisma.user.create({
      data: {
        email: partnerData.email,
        name: partnerData.name,
        password: hashedPassword,
        phone: `+12345678${String(i + 10).padStart(2, '0')}`,
        role: 'PARTNER',
        partnerProfile: {
          create: {
            bio: partnerData.bio,
            rating: partnerData.rating,
            totalReviews: partnerData.reviews,
            verified: true,
          }
        }
      },
      include: {
        partnerProfile: true
      }
    })
    partners.push({ ...partner, servicesSlugs: partnerData.services })
  }

  console.log(`✅ ${partners.length} socios creados`)

  // Asignar servicios a socios
  let totalAssignments = 0
  for (const partner of partners) {
    if (partner.partnerProfile) {
      for (const serviceSlug of partner.servicesSlugs) {
        const service = serviceMap[serviceSlug]
        if (service) {
          const basePrice = service.basePrice
          const variation = Math.floor(Math.random() * 20) - 10 // Variación de -10 a +10
          const price = basePrice + variation
          
          await prisma.partnerService.create({
            data: {
              partnerId: partner.partnerProfile.id,
              serviceId: service.id,
              price: price,
              active: true,
            }
          })
          totalAssignments++
        }
      }
    }
  }

  console.log(`✅ ${totalAssignments} asignaciones de servicios creadas`)

  // Crear disponibilidad específica para cada servicio de cada socio
  for (const partner of partners) {
    if (partner.partnerProfile) {
      // Obtener todos los servicios del socio
      const partnerServices = await prisma.partnerService.findMany({
        where: { partnerId: partner.partnerProfile.id }
      })

      for (const partnerService of partnerServices) {
        // Crear horarios variados para cada servicio
        const scheduleType = Math.floor(Math.random() * 3)

        if (scheduleType === 0) {
          // Horario completo: Lunes a Viernes 9-18
          for (let day = 1; day <= 5; day++) {
            await prisma.availability.create({
              data: {
                partnerId: partner.partnerProfile.id,
                partnerServiceId: partnerService.id,
                dayOfWeek: day,
                startTime: '09:00',
                endTime: '18:00',
                active: true,
              }
            })
          }
          // Algunos también sábados
          if (Math.random() > 0.5) {
            await prisma.availability.create({
              data: {
                partnerId: partner.partnerProfile.id,
                partnerServiceId: partnerService.id,
                dayOfWeek: 6,
                startTime: '10:00',
                endTime: '14:00',
                active: true,
              }
            })
          }
        } else if (scheduleType === 1) {
          // Horario de mañana: Lunes a Sábado 8-13
          for (let day = 1; day <= 6; day++) {
            await prisma.availability.create({
              data: {
                partnerId: partner.partnerProfile.id,
                partnerServiceId: partnerService.id,
                dayOfWeek: day,
                startTime: '08:00',
                endTime: '13:00',
                active: true,
              }
            })
          }
        } else {
          // Horario de tarde: Lunes a Viernes 14-20
          for (let day = 1; day <= 5; day++) {
            await prisma.availability.create({
              data: {
                partnerId: partner.partnerProfile.id,
                partnerServiceId: partnerService.id,
                dayOfWeek: day,
                startTime: '14:00',
                endTime: '20:00',
                active: true,
              }
            })
          }
        }
      }
    }
  }

  console.log('✅ Disponibilidad de socios configurada')

  // Crear algunas reservas de ejemplo
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)

  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  nextWeek.setHours(14, 0, 0, 0)

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(15, 0, 0, 0)

  // Reserva completada
  const plomeria = serviceMap['plomeria']
  if (plomeria && partners[0]) {
    await prisma.booking.create({
      data: {
        userId: client1.id,
        serviceId: plomeria.id,
        partnerId: partners[0].id,
        scheduledDate: yesterday,
        scheduledTime: '15:00',
        status: 'COMPLETED',
        address: 'Calle Principal 123, Ciudad',
        notes: 'Reparación de fuga en el baño',
        totalPrice: 55,
      }
    })
  }

  // Reserva confirmada para mañana
  const electricidad = serviceMap['electricidad']
  if (electricidad && partners[1]) {
    await prisma.booking.create({
      data: {
        userId: client2.id,
        serviceId: electricidad.id,
        partnerId: partners[1].id,
        scheduledDate: tomorrow,
        scheduledTime: '10:00',
        status: 'CONFIRMED',
        address: 'Avenida Central 456, Ciudad',
        notes: 'Instalación de lámpara en el techo',
        totalPrice: 65,
      }
    })
  }

  // Reserva pendiente para la próxima semana
  const limpiezaHogar = serviceMap['limpieza-hogar']
  if (limpiezaHogar && partners[2]) {
    await prisma.booking.create({
      data: {
        userId: client3.id,
        serviceId: limpiezaHogar.id,
        partnerId: partners[2].id,
        scheduledDate: nextWeek,
        scheduledTime: '14:00',
        status: 'PENDING',
        address: 'Calle Secundaria 789, Ciudad',
        notes: 'Limpieza profunda de apartamento de 2 habitaciones',
        totalPrice: 45,
      }
    })
  }

  console.log('✅ Reservas de ejemplo creadas')

  // Verificar que cada servicio tenga al menos 5 socios
  console.log('\n📊 Verificando cobertura de servicios...')
  for (const service of Object.values(serviceMap)) {
    const count = await prisma.partnerService.count({
      where: { serviceId: service.id }
    })
    if (count < 5) {
      console.log(`⚠️  ${service.name}: solo ${count} socios (se recomienda mínimo 5)`)
    }
  }

  console.log('\n🎉 Seed completado exitosamente!')
  console.log('\n📝 Usuarios de prueba:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('👤 Admin:')
  console.log('   Email: admin@servicios.com')
  console.log('   Password: password123')
  console.log('\n👥 Clientes:')
  console.log('   1. cliente@test.com / password123 (Juan Pérez)')
  console.log('   2. maria.lopez@test.com / password123 (María López)')
  console.log('   3. pedro.sanchez@test.com / password123 (Pedro Sánchez)')
  console.log('\n🔧 Socios (30 profesionales):')
  partnersData.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.email} / password123 (${p.name})`)
  })
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n📊 Estadísticas:')
  console.log(`   • ${categories.length} categorías`)
  console.log(`   • ${services.length} servicios`)
  console.log(`   • ${partners.length} socios profesionales`)
  console.log(`   • ${totalAssignments} asignaciones de servicios`)
  console.log(`   • 3 clientes registrados`)
  console.log(`   • 3 reservas de ejemplo`)
  console.log(`   • Promedio: ${(totalAssignments / services.length).toFixed(1)} socios por servicio`)
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
