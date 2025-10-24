export const DESIGN_SYSTEM = {
  colors: {
    primary: {
      main: 'primary-600',
      hover: 'primary-700',
      light: 'primary-50',
      bg: 'primary-100',
    },
    secondary: {
      main: 'secondary-600',
      hover: 'secondary-700',
      light: 'secondary-50',
    },
    success: {
      main: 'green-600',
      hover: 'green-700',
      light: 'green-50',
      bg: 'green-100',
      text: 'green-800',
      border: 'green-200',
    },
    warning: {
      main: 'yellow-600',
      hover: 'yellow-700',
      light: 'yellow-50',
      bg: 'yellow-100',
      text: 'yellow-800',
      border: 'yellow-200',
    },
    error: {
      main: 'red-600',
      hover: 'red-700',
      light: 'red-50',
      bg: 'red-100',
      text: 'red-800',
      border: 'red-200',
    },
    info: {
      main: 'blue-600',
      hover: 'blue-700',
      light: 'blue-50',
      bg: 'blue-100',
      text: 'blue-800',
      border: 'blue-200',
    },
    neutral: {
      50: 'gray-50',
      100: 'gray-100',
      200: 'gray-200',
      300: 'gray-300',
      400: 'gray-400',
      500: 'gray-500',
      600: 'gray-600',
      700: 'gray-700',
      800: 'gray-800',
      900: 'gray-900',
    },
  },

  typography: {
    h1: 'text-2xl sm:text-3xl font-bold text-gray-900',
    h2: 'text-xl sm:text-2xl font-bold text-gray-900',
    h3: 'text-lg sm:text-xl font-semibold text-gray-900',
    h4: 'text-base sm:text-lg font-semibold text-gray-900',
    body: 'text-sm sm:text-base text-gray-700',
    bodySmall: 'text-xs sm:text-sm text-gray-600',
    caption: 'text-xs text-gray-500',
    label: 'text-sm font-medium text-gray-700',
  },

  spacing: {
    section: 'py-6 sm:py-8',
    card: 'p-4 sm:p-6',
    cardSmall: 'p-3 sm:p-4',
    container: 'px-4 sm:px-6 lg:px-8',
    gap: 'gap-4 sm:gap-6',
    gapSmall: 'gap-2 sm:gap-3',
  },

  layout: {
    container: 'max-w-7xl mx-auto',
    containerSmall: 'max-w-4xl mx-auto',
    minHeight: 'min-h-screen',
    background: 'bg-gradient-to-br from-gray-50 to-gray-100',
  },

  components: {
    card: {
      base: 'bg-white rounded-lg shadow-sm border border-gray-200 transition-all duration-200',
      hover: 'hover:shadow-md hover:border-gray-300',
      interactive: 'cursor-pointer hover:shadow-md hover:border-gray-300',
    },
    button: {
      primary: 'bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed',
      secondary: 'bg-white text-gray-700 px-4 py-2 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200',
      danger: 'bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors duration-200',
      success: 'bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors duration-200',
      ghost: 'text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors duration-200',
      icon: 'p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200',
      small: 'px-3 py-1.5 text-sm',
      large: 'px-6 py-3 text-base',
    },
    badge: {
      success: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200',
      warning: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200',
      error: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200',
      info: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200',
      neutral: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200',
      purple: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200',
    },
    input: {
      base: 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200',
      error: 'border-red-300 focus:ring-red-500',
    },
    header: {
      base: 'bg-white shadow-sm sticky top-0 z-40',
      container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4',
      title: 'text-2xl font-bold text-gray-900',
      subtitle: 'text-sm text-gray-600',
    },
    nav: {
      container: 'border-t border-gray-200 bg-gray-50',
      wrapper: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
      menu: 'flex gap-1 overflow-x-auto scrollbar-hide',
      item: {
        base: 'flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap',
        active: 'border-primary-600 text-primary-600',
        inactive: 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300',
      },
    },
    loading: {
      spinner: 'animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600',
      container: 'min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100',
    },
    stat: {
      container: 'bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6',
      label: 'text-sm text-gray-600 mb-1',
      value: 'text-2xl sm:text-3xl font-bold text-gray-900',
      icon: 'w-8 h-8 sm:w-10 sm:h-10',
    },
  },

  statusColors: {
    PENDING: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-200',
      full: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    CONFIRMED: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
      full: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    IN_PROGRESS: {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-200',
      full: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    COMPLETED: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200',
      full: 'bg-green-100 text-green-800 border-green-200',
    },
    CANCELLED: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-200',
      full: 'bg-red-100 text-red-800 border-red-200',
    },

  },

  statusLabels: {
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmada',
    IN_PROGRESS: 'En progreso',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
  },

  animations: {
    fadeIn: 'animate-fade-in',
    slideUp: 'animate-slide-up',
    slideDown: 'animate-slide-down',
    scaleIn: 'animate-scale-in',
  },

  responsive: {
    hideOnMobile: 'hidden sm:block',
    hideOnDesktop: 'block sm:hidden',
    showOnMobile: 'block sm:hidden',
    showOnDesktop: 'hidden sm:block',
    flexCol: 'flex flex-col',
    flexColSm: 'flex flex-col sm:flex-row',
    gridCols1: 'grid grid-cols-1',
    gridCols2: 'grid grid-cols-1 sm:grid-cols-2',
    gridCols3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    gridCols4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  },
}

export const getStatusClasses = (status: string): string => {
  return DESIGN_SYSTEM.statusColors[status as keyof typeof DESIGN_SYSTEM.statusColors]?.full || DESIGN_SYSTEM.statusColors.PENDING.full
}

export const getStatusLabel = (status: string): string => {
  return DESIGN_SYSTEM.statusLabels[status as keyof typeof DESIGN_SYSTEM.statusLabels] || status
}
