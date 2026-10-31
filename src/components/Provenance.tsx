import { BadgeCheck, BookOpen, FlaskConical, Info } from "lucide-react";
import type { DataStatus, EstimateProvider } from "@/lib/nutrition/types";
import { PROVIDER_LABEL } from "@/lib/format";

const STYLE: Record<DataStatus, { cls: string; label: string; Icon: typeof Info }> = {
  verified: { cls: "bg-good-soft text-good", label: "Restaurant-published", Icon: BadgeCheck },
  external: { cls: "bg-info-soft text-info", label: "Reference average", Icon: BookOpen },
  estimated: { cls: "bg-warn-soft text-warn", label: "Estimated", Icon: FlaskConical },
};

const TOOLTIP: Record<DataStatus, string> = {
  verified: "Nutrition published by the restaurant or chain itself",
  external: "Average for this kind of dish from a food-composition database (Matvaretabellen)",
  estimated: "Calculated from likely ingredients and assumed quantities — not measured",
};

/** Always shows where a number comes from: icon + words, never colour alone. */
export function ProvenanceChip({ status, provider, compact = false }: { status: DataStatus; provider?: EstimateProvider | "none"; compact?: boolean }) {
  const s = STYLE[status];
  const isAi = provider && ["gemini", "groq", "ollama", "anthropic", "free_ai"].includes(provider);
  const label = status === "estimated" && isAi ? "AI-assisted estimate" : s.label;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`} title={TOOLTIP[status] + (provider ? ` (${PROVIDER_LABEL[provider]})` : "")}>
      <s.Icon size={12} aria-hidden />
      {label}
      {!compact && provider && status !== "verified" && !isAi && provider !== "reference_db" ? <span className="opacity-75">· {PROVIDER_LABEL[provider].replace(" estimate", "")}</span> : null}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink-3 px-2 py-0.5 text-[11px] font-medium text-ink-2" title="Fictional restaurant with an illustrative menu">
      Demo
    </span>
  );
}
