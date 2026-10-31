"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface UserLocation {
  lat: number;
  lng: number;
  label: string;
  source: "gps" | "search" | "default";
}

interface Ctx {
  location: UserLocation | null;
  ready: boolean;
  setLocation: (l: UserLocation) => void;
  radiusM: number;
  setRadiusM: (r: number) => void;
}

const LocationContext = createContext<Ctx | null>(null);
const KEY = "mm.location";
const RKEY = "mm.radius";

function read<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable — keep in memory only */
  }
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLoc] = useState<UserLocation | null>(null);
  const [radiusM, setR] = useState(2000);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLoc(read<UserLocation>(KEY));
    setR(read<number>(RKEY) ?? 2000);
    setReady(true);
  }, []);

  const setLocation = useCallback((l: UserLocation) => {
    setLoc(l);
    write(KEY, l);
  }, []);
  const setRadiusM = useCallback((r: number) => {
    setR(r);
    write(RKEY, r);
  }, []);

  return <LocationContext.Provider value={{ location, ready, setLocation, radiusM, setRadiusM }}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const c = useContext(LocationContext);
  if (!c) throw new Error("useLocation outside LocationProvider");
  return c;
}
