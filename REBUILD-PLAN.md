# SyncMind Rebuild Plan (Option B)

## Status: IN PROGRESS — Context ran out, continue in new conversation

## What's Done
- Next.js 16 app scaffolded and builds clean
- PowerSync schema, connector, provider
- Neon Postgres connected (sql.query works)
- API routes: /api/sync, /api/tasks, /api/agents/run, /api/approvals
- Mastra agents: Atlas (researcher), Nexus (summarizer), Forge (executor)
- Mastra tools: web-search, write-memory, request-approval
- Dashboard UI: AgentPanel, TaskBoard, ActivityFeed, MemoryExplorer, ApprovalQueue, SyncStatus
- All .env.local credentials configured by user

## What Needs Rebuilding (Option B)

### 1. PowerSync Client-Side Writes (CRITICAL for judges)
**Current:** Tasks created via fetch() to /api/tasks → Neon directly
**Needed:** Tasks written to LOCAL SQLite via `db.execute()` → PowerSync syncs to Neon

Change TaskBoard.tsx createTask:
```tsx
import { usePowerSync } from "@powersync/react";
const db = usePowerSync();
const id = uuid();
await db.execute(
  "INSERT INTO tasks (id, title, description, status, priority, assigned_by, created_at, updated_at) VALUES (?, ?, ?, 'pending', 0, 'human', ?, ?)",
  [id, title, description, now, now]
);
```

Update BackendConnector.uploadData to POST each CRUD op to /api/sync.

### 2. Agent Swarm Pipeline (CRITICAL for originality)
**Current:** Manual one-agent-at-a-time assignment
**Needed:** "Run Swarm" button that chains: Research → Summarize → Execute

Create /api/agents/swarm/route.ts:
- Takes a taskId
- Runs researcher agent first
- When done, auto-triggers summarizer (reads researcher's memories)
- When done, auto-triggers executor (reads all memories)
- Each step updates task status and activity_log

### 3. Agent Output Streaming
**Current:** Agent runs in background, no feedback until done
**Needed:** Activity feed polls or uses PowerSync to show progress in real-time

Add to runner.ts: write activity_log entries at each step (agent thinking, tool called, memory written, etc.)
The ActivityFeed already reads from activity_log via PowerSync — so if runner writes to Neon, PowerSync syncs it down automatically.

### 4. Multi-Tab Demo
PowerSync already handles this! Just need to demo:
- Open tab 1: create a task
- Open tab 2: task appears instantly (via PowerSync local SQLite sync)
- Assign agent in tab 1, watch status update in tab 2

### 5. README.md
Write a proper README with:
- Project description
- Screenshots
- Setup instructions
- Architecture diagram (text)
- Prize categories targeted
- Demo video link placeholder

## File Locations
- Project: C:/Users/saiga/OneDrive/Desktop/syncmind
- Build plan: BUILDPLAN.md
- Migration SQL: lib/db/migrate.sql
- PowerSync schema: lib/powersync/schema.ts
- Mastra agents: lib/mastra/agents/
- Dashboard: components/dashboard/
- API routes: app/api/

## To Continue
Tell Claude: "Continue rebuilding SyncMind from REBUILD-PLAN.md at C:/Users/saiga/OneDrive/Desktop/syncmind"
