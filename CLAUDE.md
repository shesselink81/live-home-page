<!-- claude-code-memory-bank:begin -->
# Memory bank (persistent context)

This repository uses a **memory bank** under `./memory-bank/` — structured markdown that survives sessions, similar to Cursor-style workflows.

Context layers (read deeper files after foundations): **projectbrief** → **productContext** / **systemPatterns** / **techContext** → **activeContext** → **progress**.

## What Claude should do

1. **Before substantive work**, read **all** of the following under `./memory-bank/` when the task depends on project state (not optional for non-trivial work). In **Plan mode**, reading for the plan is allowed; **do not edit** these files until **Act mode** unless the user only asked for a documentation/memory update with no code change.
   - `projectbrief.md` — scope and goals
   - `productContext.md` — product intent and UX
   - `systemPatterns.md` — architecture and conventions
   - `techContext.md` — stack and constraints
   - `progress.md` — done / pending / known issues
   - `activeContext.md` — current task and decisions

2. **During Act-mode work**, keep `activeContext.md` aligned with the current task (update when focus shifts).

3. **After meaningful milestones** (in Act mode), update `progress.md` and any affected docs in `./memory-bank/`.

4. When the user asks to **update memory bank** (or similar), **open and review every** file in `./memory-bank/`, then update what changed — especially `activeContext.md` and `progress.md`, even if other files are unchanged. Prefer doing heavy memory-bank writes in **Act mode** unless the user asked for documentation-only updates.

5. Prefer **short, factual updates** over long prose. Reference files, symbols, and tickets instead of duplicating code.

Do not delete these files; evolve them as the project changes.
<!-- claude-code-memory-bank:end -->
lients` | Local API `/stat/sta` — active wired + wireless clients |

### Key Files

- `src/lib/unifi.ts` — Both API clients (local + cloud) with all TypeScript types. Local API bypasses TLS verification via a scoped `https.Agent`.
- `src/lib/history.ts` — Singleton in-memory ring buffer. `pushPoint()` / `getHistory()` / `getRollingMaxLatency(windowMs)`.
- `src/lib/format.ts` — Shared formatters for uptime, bytes, rates, device labels.
- `src/app/page.tsx` — Top-level dashboard; owns all SWR fetches and passes data to components.

### Components

- `WanHealthCard` — ISP name/ASN, external IP, WAN uptime %, latency, issue badges
- `DeviceCard` — Per-device status, IP, uptime, firmware, TX/RX
- `ClientsTable` — Sortable/searchable table with VLAN color coding and signal strength
- `IspCharts` — Recharts line graphs (latency avg+max, WAN uptime %) with red shading for active issues

### Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json` and `next.config.ts`).

## Docker & CI/CD

- `Dockerfile` — Dev image (Node 26 Alpine, `npm run dev`)
- `Dockerfile.prod` — Multi-stage production build → standalone Next.js app; non-root user, port 4000
- `.github/workflows/release.yml` — Builds and pushes `ghcr.io/shesselink81/live-home-page` for `linux/amd64` + `linux/arm64` on `v*` tags (image name follows `github.repository` automatically)

## MCP Integration

`.mcp.json` wires Claude Code to both MCP servers via SSE:
- `http://localhost:3000/sse` (cloud tools: `get_isp_metrics`, `list_sites`, `get_site_health_summary`)
- `http://localhost:3001/sse` (local tools: devices, clients, firewall, DNS, WiFi)

Use `/mcp` in Claude Code to access these tools once the MCP containers are running.









































<!-- cloude-code-toolbox:mcp-skills-awareness-begin -->

### MCP & Skills awareness (Cloude Code ToolBox)

_Last synced: 2026-09-04T13:18:29.565Z._

- **Full report:** `.claude/cloude-code-toolbox-mcp-skills-awareness.md` in this workspace (auto-overwritten on each scan). Use it as ground truth for configured servers and skill folders.
- **MCP:** For **live tools** in Claude Code, enable the matching server via `/mcp`. Servers are configured in `~/.claude.json` (user) and `.mcp.json` (project).
- **When the user’s task matches a server** (e.g. Confluence work and a **Confluence** / **Atlassian** MCP is listed), **prefer that server id** and plan on tool use—not only file search.
- **Skills:** Folders below contain `SKILL.md`; attach or cite paths in chat when relevant.

