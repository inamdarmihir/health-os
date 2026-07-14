"use client";

import { useEffect, useState } from "react";

/**
 * Persists a piece of state to localStorage under `key`. SSR-safe: renders the
 * default value on the server/first paint, then hydrates from storage after mount
 * so the server and client markup match (no hydration warning).
 */
export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // Corrupt or inaccessible storage: fall back to the default value.
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable (private browsing): non-fatal, state stays in memory.
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}
