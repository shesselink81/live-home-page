import { NextResponse } from 'next/server'
import { callMcpTool } from '@/lib/mcp'

const URL_ = process.env.MCP_GITHUB_URL ?? 'http://localhost:8082/mcp'
const TOKEN = process.env.MCP_GITHUB_TOKEN
const QUERY = process.env.MCP_GITHUB_QUERY ?? 'user:shesselink81'

interface ToolResult {
  content?: { type: string; text?: string }[]
}

export interface GithubRepo {
  name: string
  full_name: string
  html_url: string
  description: string | null
  language: string | null
  private: boolean
  updated_at: string
}

export async function GET() {
  if (!TOKEN) {
    return NextResponse.json({ ok: false, error: 'MCP_GITHUB_TOKEN is not configured' })
  }

  try {
    const result = await callMcpTool<ToolResult>(
      URL_,
      'search_repositories',
      { query: QUERY, sort: 'updated', order: 'desc', minimal_output: true },
      { Authorization: `Bearer ${TOKEN}` }
    )
    const text = result.content?.find((c) => c.type === 'text')?.text ?? ''
    const parsed = JSON.parse(text)
    const items = Array.isArray(parsed) ? parsed : (parsed.items ?? [])
    const repos: GithubRepo[] = items.map((r: Record<string, unknown>) => ({
      name: String(r.name ?? ''),
      full_name: String(r.full_name ?? r.name ?? ''),
      html_url: String(r.html_url ?? `https://github.com/${r.full_name ?? ''}`),
      description: (r.description as string | null) ?? null,
      language: (r.language as string | null) ?? null,
      private: Boolean(r.private),
      updated_at: String(r.updated_at ?? ''),
    }))
    return NextResponse.json({ ok: true, repos })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'GitHub MCP server unreachable' })
  }
}
