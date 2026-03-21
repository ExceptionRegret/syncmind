import { column, Schema, Table } from "@powersync/web";

const memories = new Table(
  {
    content: column.text,
    memory_type: column.text,
    source: column.text,
    project: column.text,
    tags: column.text,
    created_at: column.text,
    used_count: column.integer,
    last_accessed: column.text,
    confidence: column.text,
    scope: column.text,
    version: column.text,
  },
  { indexes: { by_source: ["source"], by_project: ["project"], by_type: ["memory_type"], by_time: ["created_at"], by_scope: ["scope"] } }
);

const activity_log = new Table(
  {
    source: column.text,
    action: column.text,
    details: column.text,
    created_at: column.text,
  },
  { indexes: { by_time: ["created_at"] } }
);

export const AppSchema = new Schema({
  memories,
  activity_log,
});

export type Database = (typeof AppSchema)["types"];
export type MemoryRecord = Database["memories"];
export type ActivityRecord = Database["activity_log"];
