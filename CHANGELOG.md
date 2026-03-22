# Changelog

## v3 — Exit Gate + Rich Session Capture (2026-03-22)

### New Features

- **Exit Gate (`export_session` MCP tool)** — Agents dump full session context before ending: summary, decisions, bugs, patterns, learnings, files touched, next steps. Creates a rich composite memory + individual typed memories.
- **Rich session capture** — `syncmind session end` now captures 8 signals instead of 3:
  - Git commits (last 2 hours)
  - File diffs with names
  - Uncommitted changes (staged vs unstaged breakdown)
  - Branch name + ahead/behind remote
  - Recently modified files (excludes build artifacts)
  - Dependency changes from package.json
  - Error logs from .next/trace
  - Works without git (filesystem-only fallback)
- **`/api/memories/export` endpoint** — REST API for the Exit Gate
- **`/api/sync` GET endpoint** — Activity feed via REST (`?action=activities`)
- **`syncmind hooks` command** — Installs Exit Gate instructions into CLAUDE.md, .cursor/rules/syncmind.mdc, AGENTS.md, .windsurfrules, plus git hooks and IDE session hooks
- **`--source` / `-s` flag** for `syncmind session end` — Explicitly pass which IDE triggered the session

### Improvements

- **Better project detection** — Falls back through: git remote → git toplevel → cwd basename (3 fallbacks instead of 1)
- **Better source detection** — Checks more env vars including `TERM_PROGRAM=Claude`
- **Windows compatibility** — All git commands use `stdio:['pipe','pipe','pipe']` for proper error handling; PowerShell commands for file discovery
- **Cross-platform Stop hook** — Updated Claude Code Stop hook to pass `--source` and use robust project detection
- **Build artifact filtering** — Recently modified files excludes `.next/`, `dist/`, `build/`, `coverage/`, `node_modules/`

### API

- `POST /api/memories/export` — Session export with structured fields (summary, decisions, bugs, patterns, learnings, files_touched, next_steps)
- `GET /api/sync?action=activities` — Fetch recent activity log entries

## v2 — SyncMind Core (2026-03-20)

- Initial release: shared persistent memory for AI coding agents
- PowerSync local-first dashboard with real-time sync
- Neon Postgres with full-text search + pg_trgm dedup
- MCP server with read/write/bump/delete tools
- CLI with 9 commands: install, status, write, search, capture, session, hooks, restart, pull
- Auto-capture from 13 source types
- Freshness scoring, confidence levels, scoped visibility
