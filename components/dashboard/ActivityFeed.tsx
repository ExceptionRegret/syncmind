"use client";

import { useQuery } from "@powersync/react";

const sourceColors: Record<string, string> = {
  "claude-code": "bg-violet-500/20 text-violet-400",
  codex: "bg-blue-500/20 text-blue-400",
  cursor: "bg-amber-500/20 text-amber-400",
  human: "bg-zinc-500/20 text-zinc-400",
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ActivityFeed() {
  const { data: activities } = useQuery(
    "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 30"
  );

  return (
    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800/50">
        <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Live Activity</h2>
      </div>
      <div className="divide-y divide-zinc-800/30 max-h-[350px] overflow-y-auto">
        {activities.map((a) => {
          const src = a.source as string || "unknown";
          const colorClass = sourceColors[src] || "bg-zinc-800 text-zinc-500";
          return (
            <div key={a.id} className="px-4 py-2.5 hover:bg-zinc-800/20 transition-colors flex items-start gap-2.5">
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${colorClass}`}>
                {src.slice(0, 2).toUpperCase()}
              </span>
              <p className="text-[11px] text-zinc-400 flex-1 min-w-0 leading-relaxed">
                {a.details as string}
              </p>
              <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                {a.created_at ? timeAgo(a.created_at as string) : ""}
              </span>
            </div>
          );
        })}
        {activities.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-zinc-600">No activity yet</p>
            <p className="text-[10px] text-zinc-700 mt-1">Write a memory or use the API</p>
          </div>
        )}
      </div>
    </div>
  );
}
