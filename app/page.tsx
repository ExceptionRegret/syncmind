"use client";

import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with PowerSync (WASM/SQLite)
const Dashboard = dynamic(() => import("@/components/dashboard/Dashboard"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-500">
      <div className="text-center space-y-3">
        <div className="text-4xl">🧠</div>
        <p className="font-mono text-sm">Initializing SyncMind...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <Dashboard />;
}
