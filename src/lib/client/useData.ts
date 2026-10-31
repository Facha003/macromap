"use client";
import { useCallback, useEffect, useState } from "react";
import { track } from "./loading";

/** Loads data from the backend on mount / when deps change, with a manual reload. */
export function useData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(async () => {
    try {
      setData(await track(run()));
      setError(null);
    } catch (e) {
      setError((e as Error).message || "Something went wrong");
    }
  }, [run]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload };
}
