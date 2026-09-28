import { Heart } from 'lucide-react'

export function FavoriteHeartButton({
  isFavorite,
  isLoading,
  isLoggedIn,
  onClick,
}: {
  isFavorite: boolean
  isLoading: boolean
  isLoggedIn: boolean
  onClick?: (e: React.MouseEvent) => void
}) {
  const label = !isLoggedIn ? 'Inicia sesión para guardar en favoritos' : isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      aria-label={label}
      className={`-mr-1 -mt-1 flex h-11 w-11 items-center justify-center rounded-full transition-colors md:mr-0 md:mt-0 ${
        isFavorite ? 'text-primary-600 hover:bg-primary-50' : 'text-gray-400 hover:bg-gray-100'
      } ${isLoading ? 'opacity-50' : ''}`}
      title={!isLoggedIn ? 'Inicia sesión para agregar a favoritos' : isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
    >
      <Heart className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
    </button>
  )
}
