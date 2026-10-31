"use client";
import Link from "next/link";
import { useState } from "react";
import { Bookmark, ChevronRight, Heart } from "lucide-react";
import type { Selections } from "@/lib/nutrition/customize";
import type { MealView } from "@/server/repo/menu";
import { MealRow } from "./MealRow";
import { MealSheet } from "./MealSheet";
import { DemoBadge } from "./Provenance";
import { cuisineLabel } from "./RestaurantCard";

export function SavedView({ favorites, restaurants }: { favorites: { meal: MealView; selections: Selections }[]; restaurants: { id: string; name: string; cuisines: string[]; isDemo: boolean; address: string | null }[] }) {
  const [open, setOpen] = useState<{ meal: MealView; selections: Selections } | null>(null);
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-ink-3">Saved</p>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Your favourites</h1>

      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3"><Heart size={13} />Meals</h2>
        {favorites.length === 0 ? (
          <p className="card p-5 text-sm text-ink-2">Tap the heart on any meal to save it here — with your customizations — for two-tap logging.</p>
        ) : (
          <ul className="space-y-2">
            {favorites.map((f) => (
              <li key={f.meal.id}>
                <MealRow meal={f.meal} onOpen={() => setOpen(f)} extra={<p className="mt-2 border-t border-line pt-2 text-[11px] text-ink-2">{f.meal.restaurant.name}{Object.keys(f.selections).length ? " · your customization saved" : ""}</p>} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3"><Bookmark size={13} />Restaurants</h2>
        {restaurants.length === 0 ? (
          <p className="card p-5 text-sm text-ink-2">Bookmark restaurants from their page to find them quickly.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
            {restaurants.map((r) => (
              <li key={r.id}>
                <Link href={`/r/${encodeURIComponent(r.id)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">{r.name}{r.isDemo && <DemoBadge />}</p>
                    <p className="truncate text-xs text-ink-2">{[r.cuisines.map(cuisineLabel).join(", "), r.address].filter(Boolean).join(" · ")}</p>
                  </div>
                  <ChevronRight size={16} className="text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {open && <MealSheet meal={open.meal} initialSelections={open.selections} isFavorite onClose={() => setOpen(null)} />}
    </div>
  );
}
