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
    target: 'search-bar',
    title: '🔍 Search any service',
    description: 'Type what you need: babysitter, plumber, cleaning... and find experts instantly.',
    position: 'bottom'
  },
  {
    target: 'navbar',
    title: '🎯 Navigation bar',
    description: 'Here you can select your city, browse sections (Home, Services, FAQ), and access your profile or sign in.',
    position: 'bottom'
  },
  {
    target: 'bottom-nav',
    title: '🧭 Quick navigation',
    description: 'Use these buttons to navigate: Home, Services, and your Profile.',
    position: 'top'
  },
  {
    target: 'service-categories',
    title: '📂 Explore by categories',
    description: 'Browse categories to discover all available services.',
    position: 'top'
  }
]

// Translation mappings for internationalization
const tourTranslations = {
  en: {
    steps: [
      {
        title: '🔍 Search any service',
        description: 'Type what you need: babysitter, plumber, cleaning... and find experts instantly.'
      },
      {
        title: '🎯 Navigation bar',
        description: 'Here you can select your city, browse sections (Home, Services, FAQ), and access your profile or sign in.'
      },
      {
        title: '🧭 Quick navigation',
        description: 'Use these buttons to navigate: Home, Services, and your Profile.'
      },
      {
        title: '📂 Explore by categories',
        description: 'Browse categories to discover all available services.'
      }
    ],
    ui: {
      previous: 'Previous',
      next: 'Next',
      finish: 'Finish',
      dontShowAgain: 'Do not show again',
      viewTutorial: 'View tutorial',
      showTutorial: 'Show tutorial',
      stepCounter: 'of'
    }
  },
  es: {
    steps: [
      {
        title: '🔍 Busca cualquier servicio',
        description: 'Escribe lo que necesitas: niñera, plomero, limpieza... y encuentra expertos al instante.'
      },
      {
        title: '🎯 Barra de navegación',
        description: 'Aquí puedes seleccionar tu ciudad, navegar por las secciones (Inicio, Servicios, FAQ), y acceder a tu perfil o iniciar sesión.'
      },
      {
        title: '🧭 Navegación rápida',
        description: 'Usa estos botones para navegar: Inicio, Servicios y tu Perfil.'
      },
      {
        title: '📂 Explora por categorías',
        description: 'Navega por categorías para descubrir todos los servicios disponibles.'
      }
    ],
    ui: {
      previous: 'Anterior',
      next: 'Siguiente',
      finish: 'Finalizar',
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
    if (!isMobile) return

    const tourCompleted = localStorage.getItem('onboarding-tour-completed')
    const dontShowAgain = localStorage.getItem('onboarding-tour-dont-show')

    if (!tourCompleted && !dontShowAgain) {
      setShowFloatingButton(true)
    } else {
      setShowFloatingButton(true)
    }
  }, [isMobile])

  useEffect(() => {
    if (isOpen) {
      const step = tourSteps[currentStep]
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
    const element = getTargetElement(step.target)
    
    if (!element) return {}
    
    const rect = element.getBoundingClientRect()
    return {
      top: rect.top - 8,
      left: rect.left - 8,
      width: rect.width + 16,
      height: rect.height + 16
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
        className="fixed bottom-24 md:bottom-6 right-4 z-50 w-12 h-12 md:w-14 md:h-14 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
        aria-label={translations.ui.showTutorial}
      >
        <HelpCircle size={24} className="md:w-7 md:h-7" />
        <span className="absolute right-14 md:right-16 bg-gray-900 text-white text-xs md:text-sm px-3 py-1.5 md:px-4 md:py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
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
      <div className="fixed inset-0 bg-black/70 z-[100] animate-fadeIn pointer-events-none" />

      <div
        className="fixed z-[101] border-4 border-primary-500 rounded-xl pointer-events-none transition-all duration-300"
        style={highlightStyle}
      />

      <div
        className="fixed z-[102] bg-white rounded-2xl shadow-2xl p-6 w-[calc(100vw-2rem)] md:w-80 animate-fadeIn pointer-events-auto"
        style={tooltipStyle}
      >
        <button
          onClick={handleComplete}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <X size={20} />
        </button>

        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{translatedStep.title}</h3>
          <p className="text-sm text-gray-600">{translatedStep.description}</p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1.5">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-8 bg-primary-500'
                    : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500 font-medium">
            {currentStep + 1} {translations.ui.stepCounter} {tourSteps.length}
          </span>
        </div>

        <div className="flex gap-2">
          {currentStep > 0 && (
            <button
              onClick={handlePrevious}
              className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold flex items-center justify-center gap-2"
            >
              <ChevronLeft size={18} />
              {translations.ui.previous}
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-xl hover:from-primary-600 hover:to-secondary-600 transition font-semibold flex items-center justify-center gap-2"
          >
            {currentStep === tourSteps.length - 1 ? translations.ui.finish : translations.ui.next}
            {currentStep < tourSteps.length - 1 && <ChevronRight size={18} />}
          </button>
        </div>

        {currentStep === 0 && (
          <button
            onClick={handleDontShowAgain}
            className="w-full mt-3 text-xs text-gray-500 hover:text-gray-700 transition"
          >
            {translations.ui.dontShowAgain}
          </button>
        )}
      </div>
    </>
  )
}
