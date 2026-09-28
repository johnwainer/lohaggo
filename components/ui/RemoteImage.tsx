import type { ImgHTMLAttributes } from 'react'

const CLOUDINARY_IMAGE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/
const TRANSFORM_SEGMENT = /^[a-z]{1,4}_[^/]*$/
const FILL_WIDTHS = [320, 480, 640, 828, 1080, 1200]

/** Adds a resize step after any transformation already in the URL (e.g. the Open Graph crop). */
export function cloudinaryResize(src: string, width: number) {
  const m = src.match(CLOUDINARY_IMAGE)
  if (!m) return src
  const parts = m[2].split('/')
  let i = 0
  while (i < parts.length - 1 && TRANSFORM_SEGMENT.test(parts[i])) i++
  parts.splice(i, 0, `c_limit,w_${width},f_auto,q_auto`)
  return m[1] + parts.join('/')
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> & {
  src: string
  alt: string
  /** Fixed-size image (avatars): 1x/2x candidates. */
  width?: number
  height?: number
  /** Image that fills its (relative) parent: responsive candidates driven by `sizes`. */
  fill?: boolean
  priority?: boolean
}

/**
 * Lazy, responsive image for listings. Cloudinary resizes and picks the format (f_auto), so it
 * needs no image optimizer and, unlike next/image, adds no client JS to server-rendered pages.
 * Any other host is served as is.
 */
export function RemoteImage({ src, alt, width, height, fill, priority, sizes, className, style, ...rest }: Props) {
  const cloudinary = CLOUDINARY_IMAGE.test(src)
  let srcSet: string | undefined
  let finalSrc = src
  if (cloudinary) {
    if (fill) {
      srcSet = FILL_WIDTHS.map((w) => `${cloudinaryResize(src, w)} ${w}w`).join(', ')
      finalSrc = cloudinaryResize(src, FILL_WIDTHS[FILL_WIDTHS.length - 1])
    } else if (width) {
      srcSet = `${cloudinaryResize(src, width)} 1x, ${cloudinaryResize(src, width * 2)} 2x`
      finalSrc = cloudinaryResize(src, width)
    }
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      src={finalSrc}
      srcSet={srcSet}
      sizes={fill ? sizes ?? '100vw' : undefined}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
      style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', ...style } : style}
    />
  )
}
