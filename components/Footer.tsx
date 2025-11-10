import Link from 'next/link'
import { Sparkles, Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin, Heart } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Section */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] rounded-2xl blur opacity-50 group-hover:opacity-75 transition"></div>
                <div className="relative bg-gradient-to-r from-[#FF2D55] to-[#FF6900] p-2.5 rounded-2xl">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-white">
                  LoHaggo
                </span>
                <div className="text-xs text-gray-400 font-semibold -mt-1">Servicios a tu alcance</div>
              </div>
            </Link>
            <p className="text-gray-400 leading-relaxed font-medium">
              La plataforma más confiable para conectar profesionales con clientes. Rápido, seguro y fácil de usar.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="w-10 h-10 bg-white/10 hover:bg-gradient-to-r hover:from-[#FF2D55] hover:to-[#FF6900] rounded-full flex items-center justify-center transition-all transform hover:scale-110">
                <Facebook size={18} />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 hover:bg-gradient-to-r hover:from-[#FF2D55] hover:to-[#FF6900] rounded-full flex items-center justify-center transition-all transform hover:scale-110">
                <Twitter size={18} />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 hover:bg-gradient-to-r hover:from-[#FF2D55] hover:to-[#FF6900] rounded-full flex items-center justify-center transition-all transform hover:scale-110">
                <Instagram size={18} />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 hover:bg-gradient-to-r hover:from-[#FF2D55] hover:to-[#FF6900] rounded-full flex items-center justify-center transition-all transform hover:scale-110">
                <Linkedin size={18} />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-black mb-6 text-white">Servicios</h3>
            <ul className="space-y-3">
              {['Plomería', 'Electricidad', 'Limpieza', 'Carpintería', 'Pintura', 'Jardinería'].map((service) => (
                <li key={service}>
                  <Link href="/servicios" className="text-gray-400 hover:text-[#FF2D55] transition-colors flex items-center group font-medium">
                    <span className="w-1.5 h-1.5 bg-[#FF2D55] rounded-full mr-2 group-hover:scale-150 transition-transform"></span>
                    {service}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-lg font-black mb-6 text-white">Empresa</h3>
            <ul className="space-y-3">
              {[
                { name: 'Sobre nosotros', href: '/about' },
                { name: 'Cómo funciona', href: '/how-it-works' },
                { name: 'Conviértete en socio', href: '/register?role=partner' },
                { name: 'FAQ', href: '/faq' },
                { name: 'Contacto', href: '/contact' }
              ].map((item) => (
                <li key={item.name}>
                  <Link href={item.href} className="text-gray-400 hover:text-[#FF2D55] transition-colors flex items-center group font-medium">
                    <span className="w-1.5 h-1.5 bg-[#FF2D55] rounded-full mr-2 group-hover:scale-150 transition-transform"></span>
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-black mb-6 text-white">Contacto</h3>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3 text-gray-400">
                <MapPin size={20} className="text-[#FF2D55] flex-shrink-0 mt-1" />
                <span className="font-medium">Medellín, Antioquia, Colombia</span>
              </li>
              <li className="flex items-center space-x-3 text-gray-400">
                <Phone size={20} className="text-[#FF2D55] flex-shrink-0" />
                <span className="font-medium">+57 (4) 604 5678</span>
              </li>
              <li className="flex items-center space-x-3 text-gray-400">
                <Mail size={20} className="text-[#FF2D55] flex-shrink-0" />
                <span className="font-medium">hola@lohaggo.com</span>
              </li>
            </ul>
            <div className="mt-6">
              <Link
                href="/register?role=partner"
                className="inline-block bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white px-6 py-3 rounded-xl hover:from-[#FF1D45] hover:to-[#FF5900] transition-all font-bold text-sm shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Únete como socio
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2 text-gray-400 text-sm">
              <span>© {currentYear} LoHaggo. Todos los derechos reservados.</span>
              <span className="hidden md:inline">•</span>
              <span className="hidden md:inline">Hecho con</span>
              <Heart size={14} className="text-[#FF2D55] fill-[#FF2D55] hidden md:inline" />
            </div>
            <div className="flex space-x-6 text-sm">
              <Link href="/privacy" className="text-gray-400 hover:text-[#FF2D55] transition-colors font-medium">
                Privacidad
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-[#FF2D55] transition-colors font-medium">
                Términos
              </Link>
              <Link href="/cookies" className="text-gray-400 hover:text-[#FF2D55] transition-colors font-medium">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
