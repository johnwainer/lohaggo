import { lookup } from 'dns/promises'
import { isIP } from 'net'

/** Loopback, private, link-local (cloud metadata), CGNAT, multicast/reserved and their IPv6 equivalents. */
export function isPrivateAddress(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  const v6 = ip.toLowerCase()
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7))
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb') || v6.startsWith('ff')
}

/** Outbound webhooks only to public https hosts: blocks SSRF towards the internal network. */
export async function assertPublicHttpsUrl(raw: string) {
  let url: URL
  try { url = new URL(raw) } catch { throw new Error('URL inválida') }
  if (url.protocol !== 'https:') throw new Error('El webhook debe usar https://')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Destino no permitido')
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error('Destino no permitido (red privada)')
  return url
}
