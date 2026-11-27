"use client";

import { useSearchParams } from "next/navigation";
import type { Dictionary, Locale } from "@/i18n";
import { RiskFlow } from "./RiskFlow";

/** Reads ?demo=1 and ?org=CODE in the browser, so the page can be prerendered (GitHub Pages). */
export function RiskFlowFromQuery(props: { lang: Locale; t: Dictionary; provinces: string[] }) {
  const sp = useSearchParams();
  const demo = sp.get("demo") === "1";
  const org = sp.get("org");
  const orgCode = org && /^[A-Za-z0-9_-]{3,32}$/.test(org) ? org : null;
  return <RiskFlow key={`${demo}-${orgCode}`} {...props} demo={demo} orgCode={orgCode} />;
}
