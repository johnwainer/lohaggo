import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { partnerShareUrl } from '@/lib/partners/share-url'

export const runtime = 'nodejs'

const SIZE = { width: 1080, height: 1920 }

/**
 * A 9:16 image of the partner's public profile for WhatsApp/Instagram statuses: photo, name, services,
 * rating and a QR to the profile (tagged as shared by the partner). Public, like the profile itself.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const partner = await prisma.partnerProfile.findUnique({
    where: { slug },
    select: {
      slug: true, isPublicProfile: true, verified: true, rating: true, totalReviews: true, completedServicesCount: true, profileHeadline: true,
      user: { select: { name: true, image: true } },
      services: { where: { active: true }, select: { service: { select: { name: true, icon: true } } }, take: 4, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!partner || !partner.isPublicProfile || !partner.slug) return new Response('Perfil no encontrado', { status: 404 })

  const url = partnerShareUrl(partner.slug, 'imagen')
  const qr = await QRCode.toDataURL(url, { width: 420, margin: 1, color: { dark: '#1e1b4b', light: '#ffffff' } })
  const name = partner.user.name ?? 'Socio LoHaggo'
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
  const photo = partner.user.image && /^https:\/\//.test(partner.user.image) ? partner.user.image : null
  const rating = partner.totalReviews > 0 ? `${partner.rating.toFixed(1).replace('.', ',')} de 5 · ${partner.totalReviews} ${partner.totalReviews === 1 ? 'reseña' : 'reseñas'}` : null
  const jobs = partner.completedServicesCount > 0 ? `${partner.completedServicesCount} servicios hechos` : null

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'linear-gradient(160deg, #4338ca 0%, #6d28d9 45%, #ea580c 100%)', padding: '110px 80px', color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, letterSpacing: -1 }}>LoHaggo</div>
        <div style={{ display: 'flex', fontSize: 30, opacity: 0.9, marginTop: 6 }}>Profesionales verificados</div>

        <div style={{ display: 'flex', marginTop: 90, width: 300, height: 300, borderRadius: 150, border: '10px solid white', background: '#ede9fe', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={photo} width={300} height={300} style={{ objectFit: 'cover' }} alt="" />
            : <div style={{ display: 'flex', fontSize: 120, fontWeight: 800, color: '#4338ca' }}>{initials || 'L'}</div>}
        </div>

        <div style={{ display: 'flex', marginTop: 40, fontSize: 72, fontWeight: 800, textAlign: 'center', lineHeight: 1.1 }}>{name}</div>
        {partner.profileHeadline && (
          <div style={{ display: 'flex', marginTop: 18, fontSize: 36, textAlign: 'center', opacity: 0.95, maxWidth: 900 }}>{partner.profileHeadline.slice(0, 80)}</div>
        )}
        <div style={{ display: 'flex', marginTop: 24, gap: 18, fontSize: 32, fontWeight: 700 }}>
          {partner.verified && <div style={{ display: 'flex', background: 'rgba(255,255,255,0.2)', borderRadius: 40, padding: '10px 26px' }}>Verificado</div>}
          {rating && <div style={{ display: 'flex', background: 'rgba(255,255,255,0.2)', borderRadius: 40, padding: '10px 26px' }}>{rating}</div>}
          {!rating && jobs && <div style={{ display: 'flex', background: 'rgba(255,255,255,0.2)', borderRadius: 40, padding: '10px 26px' }}>{jobs}</div>}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 44, maxWidth: 920 }}>
          {partner.services.map((s) => (
            <div key={s.service.name} style={{ display: 'flex', background: 'white', color: '#312e81', borderRadius: 40, padding: '14px 30px', fontSize: 34, fontWeight: 700 }}>
              {s.service.name}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', background: 'white', borderRadius: 48, padding: '36px 56px', color: '#1e1b4b' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={340} height={340} alt="" />
          <div style={{ display: 'flex', marginTop: 16, fontSize: 38, fontWeight: 800 }}>Pídeme tu servicio aquí</div>
          <div style={{ display: 'flex', marginTop: 6, fontSize: 28, color: '#4b5563' }}>{`lohaggo.com/pro/${partner.slug}`}</div>
        </div>
      </div>
    ),
    { ...SIZE, headers: { 'Cache-Control': 'public, max-age=600' } },
  )
}
