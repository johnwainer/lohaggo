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
      <div className="bg-white rounded-3xl shadow-2xl p-3 flex items-center gap-3 hover:shadow-3xl transition-shadow">
        <Search className="w-6 h-6 text-gray-400 ml-4" />
        <input
          type="text"
          placeholder="¿Qué servicio buscas? Ej: Plomero, Electricista, Limpieza..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-5 text-gray-800 placeholder-gray-400 focus:outline-none text-lg font-medium"
        />
        <button 
          type="submit"
          className="bg-gradient-to-r from-[#FF2D55] to-[#FF6900] hover:from-[#FF1D45] hover:to-[#FF5900] text-white px-10 py-5 rounded-2xl font-bold transition-all transform hover:scale-105 flex items-center gap-2 shadow-lg"
        >
          Buscar
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </form>
  )
}
