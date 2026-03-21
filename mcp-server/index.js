#!/usr/bin/env node

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const SYNCMIND_URL = process.env.SYNCMIND_URL || "http://localhost:3000";

// Detect source from env — so each IDE auto-identifies
const SOURCE =
  process.env.SYNCMIND_SOURCE ||
  (process.env.CURSOR_TRACE_ID ? "cursor" : undefined) ||
  (process.env.CODEX_ENV ? "codex" : undefined) ||
  "claude-code";

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${SYNCMIND_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  return res.json();
}

const server = new McpServer({
  name: "syncmind",
  version: "2.0.0",
});

// --- read_memories ---
server.tool(
  "read_memories",
  "Read shared memories from SyncMind. Use at the start of a task to check what other agents have learned. Results are sorted by freshness.",
  {
    search: z.string().optional().describe("Full-text search query"),
    source: z.string().optional().describe("Filter by source (claude-code, codex, cursor, human)"),
    project: z.string().optional().describe("Filter by project name (also includes global-scope memories)"),
    type: z.enum(["learning", "pattern", "decision", "bug", "context"]).optional().describe("Filter by memory type"),
    scope: z.enum(["project", "team", "global"]).optional().describe("Filter by scope"),
    confidence: z.enum(["speculative", "validated", "auto"]).optional().describe("Filter by confidence level"),
    limit: z.number().optional().describe("Max results (default 20)"),
  },
  async (args) => {
    const params = new URLSearchParams();
    if (args.search) params.set("search", args.search);
    if (args.source) params.set("source", args.source);
    if (args.project) params.set("project", args.project);
    if (args.type) params.set("type", args.type);
    if (args.scope) params.set("scope", args.scope);
    if (args.confidence) params.set("confidence", args.confidence);
    params.set("limit", String(args.limit || 20));

    const data = await fetchJSON(`/api/memories?${params}`);
    if (!data.memories || data.memories.length === 0) {
      return { content: [{ type: "text", text: "No memories found." }] };
    }
    const text = data.memories
      .map((m) => {
        const freshness = Math.round((m.freshness || 0) * 100);
        const meta = [m.source, m.project, m.scope !== "project" ? `scope:${m.scope}` : "", m.confidence !== "speculative" ? `confidence:${m.confidence}` : ""].filter(Boolean).join(", ");
        return `[${m.memory_type}] (${meta}) freshness:${freshness}%\n${m.content}\n— ${m.created_at} | used ${m.used_count || 0}x`;
      })
      .join("\n\n---\n\n");
    return { content: [{ type: "text", text }] };
  }
);

// --- write_memory ---
server.tool(
  "write_memory",
  "Save a memory to SyncMind. Use when you discover a pattern, bug, decision, or context worth sharing with other agents. Automatically deduplicates similar content.",
  {
    content: z.string().describe("What you learned, discovered, or decided"),
    type: z.enum(["learning", "pattern", "decision", "bug", "context"]).optional().default("learning").describe("Memory type"),
    project: z.string().optional().describe("Project name"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
    confidence: z.enum(["speculative", "validated", "auto"]).optional().default("speculative").describe("How confident is this memory"),
    scope: z.enum(["project", "team", "global"]).optional().default("project").describe("Visibility scope"),
  },
  async (args) => {
    const data = await fetchJSON("/api/memories", {
      method: "POST",
      body: JSON.stringify({
        content: args.content,
        source: SOURCE,
        type: args.type || "learning",
        project: args.project || "",
        tags: args.tags || [],
        confidence: args.confidence || "speculative",
        scope: args.scope || "project",
      }),
    });
    const msg = data.deduped
      ? `Memory merged with existing (id: ${data.id}, similarity: ${Math.round(data.similarity * 100)}%)`
      : `Memory saved (id: ${data.id})`;
    return { content: [{ type: "text", text: msg }] };
  }
);

// --- bump_memory ---
server.tool(
  "bump_memory",
  "Mark a memory as actively used. Call this when you use a memory to inform your work — it boosts the memory's freshness score.",
  {
    id: z.string().describe("Memory UUID to bump"),
  },
  async (args) => {
    const data = await fetchJSON("/api/memories/bump", {
      method: "POST",
      body: JSON.stringify({ id: args.id }),
    });
    if (data.error) {
      return { content: [{ type: "text", text: `Error: ${data.error}` }] };
    }
    return { content: [{ type: "text", text: `Bumped — used ${data.used_count}x total` }] };
  }
);

// --- delete_memory ---
server.tool(
  "delete_memory",
  "Delete a memory from SyncMind by ID.",
  {
    id: z.string().describe("Memory UUID to delete"),
  },
  async (args) => {
    await fetchJSON("/api/memories", {
      method: "DELETE",
      body: JSON.stringify({ id: args.id }),
    });
    return { content: [{ type: "text", text: `Deleted ${args.id}` }] };
  }
);

// --- start ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`SyncMind MCP error: ${err.message}\n`);
  process.exit(1);
});
