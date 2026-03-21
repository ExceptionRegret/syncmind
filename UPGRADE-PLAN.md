# SyncMind v2 Upgrade Plan

## Schema Changes (migrate-v2.sql)

Add these columns to `memories` table:

```sql
ALTER TABLE memories ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMPTZ;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'speculative'; -- speculative, validated, auto
ALTER TABLE memories ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'project'; -- project, team, global
ALTER TABLE memories ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '';
```

Also add to PowerSync schema.ts: `used_count`, `last_accessed`, `confidence`, `scope`, `version`.

## 1. Decay & Freshness Scoring

- API: return `freshness` score (0-1) based on age + used_count + last_accessed
- Formula: `freshness = (recency_weight * recency) + (usage_weight * usage_score)`
- Dashboard: dim cards with low freshness, show "stale" badge on old unused memories
- MCP: sort results by freshness by default

## 2. Provenance & Trust

- `confidence` field: `speculative` (default), `validated` (confirmed by human/test), `auto` (from git hooks)
- Dashboard: show confidence badge on cards
- API: accept `confidence` on POST, filter by confidence on GET

## 3. Smart Dedup

- On POST /api/memories: check for similar content using Postgres `similarity()` (pg_trgm extension)
- If >80% similar memory exists from same project, update it instead of creating new
- Need: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` in migrate-v2.sql

## 4. Auto-Capture Endpoint

- POST /api/memories/auto — accepts git commit messages, test results, PR descriptions
- Parses and extracts learnings automatically
- Source: "git-hook", "ci", "pr-review"
- Example git hook: `git log -1 --format="%B" | curl -X POST .../api/memories/auto -d @-`

## 5. Scoped Visibility

- `scope` field: project, team, global
- GET /api/memories?scope=global returns cross-project memories
- Memories with scope=global visible in all projects

## 6. Bump on Read (used_count)

- GET /api/memories: increment `used_count` and `last_accessed` for returned memories
- Separate endpoint: POST /api/memories/:id/bump (so MCP can explicitly mark "I used this")

## 7. Dashboard Changes

- MemoryBrowser: show freshness bar, confidence badge, scope indicator
- StatsBar: add "stale memories" count, "most used" stat
- Color coding: fresh=bright, stale=dimmed, validated=green border, speculative=dashed border

## Files to Update

1. `lib/db/migrate-v2.sql` — new columns + pg_trgm extension
2. `lib/powersync/schema.ts` — add new columns
3. `app/api/memories/route.ts` — freshness scoring, dedup, bump, scope filter
4. `mcp-server/index.js` — return freshness, add bump tool
5. `components/dashboard/MemoryBrowser.tsx` — visual freshness, confidence, scope
6. `components/dashboard/StatsBar.tsx` — new stats
7. `app/api/sync/route.ts` — handle new columns in PowerSync sync

## Priority Order

1. Schema + API changes (freshness, confidence, scope, used_count)
2. Smart dedup on write
3. Dashboard visual updates
4. MCP server updates
5. Auto-capture endpoint (stretch)
