"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DiaryView } from "@/components/DiaryView";
import { backend } from "@/lib/client/backend";
import { useData } from "@/lib/client/useData";

function Inner() {
  const day = useSearchParams().get("day");
  const { data, error, reload } = useData(() => backend.diary(day), [day]);
  if (error) return <p className="card p-6 text-sm text-ink-2">Couldn’t load your diary. {error}</p>;
  if (!data) return <div className="h-80 animate-pulse rounded-[20px] bg-surface-2" />;
  return <DiaryView key={data.day + data.entries.map((e) => e.id + e.portion).join()} {...data} onChanged={reload} />;
}

export default function DiaryPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
