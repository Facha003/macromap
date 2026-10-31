import { DiaryView } from "@/components/DiaryView";
import { shiftDay, todayISO } from "@/lib/format";
import { getSession } from "@/server/auth";
import { getProfile, history, listDay, recentEntries, totalsOf } from "@/server/repo/user";

export const dynamic = "force-dynamic";

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const sp = await searchParams;
  const today = todayISO();
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today;
  const { userId } = await getSession();
  const [profile, entries, recent, hist] = await Promise.all([getProfile(userId), listDay(userId, day), recentEntries(userId, 8), history(userId, shiftDay(day, -6), day)]);
  const totals = totalsOf(entries);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(day, i - 6)).map((d) => ({ day: d, kcal: hist.find((h) => h.day === d)?.kcal ?? 0 }));
  return (
    <DiaryView
      day={day}
      today={today}
      goals={{ goalType: profile.goalType, kcalTarget: profile.kcalTarget, proteinG: profile.proteinG, carbsG: profile.carbsG, fatG: profile.fatG }}
      entries={entries.map((e) => ({ ...e, loggedAt: e.loggedAt.toISOString() }))}
      totals={totals}
      recent={recent.map((e) => ({ id: e.id, name: e.name, restaurantName: e.restaurantName, kcal: e.kcal * e.portion, protein: e.protein * e.portion }))}
      week={days}
    />
  );
}
