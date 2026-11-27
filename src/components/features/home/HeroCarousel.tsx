"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useReducedMotion } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { toKhmerDigits } from "@/lib/client/util";
import { HeroVisual, type HeroVisualData } from "./HeroVisual";

export interface HeroSlide {
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
  visual: HeroVisualData;
}

export interface CarouselLabels {
  label: string; prev: string; next: string; pause: string; play: string; slideOf: string; goTo: string;
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? `{${k}}`));

/**
 * Accessible hero carousel (Embla): autoplay every 5.5 s, paused on hover/focus, when the tab is hidden
 * (plugin) and by the pause button; swipe, arrows, dots and ←/→ keys. Autoplay is off with reduced motion.
 */
export function HeroCarousel({ slides, labels, lang }: { slides: HeroSlide[]; labels: CarouselLabels; lang: "en" | "km" }) {
  const digits = (n: number) => (lang === "km" ? toKhmerDigits(n) : String(n));
  const reduce = useReducedMotion();
  // One plugin instance for the component's lifetime (lazy state initialiser, not read from a ref during render).
  const [autoplay] = useState(() => Autoplay({ delay: 5500, playOnInit: false, stopOnInteraction: false, stopOnMouseEnter: true, stopOnFocusIn: true }));
  const [viewportRef, api] = useEmblaCarousel({ loop: true, duration: 30 }, [autoplay]);
  const [selected, setSelected] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    // The plugin resumes after mouse-leave/focus-out; honour the user's pause button.
    const onPlay = () => pausedRef.current && autoplay.stop();
    onSelect();
    api.on("select", onSelect).on("reInit", onSelect).on("autoplay:play", onPlay);
    return () => {
      api.off("select", onSelect).off("reInit", onSelect).off("autoplay:play", onPlay);
    };
  }, [api, autoplay]);

  // Start autoplay only when motion is allowed.
  useEffect(() => {
    if (!api) return;
    if (reduce || pausedRef.current) autoplay.stop();
    else autoplay.play();
  }, [api, autoplay, reduce]);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setUserPaused(next);
    if (next) autoplay.stop();
    else if (!reduce) autoplay.play();
  }, [autoplay, reduce]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      api?.scrollPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      api?.scrollNext();
    }
  };

  const playing = !userPaused && !reduce;
  const total = slides.length;

  return (
    <section aria-roledescription="carousel" aria-label={labels.label} onKeyDown={onKeyDown} className="relative">
      <div ref={viewportRef} className="overflow-hidden">
        <div className="flex touch-pan-y">
          {slides.map((s, i) => {
            const active = i === selected;
            const Heading = i === 0 ? "h1" : "h2"; // one h1 per page
            return (
              <div
                key={s.title}
                role="group"
                aria-roledescription="slide"
                aria-label={fill(labels.slideOf, { n: digits(i + 1), total: digits(total) })}
                aria-hidden={!active}
                inert={!active}
                className="min-w-0 shrink-0 grow-0 basis-full"
              >
                <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pt-10 pb-6 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:pt-16">
                  <div className={`transition-[opacity,transform,translate,scale] duration-300 ease-enter ${active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
                    <p className="eyebrow">{s.eyebrow}</p>
                    <Heading className="mt-3 text-display font-semibold text-balance">
                      {s.title}
                    </Heading>
                    <p className="mt-4 max-w-xl text-body text-secondary">{s.desc}</p>
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link href={s.href} className="btn-primary w-full sm:w-auto">
                        {s.cta}
                        <ArrowRight aria-hidden size={20} />
                      </Link>
                    </div>
                  </div>
                  <div className={`transition-opacity delay-75 duration-300 ease-enter ${active ? "opacity-100" : "opacity-0"}`}>
                    <HeroVisual data={s.visual} active={active} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 pb-4 sm:px-8">
        <button type="button" onClick={togglePause} className="ctrl" aria-label={playing ? labels.pause : labels.play}>
          {playing ? <Pause aria-hidden size={20} /> : <Play aria-hidden size={20} />}
        </button>
        <div className="flex items-center gap-1">
          {slides.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => api?.scrollTo(i)}
              aria-label={fill(labels.goTo, { n: digits(i + 1) })}
              aria-current={i === selected ? "true" : undefined}
              className="group inline-flex h-11 items-center px-1"
            >
              <span
                className={`block h-2 rounded-full transition-[width,background-color] duration-200 ease-enter ${
                  i === selected ? "w-8 bg-gold" : "w-2 bg-surface-3 group-hover:bg-border-strong"
                }`}
              />
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => api?.scrollPrev()} className="ctrl" aria-label={labels.prev}>
            <ChevronLeft aria-hidden size={20} />
          </button>
          <button type="button" onClick={() => api?.scrollNext()} className="ctrl" aria-label={labels.next}>
            <ChevronRight aria-hidden size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}
