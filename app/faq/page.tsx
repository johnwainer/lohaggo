'use client'

import { useState } from 'react'
import { ChevronDown, Users, Briefcase, HelpCircle } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
}

interface FAQSection {
  title: string
  icon: any
  color: string
  faqs: FAQItem[]
}

export default function FAQPage() {
  const [activeTab, setActiveTab] = useState<'clients' | 'partners'>('clients')
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const faqData: Record<'clients' | 'partners', FAQSection> = {
    clients: {
      title: 'Preguntas Frecuentes para Clientes',
      icon: Users,
      color: 'from-[#FF2D55] to-[#FF6900]',
      faqs: [
        {
          question: '¿Cómo puedo reservar un servicio?',
          answer: 'Para reservar un servicio, primero debes registrarte en la plataforma. Luego, navega a la sección de "Servicios", selecciona el servicio que necesitas, completa los detalles de tu solicitud (fecha, hora, dirección) y confirma tu reserva. Recibirás una notificación cuando un socio acepte tu solicitud.'
        },
        {
          question: '¿Cuánto tiempo tarda en confirmarse mi reserva?',
          answer: 'El tiempo de confirmación varía según la disponibilidad de los socios. Generalmente, las reservas se confirman en un plazo de 1 a 24 horas. Recibirás una notificación por correo electrónico y en la plataforma cuando tu reserva sea confirmada.'
        },
        {
          question: '¿Puedo cancelar o modificar mi reserva?',
          answer: 'Sí, puedes cancelar tu reserva desde tu panel de cliente en la sección "Mis Reservas". Ten en cuenta que las políticas de cancelación pueden variar según el servicio y el tiempo de anticipación. Te recomendamos revisar los términos antes de confirmar tu reserva.'
        },
        {
          question: '¿Cómo funcionan los pagos?',
          answer: 'Los pagos se procesan de forma segura a través de nuestra plataforma. Puedes pagar con tarjeta de crédito, débito o transferencia bancaria. El pago se realiza después de que el servicio haya sido completado y confirmado por ambas partes.'
        },
        {
          question: '¿Qué hago si tengo un problema con el servicio?',
          answer: 'Si tienes algún problema con el servicio recibido, puedes reportarlo desde tu panel de cliente. Nuestro equipo de soporte revisará tu caso y trabajará para encontrar una solución satisfactoria. También puedes dejar una reseña sobre tu experiencia.'
        },
        {
          question: '¿Los socios están verificados?',
          answer: 'Sí, todos nuestros socios pasan por un proceso de verificación que incluye validación de identidad, experiencia y referencias. Además, contamos con un sistema de calificaciones y reseñas para que puedas tomar decisiones informadas.'
        },
        {
          question: '¿Puedo solicitar un servicio personalizado?',
          answer: 'Absolutamente. Si no encuentras exactamente lo que buscas en nuestro catálogo, puedes crear una solicitud personalizada describiendo tus necesidades. Los socios interesados te enviarán propuestas que podrás revisar y aceptar.'
        },
        {
          question: '¿Cómo puedo contactar al socio asignado?',
          answer: 'Una vez que tu reserva sea confirmada, podrás comunicarte con el socio a través del sistema de mensajería interno de la plataforma. Esto mantiene toda la comunicación segura y documentada.'
        },
        {
          question: '¿Qué pasa si el socio no se presenta?',
          answer: 'Si el socio no se presenta en la fecha y hora acordadas, por favor repórtalo inmediatamente a través de tu panel. No se te cobrará por el servicio y te ayudaremos a encontrar otro socio disponible lo antes posible.'
        },
        {
          question: '¿Puedo solicitar el mismo socio para servicios futuros?',
          answer: 'Sí, si quedaste satisfecho con un socio, puedes agregarlo a tus favoritos y solicitar sus servicios directamente en futuras ocasiones. Esto facilita la continuidad y construye una relación de confianza.'
        }
      ]
    },
    partners: {
      title: 'Preguntas Frecuentes para Socios',
      icon: Briefcase,
      color: 'from-[#FF6900] to-[#FF2D55]',
      faqs: [
        {
          question: '¿Cómo puedo registrarme como socio?',
          answer: 'Para registrarte como socio, haz clic en "Registrarse" y selecciona la opción "Soy Profesional". Completa el formulario con tu información personal, experiencia profesional y los servicios que ofreces. Nuestro equipo revisará tu solicitud en un plazo de 24-48 horas.'
        },
        {
          question: '¿Cuáles son los requisitos para ser socio?',
          answer: 'Los requisitos básicos incluyen: ser mayor de 18 años, tener experiencia demostrable en el servicio que ofreces, proporcionar documentos de identificación válidos, y pasar nuestro proceso de verificación. Algunos servicios pueden requerir certificaciones específicas.'
        },
        {
          question: '¿Cuánto cobra la plataforma por comisión?',
          answer: 'Nuestra comisión es competitiva y transparente. Cobramos un porcentaje del valor del servicio que varía según la categoría. Los detalles específicos se proporcionan durante el proceso de registro. No hay costos ocultos ni tarifas de membresía.'
        },
        {
          question: '¿Cómo recibo los pagos?',
          answer: 'Los pagos se procesan automáticamente después de que el servicio sea completado y confirmado. El dinero se deposita en tu cuenta bancaria registrada en un plazo de 3-5 días hábiles. Puedes ver el historial de pagos en tu panel de socio.'
        },
        {
          question: '¿Puedo elegir qué solicitudes aceptar?',
          answer: 'Sí, tienes total libertad para aceptar o rechazar solicitudes según tu disponibilidad, ubicación y preferencias. No hay penalización por rechazar solicitudes, pero mantener una buena tasa de aceptación mejora tu visibilidad en la plataforma.'
        },
        {
          question: '¿Cómo funciona el sistema de calificaciones?',
          answer: 'Después de cada servicio, los clientes pueden calificarte del 1 al 5 estrellas y dejar comentarios. Estas calificaciones son visibles en tu perfil y ayudan a otros clientes a tomar decisiones. Mantener calificaciones altas aumenta tus oportunidades de trabajo.'
        },
        {
          question: '¿Puedo ofrecer múltiples servicios?',
          answer: 'Sí, puedes registrar y ofrecer múltiples servicios en diferentes categorías. Esto aumenta tus oportunidades de recibir solicitudes y maximizar tus ingresos en la plataforma.'
        },
        {
          question: '¿Qué hago si tengo un problema con un cliente?',
          answer: 'Si surge algún problema con un cliente, puedes reportarlo a través de tu panel de socio. Nuestro equipo de soporte mediará en la situación y trabajará para encontrar una solución justa. Toda la comunicación debe mantenerse dentro de la plataforma.'
        },
        {
          question: '¿Puedo establecer mis propios precios?',
          answer: 'Sí, tienes la flexibilidad de establecer tus propios precios para los servicios que ofreces. Sin embargo, te recomendamos investigar los precios del mercado para mantenerte competitivo. Puedes ajustar tus precios en cualquier momento desde tu panel.'
        },
        {
          question: '¿Cómo puedo mejorar mi visibilidad en la plataforma?',
          answer: 'Para mejorar tu visibilidad: mantén un perfil completo con fotos profesionales, responde rápidamente a las solicitudes, mantén calificaciones altas, completa servicios de manera consistente, y solicita a clientes satisfechos que dejen reseñas positivas.'
        },
        {
          question: '¿Hay soporte disponible si tengo dudas?',
          answer: 'Sí, nuestro equipo de soporte está disponible para ayudarte. Puedes contactarnos a través del chat en vivo, correo electrónico o teléfono. También tenemos una base de conocimientos con guías y tutoriales para socios.'
        },
        {
          question: '¿Puedo trabajar en múltiples ciudades?',
          answer: 'Sí, puedes configurar tu perfil para ofrecer servicios en múltiples ciudades o zonas. Esto te permite expandir tu área de cobertura y recibir más solicitudes de diferentes ubicaciones.'
        }
      ]
    }
  }

  const currentSection = faqData[activeTab]
  const Icon = currentSection.icon

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-2xl mb-4">
              <HelpCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 mb-4">
              Preguntas Frecuentes
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Encuentra respuestas a las preguntas más comunes sobre LoHaggo
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex gap-4 mb-8 justify-center">
          <button
            onClick={() => {
              setActiveTab('clients')
              setOpenIndex(null)
            }}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-lg transition-all ${
              activeTab === 'clients'
                ? 'bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow'
            }`}
          >
            <Users size={24} />
            <span>Para Clientes</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('partners')
              setOpenIndex(null)
            }}
            className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-lg transition-all ${
              activeTab === 'partners'
                ? 'bg-gradient-to-r from-[#FF6900] to-[#FF2D55] text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-50 shadow'
            }`}
          >
            <Briefcase size={24} />
            <span>Para Socios</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className={`bg-gradient-to-r ${currentSection.color} p-6`}>
            <div className="flex items-center gap-3 text-white">
              <Icon size={28} />
              <h2 className="text-2xl font-bold">{currentSection.title}</h2>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {currentSection.faqs.map((faq, index) => (
              <div key={index} className="transition-all">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="text-left font-semibold text-gray-900 text-lg pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown
                    size={24}
                    className={`text-[#FF2D55] flex-shrink-0 transition-transform ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openIndex === index ? 'max-h-96' : 'max-h-0'
                  }`}
                >
                  <div className="px-6 pb-5 pt-2">
                    <p className="text-gray-700 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 bg-gradient-to-r from-[#FF2D55]/10 to-[#FF6900]/10 rounded-3xl p-8 text-center border border-[#FF2D55]/20">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            ¿No encontraste lo que buscabas?
          </h3>
          <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
            Nuestro equipo de soporte está disponible para ayudarte con cualquier pregunta o inquietud que tengas.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href="mailto:soporte@lohaggo.com"
              className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all border-2 border-gray-200"
            >
              Enviar un correo
            </a>
            <a
              href="/contacto"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all"
            >
              Formulario de contacto
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
