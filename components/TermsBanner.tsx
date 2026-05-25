'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useCity } from '@/lib/city-context'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'

export default function TermsBanner() {
    const [isVisible, setIsVisible] = useState(false)
    const [isAccepted, setIsAccepted] = useState(false)
    const { showCityModal } = useCity()
    const { data: session } = useSession()
    const pathname = usePathname()

    const inProtectedArea = Boolean(
      pathname &&
      (/^\/(dashboard|partner|profile|notifications|my-ratings|admin|unete)(\/|$)/.test(pathname))
    )

    useEffect(() => {
        const termsAccepted = localStorage.getItem('terms-accepted')
        if (!termsAccepted) {
            const timer = setTimeout(() => setIsVisible(true), 3000)
            return () => clearTimeout(timer)
        }
    }, [])

    const handleAccept = () => {
        if (isAccepted) {
            localStorage.setItem('terms-accepted', 'true')
            setIsVisible(false)
        }
    }

    const handleClose = () => {
        // Allow closing but will show again next time
        setIsVisible(false)
    }

    if (!isVisible || session?.user?.id || inProtectedArea) {
        return null
    }

    if (showCityModal) {
        return null
    }

    return (
        <div className="fixed bottom-[5.5rem] left-0 right-0 md:bottom-0 z-40 bg-white border-t-2 border-primary-500 shadow-2xl">
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        {/* Close button */}
                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
                            aria-label="Cerrar"
                        >
                            <X size={20} />
                        </button>

                        {/* Content */}
                        <div className="flex-1 pr-8">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">
                                Aviso Legal
                            </h3>
                            <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                Para continuar usando LoHaggo, debes leer y aceptar nuestros{' '}
                                <Link
                                    href="/terms"
                                    target="_blank"
                                    className="text-primary-600 font-semibold hover:underline"
                                >
                                    Términos y Condiciones
                                </Link>
                                , la{' '}
                                <Link
                                    href="/privacy"
                                    target="_blank"
                                    className="text-primary-600 font-semibold hover:underline"
                                >
                                    Política de Privacidad
                                </Link>
                                {' '}y la{' '}
                                <Link
                                    href="/cookies"
                                    target="_blank"
                                    className="text-primary-600 font-semibold hover:underline"
                                >
                                    Política de Cookies
                                </Link>
                                .
                            </p>

                            {/* Checkbox */}
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative flex items-center justify-center mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={isAccepted}
                                        onChange={(e) => setIsAccepted(e.target.checked)}
                                        className="w-5 h-5 border-2 border-gray-300 rounded cursor-pointer checked:bg-primary-500 checked:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all"
                                    />
                                </div>
                                <span className="text-sm text-gray-700">
                                    He leído y acepto los términos mencionados
                                </span>
                            </label>
                        </div>

                        {/* Action button */}
                        <div className="w-full sm:w-auto">
                            <button
                                onClick={handleAccept}
                                disabled={!isAccepted}
                                className="w-full sm:w-auto px-8 py-3 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-500"
                            >
                                Aceptar y continuar
                            </button>
                        </div>
                    </div>
                </div>
        </div>
    )
}
