# SyncMind — Build Plan

## Project Overview
Multi-agent collaborative workspace where humans and AI agents share state via PowerSync.
Agents research, summarize, and execute tasks — humans observe, steer, and approve in real-time.
Works offline-first.

## Target Prizes
- Core: 1st ($3k), 2nd ($1k), 3rd ($500)
- Neon ($2,000/member) — backend Postgres
- Mastra ($500 Amazon) — agent orchestration
- Local-First ($500) — offline-capable via PowerSync

## Tech Stack
- Next.js 16 (App Router, no src dir)
- PowerSync (`@powersync/web`, `@powersync/react`) — sync engine
- Neon Postgres — backend database
- Mastra (`@mastra/core`, `mastra`) — AI agent framework
- Tailwind CSS + shadcn/ui — UI
- AI SDK v6 (`ai`, `@ai-sdk/react`) — AI integration

## Database Schema (Neon Postgres)

```sql
-- Agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'idle', -- idle, thinking, executing, waiting_approval
  current_task_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- pending, assigned, in_progress, awaiting_approval, completed, failed
  priority INTEGER DEFAULT 0,
  assigned_agent_id UUID REFERENCES agents(id),
  assigned_by TEXT, -- 'human' or agent id
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Shared memory table (agents write findings here)
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  task_id UUID REFERENCES tasks(id),
  content TEXT NOT NULL,
  memory_type TEXT DEFAULT 'finding', -- finding, observation, decision, error
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activity log (real-time feed)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  task_id UUID REFERENCES tasks(id),
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Approval requests (human-in-the-loop)
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id),
  agent_id UUID REFERENCES agents(id),
  action_description TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  response_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
```

## PowerSync Client Schema

```typescript
import { column, Schema, Table } from '@powersync/web';

const agents = new Table({
  name: column.text,
  role: column.text,
  status: column.text,
  current_task_id: column.text,
  created_at: column.text,
});

const tasks = new Table({
  title: column.text,
  description: column.text,
  status: column.text,
  priority: column.integer,
  assigned_agent_id: column.text,
  assigned_by: column.text,
  result: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const memories = new Table({
  agent_id: column.text,
  task_id: column.text,
  content: column.text,
  memory_type: column.text,
  created_at: column.text,
});

const activity_log = new Table({
  agent_id: column.text,
  task_id: column.text,
  action: column.text,
  details: column.text,
  created_at: column.text,
});

const approvals = new Table({
  task_id: column.text,
  agent_id: column.text,
  action_description: column.text,
  status: column.text,
  response_note: column.text,
  created_at: column.text,
  resolved_at: column.text,
});

export const AppSchema = new Schema({ agents, tasks, memories, activity_log, approvals });
```

## Sync Streams Config (PowerSync Dashboard YAML)

```yaml
config:
  edition: 3

streams:
  all_agents:
    auto_subscribe: true
    query: SELECT * FROM agents

  all_tasks:
    auto_subscribe: true
    query: SELECT * FROM tasks

  all_memories:
    auto_subscribe: true
    query: SELECT * FROM memories

  recent_activity:
    auto_subscribe: true
    query: SELECT * FROM activity_log

  pending_approvals:
    auto_subscribe: true
    query: SELECT * FROM approvals WHERE status = 'pending'
```

## File Structure

```
powersync/
  BUILDPLAN.md                          ← this file
  app/
    layout.tsx                          ← root layout with providers
    page.tsx                            ← main dashboard
    api/
      tasks/route.ts                    ← CRUD for tasks
      agents/run/route.ts              ← trigger agent execution
      approvals/route.ts               ← approve/reject actions
  components/
    providers/
      SystemProvider.tsx               ← PowerSync + React context
    dashboard/
      AgentPanel.tsx                    ← live agent status cards
      TaskBoard.tsx                     ← task list with assignment
      ActivityFeed.tsx                  ← real-time activity stream
      MemoryExplorer.tsx               ← shared agent memory view
      ApprovalQueue.tsx                ← human-in-the-loop approvals
    ui/                                ← shadcn components
  lib/
    powersync/
      schema.ts                        ← PowerSync client schema
      connector.ts                     ← Backend connector
    db/
      index.ts                         ← Neon database client
      schema.ts                        ← Drizzle schema
    mastra/
      index.ts                         ← Mastra instance
      agents/
        researcher.ts                  ← Research agent
        summarizer.ts                  ← Summarization agent
        executor.ts                    ← Task execution agent
      tools/
        web-search.ts                  ← Web search tool
        db-query.ts                    ← Database query tool
        write-memory.ts               ← Write to shared memory
  next.config.ts
  tailwind.config.ts
  package.json
  .env.local
```

## Build Steps

### Phase 1: Project Setup
- [x] Create BUILDPLAN.md
- [ ] Scaffold Next.js app
- [ ] Install all dependencies
- [ ] Configure next.config.ts
- [ ] Set up Tailwind + shadcn/ui
- [ ] Create PowerSync schema + connector
- [ ] Create SystemProvider

### Phase 2: Backend
- [ ] Set up Neon Postgres (user needs to do this manually)
- [ ] Create Drizzle schema + client
- [ ] Create API routes (tasks, agents/run, approvals)
- [ ] Set up Mastra agents + tools

### Phase 3: Frontend Dashboard
- [ ] Main dashboard layout (dark mode)
- [ ] AgentPanel — live agent status
- [ ] TaskBoard — create/assign tasks
- [ ] ActivityFeed — real-time log
- [ ] MemoryExplorer — agent findings
- [ ] ApprovalQueue — approve/reject

### Phase 4: Agent Logic
- [ ] Wire Mastra agents to PowerSync data
- [ ] Agent execution loop (claim task → execute → write results)
- [ ] Human-in-the-loop approval flow
- [ ] Multi-agent coordination

### Phase 5: Polish
- [ ] Offline mode demo
- [ ] Error handling
- [ ] Demo video script

## Environment Variables Needed

```env
# PowerSync
NEXT_PUBLIC_POWERSYNC_URL=https://your-instance.powersync.journeyapps.com
NEXT_PUBLIC_POWERSYNC_TOKEN=<dev-token>

# Neon Postgres
DATABASE_URL=postgresql://user:pass@your-project.neon.tech/neondb?sslmode=require

# AI (for Mastra agents)
OPENAI_API_KEY=sk-...
# or GOOGLE_GENERATIVE_AI_API_KEY=...

# Mastra
MASTRA_STORAGE_URL=file:./mastra.db
```

## Manual Steps (User Must Do)
1. Create Neon project at https://neon.tech
2. Enable logical replication in Neon
3. Create PowerSync account at https://powersync.com
4. Connect PowerSync to Neon
5. Configure Sync Streams YAML in PowerSync Dashboard
6. Get API keys for AI provider
