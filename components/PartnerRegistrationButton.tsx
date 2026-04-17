'use client'

import { useSession, signOut } from 'next-auth/react'
import { ArrowRight } from 'lucide-react'

export default function PartnerRegistrationButton() {
  const { data: session } = useSession()

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    
    if (session?.user?.role === 'PARTNER') {
      window.location.href = '/profile'
      return
    }
    
    if (session) {
      await signOut({ redirect: false })
    }
    
    window.location.href = '/unete'
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 bg-white text-primary-600 px-10 py-5 rounded-2xl hover:bg-gray-100 transition-all font-black text-lg shadow-2xl hover:shadow-3xl transform hover:scale-105"
    >
      Regístrate como socio
      <ArrowRight className="w-5 h-5" />
    </button>
  )
}
