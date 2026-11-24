import { Activity, CircleCheck, FlaskConical, HeartPulse, Hospital, MapPin, TriangleAlert } from "lucide-react";

export type HeroVisualKind = "risk" | "lab" | "map" | "data";

/**
 * Decorative "product" illustrations for the hero slides, drawn with HTML/CSS (no image downloads).
 * aria-hidden: they repeat what the slide text already says.
 */
export function HeroVisual({ kind }: { kind: HeroVisualKind }) {
  return (
    <div aria-hidden className="relative mx-auto aspect-[5/4] w-full max-w-md select-none lg:max-w-none">
      {/* glow */}
      <div className="absolute inset-[8%] rounded-[2.5rem] opacity-60 blur-3xl [background:var(--gradient)] dark:opacity-30" />
      <div className="relative h-full overflow-hidden rounded-3xl border border-line bg-surface/90 p-5 shadow-lg backdrop-blur sm:p-7">
        {kind === "risk" && <RiskMock />}
        {kind === "lab" && <LabMock />}
        {kind === "map" && <MapMock />}
        {kind === "data" && <DataMock />}
      </div>
    </div>
  );
}

function Bar({ w, className = "" }: { w: string; className?: string }) {
  return <span className={`block h-2.5 rounded-full bg-foreground/10 ${className}`} style={{ width: w }} />;
}

function RiskMock() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong"><HeartPulse size={22} /></span>
        <div className="flex flex-1 flex-col gap-2"><Bar w="60%" /><Bar w="35%" className="bg-foreground/5" /></div>
      </div>
      <div className="rounded-2xl bg-[var(--ok-bg)] p-4 text-[var(--ok-fg)]">
        <div className="flex items-baseline justify-between">
          <span className="text-4xl font-extrabold tracking-tight">4%</span>
          <CircleCheck size={22} />
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div className="h-full w-[18%] rounded-full bg-current" />
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-3">
        {["var(--ok-bg)", "var(--caution-bg)", "var(--danger-bg)"].map((bg, i) => (
          <div key={bg} className="flex flex-col justify-end gap-2 rounded-2xl p-3" style={{ background: bg }}>
            <span className="block rounded-full bg-black/10 dark:bg-white/15" style={{ height: `${28 + i * 22}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function LabMock() {
  const rows = [
    { ok: true, w: "55%" },
    { ok: false, w: "45%" },
    { ok: true, w: "62%" },
    { ok: true, w: "40%" },
  ];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong"><FlaskConical size={22} /></span>
        <div className="flex flex-1 flex-col gap-2"><Bar w="50%" /><Bar w="30%" className="bg-foreground/5" /></div>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-3">
          {r.ok ? <CircleCheck size={18} className="shrink-0 text-[var(--ok-fg)]" /> : <TriangleAlert size={18} className="shrink-0 text-[var(--orange-fg)]" />}
          <Bar w={r.w} />
          <span className={`ml-auto h-6 w-14 shrink-0 rounded-full ${r.ok ? "bg-[var(--ok-bg)]" : "bg-[var(--orange-bg)]"}`} />
        </div>
      ))}
    </div>
  );
}

function MapMock() {
  const pins = [
    { x: "22%", y: "30%", big: false },
    { x: "58%", y: "22%", big: false },
    { x: "44%", y: "52%", big: true },
    { x: "72%", y: "62%", big: false },
    { x: "28%", y: "70%", big: false },
  ];
  return (
    <div className="relative h-full overflow-hidden rounded-2xl bg-surface-2">
      <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:28px_28px]" />
      <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d="M5 60 C 25 40, 40 70, 60 45 S 90 30, 98 20" fill="none" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="3 2.5" />
      </svg>
      {pins.map((p, i) => (
        <span key={i} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: p.x, top: p.y }}>
          {p.big && <span className="absolute top-1/2 left-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/3 animate-ping rounded-full bg-accent/20" />}
          <span className={`relative inline-flex items-center justify-center rounded-full shadow-md ${p.big ? "h-11 w-11 bg-brand text-on-brand" : "h-8 w-8 bg-surface text-brand-strong"}`}>
            {p.big ? <MapPin size={20} /> : <Hospital size={15} />}
          </span>
        </span>
      ))}
      <div className="absolute right-4 bottom-4 left-4 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-md">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-strong"><Hospital size={18} /></span>
        <div className="flex flex-1 flex-col gap-1.5"><Bar w="70%" /><Bar w="40%" className="bg-foreground/5" /></div>
        <span className="text-sm font-bold text-brand-strong">2.4 km</span>
      </div>
    </div>
  );
}

function DataMock() {
  const bars = [38, 62, 48, 80, 56, 92, 70];
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-strong"><Activity size={22} /></span>
        <div className="flex flex-1 flex-col gap-2"><Bar w="55%" /><Bar w="32%" className="bg-foreground/5" /></div>
      </div>
      <div className="flex flex-1 items-end gap-2.5 rounded-2xl bg-surface-2 p-4">
        {bars.map((h, i) => (
          <span key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%`, background: i === 5 ? "var(--gradient)" : "color-mix(in oklab, var(--accent) 28%, transparent)" }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <Bar w="70%" className={i === 1 ? "bg-accent/40" : ""} />
            <Bar w="45%" className="bg-foreground/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
