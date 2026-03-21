<p align="center">
  <img src="public/logo.svg" alt="SyncMind" width="80" height="80" />
</p>

<h1 align="center">SyncMind</h1>

<p align="center">
  <strong>Shared persistent memory for AI coding agents, synced in real-time.</strong>
  <br />
  <sub>Give your AI agents a shared brain — Claude Code, Cursor, Codex, Windsurf, and any MCP-compatible tool can read and write memories that persist across sessions, sync across agents, and stay fresh automatically. Built with Next.js 16, Neon Postgres, and PowerSync for local-first, offline-capable, real-time collaboration.</sub>
</p>

<p align="center">
  <a href="#demo">Demo</a> &middot;
  <a href="#the-problem">Problem</a> &middot;
  <a href="#how-it-works">How It Works</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#syncmind-cli">CLI</a> &middot;
  <a href="#mcp-server--one-command-install">MCP</a> &middot;
  <a href="#auto-capture-hooks">Hooks</a> &middot;
  <a href="#rest-api-reference">API</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/PowerSync-local--first-blue?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiPjwvc3ZnPg==" alt="PowerSync" />
  <img src="https://img.shields.io/badge/Neon-Postgres-green?logo=postgresql" alt="Neon Postgres" />
  <img src="https://img.shields.io/badge/MCP-compatible-violet" alt="MCP Compatible" />
  [![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?logo=github-sponsors)](https://github.com/sponsors/ExceptionRegret)
</p>

---

## Demo

<p align="center">
  <a href="https://github.com/ExceptionRegret/syncmind/raw/master/assets/video.mp4">
    <img src="assets/dashboard.png" alt="Watch Demo Video — click to download" width="800" />
  </a>
  <br />
  <sub>Click the image above to watch the demo video</sub>
</p>

---

## The Problem

AI coding agents work in **isolation**. Claude Code discovers a critical pattern in your codebase — that knowledge dies when the session ends. Codex finds a bug — the next agent repeats the same mistake. Switch between Cursor and Claude Code? They can't share what they've learned.

**There is no shared memory between AI agents.**

## The Solution

SyncMind gives AI agents a **shared brain**. Any agent writes a memory — every other agent reads it instantly.

```
Claude Code  ─── writes "auth middleware must run before DB queries" ───►  SyncMind
Codex        ─── reads shared memories before starting work           ◄──  SyncMind
Cursor       ─── writes "found race condition in webhook handler"     ───►  SyncMind
Human        ─── browses all memories in real-time dashboard          ◄──  SyncMind
Git hooks    ─── auto-captures learnings from commits/CI/tests       ───►  SyncMind
```

---

## Key Features

- **Freshness scoring** — Every memory gets a 0–1 score based on age, usage count, and recency of last access. Stale memories fade, active ones stay on top.
- **Smart dedup** — When you write a memory >80% similar to an existing one (pg_trgm), it merges instead of duplicating.
- **Bump on read** — Reading memories increments their usage counter, keeping frequently-used knowledge fresh.
- **Confidence levels** — `speculative` (default), `validated` (confirmed by human/test), `auto` (from git hooks/CI).
- **Scoped visibility** — `project` (default), `team`, or `global`. Global memories appear in all project queries.
- **Auto-capture** — 13 source types: git commits, diffs, CI logs, PR reviews, terminal errors, lint output, test results, deploy logs, chat threads, docs, browser console, dependency audits, and freeform text.
- **SyncMind CLI** — `syncmind` command for writing, searching, capturing, and managing from the terminal.
- **Auto-capture hooks** — Git post-commit, pre-push, Claude Code session end, VS Code folder close, terminal exit.
- **MCP compatible** — Works with Claude Code, Cursor, VS Code Copilot, Windsurf, and any MCP-compatible tool.
- **Offline support** — Dashboard works offline via local SQLite, syncs when reconnected.

---

## How It Works

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Claude Code │     │    Codex     │     │   Cursor     │
│  (MCP Tool)  │     │  (REST API)  │     │  (REST API)  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                    ┌───────▼────────┐
                    │   REST API     │
                    │ /api/memories  │
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │ Neon Postgres  │  ← Persistent storage + full-text search
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │   PowerSync    │  ← Real-time sync to all clients
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        ┌─────▼─────┐ ┌────▼─────┐ ┌─────▼─────┐
        │ Dashboard │ │ Tab 2    │ │ Mobile    │
        │ (SQLite)  │ │ (SQLite) │ │ (SQLite)  │
        └───────────┘ └──────────┘ └───────────┘
```

### Why PowerSync?

- **Real-time sync** — Memories written via API appear instantly in the dashboard (and vice versa)
- **Local-first** — Dashboard reads/writes to local SQLite, works offline
- **Multi-client** — Open on phone, laptop, multiple tabs — all stay in sync
- **Conflict-free** — PowerSync handles concurrent writes from multiple agents

---

## Memory Types

| Type | Color | Use Case |
|------|-------|----------|
| `learning` | Cyan | Something the agent learned about the codebase |
| `pattern` | Violet | A recurring pattern or convention discovered |
| `decision` | Emerald | An architectural or design decision made |
| `bug` | Red | A bug found and how it was fixed |
| `context` | Amber | Background context about the project |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A free [Neon](https://neon.tech) database
- A free [PowerSync](https://www.powersync.com) instance

### 1. Clone & Install

```bash
git clone https://github.com/ExceptionRegret/syncmind.git
cd syncmind
npm install
```

### 2. Set Up Neon Database

1. Create a free database at [neon.tech](https://neon.tech)
2. Open the **SQL Editor** and paste the contents of [`lib/db/migrate.sql`](lib/db/migrate.sql)
3. Run it — this creates the `memories` and `activity_log` tables

### 3. Set Up PowerSync

1. Create a free instance at [powersync.com](https://www.powersync.com)
2. Connect it to your Neon database
3. Add sync rules for the `memories` and `activity_log` tables:

```yaml
bucket_definitions:
  global:
    data:
      - SELECT * FROM memories
      - SELECT * FROM activity_log
```

### 4. Configure Environment

Create `.env.local`:

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
NEXT_PUBLIC_POWERSYNC_URL=https://your-instance.powersync.journeyapps.com
NEXT_PUBLIC_POWERSYNC_TOKEN=your-powersync-token
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll see the SyncMind dashboard.

---

## MCP Server — One-Command Install

SyncMind includes a global CLI. Install once, use from **any directory**, works with **any IDE**.

### First-time setup

```bash
cd mcp-server && npm install && npm link
```

This gives you two global commands: `syncmind` (CLI) and `syncmind-mcp` (MCP server).

### Install MCP into your IDE

```bash
syncmind install              # interactive — picks IDE, auto-detects URL
syncmind install --tool claude # non-interactive
syncmind install --tool all    # all IDEs at once
syncmind install --url https://my-syncmind.vercel.app  # custom URL
```

The URL is **auto-detected** from `.env.local`, `.mcp.json`, or defaults to `http://localhost:3000`.

### Check status

```bash
syncmind status    # checks server, MCP connection, global install
```

### Supported IDEs

| Command | What it does |
|---------|-------------|
| `syncmind i --tool claude` | Registers globally in Claude Code (`claude mcp add`) |
| `syncmind i --tool cursor` | Writes `.cursor/mcp.json` |
| `syncmind i --tool vscode` | Writes `.vscode/mcp.json` |
| `syncmind i --tool windsurf` | Writes `.windsurf/mcp.json` |
| `syncmind i --tool all` | All of the above + `.mcp.json` |

### MCP Tools

| Tool | Description |
|------|-------------|
| `read_memories` | Search & filter by source, project, type, scope, confidence. Returns freshness score. |
| `write_memory` | Save with auto-dedup, confidence level, scope. Reports merge on duplicates. |
| `bump_memory` | Explicitly mark a memory as used — boosts its freshness score. |
| `delete_memory` | Remove a memory by ID. |

---

## SyncMind CLI

The `syncmind` command is available globally after `npm link`.

```bash
# Setup
syncmind install              # install MCP into your IDE (interactive)
syncmind hooks                # set up auto-capture hooks (git, IDE, terminal)
syncmind status               # check server + MCP connections

# Read & Write
syncmind write "Always use ISR for product pages"
syncmind write -t bug "Auth breaks on empty cookies"
syncmind write -t pattern -s global "Use zod for all API validation"
syncmind search "auth pattern"

# Auto-Capture
syncmind capture              # auto from recent git commits
syncmind capture -t test      # run tests, capture failures
syncmind capture -t lint      # run linter, capture issues
syncmind capture -t deps      # npm audit, capture vulnerabilities
npm test | syncmind capture -t test --stdin   # pipe anything

# Session Lifecycle
syncmind session start        # show recent memories for context
syncmind session end          # capture commits, diffs, uncommitted work

# Maintenance
syncmind restart              # re-link MCP + re-register with IDEs
syncmind pull --restart       # git pull + reinstall + restart
```

---

## Auto-Capture Hooks

Run `syncmind hooks` to set up automatic memory capture:

| Hook | Trigger | What it captures |
|------|---------|-----------------|
| Git post-commit | Every commit | Commit messages parsed by type |
| Git pre-push | Before push | Session state snapshot |
| Claude Code Stop | Session exit | Last hour's commits, diffs, uncommitted files |
| VS Code task | Folder close | Session end capture |
| Terminal trap | Shell exit | Session end capture |

**For terminal auto-capture, add to `.bashrc` / `.zshrc`:**

```bash
trap 'syncmind session end 2>/dev/null' EXIT
```

**Auto-capture source types:** `git-hook`, `git-diff`, `ci`, `pr-review`, `terminal`, `lint`, `test`, `deploy`, `chat`, `doc`, `browser`, `deps`, `custom`

---

## Setup for Each IDE / Agent

### Claude Code

**Option A — Project-scoped** (add `.mcp.json` to any project):

```json
{
  "mcpServers": {
    "syncmind": {
      "type": "stdio",
      "command": "syncmind-mcp",
      "args": [],
      "env": { "SYNCMIND_URL": "http://localhost:3000" }
    }
  }
}
```

**Option B — Global** (available in all projects):

```bash
claude mcp add syncmind -s user syncmind-mcp
```

Then add to your project's `CLAUDE.md`:

```markdown
Before starting work, use read_memories to check for relevant patterns and context.
After completing a task, use write_memory to save what you learned.
```

### Cursor

Go to **Cursor Settings > MCP Servers > Add Server**:

```json
{
  "mcpServers": {
    "syncmind": {
      "command": "syncmind-mcp",
      "env": { "SYNCMIND_URL": "http://localhost:3000" }
    }
  }
}
```

Or create `.cursor/mcp.json` in your project root with the same config.

### VS Code (Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "syncmind": {
      "type": "stdio",
      "command": "syncmind-mcp",
      "env": { "SYNCMIND_URL": "http://localhost:3000" }
    }
  }
}
```

### Windsurf

Go to **Windsurf Settings > MCP** and add:

```json
{
  "mcpServers": {
    "syncmind": {
      "command": "syncmind-mcp",
      "env": { "SYNCMIND_URL": "http://localhost:3000" }
    }
  }
}
```

### Codex (OpenAI)

Add to your `codex.md` or project MCP config:

```json
{
  "mcpServers": {
    "syncmind": {
      "type": "stdio",
      "command": "syncmind-mcp",
      "args": [],
      "env": { "SYNCMIND_URL": "http://localhost:3000" }
    }
  }
}
```

### Any MCP-Compatible Tool

The `syncmind-mcp` binary speaks standard MCP over stdio. Any tool that supports MCP can use it:

```bash
SYNCMIND_URL=http://localhost:3000 syncmind-mcp
```

---

## Example: Cross-Agent Memory Sharing

```
1. Claude Code discovers a pattern:
   → write_memory("Auth middleware must run before DB queries", type="pattern", project="my-app")

