import { BadgeCheck, BookOpen, FlaskConical, Info } from "lucide-react";
import type { DataStatus, EstimateProvider } from "@/lib/nutrition/types";
import { PROVIDER_LABEL } from "@/lib/format";

const STYLE: Record<DataStatus, { cls: string; label: string; Icon: typeof Info }> = {
  verified: { cls: "bg-good-soft text-good", label: "Verified", Icon: BadgeCheck },
  external: { cls: "bg-info-soft text-info", label: "Reference data", Icon: BookOpen },
  estimated: { cls: "bg-warn-soft text-warn", label: "Estimate", Icon: FlaskConical },
};

/** Always shows how trustworthy a number is: icon + words, never colour alone. */
export function ProvenanceChip({ status, provider, compact = false }: { status: DataStatus; provider?: EstimateProvider | "none"; compact?: boolean }) {
  const s = STYLE[status];
  const isAi = provider && ["gemini", "groq", "ollama", "anthropic"].includes(provider);
  const label = status === "estimated" && isAi ? "AI estimate" : s.label;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`} title={provider ? PROVIDER_LABEL[provider] : undefined}>
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
