"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import { useLocation } from "@/lib/client/location";
import { track } from "@/lib/client/loading";
import { backend, type RestaurantHit, type SearchApiResponse } from "@/lib/client/backend";
import { useHalal } from "@/lib/client/prefs";
import { halalStatus, passesHalalFilter } from "@/lib/halal";
import type { MealFilters } from "@/lib/queryParser";
import type { MealResult } from "@/lib/searchCore";
import { MealRow } from "./MealRow";
import { MealSheet } from "./MealSheet";
import { HalalBadge } from "./RestaurantCard";

type Overrides = { maxKcal?: number; minProtein?: number; km?: number; vegetarian?: boolean; vegan?: boolean; halal?: boolean; budget?: boolean; real?: boolean; strict?: boolean; sort?: MealFilters["sort"] };

const EXAMPLES = ["40 g protein under 650 kcal within 3 km", "high protein sushi", "vegan under 500 kcal", "kebab", "fits my remaining budget"];

export function SearchView({ initialQuery = "" }: { initialQuery?: string }) {
  const { location, ready } = useLocation();
  const [q, setQ] = useState(initialQuery);
  const [ov, setOv] = useState<Overrides>({});
  const [data, setData] = useState<SearchApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<MealResult | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { halalOnly, setHalalOnly, includePossible, setIncludePossible, reports } = useHalal();
  const [restaurantHits, setRestaurantHits] = useState<RestaurantHit[]>([]);

  const run = useCallback(
    async (query: string, o: Overrides) => {
      setLoading(true);
      setError(null);
      const p = new URLSearchParams({ q: query });
      if (location) {
        p.set("lat", String(location.lat));
        p.set("lng", String(location.lng));
      }
      for (const [k, v] of Object.entries(o)) if (v !== undefined) p.set(k, v === true ? "1" : v === false ? "0" : String(v));
      if (o.halal === undefined && halalOnly) p.set("halal", "1");
      if (includePossible) p.set("halalPossible", "1");
      try {
        const [res, hits] = await Promise.all([
          track(backend.search(p, reports)),
          query.trim().length >= 2 && location ? backend.searchRestaurants(query.trim(), location.lat, location.lng).catch(() => []) : Promise.resolve([]),
        ]);
        setData(res);
        setRestaurantHits(res.filters.text ? hits.slice(0, 6) : []);
      } catch (e) {
        setError((e as Error).message || "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [location, halalOnly, includePossible, reports],
  );

  useEffect(() => {
    if (ready) run(q, ov);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, location, ov, halalOnly, includePossible]);

  // Re-run once a slow live places lookup finishes on the server.
  useEffect(() => {
    if (!data?.pending) return;
    const t = setTimeout(() => run(q, ov), 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const f = data?.filters;
  const setO = (patch: Overrides) => setOv((o) => ({ ...o, ...patch }));
  const chip = (on: boolean) => `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${on ? "bg-ink text-bg" : "bg-surface-2 text-ink-2"}`;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Search</p>
      <h1 className="mb-3 text-xl font-semibold tracking-tight">Find a meal that fits</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOv({});
          run(q, {});
        }}
        className="relative"
      >
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dish, restaurant or “35 g protein under 600 kcal”" className="w-full rounded-2xl border border-line bg-surface py-3.5 pl-10 pr-24 text-sm outline-none focus:border-ink-3" aria-label="Search meals" />
        <button className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Search</button>
      </form>
      {!q && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => { setQ(ex); setOv({}); run(ex, {}); }} className="whitespace-nowrap rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:text-ink">{ex}</button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setShowFilters((s) => !s)} className={chip(showFilters)} aria-expanded={showFilters}><SlidersHorizontal size={13} className="mr-1 inline" />Filters</button>
        {[500, 650, 800].map((k) => (
          <button key={k} className={chip(f?.maxKcal === k)} onClick={() => setO({ maxKcal: f?.maxKcal === k ? 0 : k })}>≤ {k} kcal</button>
        ))}
        {[30, 40].map((p) => (
          <button key={p} className={chip(f?.minProtein === p)} onClick={() => setO({ minProtein: f?.minProtein === p ? 0 : p })}>≥ {p} g protein</button>
        ))}
        <button className={chip(Boolean(f?.withinBudget))} onClick={() => setO({ budget: !f?.withinBudget })}>Within today’s budget</button>
        <button className={chip(Boolean(f?.realOnly))} aria-pressed={Boolean(f?.realOnly)} onClick={() => setO({ real: !f?.realOnly })}>Real menu items only</button>
        <button className={chip(Boolean(f?.strict))} aria-pressed={Boolean(f?.strict)} title="Only meals whose whole estimated range meets your limits" onClick={() => setO({ strict: !f?.strict })}>Whole range fits</button>
      </div>

      {showFilters && (
        <div className="card mt-2 space-y-3 p-4 text-sm">
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-2">Distance</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 5].map((km) => <button key={km} className={chip(f?.maxDistanceKm === km)} onClick={() => setO({ km })}>{km} km</button>)}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-2">Diet</p>
            <div className="flex flex-wrap gap-1.5">
              <button className={chip(Boolean(f?.vegetarian))} onClick={() => setO({ vegetarian: !f?.vegetarian })}>Vegetarian</button>
              <button className={chip(Boolean(f?.vegan))} onClick={() => setO({ vegan: !f?.vegan })}>Vegan</button>
              <button className={chip(Boolean(f?.halal))} onClick={() => { setHalalOnly(!f?.halal); setO({ halal: !f?.halal }); }}>Halal</button>
              {f?.halal && <button className={chip(includePossible)} onClick={() => setIncludePossible(!includePossible)}>+ possibly halal</button>}
            </div>
            <p className="mt-1.5 text-[11px] text-ink-3">Halal only includes restaurants with halal evidence (stated by the restaurant, an OpenStreetMap tag, or your own report). “Possibly halal” (cuisine only) is opt-in. Vegetarian/vegan uses the restaurant’s label, else is inferred from estimated ingredients — always confirm when ordering.</p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-2">Sort by</p>
            <div className="flex flex-wrap gap-1.5">
              {([["score", "Best fit for my goal"], ["protein_density", "Protein per kcal"], ["protein", "Most protein"], ["kcal", "Fewest kcal"], ["distance", "Nearest"]] as const).map(([id, label]) => (
                <button key={id} className={chip((f?.sort ?? "score") === id)} onClick={() => setO({ sort: id })}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {f && (
        <p className="mt-3 text-xs text-ink-2">
          {[
            f.text && `“${f.text}”`,
            f.minProtein && `≥ ${f.minProtein} g protein`,
            f.maxKcal && `≤ ${f.maxKcal} kcal`,
            f.minKcal && `≥ ${f.minKcal} kcal`,
            f.maxDistanceKm && `within ${f.maxDistanceKm} km`,
            f.vegetarian && "vegetarian",
            f.vegan && "vegan",
            f.halal && (includePossible ? "halal incl. possibly halal" : "halal (evidence only)"),
            f.withinBudget && `within ${Math.round(data!.remainingKcal)} kcal left today`,
          ].filter(Boolean).join(" · ") || "All meals nearby"}
          {location && <span className="text-ink-3"> · near {location.label}</span>}
        </p>
      )}
      {!location && ready && (
        <p className="mt-3 flex items-center gap-1 text-xs text-ink-2"><MapPin size={13} />Searching around Oslo sentrum. <Link href="/" className="underline">Set your location</Link></p>
      )}

      {error && <p className="mt-4 rounded-xl bg-warn-soft p-3 text-sm text-warn" role="alert">{error}</p>}
      {data?.pending && <p className="mt-3 flex items-center gap-2 text-xs text-ink-3"><Loader2 size={12} className="animate-spin" />Still loading live restaurant data for this area…</p>}
      {data?.liveError && <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">{data.liveError}</p>}

      <div className="mt-4">
        {loading && !data ? (
          <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-32 animate-pulse rounded-[20px] bg-surface-2" />)}</div>
        ) : data ? (
          <>
            {restaurantHits.filter((h) => !halalOnly || passesHalalFilter(halalStatus(h, reports[h.id]).status, includePossible)).length > 0 && (
              <section className="mb-4">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Restaurants</h2>
                <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
                  {restaurantHits
                    .filter((h) => !halalOnly || passesHalalFilter(halalStatus(h, reports[h.id]).status, includePossible))
                    .map((h) => (
                      <li key={h.id}>
                        <Link href={`/r/?id=${encodeURIComponent(h.id)}`} className="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-surface-2">
                          <span className="flex min-w-0 items-center gap-2"><span className="truncate font-medium">{h.name}</span><HalalBadge status={halalStatus(h, reports[h.id]).status} /></span>
                          <span className="shrink-0 text-xs text-ink-3">{formatDistance(h.distanceM)}</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            )}
            <p className="mb-2 flex items-center gap-2 text-xs text-ink-3">
              {loading && <Loader2 size={12} className="animate-spin" />}
              {data.results.length} menu items from {data.scanned.withMenus} restaurants with menus ({data.scanned.restaurants} places nearby)
            </p>
            <ul className="space-y-2">
              {data.results.map((r) => (
                <li key={r.meal.id}>
                  <MealRow
                    meal={r.meal}
                    onOpen={() => setOpen(r)}
                    extra={
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-2 text-[11px] text-ink-2">
                        <span className="font-medium text-ink">{r.meal.restaurant.name}</span>
                        <span>{formatDistance(r.distanceM)}</span>
                        <span className="tabular rounded bg-surface-2 px-1.5 py-0.5 font-medium text-ink">Fit {r.score}</span>
                        <HalalBadge status={r.diet.halal} />
                        {r.reasons.slice(0, 2).map((x) => <span key={x}>· {x}</span>)}
                        <FitNote r={r} />
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>
            {data.results.length === 0 && (
              <p className="card p-6 text-center text-sm text-ink-2">
                No menu items match these filters nearby.{f?.strict ? " “Whole range fits” is on — turning it off also shows meals that possibly fit." : " Try relaxing the limits or a larger distance."}
              </p>
            )}
            {!f?.realOnly && data.typicalResults.length > 0 && (
              <section className="mt-6" aria-label="Typical dishes">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Typical dishes — not confirmed on these menus</h2>
                <p className="mb-2 mt-0.5 text-xs text-ink-3">Generic examples for nearby restaurants we have no menu for. The restaurant may not sell them; open one to find its real menu.</p>
                <ul className="space-y-2 opacity-90">
                  {data.typicalResults.map((r) => (
                    <li key={r.meal.id}>
                      <MealRow
                        meal={r.meal}
                        onOpen={() => setOpen(r)}
                        extra={
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-2 text-[11px] text-ink-2">
                            <span className="font-medium text-ink">{r.meal.restaurant.name}</span>
                            <span>{formatDistance(r.distanceM)}</span>
                            <FitNote r={r} />
                          </div>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : null}
      </div>
      {open && <MealSheet meal={open.meal} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** How a meal relates to the user's limits, honest about estimate ranges. */
function FitNote({ r }: { r: MealResult }) {
  if (r.fit === "fits") return null;
  return <span className="w-full rounded bg-warn-soft px-1.5 py-0.5 text-warn">Possibly fits — {r.fitNotes.join("; ")}</span>;
}
