"use client";
import Link from "next/link";
import { ArrowLeft, Clock, ExternalLink, Info, Phone } from "lucide-react";
import { backend } from "@/lib/client/backend";
import { useData } from "@/lib/client/useData";
import { MenuList } from "./MenuList";
import { DemoBadge } from "./Provenance";
import { cuisineLabel } from "./RestaurantCard";
import { SaveRestaurantButton } from "./SaveRestaurantButton";

export function RestaurantView({ id }: { id: string }) {
  const { data, error, reload } = useData(() => backend.restaurant(id), [id]);

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

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2"><ArrowLeft size={16} />Explore</Link>
      <header className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{r.name}</h1>
              {r.isDemo && <DemoBadge />}
            </div>
            <p className="mt-1 text-sm text-ink-2">
              {[r.cuisines.map(cuisineLabel).join(", ") || (r.amenity && cuisineLabel(r.amenity)), r.address].filter(Boolean).join(" · ")}
            </p>
          </div>
          <SaveRestaurantButton key={String(data.saved)} restaurantId={r.id} initial={data.saved} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {r.tags.website && <a href={r.tags.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5"><ExternalLink size={12} />Official website / menu</a>}
          {r.tags.phone && <a href={`tel:${r.tags.phone}`} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5"><Phone size={12} />{r.tags.phone}</a>}
          {r.tags.openingHours && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5"><Clock size={12} />{r.tags.openingHours}</span>}
          {(r.tags.halal === "yes" || r.tags.halal === "only") && <span className="rounded-full bg-surface-2 px-3 py-1.5">Halal (per OpenStreetMap)</span>}
          {osmUrl && <a href={osmUrl} target="_blank" rel="noreferrer" className="rounded-full bg-surface-2 px-3 py-1.5 text-ink-2">View on OpenStreetMap</a>}
        </div>
      </header>

      {r.isDemo && (
        <p className="mb-5 flex gap-2 rounded-2xl border border-dashed border-ink-3 p-3 text-xs text-ink-2">
          <Info size={15} className="mt-0.5 shrink-0" />
          This is a fictional demo restaurant with an illustrative menu. Its nutrition numbers are real estimates computed from the dish descriptions using Matvaretabellen data — but the restaurant and menu are not real.
        </p>
      )}
      {!r.isDemo && meals.length === 0 && (
        <p className="mb-5 rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">
          We don’t have this restaurant’s menu yet — most restaurants don’t publish menus in a form apps can use, and we don’t scrape. Paste their menu from Wolt, foodora or their website below and we’ll estimate every dish.
        </p>
      )}

      <MenuList meals={meals} favoriteIds={data.favoriteIds} restaurantId={r.id} restaurantName={r.name} isDemo={r.isDemo} aiEnabled={data.aiEnabled} onChanged={reload} />
    </div>
  );
}
