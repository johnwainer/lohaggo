'use client'

import { Facebook, Twitter, Linkedin, Link as LinkIcon } from 'lucide-react'
import { useState } from 'react'

interface SocialShareProps {
  url?: string
  title?: string
  description?: string
}

export default function SocialShare({ url, title, description }: SocialShareProps) {
  const [copied, setCopied] = useState(false)
  
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
  const shareTitle = title || 'LoHaggo - Servicios Profesionales en Colombia'
  const shareDescription = description || 'Contrata servicios profesionales en Colombia'

  const handleShare = (platform: string) => {
    let shareLink = ''
    
    switch (platform) {
      case 'facebook':
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
        break
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`
        break
      case 'linkedin':
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
        break
      case 'copy':
        navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
    }
    
    if (shareLink) {
      window.open(shareLink, '_blank', 'width=600,height=400')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-600">Compartir:</span>
      <button
        onClick={() => handleShare('facebook')}
        className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        aria-label="Compartir en Facebook"
      >
        <Facebook className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleShare('twitter')}
        className="p-2 rounded-full bg-sky-500 hover:bg-sky-600 text-white transition-colors"
        aria-label="Compartir en Twitter"
      >
        <Twitter className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleShare('linkedin')}
        className="p-2 rounded-full bg-blue-700 hover:bg-blue-800 text-white transition-colors"
        aria-label="Compartir en LinkedIn"
      >
        <Linkedin className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleShare('copy')}
        className="p-2 rounded-full bg-gray-600 hover:bg-gray-700 text-white transition-colors relative"
        aria-label="Copiar enlace"
      >
        <LinkIcon className="w-4 h-4" />
        {copied && (
          <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            ¡Copiado!
          </span>
        )}
      </button>
    </div>
  )
}
