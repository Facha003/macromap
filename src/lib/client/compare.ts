"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "mm.compare";
const EVT = "mm-compare";
export const COMPARE_MAX = 4;

export interface CompareEntry {
  id: string;
  selections: Record<string, string | string[] | number>;
}

function read(): CompareEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

/** Compare tray kept per browser — a convenience, not durable data. */
export function useCompare() {
  const [items, setItems] = useState<CompareEntry[]>([]);
  useEffect(() => {
    setItems(read());
    const on = () => setItems(read());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  const save = useCallback((next: CompareEntry[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setItems(next);
    window.dispatchEvent(new Event(EVT));
  }, []);
  const toggle = useCallback(
    (e: CompareEntry) => {
      const cur = read();
      save(cur.some((x) => x.id === e.id) ? cur.filter((x) => x.id !== e.id) : [...cur, e].slice(-COMPARE_MAX));
    },
    [save],
  );
  const remove = useCallback((id: string) => save(read().filter((x) => x.id !== id)), [save]);
  const clear = useCallback(() => save([]), [save]);
  return { items, toggle, remove, clear, has: (id: string) => items.some((x) => x.id === id) };
}
