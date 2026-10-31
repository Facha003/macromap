import { SavedView } from "@/components/SavedView";
import { getSession } from "@/server/auth";
import { getRestaurant, mealViews } from "@/server/repo/menu";
import { listFavorites, listSavedRestaurants } from "@/server/repo/user";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const { userId } = await getSession();
  const [favs, saved] = await Promise.all([listFavorites(userId), listSavedRestaurants(userId)]);
  const meals = await mealViews({ itemIds: favs.map((f) => f.menuItemId) });
  const restaurants = (await Promise.all(saved.map((s) => getRestaurant(s.restaurantId)))).filter((r) => r !== null);
  return (
    <SavedView
      favorites={favs.flatMap((f) => {
        const meal = meals.find((m) => m.id === f.menuItemId);
        return meal ? [{ meal, selections: f.selections }] : [];
      })}
      restaurants={restaurants.map((r) => ({ id: r.id, name: r.name, cuisines: r.cuisines, isDemo: r.isDemo, address: r.address }))}
    />
  );
}
