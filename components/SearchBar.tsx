'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight } from 'lucide-react'

export default function SearchBar() {
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      router.push(`/servicios?search=${encodeURIComponent(searchTerm.trim())}`)
    } else {
      router.push('/servicios')
    }
  }

  return (
    <form onSubmit={handleSearch}>
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl p-2 md:p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 hover:shadow-3xl transition-shadow">
        <div className="flex items-center gap-2 md:gap-3 flex-1">
          <Search className="w-5 h-5 md:w-6 md:h-6 text-gray-400 ml-3 md:ml-4 flex-shrink-0" />
          <input
            type="text"
            placeholder="¿Qué servicio buscas?"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-2 md:px-4 py-3 md:py-5 text-gray-800 placeholder-gray-400 focus:outline-none text-base md:text-lg font-medium min-w-0"
          />
        </div>
        <button 
          type="submit"
          className="bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white px-6 md:px-10 py-3 md:py-5 rounded-xl md:rounded-2xl font-bold transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg flex-shrink-0"
        >
          <span>Buscar</span>
          <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>
    </form>
  )
}
