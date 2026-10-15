"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const EVENT = "free-astro:local-storage";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** State persisted to localStorage, synced across components and tabs (SSR-safe). */
export function useLocalStorageState<T>(key: string, initial: T) {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );

  const value = useMemo<T>(() => {
    if (raw == null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
    // `initial` is a default; changes to it shouldn't re-parse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = read(key);
      let prev = initial;
      try {
        if (current != null) prev = JSON.parse(current) as T;
      } catch {
        // fall back to initial
      }
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Storage may be blocked; nothing else to do.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, set] as const;
}
