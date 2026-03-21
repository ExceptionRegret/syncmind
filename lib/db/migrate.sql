-- SyncMind: Shared Persistent Memory for AI Agents
-- Run this in your Neon SQL Editor

-- Enable trigram similarity for smart dedup
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop old tables if migrating from v1
DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS memories CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- Core table: shared memory entries
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  memory_type TEXT DEFAULT 'learning',
  source TEXT NOT NULL DEFAULT 'unknown',
  project TEXT DEFAULT 'default',
  tags TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  used_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  confidence TEXT DEFAULT 'speculative',
  scope TEXT DEFAULT 'project',
  version TEXT DEFAULT ''
);

CREATE INDEX idx_memories_source ON memories(source);
CREATE INDEX idx_memories_project ON memories(project);
CREATE INDEX idx_memories_type ON memories(memory_type);
CREATE INDEX idx_memories_created ON memories(created_at DESC);
CREATE INDEX idx_memories_scope ON memories(scope);

-- Full-text search on memory content
CREATE INDEX idx_memories_content_search ON memories USING gin(to_tsvector('english', content));

-- Trigram similarity index for smart dedup
CREATE INDEX idx_memories_content_trgm ON memories USING gin(content gin_trgm_ops);

-- Activity log for tracking reads/writes
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_activity_created ON activity_log(created_at DESC);
