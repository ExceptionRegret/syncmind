"use client";

import { useState, useEffect, useCallback } from "react";

interface Memory {
  id: string;
  content: string;
  memory_type: string;
  source: string;
  project: string;
  tags: string;
  created_at: string;
  used_count: number;
  last_accessed: string | null;
  confidence: string;
  scope: string;
  version: string;
  freshness: number;
}

interface Activity {
  id: string;
  source: string;
  action: string;
  details: string;
  created_at: string;
}

export function useMemories(refreshInterval = 5000) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/memories?limit=200&no_bump=true");
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch {
      // silently retry on next interval
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, refreshInterval);
    return () => clearInterval(id);
  }, [refresh, refreshInterval]);

  return { memories, loading, refresh };
}

export function useActivities(refreshInterval = 5000) {
  const [activities, setActivities] = useState<Activity[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/sync?action=activities");
      if (!res.ok) return;
      const data = await res.json();
      setActivities(data.activities || []);
    } catch {
      // silently retry
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, refreshInterval);
    return () => clearInterval(id);
  }, [refresh, refreshInterval]);

  return { activities, refresh };
}
