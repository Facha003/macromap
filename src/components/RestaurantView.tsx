"use client";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, ExternalLink, Info, Phone } from "lucide-react";
import { useHalal } from "@/lib/client/prefs";
import { halalStatus } from "@/lib/halal";
import { backend } from "@/lib/client/backend";
import { useData } from "@/lib/client/useData";
import { MenuList } from "./MenuList";
import { DemoBadge } from "./Provenance";
import { cuisineLabel, HalalBadge } from "./RestaurantCard";
import { SaveRestaurantButton } from "./SaveRestaurantButton";

export function RestaurantView({ id }: { id: string }) {
  const { data, error, reload } = useData(() => backend.restaurant(id), [id]);
  const { halalOnly, reports, report } = useHalal();

  if (error) return <p className="card p-6 text-sm text-ink-2">Couldn’t load this restaurant. {error}</p>;
  if (data === null) return <div className="space-y-3"><div className="h-20 animate-pulse rounded-[20px] bg-surface-2" /><div className="h-32 animate-pulse rounded-[20px] bg-surface-2" /></div>;
  if (!data) {
    return (
      <div className="card p-6 text-center text-sm text-ink-2">
        Restaurant not found. <Link href="/" className="underline">Back to Explore</Link>
      </div>
    );
  }
  const { restaurant: r, meals } = data;
  const osmUrl = r.provider === "osm" ? `https://www.openstreetmap.org/${r.providerId}` : null;
  const halal = halalStatus({ name: r.name, cuisines: r.cuisines, halalTag: r.tags.halal }, reports[r.id]);
  const typicalOnly = meals.length > 0 && meals.every((m) => m.sourceType === "typical");

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2"><ArrowLeft size={16} />Explore</Link>
      <header className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{r.name}</h1>
              {r.isDemo && <DemoBadge />}
              <HalalBadge status={halal.status} />
            </div>
            <p className="mt-1 text-sm text-ink-2">
              {[r.cuisines.map(cuisineLabel).join(", ") || (r.amenity && cuisineLabel(r.amenity)), r.address].filter(Boolean).join(" · ")}
            </p>
          </div>
          <SaveRestaurantButton key={String(data.saved)} restaurantId={r.id} initial={data.saved} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {r.tags.menuUrl && <a href={r.tags.menuUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 font-medium text-bg"><BookOpen size={12} />Their menu</a>}
          {r.tags.website && <a href={r.tags.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5"><ExternalLink size={12} />Website</a>}
          {r.tags.phone && <a href={`tel:${r.tags.phone}`} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5"><Phone size={12} />{r.tags.phone}</a>}
          {r.tags.openingHours && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5"><Clock size={12} />{r.tags.openingHours}</span>}
          {osmUrl && <a href={osmUrl} target="_blank" rel="noreferrer" className="rounded-full bg-surface-2 px-3 py-1.5 text-ink-2">View on OpenStreetMap</a>}
        </div>
      </header>

      {r.isDemo && (
        <p className="mb-5 flex gap-2 rounded-2xl border border-dashed border-ink-3 p-3 text-xs text-ink-2">
          <Info size={15} className="mt-0.5 shrink-0" />
          This is a fictional demo restaurant with an illustrative menu. Its nutrition numbers are real estimates computed from the dish descriptions using Matvaretabellen data — but the restaurant and menu are not real.
        </p>
      )}
      {!r.isDemo && (
        <section className="mb-5 rounded-2xl border border-line p-3 text-xs text-ink-2">
          <p>
            <span className="font-medium text-ink">Halal: </span>
            {halal.status === "unknown" ? "No information." : halal.source + "."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => report(r.id, reports[r.id] === "halal" ? null : "halal")} aria-pressed={reports[r.id] === "halal"} className={`rounded-full px-3 py-1 ${reports[r.id] === "halal" ? "bg-good text-white" : "bg-surface-2"}`}>It’s halal</button>
            <button onClick={() => report(r.id, reports[r.id] === "not" ? null : "not")} aria-pressed={reports[r.id] === "not"} className={`rounded-full px-3 py-1 ${reports[r.id] === "not" ? "bg-ink text-bg" : "bg-surface-2"}`}>Not halal</button>
            <span className="self-center text-ink-3">Saved on this device</span>
          </div>
        </section>
      )}
      {!r.isDemo && (meals.length === 0 || typicalOnly) && (
        <p className="mb-5 rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">
          {typicalOnly
            ? "We don’t have this restaurant’s menu yet, so below are typical dishes for this kind of place with estimates — useful for a rough idea, but not their actual menu. Find their real menu below to replace them."
            : "We don’t have this restaurant’s menu yet. Find it with AI or paste it from Wolt, foodora or their website below and we’ll estimate every dish."}
        </p>
      )}

      <MenuList meals={meals} favoriteIds={data.favoriteIds} restaurantId={r.id} restaurantName={r.name} website={r.tags.website ?? null} isDemo={r.isDemo} aiEnabled={data.aiEnabled} halalOnly={halalOnly} onChanged={reload} />
    </div>
  );
}
