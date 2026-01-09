const isMobileBuild = process.env.NEXT_PUBLIC_PLATFORM === 'mobile';

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://sdk.mercadopago.com https://www.mercadopago.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api.mercadopago.com https://api.cloudinary.com https://*.cloudinary.com",
      "frame-src 'self' https://www.mercadopago.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests"
    ].join('; ')
  }
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  ...(isMobileBuild && {
    output: 'export',
    distDir: 'out',
    trailingSlash: false,
  }),

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0'
          }
        ],
      },
    ]
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    ...(isMobileBuild && {
      unoptimized: true,
    }),
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  turbopack: {},

  env: {
    NEXT_PUBLIC_API_URL: isMobileBuild 
      ? process.env.NEXT_PUBLIC_API_URL || 'https://lohaggo.com/api'
      : process.env.NEXT_PUBLIC_API_URL || '/api',
  },

  webpack: (config, { isServer }) => {
    if (isMobileBuild && isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@prisma/client': 'commonjs @prisma/client',
      });
    }
    return config;
  },
}

module.exports = nextConfig