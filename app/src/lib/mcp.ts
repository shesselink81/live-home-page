import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const CALL_TIMEOUT_MS = 5_000

/**
 * Connects to an MCP server over Streamable HTTP, calls one tool, then disconnects.
 * Servers used here run stateless, so a fresh connection per call is the intended pattern.
 */
export async function callMcpTool<T = unknown>(
  url: string,
  tool: string,
  args: Record<string, unknown> = {},
  headers?: Record<string, string>
): Promise<T> {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) },
  })
  const client = new Client({ name: 'live-home-page-dashboard', version: '1.0.0' })

  try {
    await client.connect(transport)
    const result = await client.callTool({ name: tool, arguments: args })
    if (result.isError) {
      throw new Error(extractText(result.content) || `MCP tool "${tool}" returned an error`)
    }
    return result as T
  } finally {
    await client.close().catch(() => {})
  }
}

function extractText(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined
  const textBlock = content.find((c) => c && typeof c === 'object' && 'text' in c) as
    | { text?: string }
    | undefined
  return textBlock?.text
}

export interface McpToolResult {
  content?: { type: string; text?: string }[]
  structuredContent?: { items?: Record<string, unknown>[] }
}

export function toolText(result: McpToolResult): string {
  return result.content?.find((c) => c.type === 'text')?.text ?? ''
}

export function toolItems<T = Record<string, unknown>>(result: McpToolResult): T[] {
  return (result.structuredContent?.items as T[] | undefined) ?? []
}

/**
 * Parses a kubectl-style whitespace-aligned text table (columns separated by
 * 2+ spaces) into row objects keyed by header name. Used for tools that don't
 * return structuredContent (e.g. nodes_top, pods_list).
 */
export function parseTable(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const header = lines[0]
  const cols: { name: string; start: number }[] = []
  const headerRe = /\S+(?:\s\S+)*?(?=\s{2,}|$)/g
  let m: RegExpExecArray | null
  while ((m = headerRe.exec(header))) {
    cols.push({ name: m[0], start: m.index })
  }
  return lines.slice(1).map((line) => {
    const row: Record<string, string> = {}
    cols.forEach((col, i) => {
      const end = i + 1 < cols.length ? cols[i + 1].start : line.length
      row[col.name] = line.slice(col.start, end).trim()
    })
    return row
  })
}
