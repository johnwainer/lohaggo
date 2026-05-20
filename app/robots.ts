import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/profile/',
          '/partner/dashboard',
          '/partner/requests',
          '/partner/bookings',
          '/partner/verification',
          '/partner/earnings',
          '/partner/profile',
          '/login',
          '/register',
          '/registro-socios',
          '/notifications',
          '/my-ratings',
          '/servicios?',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/profile/',
          '/partner/dashboard',
          '/partner/requests',
          '/partner/bookings',
          '/partner/verification',
          '/partner/earnings',
          '/partner/profile',
          '/login',
          '/register',
          '/registro-socios',
          '/notifications',
          '/my-ratings',
          '/servicios?',
        ],
        crawlDelay: 0,
      },
    ],
    sitemap: 'https://www.lohaggo.com/sitemap.xml',
  }
}
