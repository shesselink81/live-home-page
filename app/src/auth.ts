import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'

// SSO is entirely optional — the app runs exactly as before (LAN restriction
// only, see middleware.ts) unless all three Entra ID values are set.
export const SSO_ENABLED = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
)

const ALLOWED_EMAILS = (process.env.AUTH_ALLOWED_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: SSO_ENABLED
    ? [
        MicrosoftEntraID({
          clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
          clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
          issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
        }),
      ]
    : [],
  // Never Vercel/Cloudflare Pages — always self-hosted behind Traefik or
  // plain Docker port-publishing, so the host must always be trusted.
  trustHost: true,
  session: { strategy: 'jwt' },
  // Harmless placeholder when SSO is disabled: no session is ever created or
  // verified in that case (middleware.ts never wraps with `auth()`), so this
  // value is never actually used to sign or verify anything.
  secret: process.env.AUTH_SECRET ?? 'unused-when-sso-disabled',
  callbacks: {
    signIn({ user }) {
      // Empty allowlist = any account in the tenant may sign in (the tenant
      // itself is already the boundary via the Entra ID app registration).
      if (ALLOWED_EMAILS.length === 0) return true
      return ALLOWED_EMAILS.includes((user.email ?? '').toLowerCase())
    },
  },
})
