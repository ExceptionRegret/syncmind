"use client";

import { useStatus } from "@powersync/react";

export function SyncStatus() {
  const status = useStatus();
  const connected = status.connected;
  const syncing = status.dataFlowStatus?.downloading;

  return (
    <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800/50 rounded-full px-3 py-1.5">
      <div className={`w-2 h-2 rounded-full ${connected ? syncing ? "bg-amber-400 animate-pulse" : "bg-emerald-400" : "bg-red-400"}`} />
      <span className="text-[11px] text-zinc-400 font-mono">
        {connected ? syncing ? "Syncing" : "Live" : "Offline"}
      </span>
    </div>
  );
}
