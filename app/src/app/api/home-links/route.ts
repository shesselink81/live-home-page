import { NextResponse } from 'next/server'
import { linkGroups as defaultGroups, repoLink as defaultRepoLink, type LinkGroup, type FavoriteLink } from '@/content/favoriteLinks'

const MAX_LINKS = 200

/**
 * Reads HOME_LINK_<N>_TITLE/_LABEL/_URL/_NOTE (NOTE optional) for N = 0..MAX_LINKS,
 * grouping entries that share the same TITLE into one group, in first-seen order.
 * A gap (missing TITLE/LABEL/URL at some N) is skipped, not treated as the end.
 */
function parseGroups(): LinkGroup[] {
  const groups: LinkGroup[] = []
  const groupByTitle = new Map<string, LinkGroup>()

  for (let i = 0; i < MAX_LINKS; i++) {
    const title = process.env[`HOME_LINK_${i}_TITLE`]
    const label = process.env[`HOME_LINK_${i}_LABEL`]
    const url = process.env[`HOME_LINK_${i}_URL`]
    if (!title || !label || !url) continue

    const note = process.env[`HOME_LINK_${i}_NOTE`]
    let group = groupByTitle.get(title)
    if (!group) {
      group = { title, links: [] }
      groupByTitle.set(title, group)
      groups.push(group)
    }
    group.links.push(note ? { label, url, note } : { label, url })
  }

  return groups.length > 0 ? groups : defaultGroups
}

function parseRepoLink(): FavoriteLink {
  const raw = process.env.HOME_REPO_LINK
  if (!raw) return defaultRepoLink
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && parsed.url ? parsed : defaultRepoLink
  } catch {
    return defaultRepoLink
  }
}

export async function GET() {
  return NextResponse.json({ groups: parseGroups(), repoLink: parseRepoLink() })
}