#### Workspace MCP

- `d:\Users\Sander\repos\unifi-ai\.mcp.json` _(workspace: unifi-ai)_ — _servers defined_

| Server id | Kind | Detail |
|-----------|------|--------|
| unifi Local | stdio | unifi-mcp-server |
| unifi Cloud | stdio | unifi-mcp-server |
| cloudflare-api | http | https://mcp.cloudflare.com/mcp?codemode=false |

#### User MCP

- `C:\Users\shess\.claude.json` — _servers defined_

| Server id | Kind | Detail |
|-----------|------|--------|
| kubernetes | stdio | npx -y kubernetes-mcp-server@latest |
| context7 | http | https://mcp.context7.com/mcp |
| github | http | https://api.githubcopilot.com/mcp |

_Off (Toolbox stash):_ 

- **io.github.hashicorp/terraform-mcp-server** (stdio)

#### Project skills

_None found (or no workspace open)._

#### User skills

_None found._

<!-- cloude-code-toolbox:mcp-skills-awareness-end -->






<!-- claude-code-memory-bank:begin -->
# Memory bank (persistent context)

This repository uses a **memory bank** under `./memory-bank/` — structured markdown that survives sessions, similar to Cursor-style workflows.

Context layers (read deeper files after foundations): **projectbrief** → **productContext** / **systemPatterns** / **techContext** → **activeContext** → **progress**.

## What Claude should do

1. **Before substantive work**, read **all** of the following under `./memory-bank/` when the task depends on project state (not optional for non-trivial work). In **Plan mode**, reading for the plan is allowed; **do not edit** these files until **Act mode** unless the user only asked for a documentation/memory update with no code change.
   - `projectbrief.md` — scope and goals
   - `productContext.md` — product intent and UX
   - `systemPatterns.md` — architecture and conventions
   - `techContext.md` — stack and constraints
   - `progress.md` — done / pending / known issues
   - `activeContext.md` — current task and decisions

2. **During Act-mode work**, keep `activeContext.md` aligned with the current task (update when focus shifts).

3. **After meaningful milestones** (in Act mode), update `progress.md` and any affected docs in `./memory-bank/`.

4. When the user asks to **update memory bank** (or similar), **open and review every** file in `./memory-bank/`, then update what changed — especially `activeContext.md` and `progress.md`, even if other files are unchanged. Prefer doing heavy memory-bank writes in **Act mode** unless the user asked for documentation-only updates.

5. Prefer **short, factual updates** over long prose. Reference files, symbols, and tickets instead of duplicating code.

Do not delete these files; evolve them as the project changes.
<!-- claude-code-memory-bank:end -->





<!-- cloude-code-toolbox:cursorrules-begin -->

## Migrated from `.cursorrules` (via Cloude Code ToolBox)

# Cursor / Copilot shared hints (root rules)

- Keep answers concise.
- Match existing code style.

<!-- cloude-code-toolbox:cursorrules-end -->

<!-- cursor-rules-to-claude:always-begin -->
<!-- Generated by cursor-rules-to-claude — re-run after changing Cursor rules. -->

# Project instructions (from Cursor rules)

## .cursor/rules/core.mdc

<!-- Source: .cursor/rules/core.mdc -->
## Core rules — Plan / Act (match GitHub Copilot instructions)

You have two modes of operation:

1. **Plan mode** — Work with the user to define a plan; **do not change the codebase** until the user approves.
2. **Act mode** — Make changes based on the approved plan.

### Plan mode (default)

- **First line MUST be:** `# Mode: PLAN`
- **Do not** create, edit, or delete any files (including under the memory bank path), apply patches, or run terminal commands that modify the workspace—**only** read/search, discuss, and output the plan in markdown.
- Stay in Plan mode until the user explicitly approves (e.g. **`ACT`**).
- If the user asks for edits while in Plan mode, respond with `# Mode: PLAN`, remind them you need approval first, and ask them to type **`ACT`** when ready.
- In Plan mode, include the **full updated plan** in every response.
- End by telling the user to type **`ACT`** to implement (or refine the plan).

