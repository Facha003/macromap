"use client";
import { useState } from "react";
import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import { OSLO } from "@/lib/geo";
import { useLocation, type UserLocation } from "@/lib/client/location";
import { startLoading, track } from "@/lib/client/loading";
import { backend } from "@/lib/client/backend";

export function LocationGate({ onDone }: { onDone?: () => void }) {
  const { setLocation } = useLocation();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<"gps" | "search" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);

  const choose = (l: UserLocation) => {
    setLocation(l);
    onDone?.();
  };

  const useGps = () => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support location. Search for a place instead.");
      return;
    }
    setBusy("gps");
    const stop = startLoading();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        stop();
        setBusy(null);
        choose({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Current location", source: "gps" });
      },
      (err) => {
        stop();
        setBusy(null);
        setError(err.code === err.PERMISSION_DENIED ? "Location permission was denied. Search for a city or address instead." : "Couldn't get your location. Search for a city or address instead.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy("search");
    setError(null);
    try {
      const results = await track(backend.geocode(q));
      setResults(results);
      if (!results.length) setError("No places found. Try a street, neighbourhood or city.");
    } catch {
      setError("Address search is unavailable right now.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="text-lg font-semibold tracking-tight">Where are you eating?</h2>
      <p className="mt-1 text-sm text-ink-2">We use your location only to find nearby restaurants. It stays in this browser.</p>
      <button onClick={useGps} disabled={busy !== null} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition active:scale-[0.99] disabled:opacity-60">
        {busy === "gps" ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
        Use my location
      </button>
      <form onSubmit={search} className="mt-3 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">City or address</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="City, street or neighbourhood" className="w-full rounded-2xl border border-line bg-bg py-3 pl-9 pr-3 text-sm outline-none focus:border-ink-3" />
        </label>
        <button type="submit" disabled={busy !== null} className="rounded-2xl border border-line px-4 text-sm font-medium disabled:opacity-60">
          {busy === "search" ? <Loader2 size={16} className="animate-spin" /> : "Find"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
      {results.length > 0 && (
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button onClick={() => choose({ ...r, label: r.label.split(",").slice(0, 2).join(","), source: "search" })} className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-ink-3" />
                <span className="line-clamp-2">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => choose({ lat: OSLO.lat, lng: OSLO.lng, label: OSLO.label, source: "default" })} className="mt-3 w-full text-center text-sm text-ink-2 underline-offset-4 hover:underline">
        Or start in {OSLO.label}
      </button>
      <p className="mt-3 text-center text-[11px] text-ink-3">Address search by Nominatim · © OpenStreetMap contributors</p>
    </div>
  );
}
