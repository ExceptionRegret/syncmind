"use client";

import { useQuery } from "@powersync/react";

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

export function StatsBar() {
  const { data: allMemories } = useQuery(
    "SELECT id, source, memory_type, created_at, used_count, last_accessed, confidence, scope FROM memories"
  );

  const total = allMemories.length;
  const sources = new Set(allMemories.map((m) => m.source as string).filter(Boolean));
  const types: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};

  let staleCount = 0;
  let mostUsed = { content: "none", count: 0 };
  let validatedCount = 0;
  let globalCount = 0;

  allMemories.forEach((m) => {
    const t = m.memory_type as string;
    const s = m.source as string;
    if (t) types[t] = (types[t] || 0) + 1;
    if (s) sourceCounts[s] = (sourceCounts[s] || 0) + 1;

    const freshness = computeFreshness(
      m.created_at as string,
      (m.used_count as number) || 0,
      m.last_accessed as string | null
    );
    if (freshness < 0.3) staleCount++;

    const uc = (m.used_count as number) || 0;
    if (uc > mostUsed.count) {
      mostUsed = { content: s, count: uc };
    }

    if (m.confidence === "validated") validatedCount++;
    if (m.scope === "global") globalCount++;
  });

  const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];

  const stats = [
    { label: "Total", value: total, color: "text-zinc-100" },
    { label: "Sources", value: sources.size, color: "text-violet-400" },
    { label: "Validated", value: validatedCount, color: "text-emerald-400" },
    { label: "Global", value: globalCount, color: "text-indigo-400" },
    { label: "Stale", value: staleCount, color: staleCount > 0 ? "text-red-400" : "text-zinc-500" },
    { label: "Most Used", value: mostUsed.count > 0 ? `${mostUsed.count}x` : "-", color: "text-amber-400", mono: true },
    { label: "Top Source", value: topSource ? topSource[0] : "none", color: "text-cyan-400", mono: true },
    { label: "Patterns", value: types["pattern"] || 0, color: "text-violet-400" },
  ];

  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-2.5 py-2">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-0.5">{s.label}</p>
          <p className={`text-base font-semibold ${s.color} ${s.mono ? "text-[11px] font-mono mt-0.5" : ""}`}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}
