import ServiceDetailClient from './ServiceDetailClient'

export function generateStaticParams() {
  return []
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ServiceDetailClient slug={slug} />
}
