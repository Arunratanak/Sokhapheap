import { ChartColumn, ClipboardCheck, Heart, Info, Layers, Route, ShieldCheck, Signpost, TestTube, Users, type LucideIcon } from "lucide-react";

/**
 * Feature and section icons. Lucide only, 1.5 stroke, current text colour (DESIGN.md §6).
 * The export names are unchanged so the pages that use them didn't change; `size` defaults to 20.
 * Decorative (aria-hidden): the text next to them carries the meaning.
 */
type P = { size?: number; className?: string };
const wrap = (Icon: LucideIcon) =>
  function BrandIcon({ size = 20, className = "" }: P) {
    return <Icon aria-hidden size={size} className={className} />;
  };

export const IconHealthCheck = wrap(ClipboardCheck);
export const IconHeartRisk = wrap(Heart);
export const IconLabTube = wrap(TestTube);
export const IconTempleData = wrap(ChartColumn);
export const IconPathSteps = wrap(Route);
export const IconLayers = wrap(Layers);
export const IconCaution = wrap(Info);
export const IconSignpost = wrap(Signpost);
export const IconShieldLock = wrap(ShieldCheck);
export const IconPeople = wrap(Users);
