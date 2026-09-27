import { permanentRedirect } from 'next/navigation'

/** The partner sign-up lives at /unete; this old URL only forwards there (308). */
export default function RegistroSociosPage() {
  permanentRedirect('/unete')
}