2. Cursor picks up the pattern:
   → read_memories(project="my-app") → sees the auth pattern, follows it

3. You find a bug manually:
   → Dashboard: + New → "Login fails with uppercase emails" (type: bug, source: human)

4. Codex reads the bug:
   → GET /api/memories?type=bug&project=my-app → fixes it correctly

All memories sync in real-time across all tools via PowerSync.
```

---

## REST API Reference

### Write a Memory

```bash
curl -X POST http://localhost:3000/api/memories \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Always batch DB writes for performance",
    "source": "claude-code",
    "type": "pattern",
    "project": "my-app",
    "tags": ["database", "performance"]
  }'
```

**Required:** `content`, `source`
**Optional:** `type`, `project`, `tags`, `confidence` (`speculative` | `validated` | `auto`), `scope` (`project` | `team` | `global`)

Smart dedup: >80% similar content in the same project auto-merges.

### Read Memories

```bash
# All memories
curl http://localhost:3000/api/memories

# Full-text search
curl http://localhost:3000/api/memories?search=authentication

# Filter by source + project + type + scope + confidence
curl "http://localhost:3000/api/memories?source=claude-code&project=my-app&type=pattern&scope=global&confidence=validated&limit=10"

# Skip usage tracking
curl "http://localhost:3000/api/memories?search=auth&no_bump=true"
```

Returns `freshness` score (0–1) per memory. Bumps `used_count` on read by default.

### Bump a Memory

```bash
curl -X POST http://localhost:3000/api/memories/bump \
  -H "Content-Type: application/json" \
  -d '{"id": "uuid-here"}'
