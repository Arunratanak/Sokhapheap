"use client";

import { Moon, Sun } from "lucide-react";

export const THEME_KEY = "sokhapheap-theme";

/**
 * Inline script for <head>: applies the saved theme (or the system setting) before the first paint,
 * so there is no flash of the wrong theme. See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

/**
 * Sun/moon button. Which icon shows is decided by CSS from [data-theme] (globals.css), so the button
 * is correct before hydration and React never has to read the theme during render.
 */
export function ThemeToggle({ labels, className = "" }: { labels: { toDark: string; toLight: string }; className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.classList.add("theme-transition");
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage blocked (private mode): the choice lasts for this page only */
    }
    window.setTimeout(() => root.classList.remove("theme-transition"), 250);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-foreground transition-colors hover:border-accent hover:text-brand-strong ${className}`}
    >
      <span className="theme-icon-light transition-transform duration-300 ease-out group-hover:-rotate-12">
        <Moon aria-hidden size={18} />
        <span className="sr-only">{labels.toDark}</span>
      </span>
      <span className="theme-icon-dark transition-transform duration-300 ease-out group-hover:rotate-45">
        <Sun aria-hidden size={18} />
        <span className="sr-only">{labels.toLight}</span>
      </span>
    </button>
  );
}
