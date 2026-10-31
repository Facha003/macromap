"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RestaurantView } from "@/components/RestaurantView";

function Inner() {
  const id = useSearchParams().get("id") ?? "";
  return <RestaurantView id={id} />;
}

export default function RestaurantPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
