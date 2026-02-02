'use client'

import Link from 'next/link'
import { 
  Mail, 
  MapPin, 
  MessageSquare,
  Sparkles,
  Facebook,
  Instagram,
  ExternalLink
} from 'lucide-react'

export default function ContactPage() {
  const socialChannels = [
    {
      icon: Facebook,
      name: 'Facebook',
      description: 'Síguenos y envíanos un mensaje directo',
      href: 'https://www.facebook.com/lohaggo',
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700'
    },
    {
      icon: Instagram,
      name: 'Instagram',
      description: 'Contáctanos por mensaje directo',
      href: 'https://www.instagram.com/lohaggo_',
      color: 'from-pink-500 to-purple-600',
      hoverColor: 'hover:from-pink-600 hover:to-purple-700'
    }
  ]

  const contactInfo = [
    {
      icon: Mail,
      title: 'Email',
      value: 'hola@lohaggo.com',
      link: 'mailto:hola@lohaggo.com'
    },
    {
      icon: MapPin,
      title: 'Ubicación',
      value: 'Medellín, Antioquia, Colombia',
      link: '#'
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
              ¿Tienes preguntas? Nos encantaría escucharte. Contáctanos por nuestras redes sociales.
            </p>
          </div>
        </div>
      </section>

      {/* Social Media CTAs */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              Escríbenos por redes sociales
            </h2>
            <p className="text-xl text-gray-600 font-medium max-w-2xl mx-auto">
              Elige tu canal favorito y contáctanos. Respondemos rápido.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            {socialChannels.map((channel, index) => {
              const Icon = channel.icon
              return (
                <a
                  key={index}
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative bg-white rounded-3xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-all transform hover:scale-105"
                >
                  <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity"></div>
                  
                  <div className="relative">
                    <div className={`w-16 h-16 bg-gradient-to-r ${channel.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    
                    <h3 className="text-2xl font-black text-gray-900 mb-2">
                      {channel.name}
                    </h3>
                    
                    <p className="text-gray-600 font-medium mb-6">
                      {channel.description}
                    </p>
                    
                    <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${channel.color} ${channel.hoverColor} text-white px-6 py-3 rounded-xl font-bold transition-all`}>
                      Contactar ahora
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>
                </a>
              )
            })}
          </div>

          {/* Contact Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {contactInfo.map((info, index) => {
              const Icon = info.icon
              return (
                <a
                  key={index}
                  href={info.link}
                  className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-500 mb-2">
                        {info.title}
                      </div>
                      <div className="text-lg text-gray-900 font-bold group-hover:text-primary-600 transition-colors">
                        {info.value}
                      </div>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ Link Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-3xl p-12 text-center border border-gray-200">
            <Sparkles className="w-12 h-12 text-primary-600 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              ¿Tienes preguntas frecuentes?
            </h2>
            <p className="text-xl text-gray-600 font-medium mb-8 max-w-2xl mx-auto">
              Visita nuestra sección de preguntas frecuentes para encontrar respuestas rápidas
            </p>
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              Ver preguntas frecuentes
              <ExternalLink className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
