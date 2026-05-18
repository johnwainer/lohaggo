'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, HelpCircle } from 'lucide-react'

interface TourStep {
  target: string
  title: string
  description: string
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

const tourSteps: TourStep[] = [
  {
    target: 'welcome',
    title: '👋 ¡Bienvenido a LoHaggo!',
    description: 'Te mostraremos cómo funciona la plataforma en solo 5 pasos. Puedes saltar este tutorial en cualquier momento.',
    position: 'center'
  },
  {
    target: 'search-bar',
    title: '🔍 Busca cualquier servicio',
    description: 'Escribe lo que necesitas: plomero, electricista, limpieza, niñera... Encuentra expertos verificados al instante.',
    position: 'center'
  },
  {
    target: 'service-categories',
    title: '📂 Explora por categorías',
    description: 'Navega por categorías para descubrir todos los servicios disponibles en tu ciudad.',
    position: 'center'
  },
  {
    target: 'navbar',
    title: '🎯 Barra de navegación',
    description: 'Selecciona tu ciudad, explora servicios, consulta preguntas frecuentes y accede a tu perfil desde aquí.',
    position: 'center'
  },
  {
    target: 'bottom-nav',
    title: '🧭 Navegación rápida (móvil)',
    description: 'En móvil, usa estos botones para navegar rápidamente: Inicio, Servicios y tu Perfil.',
    position: 'center'
  }
]

// Translation mappings for internationalization
const tourTranslations = {
  en: {
    steps: [
      {
        title: '👋 Welcome to LoHaggo!',
        description: 'We will show you how the platform works in just 5 steps. You can skip this tutorial at any time.'
      },
      {
        title: '🔍 Search any service',
        description: 'Type what you need: plumber, electrician, cleaning, babysitter... Find verified experts instantly.'
      },
      {
        title: '📂 Explore by categories',
        description: 'Browse categories to discover all available services in your city.'
      },
      {
        title: '🎯 Navigation bar',
        description: 'Select your city, explore services, check FAQs and access your profile from here.'
      },
      {
        title: '🧭 Quick navigation (mobile)',
        description: 'On mobile, use these buttons to navigate quickly: Home, Services and your Profile.'
      }
    ],
    ui: {
      previous: 'Previous',
      next: 'Next',
      finish: 'Start using LoHaggo',
      dontShowAgain: 'Do not show again',
      viewTutorial: 'View tutorial',
      showTutorial: 'Show tutorial',
      stepCounter: 'of'
    }
  },
  es: {
    steps: [
      {
        title: '👋 ¡Bienvenido a LoHaggo!',
        description: 'Te mostraremos cómo funciona la plataforma en solo 5 pasos. Puedes saltar este tutorial en cualquier momento.'
      },
      {
        title: '🔍 Busca cualquier servicio',
        description: 'Escribe lo que necesitas: plomero, electricista, limpieza, niñera... Encuentra expertos verificados al instante.'
      },
      {
        title: '📂 Explora por categorías',
        description: 'Navega por categorías para descubrir todos los servicios disponibles en tu ciudad.'
      },
      {
        title: '🎯 Barra de navegación',
        description: 'Selecciona tu ciudad, explora servicios, consulta preguntas frecuentes y accede a tu perfil desde aquí.'
      },
      {
        title: '🧭 Navegación rápida (móvil)',
        description: 'En móvil, usa estos botones para navegar rápidamente: Inicio, Servicios y tu Perfil.'
      }
    ],
    ui: {
      previous: 'Anterior',
      next: 'Siguiente',
      finish: 'Comenzar a usar LoHaggo',
      dontShowAgain: 'No volver a mostrar',
      viewTutorial: 'Ver tutorial',
      showTutorial: 'Mostrar tutorial',
      stepCounter: 'de'
    }
  }
}

export default function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [showFloatingButton, setShowFloatingButton] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Get user language preference (default to Spanish)
  const getUserLanguage = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user-language') || 'es'
    }
    return 'es'
  }

  const currentLanguage = getUserLanguage() as 'en' | 'es'
  const translations = tourTranslations[currentLanguage]

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    fetch('/api/public/floating-buttons')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const enabled = d?.help_float_button?.enabled ?? true
        setShowFloatingButton(enabled)
      })
      .catch(() => setShowFloatingButton(true))
  }, [])

  useEffect(() => {
    if (isOpen) {
      const step = tourSteps[currentStep]

      if (step.target !== 'welcome') {
        const element = getTargetElement(step.target)

        if (element) {
          const rect = element.getBoundingClientRect()
          const windowHeight = window.innerHeight
          const windowWidth = window.innerWidth

          const isElementVisible =
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= windowHeight &&
            rect.right <= windowWidth

          if (!isElementVisible) {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'center'
            })
          }
        }
      }
    }
  }, [currentStep, isOpen])

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    localStorage.setItem('onboarding-tour-completed', 'true')
    setIsOpen(false)
    setShowFloatingButton(true)
  }

  const handleDontShowAgain = () => {
    localStorage.setItem('onboarding-tour-dont-show', 'true')
    setIsOpen(false)
    setShowFloatingButton(true)
  }

  const handleRestart = () => {
    setCurrentStep(0)
    setIsOpen(true)
    setShowFloatingButton(false)
  }

  const getTargetElement = (target: string) => {
    return document.querySelector(`[data-tour="${target}"]`)
  }

  const getHighlightStyle = () => {
    const step = tourSteps[currentStep]

    if (step.target === 'welcome') {
      return { display: 'none' }
    }

    const element = getTargetElement(step.target)

    if (!element) return { display: 'none' }

    const rect = element.getBoundingClientRect()
    return {
      top: rect.top - 8,
      left: rect.left - 8,
      width: rect.width + 16,
      height: rect.height + 16,
      display: 'block'
    }
  }

  const getTooltipStyle = () => {
    const windowHeight = window.innerHeight
    const windowWidth = window.innerWidth

    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    }
  }

  if (!isOpen && showFloatingButton) {
    return (
      <button
        onClick={handleRestart}
        className="fixed bottom-24 md:bottom-6 right-4 z-50 w-12 h-12 md:w-14 md:h-14 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group hover:scale-110"
        aria-label={translations.ui.showTutorial}
      >
        <HelpCircle size={24} className="md:w-7 md:h-7" />
        <span className="absolute right-14 md:right-16 bg-gray-900 text-white text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {translations.ui.viewTutorial}
        </span>
      </button>
    )
  }

  if (!isOpen) return null

  const step = tourSteps[currentStep]
  const translatedStep = translations.steps[currentStep]
  const highlightStyle = getHighlightStyle()
  const tooltipStyle = getTooltipStyle()

  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-[100] animate-fadeIn pointer-events-none" />

      {step.target !== 'welcome' && (
        <div
          className="fixed z-[101] border-4 border-primary-500 rounded-xl pointer-events-none transition-all duration-500 shadow-2xl"
          style={highlightStyle}
        />
      )}

      <div
        className="fixed z-[102] bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-[calc(100vw-2rem)] max-w-md animate-fadeIn pointer-events-auto"
        style={tooltipStyle}
      >
        <button
          onClick={handleComplete}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Cerrar tutorial"
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">{translatedStep.title}</h3>
          <p className="text-sm md:text-base text-gray-600 leading-relaxed">{translatedStep.description}</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1.5">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-primary-500'
                    : index < currentStep
                    ? 'w-2 bg-primary-300'
                    : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-xs md:text-sm text-gray-500 font-medium">
            {currentStep + 1} {translations.ui.stepCounter} {tourSteps.length}
          </span>
        </div>

        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handlePrevious}
              className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold flex items-center justify-center gap-2 hover:border-gray-400"
            >
              <ChevronLeft size={18} />
              {translations.ui.previous}
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-xl hover:from-primary-600 hover:to-secondary-600 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
          >
            {currentStep === tourSteps.length - 1 ? translations.ui.finish : translations.ui.next}
            {currentStep < tourSteps.length - 1 && <ChevronRight size={18} />}
          </button>
        </div>

        {currentStep === 0 && (
          <button
            onClick={handleDontShowAgain}
            className="w-full mt-4 text-xs md:text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {translations.ui.dontShowAgain}
          </button>
        )}
      </div>
    </>
  )
}
