"use client";
import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { backend } from "@/lib/client/backend";

export function SaveRestaurantButton({ restaurantId, initial }: { restaurantId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(async () => setOn(await backend.toggleSavedRestaurant(restaurantId)))} aria-pressed={on} aria-label={on ? "Remove from saved" : "Save restaurant"} className="rounded-full bg-surface-2 p-2.5">
      <Bookmark size={18} className={on ? "fill-current" : ""} />
    </button>
  );
}
