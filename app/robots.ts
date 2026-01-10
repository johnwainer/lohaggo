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
          '/login',
          '/register',
          '/notifications',
          '/my-ratings',
          '/_next/',
          '/static/',
        ],
        crawlDelay: 1,
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/profile/',
          '/login',
          '/register',
          '/notifications',
          '/my-ratings',
        ],
        crawlDelay: 0,
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/profile/',
          '/login',
          '/register',
          '/notifications',
          '/my-ratings',
        ],
        crawlDelay: 1,
      },
    ],
    sitemap: 'https://lohaggo.com/sitemap.xml',
    host: 'https://lohaggo.com',
  }
}
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/profile/',
          '/login',
          '/register',
          '/notifications',
          '/my-ratings',
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
          '/login',
          '/register',
          '/notifications',
          '/my-ratings',
        ],
      },
    ],
    sitemap: 'https://lohaggo.com/sitemap.xml',
    host: 'https://lohaggo.com',
  }
}
