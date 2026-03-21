"use client";

import { AppSchema } from "@/lib/powersync/schema";
import { BackendConnector } from "@/lib/powersync/connector";
import { PowerSyncContext } from "@powersync/react";
import { PowerSyncDatabase } from "@powersync/web";
import React, { Suspense, useEffect, useState } from "react";

let db: PowerSyncDatabase | null = null;

function getDB() {
  if (db) return db;

  db = new PowerSyncDatabase({
    database: { dbFilename: "syncmind.db" },
    schema: AppSchema,
    flags: {
      disableSSRWarning: true,
      enableMultiTabs: false,
    },
  });

  const connector = new BackendConnector();
  db.connect(connector);

  return db;
}

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [database, setDatabase] = useState<PowerSyncDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDatabase(getDB());
    } catch (err) {
      console.error("PowerSync init failed:", err);
      setError(err instanceof Error ? err.message : "Failed to initialize");
    }
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-red-400">
        <div className="text-center space-y-2">
          <p className="font-mono text-sm">PowerSync Error: {error}</p>
          <p className="text-xs text-zinc-500">Check browser console for details</p>
        </div>
      </div>
    );
  }

  if (!database) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400">
        Initializing SyncMind...
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400">
          Loading...
        </div>
      }
    >
      <PowerSyncContext.Provider value={database}>
        {children}
      </PowerSyncContext.Provider>
    </Suspense>
  );
}
