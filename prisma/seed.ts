import { PrismaClient, UserRole, BookingStatus, City, ServiceRequestStatus, PaymentStatus, PayoutStatus, DocumentType, DocumentStatus, AchievementType } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  console.log('📂 Creating categories...')
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Limpieza',
        slug: 'limpieza',
        description: 'Servicios de limpieza profesional para tu hogar u oficina',
        icon: '🧹',
        order: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Plomería',
        slug: 'plomeria',
        description: 'Reparación e instalación de sistemas de agua y drenaje',
        icon: '🔧',
        order: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Electricidad',
        slug: 'electricidad',
        description: 'Instalación y reparación de sistemas eléctricos',
        icon: '⚡',
        order: 3,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Carpintería',
        slug: 'carpinteria',
        description: 'Fabricación y reparación de muebles de madera',
        icon: '🔨',
        order: 4,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Pintura',
        slug: 'pintura',
        description: 'Servicios de pintura interior y exterior',
        icon: '🎨',
        order: 5,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Jardinería',
        slug: 'jardineria',
        description: 'Mantenimiento y diseño de jardines',
        icon: '🌿',
        order: 6,
      },
    }),
  ])

  console.log('🔧 Creating services...')
  const services = await Promise.all([
    prisma.service.create({
      data: {
        name: 'Limpieza General',
        slug: 'limpieza-general',
        description: 'Limpieza completa de tu hogar',
        icon: '🏠',
        basePrice: 50000,
        duration: 120,
        popular: true,
        categoryId: categories[0].id,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Limpieza Profunda',
        slug: 'limpieza-profunda',
        description: 'Limpieza detallada incluyendo áreas difíciles',
        icon: '✨',
        basePrice: 80000,
        duration: 180,
        popular: true,
        categoryId: categories[0].id,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Reparación de Fugas',
        slug: 'reparacion-fugas',
        description: 'Detección y reparación de fugas de agua',
        icon: '💧',
        basePrice: 60000,
        duration: 90,
        popular: true,
        categoryId: categories[1].id,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Instalación de Grifos',
        slug: 'instalacion-grifos',
        description: 'Instalación y cambio de grifería',
        icon: '🚰',
        basePrice: 40000,
        duration: 60,
        categoryId: categories[1].id,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Instalación Eléctrica',
        slug: 'instalacion-electrica',
        description: 'Instalación de puntos eléctricos y tomacorrientes',
        icon: '🔌',
        basePrice: 70000,
        duration: 120,
        popular: true,
        categoryId: categories[2].id,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Reparación de Cortocircuitos',
        slug: 'reparacion-cortocircuitos',
        description: 'Diagnóstico y reparación de problemas eléctricos',
        icon: '⚡',
        basePrice: 90000,
        duration: 150,
        categoryId: categories[2].id,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Fabricación de Muebles',
        slug: 'fabricacion-muebles',
        description: 'Diseño y fabricación de muebles a medida',
        icon: '🛋️',
        basePrice: 200000,
        duration: 480,
        categoryId: categories[3].id,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Reparación de Muebles',
        slug: 'reparacion-muebles',
        description: 'Restauración y reparación de muebles',
        icon: '🔨',
        basePrice: 80000,
        duration: 180,
        categoryId: categories[3].id,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Pintura Interior',
        slug: 'pintura-interior',
        description: 'Pintura de interiores residenciales y comerciales',
        icon: '🏠',
        basePrice: 150000,
        duration: 360,
        popular: true,
        categoryId: categories[4].id,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Pintura Exterior',
        slug: 'pintura-exterior',
        description: 'Pintura de fachadas y exteriores',
        icon: '🏢',
        basePrice: 200000,
        duration: 480,
        categoryId: categories[4].id,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Mantenimiento de Jardines',
        slug: 'mantenimiento-jardines',
        description: 'Poda, riego y cuidado general del jardín',
        icon: '🌱',
        basePrice: 60000,
        duration: 120,
        popular: true,
        categoryId: categories[5].id,
      },
    }),
    prisma.service.create({
      data: {
        name: 'Diseño de Jardines',
        slug: 'diseno-jardines',
        description: 'Diseño y planificación de espacios verdes',
        icon: '🌳',
        basePrice: 100000,
        duration: 240,
        categoryId: categories[5].id,
      },
    }),
  ])

  console.log('👥 Creating users...')
  const passwordHash = await hash('password123', 10)

  const clients = await Promise.all([
    prisma.user.create({
      data: {
        name: 'María García',
        email: 'maria@example.com',
        password: passwordHash,
        phone: '3001234567',
        role: UserRole.CLIENT,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Carlos Rodríguez',
        email: 'carlos@example.com',
        password: passwordHash,
        phone: '3009876543',
        role: UserRole.CLIENT,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Ana Martínez',
        email: 'ana@example.com',
        password: passwordHash,
        phone: '3005551234',
        role: UserRole.CLIENT,
      },
    }),
  ])

  console.log('🔨 Creating partners...')
  const partners = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Juan Pérez',
        email: 'juan@example.com',
        password: passwordHash,
        phone: '3101234567',
        role: UserRole.PARTNER,
        partnerProfile: {
          create: {
            bio: 'Especialista en limpieza con 10 años de experiencia',
            rating: 4.8,
            totalReviews: 150,
            verified: true,
          },
        },
      },
      include: { partnerProfile: true },
    }),
    prisma.user.create({
      data: {
        name: 'Pedro López',
        email: 'pedro@example.com',
        password: passwordHash,
        phone: '3109876543',
        role: UserRole.PARTNER,
        partnerProfile: {
          create: {
            bio: 'Plomero certificado con amplia experiencia',
            rating: 4.9,
            totalReviews: 200,
            verified: true,
          },
        },
      },
      include: { partnerProfile: true },
    }),
    prisma.user.create({
      data: {
        name: 'Luis Ramírez',
        email: 'luis@example.com',
        password: passwordHash,
        phone: '3105551234',
        role: UserRole.PARTNER,
        partnerProfile: {
          create: {
            bio: 'Electricista profesional con certificación RETIE',
            rating: 4.7,
            totalReviews: 180,
            verified: true,
          },
        },
      },
      include: { partnerProfile: true },
    }),
    prisma.user.create({
      data: {
        name: 'Roberto Sánchez',
        email: 'roberto@example.com',
        password: passwordHash,
        phone: '3107778888',
        role: UserRole.PARTNER,
        partnerProfile: {
          create: {
            bio: 'Carpintero artesanal con 15 años de experiencia',
            rating: 4.9,
            totalReviews: 120,
            verified: true,
          },
        },
      },
      include: { partnerProfile: true },
    }),
    prisma.user.create({
      data: {
        name: 'Miguel Torres',
        email: 'miguel@example.com',
        password: passwordHash,
        phone: '3103334444',
        role: UserRole.PARTNER,
        partnerProfile: {
          create: {
            bio: 'Pintor profesional especializado en interiores',
            rating: 4.6,
            totalReviews: 90,
            verified: true,
          },
        },
      },
      include: { partnerProfile: true },
    }),
    prisma.user.create({
      data: {
        name: 'Diego Vargas',
        email: 'diego@example.com',
        password: passwordHash,
        phone: '3106667777',
        role: UserRole.PARTNER,
        partnerProfile: {
          create: {
            bio: 'Jardinero paisajista con estudios en diseño',
            rating: 4.8,
            totalReviews: 110,
            verified: true,
          },
        },
      },
      include: { partnerProfile: true },
    }),
  ])

  console.log('🔗 Linking partners to services...')
  await Promise.all([
    prisma.partnerService.create({
      data: {
        partnerId: partners[0].partnerProfile!.id,
        serviceId: services[0].id,
        price: 50000,
      },
    }),
    prisma.partnerService.create({
      data: {
        partnerId: partners[0].partnerProfile!.id,
        serviceId: services[1].id,
        price: 80000,
      },
    }),
    prisma.partnerService.create({
      data: {
        partnerId: partners[1].partnerProfile!.id,
        serviceId: services[2].id,
        price: 60000,
      },
    }),
    prisma.partnerService.create({
      data: {
        partnerId: partners[1].partnerProfile!.id,
        serviceId: services[3].id,
        price: 40000,
      },
    }),
    prisma.partnerService.create({
      data: {
        partnerId: partners[2].partnerProfile!.id,
        serviceId: services[4].id,
        price: 70000,
      },
    }),
    prisma.partnerService.create({
      data: {
        partnerId: partners[2].partnerProfile!.id,
        serviceId: services[5].id,
        price: 90000,
      },
    }),
    prisma.partnerService.create({
      data: {
        partnerId: partners[3].partnerProfile!.id,
        serviceId: services[6].id,
        price: 200000,
      },
    }),
    prisma.partnerService.create({
      data: {
        partnerId: partners[3].partnerProfile!.id,
        serviceId: services[7].id,
        price: 80000,
      },
    }),
    prisma.partnerService.create({
      data: {
        partnerId: partners[4].partnerProfile!.id,
        serviceId: services[8].id,
        price: 150000,
      },
    }),
    prisma.partnerService.create({
      data: {
        partnerId: partners[4].partnerProfile!.id,
        serviceId: services[9].id,
        price: 200000,
      },
    }),
    prisma.partnerService.create({
      data: {
        partnerId: partners[5].partnerProfile!.id,
        serviceId: services[10].id,
        price: 60000,
      },
    }),
    prisma.partnerService.create({
      data: {
        partnerId: partners[5].partnerProfile!.id,
        serviceId: services[11].id,
        price: 100000,
      },
    }),
  ])

  console.log('📍 Creating addresses...')
  const addresses = await Promise.all([
    prisma.address.create({
      data: {
        userId: clients[0].id,
        label: 'Casa',
        street: 'Calle 10',
        number: '20-30',
        neighborhood: 'El Poblado',
        city: City.MEDELLIN,
        complement: 'Apartamento 501',
        isPrimary: true,
      },
    }),
    prisma.address.create({
      data: {
        userId: clients[1].id,
        label: 'Casa',
        street: 'Carrera 15',
        number: '85-40',
        neighborhood: 'Chapinero',
        city: City.BOGOTA,
        complement: 'Casa blanca con portón negro',
        isPrimary: true,
      },
    }),
    prisma.address.create({
      data: {
        userId: clients[2].id,
        label: 'Apartamento',
        street: 'Avenida 6N',
        number: '25-50',
        neighborhood: 'Granada',
        city: City.CALI,
        complement: 'Edificio Torre del Parque, Apto 302',
        isPrimary: true,
      },
    }),
  ])

  console.log('📋 Creating service requests...')
  const serviceRequests = await Promise.all([
    prisma.serviceRequest.create({
      data: {
        userId: clients[0].id,
        serviceId: services[0].id,
        notes: 'Necesito limpieza general de apartamento de 80m2',
        city: City.MEDELLIN,
        address: addresses[0].street + ' ' + addresses[0].number,
        preferredDate: new Date('2024-02-15'),
        preferredTime: '10:00',
        status: ServiceRequestStatus.ACCEPTED,
        expiresAt: new Date('2024-02-20T00:00:00'),
      },
    }),
    prisma.serviceRequest.create({
      data: {
        userId: clients[0].id,
        serviceId: services[2].id,
        notes: 'Reparación de fuga en baño principal',
        city: City.MEDELLIN,
        address: addresses[0].street + ' ' + addresses[0].number,
        preferredDate: new Date('2024-02-20'),
        preferredTime: '14:00',
        status: ServiceRequestStatus.ACCEPTED,
        expiresAt: new Date('2024-02-25T00:00:00'),
      },
    }),
    prisma.serviceRequest.create({
      data: {
        userId: clients[1].id,
        serviceId: services[4].id,
        notes: 'Instalación de 5 tomacorrientes adicionales',
        city: City.BOGOTA,
        address: addresses[1].street + ' ' + addresses[1].number,
        preferredDate: new Date('2024-03-01'),
        preferredTime: '09:00',
        status: ServiceRequestStatus.ACCEPTED,
        expiresAt: new Date('2024-03-05T00:00:00'),
      },
    }),
    prisma.serviceRequest.create({
      data: {
        userId: clients[2].id,
        serviceId: services[8].id,
        notes: 'Pintura de sala y comedor',
        city: City.CALI,
        address: addresses[2].street + ' ' + addresses[2].number,
        preferredDate: new Date('2024-03-10'),
        preferredTime: '08:00',
        status: ServiceRequestStatus.ACTIVE,
        expiresAt: new Date('2024-03-15T00:00:00'),
      },
    }),
  ])

  // console.log('📅 Creating bookings...')
  // const bookings = await Promise.all([
  //   prisma.booking.create({
  //     data: {
  //       serviceRequestId: serviceRequests[0].id,
  //       clientId: clients[0].id,
  //       partnerId: partners[0].partnerProfile!.id,
  //       scheduledFor: new Date('2024-02-15T10:00:00'),
  //       price: 80000,
  //       status: BookingStatus.COMPLETED,
  //       completedAt: new Date('2024-02-15T14:00:00'),
  //     },
  //   }),
  //   prisma.booking.create({
  //     data: {
  //       serviceRequestId: serviceRequests[1].id,
  //       clientId: clients[0].id,
  //       partnerId: partners[1].partnerProfile!.id,
  //       scheduledFor: new Date('2024-02-20T14:00:00'),
  //       price: 150000,
  //       status: BookingStatus.COMPLETED,
  //       completedAt: new Date('2024-02-20T17:00:00'),
  //     },
  //   }),
  //   prisma.booking.create({
  //     data: {
  //       serviceRequestId: serviceRequests[2].id,
  //       clientId: clients[1].id,
  //       partnerId: partners[2].partnerProfile!.id,
  //       scheduledFor: new Date('2024-03-01T09:00:00'),
  //       price: 200000,
  //       status: BookingStatus.CONFIRMED,
  //     },
  //   }),
  // ])
  //
  // console.log('⭐ Creating reviews...')
  // await Promise.all([
  //   prisma.review.create({
  //     data: {
  //       bookingId: bookings[0].id,
  //       clientId: clients[0].id,
  //       partnerId: partners[0].partnerProfile!.id,
  //       rating: 5,
  //       comment: 'Excelente servicio, muy profesional y puntual. Dejó todo impecable.',
  //     },
  //   }),
  //   prisma.review.create({
  //     data: {
  //       bookingId: bookings[1].id,
  //       clientId: clients[0].id,
  //       partnerId: partners[1].partnerProfile!.id,
  //       rating: 5,
  //       comment: 'Muy buen trabajo, solucionó el problema rápidamente y explicó todo claramente.',
  //     },
  //   }),
  // ])

  console.log('💳 Creating saved payment methods...')
  const paymentMethods = await Promise.all([
    prisma.paymentMethod.create({
      data: {
        userId: clients[0].id,
        lastFourDigits: '4242',
        cardBrand: 'Visa',
        cardholderName: 'MARIA GARCIA',
        expirationMonth: 12,
        expirationYear: 2026,
        isDefault: true,
        isActive: true,
        mercadopagoCardId: 'CARD-' + Math.random().toString(36).substring(7),
        cardToken: 'TOKEN-' + Math.random().toString(36).substring(7),
      },
    }),
    prisma.paymentMethod.create({
      data: {
        userId: clients[0].id,
        lastFourDigits: '5555',
        cardBrand: 'Mastercard',
        cardholderName: 'MARIA GARCIA',
        expirationMonth: 6,
        expirationYear: 2027,
        isDefault: false,
        isActive: true,
        mercadopagoCardId: 'CARD-' + Math.random().toString(36).substring(7),
        cardToken: 'TOKEN-' + Math.random().toString(36).substring(7),
      },
    }),
    prisma.paymentMethod.create({
      data: {
        userId: clients[1].id,
        lastFourDigits: '1234',
        cardBrand: 'Visa',
        cardholderName: 'CARLOS RODRIGUEZ',
        expirationMonth: 3,
        expirationYear: 2026,
        isDefault: true,
        isActive: true,
        mercadopagoCardId: 'CARD-' + Math.random().toString(36).substring(7),
        cardToken: 'TOKEN-' + Math.random().toString(36).substring(7),
      },
    }),
  ])

  // console.log('💳 Creating payments...')
  // const payments = await Promise.all([
  //   prisma.payment.create({
  //     data: {
  //       bookingId: bookings[0].id,
  //       userId: clients[0].id,
  //       paymentMethodId: paymentMethods[0].id,
  //       amount: 80000,
  //       serviceAmount: 80000,
  //       clientCommission: 0,
  //       clientCommissionRate: 0,
  //       totalAmount: 80000,
  //       status: PaymentStatus.APPROVED,
  //       paymentMethodType: 'credit_card',
  //       paymentType: 'credit_card',
  //       transactionAmount: 80000,
  //       netReceivedAmount: 76000,
  //       mercadopagoFee: 4000,
  //       mercadopagoId: 'MP-' + Math.random().toString(36).substring(7),
  //       preferenceId: 'PREF-' + Math.random().toString(36).substring(7),
  //       paidAt: new Date('2024-02-15T14:30:00'),
  //     },
  //   }),
  //   prisma.payment.create({
  //     data: {
  //       bookingId: bookings[1].id,
  //       userId: clients[0].id,
  //       paymentMethodId: paymentMethods[1].id,
  //       amount: 150000,
  //       serviceAmount: 150000,
  //       clientCommission: 0,
  //       clientCommissionRate: 0,
  //       totalAmount: 150000,
  //       status: PaymentStatus.APPROVED,
  //       paymentMethodType: 'debit_card',
  //       paymentType: 'debit_card',
  //       transactionAmount: 150000,
  //       netReceivedAmount: 142500,
  //       mercadopagoFee: 7500,
  //       mercadopagoId: 'MP-' + Math.random().toString(36).substring(7),
  //       preferenceId: 'PREF-' + Math.random().toString(36).substring(7),
  //       paidAt: new Date('2024-02-20T17:30:00'),
  //     },
  //   }),
  //   prisma.payment.create({
  //     data: {
  //       bookingId: bookings[2].id,
  //       userId: clients[1].id,
  //       paymentMethodId: paymentMethods[2].id,
  //       amount: 200000,
  //       serviceAmount: 200000,
  //       clientCommission: 0,
  //       clientCommissionRate: 0,
  //       totalAmount: 200000,
  //       status: PaymentStatus.PENDING,
  //       mercadopagoId: 'MP-' + Math.random().toString(36).substring(7),
  //       preferenceId: 'PREF-' + Math.random().toString(36).substring(7),
  //     },
  //   }),
  // ])

  //   }),
  // ])

  // console.log('💰 Creating payouts...')
  // await Promise.all([
  //   prisma.payout.create({
  //     data: {
  //       paymentId: payments[0].id,
  //       partnerId: partners[0].partnerProfile!.id,
  //       amount: 80000,
  //       partnerCommission: 12000,
  //       partnerCommissionRate: 15.0,
  //       netAmount: 68000,
  //       status: PayoutStatus.COMPLETED,
  //       processedAt: new Date('2024-02-16T10:00:00'),
  //       notes: 'Pago procesado exitosamente',
  //     },
  //   }),
  //   prisma.payout.create({
  //     data: {
  //       paymentId: payments[1].id,
  //       partnerId: partners[1].partnerProfile!.id,
  //       amount: 150000,
  //       partnerCommission: 22500,
  //       partnerCommissionRate: 15.0,
  //       netAmount: 127500,
  //       status: PayoutStatus.COMPLETED,
  //       processedAt: new Date('2024-02-21T10:00:00'),
  //       notes: 'Pago procesado exitosamente',
  //     },
  //   }),
  // ])

  console.log('📄 Creating verification documents...')

  console.log('📄 Creating verification documents...')

  console.log('📄 Creating verification documents...')
  await Promise.all([
    prisma.verificationDocument.create({
      data: {
        partnerId: partners[0].partnerProfile!.id,
        type: DocumentType.CEDULA_CIUDADANIA,
        documentUrl: 'https://example.com/docs/cedula-juan.pdf',
        status: DocumentStatus.APPROVED,
      },
    }),
    prisma.verificationDocument.create({
      data: {
        partnerId: partners[1].partnerProfile!.id,
        type: DocumentType.CEDULA_CIUDADANIA,
        documentUrl: 'https://example.com/docs/cedula-pedro.pdf',
        status: DocumentStatus.APPROVED,
      },
    }),
    prisma.verificationDocument.create({
      data: {
        partnerId: partners[2].partnerProfile!.id,
        type: DocumentType.CEDULA_CIUDADANIA,
        documentUrl: 'https://example.com/docs/cedula-luis.pdf',
        status: DocumentStatus.APPROVED,
      },
    }),
  ])

  console.log('🏆 Creating achievements...')
  const achievements = await Promise.all([
    prisma.achievement.create({
      data: {
        type: AchievementType.IDENTITY_VERIFIED,
        name: 'Identidad Verificada',
        description: 'Has verificado tu identidad',
        icon: 'Shield',
      },
    }),
    prisma.achievement.create({
      data: {
        type: AchievementType.FIRST_SERVICE,
        name: 'Primer Servicio',
        description: 'Has completado tu primer servicio',
        icon: 'Star',
      },
    }),
    prisma.achievement.create({
      data: {
        type: AchievementType.TEN_SERVICES,
        name: '10 Servicios',
        description: 'Has completado 10 servicios',
        icon: 'Award',
      },
    }),
  ])

  console.log('🎖️ Assigning achievements to partners...')
  await Promise.all([
    prisma.partnerAchievement.create({
      data: {
        partnerId: partners[0].partnerProfile!.id,
        achievementId: achievements[0].id,
      },
    }),
    prisma.partnerAchievement.create({
      data: {
        partnerId: partners[0].partnerProfile!.id,
        achievementId: achievements[1].id,
      },
    }),
    prisma.partnerAchievement.create({
      data: {
        partnerId: partners[1].partnerProfile!.id,
        achievementId: achievements[0].id,
      },
    }),
    prisma.partnerAchievement.create({
      data: {
        partnerId: partners[1].partnerProfile!.id,
        achievementId: achievements[2].id,
      },
    }),
  ])

  console.log('⚙️ Creating platform config...')
  await prisma.platformConfig.create({
    data: {
      key: 'default',
      commissionRate: 15.0,
      clientCommissionRate: 5.0,
      partnerCommissionRate: 20.0,
      minServicePrice: 10000,
      maxServicePrice: 10000000,
    },
  })

  console.log('✅ Database seeded successfully!')
  console.log('\n📊 Summary:')
  console.log(`  - ${categories.length} categories`)
  console.log(`  - ${services.length} services`)
  console.log(`  - ${clients.length} clients`)
  console.log(`  - ${partners.length} partners`)
  // console.log(`  - ${bookings.length} bookings`)
  console.log(`  - ${achievements.length} achievements`)
  console.log('\n🔐 Test credentials:')
  console.log(`  - ${services.length} services`)
  console.log(`  - ${clients.length} clients`)
  console.log(`  - ${partners.length} partners`)
  // console.log(`  - ${bookings.length} bookings`)
  console.log(`  - ${achievements.length} achievements`)
  console.log('\n🔐 Test credentials:')
  console.log('  Client: maria@example.com / password123')
  console.log('  Partner: juan@example.com / password123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
