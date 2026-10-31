"use client";
import { useCallback, useEffect, useState } from "react";
import type { HalalReport } from "@/lib/halal";

/** Per-browser preferences shared by the server and static builds. */
const HALAL_KEY = "mm.halalMode";
const REPORTS_KEY = "mm.halalReports";
const EVT = "mm-prefs";

function read<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVT));
}

export function getHalalReports(): Record<string, HalalReport> {
  return typeof window === "undefined" ? {} : read<Record<string, HalalReport>>(REPORTS_KEY, {});
}

/** "Halal only" mode plus the user's own halal reports for restaurants. */
export function useHalal() {
  const [halalOnly, setHalalOnlyState] = useState(false);
  const [reports, setReports] = useState<Record<string, HalalReport>>({});
  useEffect(() => {
    const sync = () => {
      setHalalOnlyState(read(HALAL_KEY, false));
      setReports(read(REPORTS_KEY, {}));
    };
    sync();
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  const setHalalOnly = useCallback((v: boolean) => write(HALAL_KEY, v), []);
  const report = useCallback((restaurantId: string, r: HalalReport | null) => {
    const next = { ...read<Record<string, HalalReport>>(REPORTS_KEY, {}) };
    if (r) next[restaurantId] = r;
    else delete next[restaurantId];
    write(REPORTS_KEY, next);
  }, []);
  return { halalOnly, setHalalOnly, reports, report };
}
