export const DESIGN_SYSTEM = {
  colors: {
    primary: {
      main: 'primary-600',
      hover: 'primary-700',
      light: 'primary-50',
      bg: 'primary-100',
    },
    secondary: {
      main: 'secondary-500',
      hover: 'secondary-600',
      light: 'secondary-50',
      bg: 'secondary-100',
    },
    success: {
      main: 'emerald-600',
      hover: 'emerald-700',
      light: 'emerald-50',
      bg: 'emerald-100',
      text: 'emerald-800',
      border: 'emerald-200',
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
      secondary: 'bg-secondary-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-secondary-600 transition-colors duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed',
      success: 'bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors duration-200',
      outline: 'bg-white text-gray-700 px-4 py-2 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors duration-200',
      ghost: 'text-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors duration-200',
      danger: 'bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors duration-200',
      icon: 'p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200',
      small: 'px-3 py-1.5 text-sm',
      large: 'px-6 py-3 text-base',
    },
    badge: {
      primary: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 border border-primary-200',
      secondary: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800 border border-secondary-200',
      success: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200',
      neutral: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200',
    },
// ... existing code ...
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
      bg: 'bg-secondary-100',
      text: 'text-secondary-800',
      border: 'border-secondary-200',
      full: 'bg-secondary-100 text-secondary-800 border-secondary-200',
      icon: 'text-secondary-600',
      cardBorder: 'border-secondary-500',
    },
    CONFIRMED: {
      bg: 'bg-primary-100',
      text: 'text-primary-800',
      border: 'border-primary-200',
      full: 'bg-primary-100 text-primary-800 border-primary-200',
      icon: 'text-primary-600',
      cardBorder: 'border-primary-500',
    },
    IN_PROGRESS: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      full: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: 'text-gray-600',
      cardBorder: 'border-gray-500',
    },
    COMPLETED: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      full: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: 'text-emerald-600',
      cardBorder: 'border-emerald-500',
    },
    CANCELLED: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      border: 'border-gray-200',
      full: 'bg-gray-100 text-gray-700 border-gray-200',
      icon: 'text-gray-500',
      cardBorder: 'border-gray-400',
    },
    ACTIVE: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      full: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: 'text-emerald-600',
      cardBorder: 'border-emerald-500',
    },
    ACCEPTED: {
      bg: 'bg-primary-100',
      text: 'text-primary-800',
      border: 'border-primary-200',
      full: 'bg-primary-100 text-primary-800 border-primary-200',
      icon: 'text-primary-600',
      cardBorder: 'border-primary-500',
    },
    EXPIRED: {
      bg: 'bg-gray-100',
      text: 'text-gray-600',
      border: 'border-gray-200',
      full: 'bg-gray-100 text-gray-600 border-gray-200',
      icon: 'text-gray-500',
      cardBorder: 'border-gray-400',
    },
  },

  statusLabels: {
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmada',
    IN_PROGRESS: 'En progreso',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    ACTIVE: 'Activa',
    ACCEPTED: 'Aceptada',
    EXPIRED: 'Expirada',
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