```

### Auto-Capture

```bash
curl -X POST http://localhost:3000/api/memories/auto \
  -H "Content-Type: application/json" \
  -d '{"text": "fix: handle null cookies", "source_type": "git-hook", "project": "my-app"}'
```

**`source_type`:** `git-hook`, `git-diff`, `ci`, `pr-review`, `terminal`, `lint`, `test`, `deploy`, `chat`, `doc`, `browser`, `deps`, `custom`

### Delete a Memory

```bash
curl -X DELETE http://localhost:3000/api/memories \
  -H "Content-Type: application/json" \
  -d '{"id": "uuid-here"}'
```

---

## Dashboard Features

- **Memory Browser** — Search, filter by type/source/scope, freshness bars, confidence badges, stale indicators, scope tags
- **Live Activity Feed** — Real-time log of all memory reads/writes/auto-captures
- **Stats Bar** — Total, Sources, Validated, Global, Stale, Most Used, Top Source, Patterns
- **Built-in Docs** — MCP setup, CLI reference, REST API — all accessible from the dashboard
- **Sync Status** — Live/Syncing/Offline indicator (PowerSync)
- **Offline Support** — Dashboard works offline, syncs when reconnected

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 | Modern React with server components |
| Local-First Sync | PowerSync (`@powersync/web`) | Real-time sync between SQLite and Postgres |
| Database | Neon Postgres (serverless) | Scalable, serverless Postgres with full-text search |
| MCP Server | Node.js (stdio transport) | Standard protocol for AI tool integration |

---

## Project Structure

```
syncmind/
├── app/
│   ├── api/
│   │   ├── memories/
│   │   │   ├── route.ts         # GET/POST/DELETE memories (freshness, dedup)
│   │   │   ├── bump/route.ts    # POST bump usage count
│   │   │   └── auto/route.ts    # POST auto-capture (13 source types)
│   │   └── sync/route.ts        # PowerSync upload handler
│   ├── layout.tsx               # Root layout with Geist fonts
│   ├── page.tsx                 # Dashboard page
│   └── globals.css              # Global styles
├── components/
│   ├── dashboard/
│   │   ├── Dashboard.tsx        # Main dashboard layout
│   │   ├── MemoryBrowser.tsx    # Memory search, filter, write UI
│   │   ├── ActivityFeed.tsx     # Live activity log
│   │   ├── StatsBar.tsx         # Memory statistics
│   │   ├── ApiDocs.tsx          # Built-in API documentation
│   │   └── SyncStatus.tsx       # PowerSync connection status
│   └── providers/
│       └── SystemProvider.tsx   # PowerSync database provider
├── lib/
│   ├── db/
│   │   ├── index.ts             # Neon database query helper
│   │   └── migrate.sql          # Full schema (run in Neon SQL Editor)
│   └── powersync/
│       ├── schema.ts            # PowerSync table definitions
│       └── connector.ts         # PowerSync backend connector
├── mcp-server/
│   ├── index.js                 # MCP server (4 tools, freshness, dedup)
│   ├── cli.js                   # SyncMind CLI (9 commands, auto-capture)
│   └── package.json             # npm package (syncmind + syncmind-mcp globals)
├── assets/
│   ├── dashboard.png            # Dashboard screenshot
│   └── video.mp4                # Demo video
└── public/
    └── logo.svg                 # SyncMind logo
```

---

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Prize Categories

| Category | How SyncMind Uses It |
|----------|---------------------|
| **PowerSync Core** | Real-time sync layer between AI agents (via API) and the dashboard (local SQLite). Memories written by Claude Code appear instantly in the browser. Dashboard writes sync back to Postgres. |
| **Best Use of Neon** | Neon Postgres as the persistent memory store. Full-text search via `tsvector/tsquery`. Serverless scaling for multiple concurrent agent connections. |
| **Best Local-First App** | Dashboard runs on local SQLite via PowerSync. Works fully offline — write memories without internet, they sync when reconnected. Multi-tab and multi-device support. |

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
