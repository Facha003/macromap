"use client";
import { SavedView } from "@/components/SavedView";
import { backend } from "@/lib/client/backend";
import { useData } from "@/lib/client/useData";

export default function SavedPage() {
  const { data, error, reload } = useData(() => backend.saved(), []);
  if (error) return <p className="card p-6 text-sm text-ink-2">Couldn’t load saved items. {error}</p>;
  if (!data) return <div className="h-64 animate-pulse rounded-[20px] bg-surface-2" />;
  return <SavedView {...data} onChanged={reload} />;
}