### Act mode

- **First line MUST be:** `# Mode: ACT`
- Enter only after clear approval (**`ACT`**, **"go ahead"**, **"implement the plan"**, or user explicitly skipped planning).
- Then you may edit files, run commands, and update documentation.
- After completing Act-mode work for that turn, the next user message starts in **Plan mode** again unless they send **`ACT`** for more edits.

### Exceptions

- If the user clearly says to **skip the plan** and implement immediately, you may use `# Mode: ACT` and proceed.

## .cursor/rules/memory-bank.mdc

<!-- Source: .cursor/rules/memory-bank.mdc -->
> Persistent project memory via markdown files (memory bank)

# Cursor memory bank

You are an AI assistant whose **session memory resets**. Treat the **memory bank** as the durable source of truth for project context. At the **start of every substantive task**, read **all** memory bank files under `./memory-bank/` — this is not optional when the task depends on project state.

## Memory bank structure

Core files (Markdown), in hierarchy order (all under `./memory-bank/`):

```mermaid
flowchart TD
    PB[projectbrief.md] --> PC[productContext.md]
    PB --> SP[systemPatterns.md]
    PB --> TC[techContext.md]

    PC --> AC[activeContext.md]
    SP --> AC
    TC --> AC

    AC --> P[progress.md]
```

### Core files (required)

1. `./memory-bank/projectbrief.md` — Scope, goals, source of truth for what “done” means.
2. `./memory-bank/productContext.md` — Why the product exists, problems solved, UX goals.
3. `./memory-bank/activeContext.md` — Current focus, recent changes, next steps, active decisions.
4. `./memory-bank/systemPatterns.md` — Architecture, technical decisions, patterns, component relationships.
5. `./memory-bank/techContext.md` — Stack, setup, constraints, dependencies.
6. `./memory-bank/progress.md` — What works, what is left, status, known issues.

### Additional context

Add files or subfolders under `./memory-bank/` when useful (integrations, APIs, testing, deployment, etc.).

## Workflows

### Plan mode

```mermaid
flowchart TD
    Start[Start] --> ReadFiles[Read memory bank]
    ReadFiles --> CheckFiles{Files complete?}

    CheckFiles -->|No| Plan[Create plan]
    Plan --> Document[Document in chat]

    CheckFiles -->|Yes| Verify[Verify context]
    Verify --> Strategy[Develop strategy]
    Strategy --> Present[Present approach]
```

### Act mode

```mermaid
flowchart TD
    Start[Start] --> Context[Check memory bank]
    Context --> Update[Update documentation]
    Update --> Rules[Update .cursor/rules if needed]
    Rules --> Execute[Execute task]
    Execute --> Document[Document changes]
```

## Documentation updates

Update the memory bank when:

1. You discover new project patterns.
2. You finish significant implementation work.
3. The user asks to **update memory bank** — then **review every** memory bank file (even if most need no edit). Pay extra attention to `activeContext.md` and `progress.md`.
4. Context is unclear and needs clarification.

```mermaid
flowchart TD
    Start[Update process]

    subgraph Process
        P1[Review ALL files]
        P2[Document current state]
        P3[Clarify next steps]
        P4[Update .cursor/rules if needed]
    end

    Start --> Process
```

## Project intelligence (`.cursor/rules`)

Use `.cursor/rules` as a **learning journal**: preferences, non-obvious patterns, tooling, and decisions that are not already captured in code or the memory bank.

```mermaid
flowchart TD
    Start{Discover new pattern}

    subgraph Learn [Learning process]
        D1[Identify pattern]
        D2[Validate with user]
        D3[Document in .cursor/rules]
    end

    subgraph Apply [Usage]
        A1[Read .cursor/rules]
        A2[Apply learned patterns]
        A3[Improve future work]
    end

    Start --> Learn
    Learn --> Apply
```

### What to capture

- Critical implementation paths and conventions
- User preferences and workflow
- Project-specific patterns and pitfalls
- How decisions evolved

**Remember:** after a reset, the memory bank (and `.cursor/rules`) is your continuity. Keep them accurate and concise.
<!-- cursor-rules-to-claude:always-end -->