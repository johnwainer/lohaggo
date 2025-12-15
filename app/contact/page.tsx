'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Mail, 
  Phone, 
  MapPin, 
  Send,
  MessageSquare,
  User,
  Building2,
  Clock,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Facebook,
  Twitter,
  Instagram,
  Linkedin
} from 'lucide-react'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    userType: 'client',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setIsSubmitting(false)
    setIsSubmitted(true)
    
    // Reset form after 3 seconds
    setTimeout(() => {
      setIsSubmitted(false)
      setFormData({
        name: '',
        email: '',
        phone: '',
        userType: 'client',
        subject: '',
        message: ''
      })
    }, 3000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const contactInfo = [
    {
      icon: Mail,
      title: 'Email',
      value: 'hola@lohaggo.com',
      link: 'mailto:hola@lohaggo.com'
    },
    {
      icon: Phone,
      title: 'Teléfono',
      value: '+52 55 1234 5678',
      link: 'tel:+525512345678'
    },
    {
      icon: MapPin,
      title: 'Oficina',
      value: 'Ciudad de México, México',
      link: '#'
    },
    {
      icon: Clock,
      title: 'Horario',
      value: 'Lun - Vie: 9:00 - 18:00',
      link: '#'
    }
  ]

  const socialLinks = [
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Instagram, href: '#', label: 'Instagram' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' }
  ]

  const faqs = [
    {
      question: '¿Cuánto tiempo tarda en responder?',
      answer: 'Respondemos en menos de 24 horas hábiles'
    },
    {
      question: '¿Puedo agendar una llamada?',
      answer: 'Sí, menciona tu disponibilidad en el mensaje'
    },
    {
      question: '¿Atienden fines de semana?',
      answer: 'Soporte limitado sábados de 10:00 - 14:00'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-500 via-secondary-500 to-secondary-500 text-white pt-24 pb-20">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-yellow-400 rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-pink-400 rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full text-sm font-semibold mb-8 border border-white/30">
              <MessageSquare className="w-4 h-4" />
              <span>Estamos aquí para ayudarte</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight">
              Contáctanos
            </h1>
            
            <p className="text-xl md:text-2xl mb-8 text-white/90 font-medium max-w-3xl mx-auto">
              ¿Tienes preguntas? Nos encantaría escucharte. Envíanos un mensaje y te responderemos lo antes posible.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-gray-100">
                <div className="mb-8">
                  <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
                    Envíanos un mensaje
                  </h2>
                  <p className="text-gray-600 font-medium">
                    Completa el formulario y nos pondremos en contacto contigo pronto
                  </p>
                </div>

                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 mb-3">
                      ¡Mensaje enviado!
                    </h3>
                    <p className="text-gray-600 font-medium">
                      Gracias por contactarnos. Te responderemos pronto.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* User Type Selection */}
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-3">
                        Soy un:
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div
                          onClick={() => setFormData({ ...formData, userType: 'client' })}
                          className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all font-bold cursor-pointer ${
                            formData.userType === 'client'
                              ? 'border-primary-500 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 text-primary-600'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          <User className="w-5 h-5" />
                          Cliente
                        </div>
                        <div
                          onClick={() => setFormData({ ...formData, userType: 'partner' })}
                          className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all font-bold cursor-pointer ${
                            formData.userType === 'partner'
                              ? 'border-primary-500 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 text-primary-600'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          <Building2 className="w-5 h-5" />
                          Socio/Profesional
                        </div>
                      </div>
                    </div>

                    {/* Name */}
                    <div>
                      <label htmlFor="name" className="block text-sm font-bold text-gray-900 mb-2">
                        Nombre completo *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium"
                        placeholder="Tu nombre"
                      />
                    </div>

                    {/* Email and Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="email" className="block text-sm font-bold text-gray-900 mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium"
                          placeholder="tu@email.com"
                        />
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm font-bold text-gray-900 mb-2">
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium"
                          placeholder="+52 55 1234 5678"
                        />
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <label htmlFor="subject" className="block text-sm font-bold text-gray-900 mb-2">
                        Asunto *
                      </label>
                      <select
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium"
                      >
                        <option value="">Selecciona un asunto</option>
                        <option value="general">Consulta general</option>
                        <option value="support">Soporte técnico</option>
                        <option value="partnership">Convertirme en socio</option>
                        <option value="billing">Facturación</option>
                        <option value="feedback">Sugerencias</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>

                    {/* Message */}
                    <div>
                      <label htmlFor="message" className="block text-sm font-bold text-gray-900 mb-2">
                        Mensaje *
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={6}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all resize-none font-medium"
                        placeholder="Cuéntanos cómo podemos ayudarte..."
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Enviando...
                        </>
                      ) : (
                        <>
                          Enviar mensaje
                          <Send className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Contact Info Sidebar */}
            <div className="space-y-6">
              {/* Contact Cards */}
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                <h3 className="text-2xl font-black text-gray-900 mb-6">
                  Información de contacto
                </h3>
                <div className="space-y-6">
                  {contactInfo.map((info, index) => {
                    const Icon = info.icon
                    return (
                      <a
                        key={index}
                        href={info.link}
                        className="flex items-start gap-4 group"
                      >
                        <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-500 mb-1">
                            {info.title}
                          </div>
                          <div className="text-gray-900 font-bold group-hover:text-primary-600 transition-colors">
                            {info.value}
                          </div>
                        </div>
                      </a>
                    )
                  })}
                </div>
              </div>

              {/* Social Links */}
              <div className="bg-gradient-to-br from-primary-500 to-secondary-500 rounded-3xl shadow-xl p-8 text-white">
                <h3 className="text-2xl font-black mb-4">
                  Síguenos
                </h3>
                <p className="text-white/90 font-medium mb-6">
                  Mantente al día con nuestras novedades
                </p>
                <div className="flex gap-3">
                  {socialLinks.map((social, index) => {
                    const Icon = social.icon
                    return (
                      <a
                        key={index}
                        href={social.href}
                        aria-label={social.label}
                        className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center hover:bg-white/20 transition-all border border-white/20 hover:scale-110"
                      >
                        <Icon className="w-5 h-5" />
                      </a>
                    )
                  })}
                </div>
              </div>

              {/* Quick FAQs */}
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                <h3 className="text-2xl font-black text-gray-900 mb-6">
                  Preguntas frecuentes
                </h3>
                <div className="space-y-4">
                  {faqs.map((faq, index) => (
                    <div key={index}>
                      <div className="text-sm font-bold text-gray-900 mb-1">
                        {faq.question}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">
                        {faq.answer}
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/faq"
                  className="inline-flex items-center gap-2 text-primary-600 font-bold mt-6 hover:gap-3 transition-all"
                >
                  Ver todas las preguntas
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section (Optional) */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-3xl p-12 text-center border border-gray-200">
            <Sparkles className="w-12 h-12 text-primary-600 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              ¿Prefieres hablar directamente?
            </h2>
            <p className="text-xl text-gray-600 font-medium mb-8 max-w-2xl mx-auto">
              Agenda una llamada con nuestro equipo y resolveremos todas tus dudas
            </p>
            <a
              href="tel:+525512345678"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <Phone className="w-5 h-5" />
              Llamar ahora
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
