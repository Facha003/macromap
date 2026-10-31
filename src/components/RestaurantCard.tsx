import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDistance } from "@/lib/geo";
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

function Coverage({ r }: { r: RestaurantCardData }) {
  if (r.menuCount === 0) return <span className="text-ink-3">No menu data yet</span>;
  const withData = r.estimatedCount + r.verifiedCount;
  return (
    <span className="text-ink-2">
      <span className="font-medium text-ink">{withData}</span>/{r.menuCount} dishes with nutrition
      {r.verifiedCount > 0 ? ` · ${r.verifiedCount} verified` : ""}
    </span>
  );
}

export function RestaurantCard({ r }: { r: RestaurantCardData }) {
  return (
    <Link href={`/r/?id=${encodeURIComponent(r.id)}`} className="card group flex items-center gap-3 p-4 transition hover:border-ink-3/40 active:scale-[0.995]">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-base font-semibold ${r.menuCount ? "bg-ink text-bg" : "bg-surface-2 text-ink-3"}`} aria-hidden>
        {r.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold tracking-tight">{r.name}</h3>
          {r.isDemo && <DemoBadge />}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-2">
          {formatDistance(r.distanceM)}
          {r.cuisines.length ? ` · ${r.cuisines.slice(0, 2).map(cuisineLabel).join(", ")}` : r.amenity ? ` · ${cuisineLabel(r.amenity)}` : ""}
          {r.tags.halal === "yes" || r.tags.halal === "only" ? " · Halal" : ""}
          {r.tags.vegan === "yes" || r.tags.vegan === "only" ? " · Vegan options" : ""}
        </p>
        <p className="mt-1 text-xs"><Coverage r={r} /></p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-ink-3 transition group-hover:translate-x-0.5" />
    </Link>
  );
}
