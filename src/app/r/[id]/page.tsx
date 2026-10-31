import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink, Info, Phone } from "lucide-react";
import { MenuList } from "@/components/MenuList";
import { DemoBadge } from "@/components/Provenance";
import { cuisineLabel } from "@/components/RestaurantCard";
import { SaveRestaurantButton } from "@/components/SaveRestaurantButton";
import { getSession } from "@/server/auth";
import { getLlmProvider } from "@/server/nutrition/llm/providers";
import { getRestaurant, mealViews } from "@/server/repo/menu";
import { listFavorites, listSavedRestaurants } from "@/server/repo/user";

export const dynamic = "force-dynamic";

export default async function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const r = await getRestaurant(id);
  if (!r) notFound();
  const { userId } = await getSession();
  const [meals, favs, saved] = await Promise.all([mealViews({ restaurantIds: [r.id] }), listFavorites(userId), listSavedRestaurants(userId)]);
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
          <SaveRestaurantButton restaurantId={r.id} initial={saved.some((s) => s.restaurantId === r.id)} />
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
          We don’t have this restaurant’s menu yet — most restaurants don’t publish menus in a form apps can use, and we don’t scrape. Add a dish you can see on their menu and we’ll estimate it.
        </p>
      )}

      <MenuList meals={meals} favoriteIds={favs.map((f) => f.menuItemId)} restaurantId={r.id} aiEnabled={Boolean(getLlmProvider())} />
    </div>
  );
}
