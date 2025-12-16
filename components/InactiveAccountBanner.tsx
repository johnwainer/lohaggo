'use client'

import { useSession } from 'next-auth/react'
import { AlertCircle } from 'lucide-react'

export default function InactiveAccountBanner() {
  const { data: session } = useSession()

  if (!session?.user) return null

  const isInactive = session.user.isActive === false

  if (!isInactive) return null

  return (
    <div className="bg-red-600 text-white py-3 px-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <AlertCircle size={20} />
        <p className="font-medium">
          Your account is inactive. You cannot perform actions on the platform. Contact the administrator for more information.
        </p>
      </div>
    </div>
  )
}
