import { ProfileView } from "@/components/ProfileView";
import { FOOD_ATTRIBUTION, FOODS_RETRIEVED_AT } from "@/lib/nutrition/estimate";
import { getSession, supabaseConfigured } from "@/server/auth";
import { getLlmProvider } from "@/server/nutrition/llm/providers";
import { placesProvider } from "@/server/places";
import { getProfile } from "@/server/repo/user";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();
  const p = await getProfile(session.userId);
  const llm = getLlmProvider();
  return (
    <ProfileView
      profile={{ goalType: p.goalType, kcalTarget: p.kcalTarget, proteinG: p.proteinG, carbsG: p.carbsG, fatG: p.fatG, weightKg: p.weightKg, showDemo: p.showDemo }}
      account={{ kind: session.kind, email: session.email, supabase: supabaseConfigured() }}
      system={{
        ai: llm ? `${llm.id} · ${llm.model}` : null,
        places: placesProvider().attribution,
        foods: Object.values(FOOD_ATTRIBUTION),
        foodsRetrievedAt: FOODS_RETRIEVED_AT,
      }}
    />
  );
}
