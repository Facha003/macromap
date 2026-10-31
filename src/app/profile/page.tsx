"use client";
import { ProfileView } from "@/components/ProfileView";
import { backend } from "@/lib/client/backend";
import { useData } from "@/lib/client/useData";

export default function ProfilePage() {
  const { data, error, reload } = useData(() => backend.profile(), []);
  if (error) return <p className="card p-6 text-sm text-ink-2">Couldn’t load your profile. {error}</p>;
  if (!data) return <div className="h-96 animate-pulse rounded-[20px] bg-surface-2" />;
  return <ProfileView {...data} onChanged={reload} />;
}
