"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SearchView } from "@/components/SearchView";

function Inner() {
  const q = useSearchParams().get("q") ?? "";
  return <SearchView key={q} initialQuery={q} />;
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
