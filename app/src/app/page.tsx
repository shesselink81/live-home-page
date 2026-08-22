import Dashboard from '@/components/Dashboard'

export default function Page() {
  const title = process.env.APP_TITLE ?? 'Used IT Tech @ Home'
  return <Dashboard title={title} />
}
