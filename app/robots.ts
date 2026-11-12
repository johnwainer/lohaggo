import { MetadataRoute } from 'next'

const DISALLOW = [
  '/api/',
  '/admin/',
  '/dashboard/',
  '/profile/',
  '/partner/',
  // Enlaces de un solo uso y flujos de cuenta
  '/cita/',
  '/w/',
  '/auth/',
  '/olvide-mi-contrasena',
  '/restablecer-contrasena',
  '/login',
  '/register',
  '/notifications',
  '/my-ratings',
  '/servicios?',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      { userAgent: 'Googlebot', allow: '/', disallow: DISALLOW, crawlDelay: 0 },
    ],
    sitemap: 'https://www.lohaggo.com/sitemap.xml',
  }
}
