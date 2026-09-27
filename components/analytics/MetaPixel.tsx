'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense, useRef } from 'react'

declare global {
    interface Window {
        fbq: any
    }
}


export const pageview = () => {
    if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'PageView')
    }
}

export const trackEvent = (name: string, options = {}) => {
    if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', name, options)
    }
}

function MetaPixelContent({ pixelId }: { pixelId: string | null }) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const lastTrackedUrl = useRef('')

    useEffect(() => {
        // Combinamos la ruta con los parámetros para identificar la URL completa exacta
        const currentUrl = pathname + searchParams.toString()

        // Solo disparamos el evento si la URL es "nueva" respecto a la anterior
        if (currentUrl !== lastTrackedUrl.current) {
            lastTrackedUrl.current = currentUrl
            pageview()
        }
    }, [pathname, searchParams])

    if (!pixelId || !/^\d+$/.test(pixelId)) return null

    return (
        <Script
            id="fb-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
                __html: `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `,
            }}
        />
    )
}

/** The pixel id comes from Analítica → Conversiones (or the old env var), read by the server layout. */
export default function MetaPixel({ pixelId }: { pixelId: string | null }) {
    return (
        <Suspense fallback={null}>
            <MetaPixelContent pixelId={pixelId} />
        </Suspense>
    )
}
