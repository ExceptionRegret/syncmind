"use client";

import { usePowerSync, useQuery } from "@powersync/react";
import { useState } from "react";
import { v4 as uuid } from "uuid";

const typeStyles: Record<string, { card: string; badge: string; dot: string }> = {
  learning: { card: "border-cyan-800/40 hover:border-cyan-700/60", badge: "bg-cyan-500/15 text-cyan-400", dot: "bg-cyan-400" },
  pattern: { card: "border-violet-800/40 hover:border-violet-700/60", badge: "bg-violet-500/15 text-violet-400", dot: "bg-violet-400" },
  decision: { card: "border-emerald-800/40 hover:border-emerald-700/60", badge: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" },
  bug: { card: "border-red-800/40 hover:border-red-700/60", badge: "bg-red-500/15 text-red-400", dot: "bg-red-400" },
  context: { card: "border-amber-800/40 hover:border-amber-700/60", badge: "bg-amber-500/15 text-amber-400", dot: "bg-amber-400" },
};

const sourceStyles: Record<string, string> = {
  "claude-code": "bg-violet-500/20 text-violet-300",
  codex: "bg-blue-500/20 text-blue-300",
  cursor: "bg-amber-500/20 text-amber-300",
  human: "bg-zinc-500/20 text-zinc-300",
};

const confidenceStyles: Record<string, { border: string; badge: string; label: string }> = {
  validated: { border: "border-l-emerald-500", badge: "bg-emerald-500/15 text-emerald-400", label: "validated" },
  auto: { border: "border-l-blue-500", badge: "bg-blue-500/15 text-blue-400", label: "auto" },
  speculative: { border: "border-l-zinc-700", badge: "bg-zinc-800/50 text-zinc-500", label: "speculative" },
};

const scopeIcons: Record<string, string> = {
  global: "G",
  team: "T",
  project: "P",
};

const defaultType = { card: "border-zinc-800/40", badge: "bg-zinc-800 text-zinc-500", dot: "bg-zinc-600" };

function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function computeFreshness(createdAt: string, usedCount: number, lastAccessed: string | null): number {
  const now = Date.now();
  const ageDays = (now - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const recency = Math.max(0, 1 - ageDays / 90);
  const usage = Math.min(1, Math.log(1 + usedCount) / Math.log(21));
  let accessBoost = 0;
  if (lastAccessed) {
    const accessAgeDays = (now - new Date(lastAccessed).getTime()) / (1000 * 60 * 60 * 24);
    accessBoost = Math.max(0, 0.2 * (1 - accessAgeDays / 30));
  }
  return Math.min(1, 0.5 * recency + 0.3 * usage + 0.2 + accessBoost);
}

function freshnessColor(f: number): string {
  if (f > 0.7) return "bg-emerald-500";
  if (f > 0.4) return "bg-amber-500";
  return "bg-red-500/70";
}

export function MemoryBrowser() {
  const db = usePowerSync();
  const [filter, setFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [writing, setWriting] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("learning");
  const [newSource, setNewSource] = useState("human");
  const [newProject, setNewProject] = useState("");
  const [newConfidence, setNewConfidence] = useState("speculative");
  const [newScope, setNewScope] = useState("project");

  const searchClause = search ? `WHERE content LIKE '%' || ? || '%'` : "";
  const searchParams = search ? [search] : [];

  const { data: memories } = useQuery(
    `SELECT * FROM memories ${searchClause} ORDER BY created_at DESC LIMIT 100`,
    searchParams
  );

  const filtered = memories
    .map((m) => ({
      ...m,
      freshness: computeFreshness(
        m.created_at as string,
        (m.used_count as number) || 0,
        m.last_accessed as string | null
      ),
    }))
    .filter((m) => {
      if (filter !== "all" && m.memory_type !== filter) return false;
      if (sourceFilter !== "all" && m.source !== sourceFilter) return false;
      if (scopeFilter !== "all" && m.scope !== scopeFilter) return false;
      return true;
    })
    .sort((a, b) => b.freshness - a.freshness);

  const sources = [...new Set(memories.map((m) => m.source as string).filter(Boolean))];

  async function writeMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim()) return;
    setWriting(true);
    try {
      const id = uuid();
      const now = new Date().toISOString();
      await db.execute(
        "INSERT INTO memories (id, content, memory_type, source, project, tags, created_at, used_count, confidence, scope, version) VALUES (?, ?, ?, ?, ?, '', ?, 0, ?, ?, '')",
        [id, newContent, newType, newSource, newProject, now, newConfidence, newScope]
      );
      await db.execute(
        "INSERT INTO activity_log (id, source, action, details, created_at) VALUES (?, ?, 'memory_write', ?, ?)",
        [uuid(), newSource, `${newSource} wrote: ${newContent.slice(0, 80)}...`, now]
      );
      setNewContent("");
      setShowForm(false);
    } finally {
      setWriting(false);
    }
  }

  async function deleteMemory(id: string) {
    await db.execute("DELETE FROM memories WHERE id = ?", [id]);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search memories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
          />
        </div>

        <input type="text" list="source-filter-suggestions"
          placeholder="Filter source..."
          value={sourceFilter === "all" ? "" : sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value || "all")}
          className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-2.5 py-2 text-xs text-zinc-400 w-28 focus:outline-none focus:border-zinc-700 transition-colors" />
        <datalist id="source-filter-suggestions">
          {sources.map((s) => <option key={s} value={s} />)}
        </datalist>

        <div className="flex items-center bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
          {["all", "project", "team", "global"].map((s) => (
            <button key={s} onClick={() => setScopeFilter(s)}
              className={`px-2 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                scopeFilter === s ? "bg-zinc-800 text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
              }`}>
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
          {["all", "learning", "pattern", "decision", "bug", "context"].map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-2.5 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                filter === t ? "bg-zinc-800 text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
              }`}>
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>

        <button onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition-all">
          + New
        </button>
      </div>

      {/* Write Form */}
      {showForm && (
        <form onSubmit={writeMemory} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 space-y-3">
          <textarea
            placeholder="What did you learn? Describe a pattern, decision, bug, or context..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            autoFocus
            className="w-full bg-zinc-950 border border-zinc-800/50 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 resize-none"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <input type="text" list="source-suggestions" placeholder="Source" value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="bg-zinc-950 border border-zinc-800/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 w-28 focus:outline-none" />
            <datalist id="source-suggestions">
              {sources.map((s) => <option key={s} value={s} />)}
            </datalist>
            <select value={newType} onChange={(e) => setNewType(e.target.value)}
              className="bg-zinc-950 border border-zinc-800/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-none">
              <option value="learning">Learning</option>
              <option value="pattern">Pattern</option>
              <option value="decision">Decision</option>
              <option value="bug">Bug</option>
              <option value="context">Context</option>
            </select>
            <select value={newConfidence} onChange={(e) => setNewConfidence(e.target.value)}
              className="bg-zinc-950 border border-zinc-800/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-none">
              <option value="speculative">Speculative</option>
              <option value="validated">Validated</option>
              <option value="auto">Auto</option>
            </select>
            <select value={newScope} onChange={(e) => setNewScope(e.target.value)}
              className="bg-zinc-950 border border-zinc-800/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-none">
              <option value="project">Project</option>
              <option value="team">Team</option>
              <option value="global">Global</option>
            </select>
            <input type="text" placeholder="Project" value={newProject} onChange={(e) => setNewProject(e.target.value)}
              className="bg-zinc-950 border border-zinc-800/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 w-28 focus:outline-none" />
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={writing || !newContent.trim()}
                className="bg-zinc-100 text-zinc-900 px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-white disabled:opacity-40 transition-colors">
                {writing ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Count */}
      <p className="text-[10px] text-zinc-600 font-mono">{filtered.length} memories</p>

      {/* Memory Cards */}
      <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
        {filtered.map((memory) => {
          const mt = memory.memory_type as string;
          const style = typeStyles[mt] || defaultType;
          const src = memory.source as string;
          const srcStyle = sourceStyles[src] || "bg-zinc-800 text-zinc-400";
          const conf = (memory.confidence as string) || "speculative";
          const confStyle = confidenceStyles[conf] || confidenceStyles.speculative;
          const sc = (memory.scope as string) || "project";
          const freshness = memory.freshness;
          const isStale = freshness < 0.3;
          const usedCount = (memory.used_count as number) || 0;

          return (
            <div key={memory.id}
              className={`border border-l-2 rounded-xl p-3.5 bg-zinc-900/20 group transition-all ${style.card} ${confStyle.border} ${isStale ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${srcStyle}`}>
                    {src}
                  </span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${style.badge}`}>
                    {mt}
                  </span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${confStyle.badge}`}>
                    {confStyle.label}
                  </span>
                  {sc !== "project" && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400">
                      {scopeIcons[sc]} {sc}
                    </span>
                  )}
                  {memory.project && memory.project !== "default" && (
                    <span className="text-[9px] text-zinc-600 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded">
                      {memory.project as string}
                    </span>
                  )}
                  {isStale && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/80">
                      stale
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {usedCount > 0 && (
                    <span className="text-[9px] text-zinc-600 font-mono" title="Times used">
                      {usedCount}x
                    </span>
                  )}
                  <span className="text-[9px] text-zinc-600 font-mono">
                    {memory.created_at ? timeAgo(memory.created_at as string) : ""}
                  </span>
                  <button onClick={() => deleteMemory(memory.id as string)}
                    className="text-zinc-800 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-[10px] w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/10">
                    x
                  </button>
                </div>
              </div>

              {/* Freshness bar */}
              <div className="flex items-center gap-2 mb-2 pl-3.5">
                <div className="flex-1 h-1 bg-zinc-800/50 rounded-full overflow-hidden max-w-[120px]">
                  <div
                    className={`h-full rounded-full transition-all ${freshnessColor(freshness)}`}
                    style={{ width: `${Math.round(freshness * 100)}%` }}
                  />
                </div>
                <span className="text-[9px] text-zinc-600 font-mono">{Math.round(freshness * 100)}%</span>
              </div>

              <p className="text-[12px] text-zinc-300 whitespace-pre-wrap leading-relaxed pl-3.5">
                {memory.content as string}
              </p>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800/50 flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">&#x1f9e0;</span>
            </div>
            <p className="text-sm text-zinc-500">No memories yet</p>
            <p className="text-[11px] text-zinc-600 mt-1">Click + New or use the API to add memories</p>
          </div>
        )}
      </div>
    </div>
  );
}
