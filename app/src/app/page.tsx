import Dashboard from '@/components/Dashboard'

// Without this, Next.js statically prerenders this route at `next build`
// time (see Dockerfile) — before APP_TITLE is ever set, since it's only
// injected at container runtime via docker-compose — baking in the
// hardcoded fallback title regardless of what APP_TITLE is set to later.
export const dynamic = 'force-dynamic'

export default function Page() {
  const title = process.env.APP_TITLE ?? 'Used IT Tech @ Home'
  return <Dashboard title={title} />
}
