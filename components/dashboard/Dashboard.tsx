"use client";

import { SystemProvider } from "@/components/providers/SystemProvider";
import { MemoryBrowser } from "./MemoryBrowser";
import { ActivityFeed } from "./ActivityFeed";
import { SyncStatus } from "./SyncStatus";
import { ApiDocs } from "./ApiDocs";
import { StatsBar } from "./StatsBar";

export default function Dashboard() {
  return (
    <SystemProvider>
      <div className="min-h-screen bg-[#09090b] text-zinc-100">
        {/* Header */}
        <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-[1500px] mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="SyncMind" className="w-9 h-9" />
              <div>
                <h1 className="text-sm font-semibold tracking-tight">
                  Sync<span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Mind</span>
                </h1>
                <p className="text-[10px] text-zinc-500 font-mono">shared memory for AI agents</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <SyncStatus />
            </div>
          </div>
        </header>

        {/* Stats */}
        <div className="max-w-[1500px] mx-auto px-6 pt-5 pb-2">
          <StatsBar />
        </div>

        {/* Main */}
        <main className="max-w-[1500px] mx-auto px-6 py-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-8">
              <MemoryBrowser />
            </div>
            <div className="xl:col-span-4 space-y-5">
              <ActivityFeed />
              <ApiDocs />
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-800/40 mt-8">
          <div className="max-w-[1500px] mx-auto px-6 py-3 flex items-center justify-between">
            <p className="text-[10px] text-zinc-600 font-mono">PowerSync + Neon Postgres</p>
            <p className="text-[10px] text-zinc-600 font-mono">PowerSync AI Hackathon 2026</p>
          </div>
        </footer>
      </div>
    </SystemProvider>
  );
}
