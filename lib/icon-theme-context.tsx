'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { IconTheme } from '@/lib/icon-themes'

type IconThemeContextValue = {
  theme: IconTheme
  setTheme: (theme: IconTheme) => void
  saving: boolean
}

const IconThemeContext = createContext<IconThemeContextValue>({
  theme: 'emoji',
  setTheme: () => {},
  saving: false,
})

export function IconThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<IconTheme>('emoji')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/icon-theme')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.theme) setThemeState(data.theme) })
      .catch(() => {})
  }, [])

  const setTheme = useCallback(async (next: IconTheme) => {
    setSaving(true)
    setThemeState(next)
    try {
      await fetch('/api/icon-theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: next }),
      })
    } finally {
      setSaving(false)
    }
  }, [])

  return (
    <IconThemeContext.Provider value={{ theme, setTheme, saving }}>
      {children}
    </IconThemeContext.Provider>
  )
}

export function useIconTheme() {
  return useContext(IconThemeContext)
}
