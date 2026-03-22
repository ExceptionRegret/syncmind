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
  version: "2.2.0",
});

// --- read_memories ---
server.tool(
  "read_memories",
  `Read shared memories from SyncMind. Call this at the START of every session to see what other agents have learned.

REMINDER: Before your session ends, you MUST call export_session to save your full context. Don't skip this.`,
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
      return { content: [{ type: "text", text: "No memories found.\n\n⚠️ REMINDER: Before your session ends, call export_session with your full context (decisions, bugs, patterns, files, next steps)." }] };
    }
    const text = data.memories
      .map((m) => {
        const freshness = Math.round((m.freshness || 0) * 100);
        const meta = [m.source, m.project, m.scope !== "project" ? `scope:${m.scope}` : "", m.confidence !== "speculative" ? `confidence:${m.confidence}` : ""].filter(Boolean).join(", ");
        return `[${m.memory_type}] (${meta}) freshness:${freshness}%\n${m.content}\n— ${m.created_at} | used ${m.used_count || 0}x`;
      })
      .join("\n\n---\n\n");
    return { content: [{ type: "text", text: text + "\n\n---\n⚠️ REMINDER: Before your session ends, call export_session with your full context." }] };
  }
);

// --- write_memory ---
server.tool(
  "write_memory",
  `Save a single memory to SyncMind. Use for individual insights discovered DURING work.

IMPORTANT — Write useful context, not thin summaries:
  BAD:  "Fixed CORS error"
  GOOD: "Fixed CORS error in /api/auth — root cause was missing OPTIONS handler. Added explicit OPTIONS export to route.ts. This affects all API routes that receive cross-origin requests."

  BAD:  "Auth uses JWT"
  GOOD: "Chose JWT over sessions for auth because the app is stateless, deployed to 3 regions, and sessions would require sticky routing or a shared store."

Include: WHAT happened, WHY, HOW it was resolved, and WHAT other agents should know.

For end-of-session context dumps, use export_session instead — it captures everything in a structured format.`,
  {
    content: z.string().min(30).describe("Detailed memory content. Must be at least 30 characters. Include WHAT, WHY, and HOW — not just a title."),
    type: z.enum(["learning", "pattern", "decision", "bug", "context"]).optional().default("learning").describe("Memory type"),
    project: z.string().optional().describe("Project name"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
    confidence: z.enum(["speculative", "validated", "auto"]).optional().default("speculative").describe("How confident is this memory"),
    scope: z.enum(["project", "team", "global"]).optional().default("project").describe("Visibility scope"),
  },
  async (args) => {
    // Warn if content is still too thin (under 50 chars after the schema min of 30)
    const thinWarning = args.content.length < 80
      ? "\n\n⚠️ This memory is quite short. Consider adding more context: WHY this matters, HOW it was discovered, and WHAT the next agent should do with this info."
      : "";

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
    return { content: [{ type: "text", text: msg + thinWarning }] };
  }
);

// --- bump_memory ---
server.tool(
  "bump_memory",
  "Mark a memory as actively used. Call this when you act on a memory — it boosts the memory's freshness score so it stays visible.",
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

// --- export_session --- (EXIT GATE: agents MUST call this before ending)
server.tool(
  "export_session",
  `CRITICAL — MANDATORY EXIT GATE: You MUST call this tool before your session ends.

This is how you hand off context to the next agent. Without this, everything you learned dies with your session.

Fill in EVERY field that applies. Be detailed — the next agent only knows what you write here:
- summary: What you did and WHY (not "fixed stuff" — explain the problem, approach, outcome)
- decisions: Every choice you made and the reasoning ("Used X over Y because Z")
- bugs: Bugs found with ROOT CAUSE ("Error X happened because Y, fixed by Z")
- patterns: Reusable patterns ("Do X when Y because Z")
- learnings: Gotchas, surprises, tribal knowledge the next agent needs
- files_touched: What you created/modified/deleted
- next_steps: What's left, blockers, dependencies

Example of GOOD summary:
"Implemented Exit Gate system for SyncMind. Added export_session MCP tool + /api/memories/export endpoint + syncmind hooks command that installs agent instructions into CLAUDE.md/.cursor/rules/AGENTS.md/.windsurfrules. The key insight: instead of parsing thin context from git, make the agent itself dump everything it knows — no LLM needed, no extra cost."

Example of BAD summary:
"Added some features to SyncMind"`,
  {
    summary: z.string().min(50).describe("Detailed summary of what was accomplished. At least 50 characters. Include the WHAT, WHY, and HOW."),
    project: z.string().optional().describe("Project name"),
    decisions: z.array(z.string()).optional().describe("Key decisions made and WHY. e.g. 'Used pg_trgm over Levenshtein because it supports GIN indexes for fast similarity search at >80% threshold'"),
    bugs: z.array(z.string()).optional().describe("Bugs found/fixed with ROOT CAUSE. e.g. 'JSX parse error in ApiDocs.tsx — raw > in string literal, Turbopack interprets as JSX closer. Fixed by escaping as {\">\"}80%'"),
    patterns: z.array(z.string()).optional().describe("Patterns discovered or applied. e.g. 'Fire-and-forget UPDATE for bump-on-read — non-blocking async query after response, keeps read latency low'"),
    learnings: z.array(z.string()).optional().describe("Things the next agent should know. e.g. 'On Windows, Claude Code hooks use cmd.exe not bash — $(command) syntax fails, must use node -e wrapper'"),
    files_touched: z.array(z.string()).optional().describe("Files created/modified/deleted with what changed. e.g. ['app/api/memories/export/route.ts (created — Exit Gate endpoint)', 'mcp-server/index.js (added export_session tool)']"),
    next_steps: z.array(z.string()).optional().describe("What's left to do. e.g. ['Run migrate.sql in Neon SQL Editor', 'Update PowerSync sync rules', 'Record demo video']"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
    scope: z.enum(["project", "team", "global"]).optional().default("project").describe("Visibility scope"),
  },
  async (args) => {
    const data = await fetchJSON("/api/memories/export", {
      method: "POST",
      body: JSON.stringify({
        source: SOURCE,
        project: args.project || "",
        summary: args.summary,
        decisions: args.decisions,
        bugs: args.bugs,
        patterns: args.patterns,
        learnings: args.learnings,
        files_touched: args.files_touched,
        next_steps: args.next_steps,
        tags: args.tags,
        scope: args.scope || "project",
      }),
    });
    if (data.error) {
      return { content: [{ type: "text", text: `Export failed: ${data.error}` }] };
    }
    return {
      content: [{
        type: "text",
        text: `Session exported successfully!\n— ${data.saved} new memories saved, ${data.deduped} merged with existing\n— Main session memory: ${data.main_memory_id}\n— Total memories created: ${data.total}\n\nThe next agent will have full context of your work. You can now exit safely.`,
      }],
    };
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
