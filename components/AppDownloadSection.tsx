'use client'

import { Smartphone, Apple, Download, Sparkles, CheckCircle } from 'lucide-react'
import Image from 'next/image'
import { isNativePlatform } from '@/lib/platform'

interface AppDownloadSectionProps {
  variant?: 'home' | 'footer'
}

export function AppDownloadSection({ variant = 'home' }: AppDownloadSectionProps) {
  if (isNativePlatform()) {
    return null
  }

  const isHome = variant === 'home'

  return (
    <section className={`relative overflow-hidden ${
      isHome 
        ? 'py-20 bg-gradient-to-br from-primary-600 via-secondary-600 to-accent-600' 
        : 'py-12 bg-gradient-to-r from-primary-700 to-secondary-700'
    }`}>
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white rounded-full mix-blend-overlay filter blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid ${isHome ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-12 items-center`}>
          {isHome && (
            <div className="relative hidden md:block">
              <div className="relative z-10 flex justify-center items-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-pink-500 rounded-[3rem] blur-2xl opacity-50 animate-pulse-slow"></div>
                  <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-[3rem] shadow-2xl transform hover:scale-105 transition-transform duration-300">
                    <Smartphone className="w-48 h-48 text-white" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
              
              <div className="absolute top-10 -right-10 bg-white/20 backdrop-blur-md p-4 rounded-2xl border border-white/30 animate-float">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <div className="absolute bottom-10 -left-10 bg-white/20 backdrop-blur-md p-4 rounded-2xl border border-white/30 animate-float" style={{ animationDelay: '1s' }}>
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>
          )}

          <div className={`text-white ${isHome ? '' : 'text-center'}`}>
            <div className={`inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full text-sm font-semibold mb-6 border border-white/30 ${isHome ? '' : 'mx-auto'}`}>
              <Download className="w-4 h-4" />
              <span>Download the app</span>
            </div>

            <h2 className={`text-3xl md:text-5xl font-black mb-6 leading-tight ${isHome ? '' : 'mx-auto max-w-3xl'}`}>
              Get LoHaggo on your
              <span className="block bg-gradient-to-r from-yellow-200 to-white bg-clip-text text-transparent">
                mobile device
              </span>
            </h2>

            <p className={`text-lg md:text-xl text-white/90 mb-8 font-medium ${isHome ? 'max-w-xl' : 'max-w-2xl mx-auto'}`}>
              Request services anytime, anywhere. Download our app and enjoy a faster, more convenient experience.
            </p>

            <div className="space-y-4 mb-8">
              {[
                'Instant notifications for your requests',
                'Track your service in real-time',
                'Exclusive discounts and promotions',
                'Faster and easier payments'
              ].map((feature, index) => (
                <div key={index} className={`flex items-center gap-3 ${isHome ? '' : 'justify-center'}`}>
                  <div className="bg-white/20 backdrop-blur-md p-2 rounded-lg border border-white/30">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white/90 font-medium">{feature}</span>
                </div>
              ))}
            </div>

            <div className={`flex flex-col sm:flex-row gap-4 ${isHome ? '' : 'justify-center'}`}>
              <a
                href="https://apps.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-center gap-3 bg-black hover:bg-gray-900 text-white px-8 py-4 rounded-2xl transition-all transform hover:scale-105 hover:shadow-2xl font-bold"
              >
                <Apple className="w-8 h-8" />
                <div className="text-left">
                  <div className="text-xs opacity-90">Download on the</div>
                  <div className="text-lg font-black -mt-1">App Store</div>
                </div>
              </a>

              <a
                href="https://play.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 px-8 py-4 rounded-2xl transition-all transform hover:scale-105 hover:shadow-2xl font-bold"
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                </svg>
                <div className="text-left">
                  <div className="text-xs opacity-90">GET IT ON</div>
                  <div className="text-lg font-black -mt-1">Google Play</div>
                </div>
              </a>
            </div>

            {isHome && (
              <div className="mt-8 flex items-center gap-6 text-sm text-white/80">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-pink-500 border-2 border-white"></div>
                    ))}
                  </div>
                  <span className="font-semibold">10K+ downloads</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-2xl">⭐</span>
                  <span className="font-bold text-white">4.8</span>
                  <span className="font-medium">(2.5K reviews)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
