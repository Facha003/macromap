import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDistance } from "@/lib/geo";
import type { HalalStatus } from "@/lib/halal";
import { typicalDishesFor } from "@/lib/typicalDishes";
import { DemoBadge } from "./Provenance";

export interface RestaurantCardData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  cuisines: string[];
  amenity: string | null;
  isDemo: boolean;
  distanceM: number;
  menuCount: number;
  estimatedCount: number;
  verifiedCount: number;
  tags: { halal?: string; vegan?: string; vegetarian?: string };
}

export const cuisineLabel = (c: string) => c.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());

const HALAL_BADGE: Partial<Record<HalalStatus, { text: string; title: string; cls: string }>> = {
  restaurant: { text: "Halal · restaurant", title: "The restaurant itself says it is halal", cls: "bg-good-soft text-good" },
  osm: { text: "Halal · OSM", title: "Tagged halal on OpenStreetMap (community map data)", cls: "bg-good-soft text-good" },
  reported: { text: "Halal · you", title: "You marked this restaurant as halal (only on this device)", cls: "bg-surface-2 text-good" },
  possible: { text: "Possibly halal", title: "Unconfirmed — only the cuisine suggests it. Ask the restaurant.", cls: "border border-dashed border-ink-3 text-ink-2" },
};

/** Halal status with its source; hover/long-press shows the evidence. */
export function HalalBadge({ status }: { status?: HalalStatus }) {
  const b = status && HALAL_BADGE[status];
  if (!b) return null;
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${b.cls}`} title={b.title} aria-label={`${b.text}: ${b.title}`}>{b.text}</span>;
}

function Coverage({ r }: { r: RestaurantCardData }) {
  if (r.menuCount === 0) {
    const t = typicalDishesFor(r);
    return <span className="text-ink-3">{t ? `No menu yet · typical ${t.label.replace(/s$/, "")} dishes estimated` : "No menu yet — add or find it"}</span>;
  }
  const withData = r.estimatedCount + r.verifiedCount;
  return (
    <span className="text-ink-2">
      <span className="font-medium text-ink">{withData}</span>/{r.menuCount} dishes with nutrition
      {r.verifiedCount > 0 ? ` · ${r.verifiedCount} verified` : ""}
    </span>
  );
}

export function RestaurantCard({ r, halal }: { r: RestaurantCardData; halal?: HalalStatus }) {
  return (
    <Link href={`/r/?id=${encodeURIComponent(r.id)}`} className="card group flex items-center gap-3 p-4 transition hover:border-ink-3/40 active:scale-[0.995]">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-base font-semibold ${r.menuCount ? "bg-ink text-bg" : "bg-surface-2 text-ink-3"}`} aria-hidden>
        {r.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold tracking-tight">{r.name}</h3>
          {r.isDemo && <DemoBadge />}
          <HalalBadge status={halal} />
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-2">
          {formatDistance(r.distanceM)}
          {r.cuisines.length ? ` · ${r.cuisines.slice(0, 2).map(cuisineLabel).join(", ")}` : r.amenity ? ` · ${cuisineLabel(r.amenity)}` : ""}
          {r.tags.vegan === "yes" || r.tags.vegan === "only" ? " · Vegan options" : ""}
        </p>
        <p className="mt-1 text-xs"><Coverage r={r} /></p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-ink-3 transition group-hover:translate-x-0.5" />
    </Link>
  );
}
