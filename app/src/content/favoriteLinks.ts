export interface FavoriteLink {
  label: string
  url: string
  note?: string
}

export interface LinkGroup {
  title: string
  links: FavoriteLink[]
}

// No built-in default links — the Home tab shows nothing until HOME_LINK_0_* (see /api/home-links) is set.
export const linkGroups: LinkGroup[] = []

export const repoLink: FavoriteLink = {
  label: 'live-home-page (this project)',
  url: 'https://github.com/shesselink81/live-home-page',
}
