"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitcher } from "./LanguageSwitcher";

export interface NavLabels {
  appName: string;
  home: string; check: string; lab: string; map: string; insights: string; about: string;
  cta: string; openMenu: string; closeMenu: string; main: string; language: string; toDark: string; toLight: string; theme: string;
}

type Tab = { key: string; href: string; label: string; match: (p: string) => boolean };

/** `healthCheckLive`: the multi-screening health check (/check) has public modules; the tab opens it instead of /risk. */
export function Navbar({ lang, t, healthCheckLive = false }: { lang: Locale; t: NavLabels; healthCheckLive?: boolean }) {
  const pathname = usePathname() ?? `/${lang}`;
  const base = `/${lang}`;
  const under = (...segs: string[]) => (p: string) => segs.some((s) => p === `${base}/${s}` || p.startsWith(`${base}/${s}/`));
  const tabs: Tab[] = [
    { key: "home", href: base, label: t.home, match: (p) => p === base || p === `${base}/` },
    { key: "check", href: healthCheckLive ? `${base}/check` : `${base}/risk`, label: t.check, match: under("risk", "check") },
    { key: "lab", href: `${base}/lab`, label: t.lab, match: under("lab") },
    { key: "map", href: `${base}/map`, label: t.map, match: under("map") },
    { key: "insights", href: `${base}/insights`, label: t.insights, match: under("insights", "org", "plan") },
    { key: "about", href: `${base}/about`, label: t.about, match: under("about") },
  ];
  const ctaHref = healthCheckLive ? `${base}/check` : `${base}/risk`;
  const activeKey = tabs.find((x) => x.match(pathname))?.key ?? null;
  const onHome = activeKey === "home";

  // --- scrolled state: transparent over the home hero, frosted once the page scrolls
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // --- sliding pill behind the active (or hovered) tab, measured from the links
  const listRef = useRef<HTMLUListElement>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pill, setPill] = useState<{ x: number; w: number; visible: boolean }>({ x: 0, w: 0, visible: false });
  const [pillReady, setPillReady] = useState(false); // no slide-in animation on first paint
  const measure = useCallback(() => {
    const key = hoverKey ?? activeKey;
    const el = key ? linkRefs.current.get(key) : undefined;
    const list = listRef.current;
    if (!el || !list) return setPill((p) => ({ ...p, visible: false }));
    const a = el.getBoundingClientRect();
    const b = list.getBoundingClientRect();
    setPill({ x: a.left - b.left, w: a.width, visible: true });
  }, [hoverKey, activeKey]);
  useLayoutEffect(() => {
    measure();
  }, [measure]);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPillReady(true));
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // --- mobile menu
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);
  // Navigating (including back/forward) closes the menu: adjust state during render, not in an effect.
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.body.style.overflow = overflow;
    };
  }, [open, close]);

  const solid = scrolled || open || !onHome;

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-[border-color,box-shadow] duration-300 ease-out print:hidden ${
        solid ? "border-line shadow-sm" : "border-transparent"
      }`}
    >
      {/* Frosted background on its own layer: backdrop-filter on the header itself would become the
          containing block for the fixed mobile menu and clip it to the header's height. */}
      <div
        aria-hidden
        className={`absolute inset-0 -z-10 transition-opacity duration-300 ease-out ${solid ? "opacity-100" : "opacity-0"} bg-[var(--nav-bg)] backdrop-blur-xl backdrop-saturate-150`}
      />
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href={base} className="mr-auto inline-flex items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight lg:mr-0">
          <LogoMark size={34} />
          <span className="whitespace-nowrap">{t.appName}</span>
        </Link>

        {/* Desktop tabs */}
        <nav aria-label={t.main} className="hidden flex-1 justify-center lg:flex">
          <ul ref={listRef} className="relative flex items-center gap-0.5" onMouseLeave={() => setHoverKey(null)}>
            <span
              aria-hidden
              className={`absolute top-1/2 left-0 h-9 rounded-full bg-brand-soft ${pillReady ? "transition-[transform,translate,scale,width,opacity] duration-300 ease-out" : ""}`}
              style={{ width: pill.w, transform: `translate(${pill.x}px, -50%)`, opacity: pill.visible ? 1 : 0 }}
            />
            {tabs.map((tab) => {
              const active = tab.key === activeKey;
              return (
                <li key={tab.key} className="relative">
                  <Link
                    href={tab.href}
                    ref={(el) => {
                      if (el) linkRefs.current.set(tab.key, el);
                      else linkRefs.current.delete(tab.key);
                    }}
                    aria-current={active ? "page" : undefined}
                    onMouseEnter={() => setHoverKey(tab.key)}
                    onFocus={() => setHoverKey(tab.key)}
                    onBlur={() => setHoverKey(null)}
                    className={`relative inline-flex h-9 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors duration-200 xl:px-3.5 ${
                      active ? "text-brand-strong" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher current={lang} label={t.language} />
          {/* On phones the theme toggle lives in the menu, so logo + name + language + menu fit in 360 px. */}
          <span className="hidden sm:contents">
            <ThemeToggle labels={{ toDark: t.toDark, toLight: t.toLight }} />
          </span>
          <Link href={ctaHref} className="btn-gradient hidden min-h-10 px-4 py-2 text-sm xl:inline-flex">
            {t.cta}
            <ArrowRight aria-hidden size={16} />
          </Link>
          {/* Hamburger → X */}
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => (open ? close(false) : setOpen(true))}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface lg:hidden"
          >
            <span className="sr-only">{open ? t.closeMenu : t.openMenu}</span>
            <span aria-hidden className="relative block h-3.5 w-4.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="absolute left-0 block h-0.5 w-full rounded-full bg-foreground transition-[transform,translate,scale,opacity,top] duration-300 ease-out"
                  style={{
                    top: open ? "6px" : `${i * 6}px`,
                    transform: open ? (i === 0 ? "rotate(45deg)" : i === 2 ? "rotate(-45deg)" : "scaleX(0)") : "none",
                    opacity: open && i === 1 ? 0 : 1,
                  }}
                />
              ))}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile slide-in menu: plain CSS transitions (no animation library), so every page stays light on 3G.
          Always in the DOM; while closed it is off-screen, invisible and inert (not focusable, hidden from screen readers). */}
      <div
        aria-hidden
        className={`fixed inset-0 top-16 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div
        id="mobile-menu"
        ref={panelRef}
        inert={!open}
        className={`fixed top-16 right-0 bottom-0 z-50 flex w-[min(22rem,88vw)] flex-col gap-6 overflow-y-auto border-l border-line bg-background p-5 shadow-lg transition-[transform,translate,scale,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          open ? "visible translate-x-0" : "invisible translate-x-full"
        }`}
      >
        <nav aria-label={t.main}>
          <ul className="flex flex-col gap-1">
            {tabs.map((tab, i) => {
              const active = tab.key === activeKey;
              return (
                <li
                  key={tab.key}
                  className={`transition-[opacity,transform,translate,scale] duration-300 ease-out ${open ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}
                  style={{ transitionDelay: open ? `${80 + i * 45}ms` : "0ms" }}
                >
                  <Link
                    href={tab.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center rounded-xl px-4 text-base font-medium transition-colors ${
                      active ? "bg-brand-soft text-brand-strong" : "text-foreground hover:bg-surface-2"
                    }`}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-2 sm:hidden">
            <span className="text-sm font-medium text-muted">{t.theme}</span>
            <ThemeToggle labels={{ toDark: t.toDark, toLight: t.toLight }} />
          </div>
          <Link href={ctaHref} onClick={() => setOpen(false)} className="btn-gradient w-full">
            {t.cta}
            <ArrowRight aria-hidden size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}
