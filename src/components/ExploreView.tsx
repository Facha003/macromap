"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { List, Loader2, Map as MapIcon, MapPin, Search, Sparkles } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import { useLocation } from "@/lib/client/location";
import { track } from "@/lib/client/loading";
import { LocationGate } from "./LocationGate";
import { cuisineLabel, RestaurantCard, type RestaurantCardData } from "./RestaurantCard";

interface PlacesResponse {
  restaurants: RestaurantCardData[];
  attribution: string;
  liveError: string | null;
  pending: boolean;
}

const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-[60vh] min-h-80 animate-pulse rounded-[20px] bg-surface-2 md:h-[520px]" />,
});

const RADII = [500, 1000, 2000, 3000, 5000];

export function ExploreView() {
  const { location, ready, radiusM, setRadiusM } = useLocation();
  const [changing, setChanging] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [data, setData] = useState<PlacesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [onlyWithData, setOnlyWithData] = useState(false);

  useEffect(() => {
    if (!location) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const load = async () => {
      setLoading(true);
      try {
        const r = await track(fetch(`/api/places?lat=${location.lat}&lng=${location.lng}&radius=${radiusM}`, { signal: ctrl.signal }));
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
        setError(null);
        // A slow live lookup keeps running on the server — check back until it lands.
        if (j.pending && tries++ < 15) timer = setTimeout(load, 5000);
        else setLoading(false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("Couldn't load restaurants. Check your connection and try again.");
        setLoading(false);
      }
    };
    load();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [location, radiusM]);

  const list = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const rs = (data?.restaurants ?? []).filter(
      (r) => (!onlyWithData || r.menuCount > 0) && (!q || r.name.toLowerCase().includes(q) || r.cuisines.some((c) => c.includes(q)) || (r.amenity ?? "").includes(q)),
    );
    // Restaurants we have nutrition for first, then by distance.
    return [...rs].sort((a, b) => Number(b.menuCount > 0) - Number(a.menuCount > 0) || a.distanceM - b.distanceM);
  }, [data, filter, onlyWithData]);

  if (!ready) return null;
  if (!location || changing) {
    return (
      <div className="mx-auto max-w-md pt-6">
        <Brand />
        <LocationGate onDone={() => setChanging(false)} />
      </div>
    );
  }

  const withData = (data?.restaurants ?? []).filter((r) => r.menuCount > 0).length;

  return (
    <div>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Explore</p>
          <button onClick={() => setChanging(true)} className="flex max-w-full items-center gap-1.5 text-left text-xl font-semibold tracking-tight">
            <MapPin size={18} className="shrink-0" />
            <span className="truncate">{location.label}</span>
          </button>
        </div>
        <div className="inline-flex shrink-0 rounded-xl bg-surface-2 p-1" role="tablist" aria-label="View">
          {(["list", "map"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${view === v ? "bg-surface shadow-sm" : "text-ink-2"}`}>
              {v === "list" ? <List size={15} /> : <MapIcon size={15} />}
              {v === "list" ? "List" : "Map"}
            </button>
          ))}
        </div>
      </header>

      <Link href="/search" className="card mb-3 flex items-center gap-3 px-4 py-3 text-sm text-ink-2 transition hover:border-ink-3/40">
        <Sparkles size={17} className="text-brand" />
        <span className="flex-1">Try “40 g protein under 650 kcal within 3 km”</span>
        <Search size={16} />
      </Link>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-40 flex-1">
          <span className="sr-only">Filter restaurants</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or cuisine" className="w-full rounded-xl border border-line bg-surface py-2 pl-8 pr-3 text-sm outline-none focus:border-ink-3" />
        </label>
        <div className="flex gap-1 overflow-x-auto" role="radiogroup" aria-label="Search radius">
          {RADII.map((r) => (
            <button key={r} role="radio" aria-checked={radiusM === r} onClick={() => setRadiusM(r)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${radiusM === r ? "bg-ink text-bg" : "bg-surface-2 text-ink-2"}`}>
              {formatDistance(r)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between text-xs text-ink-2">
        <span className="tabular">
          {data ? `${list.length} places · ${withData} with nutrition data` : "Searching…"}
          {data?.pending ? " · loading live map data…" : ""}
        </span>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyWithData} onChange={(e) => setOnlyWithData(e.target.checked)} className="accent-[var(--ink)]" />
          Only with nutrition
        </label>
      </div>

      {data?.liveError && <p className="mb-3 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">{data.liveError}</p>}
      {error && <p className="mb-3 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn" role="alert">{error}</p>}

      {view === "map" ? (
        <MapView
          center={location}
          radiusM={radiusM}
          points={list.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, hasMenu: r.menuCount > 0, subtitle: `${formatDistance(r.distanceM)}${r.cuisines[0] ? " · " + cuisineLabel(r.cuisines[0]) : ""}` }))}
        />
      ) : loading && !data ? (
        <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[84px] animate-pulse rounded-[20px] bg-surface-2" />)}</div>
      ) : (
        <ul className="space-y-2">
          {list.slice(0, 120).map((r) => (
            <li key={r.id}><RestaurantCard r={r} /></li>
          ))}
          {!loading && list.length === 0 && <li className="card p-6 text-center text-sm text-ink-2">No places match. Try a larger radius.</li>}
        </ul>
      )}
      {loading && data && <Loader2 className="mx-auto mt-4 animate-spin text-ink-3" />}

      <p className="mt-6 text-center text-[11px] text-ink-3">
        {data?.attribution ?? "© OpenStreetMap contributors"} · Most restaurants don’t publish menus or nutrition — you can add a dish from any restaurant’s page.
      </p>
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-6 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ink text-lg font-bold text-bg">M</div>
      <h1 className="text-2xl font-semibold tracking-tight">MacroMap</h1>
      <p className="mt-1 text-sm text-ink-2">Restaurant meals that fit your macros — with honest, sourced numbers.</p>
    </div>
  );
}
