'use client'

import useSWR from 'swr'
import type { LinkGroup, FavoriteLink } from '@/content/favoriteLinks'
import type { GithubRepo } from '@/app/api/cloud/github/route'

const REFRESH = 30_000

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
    return r.json()
  })

interface HomeLinksData {
  groups: LinkGroup[]
  repoLink: FavoriteLink
}

interface GithubData {
  ok: boolean
  repos?: GithubRepo[]
  error?: string
}

export default function HomeLinksTab() {
  const { data, error } = useSWR<HomeLinksData>('/api/home-links', fetcher)
  const { data: github } = useSWR<GithubData>('/api/cloud/github', fetcher, { refreshInterval: REFRESH })

  if (error) return <p className="text-red-400 text-sm">{String(error)}</p>
  if (!data) return <div className="animate-pulse h-40 bg-gray-800/50 rounded-xl" />

  return (
    <div className="space-y-6">
      {data.groups.map((group) => (
        <div key={group.title}>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{group.title}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.links.map((link) => (
              <LinkTile key={link.url} link={link} />
            ))}
          </div>
        </div>
      ))}

      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">GitHub repositories</p>
        {!github ? (
          <div className="animate-pulse h-16 bg-gray-800/50 rounded-lg" />
        ) : !github.ok ? (
          <div className="text-sm">
            <p className="text-yellow-400">Not reachable from this environment</p>
            {github.error && <p className="text-gray-600 text-xs mt-1 font-mono">{github.error}</p>}
          </div>
        ) : !github.repos?.length ? (
          <p className="text-gray-500 text-sm">No repositories returned</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {github.repos.map((repo) => (
              <a
                key={repo.full_name}
                href={repo.html_url}
                target="_blank"
                rel="noreferrer"
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-blue-500 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white font-semibold truncate">{repo.name}</p>
                  <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border ${repo.private ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700' : 'bg-green-900/40 text-green-300 border-green-700'}`}>
                    {repo.private ? 'Private' : 'Public'}
                  </span>
                </div>
                {repo.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{repo.description}</p>}
                <p className="text-gray-600 text-xs mt-2">{repo.language ?? 'Unknown'}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LinkTile({ link }: { link: FavoriteLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-blue-500 transition-colors"
    >
      <p className="text-white font-semibold truncate">{link.label}</p>
      {link.note && <p className="text-gray-500 text-xs mt-1">{link.note}</p>}
      <p className="text-gray-600 text-xs mt-2 truncate font-mono">{link.url}</p>
    </a>
  )
}
