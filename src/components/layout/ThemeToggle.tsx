"use client";

import { Moon, Sun } from "lucide-react";

export const THEME_KEY = "sokhapheap-theme";

/**
 * Inline script for <head>: applies the saved theme before the first paint, so there is no flash of the
 * wrong theme. Dark is the default (DESIGN.md §3); light is the person's own choice.
 * See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t="dark"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

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
      className={`ctrl ${className}`}
    >
      <span className="theme-icon-light">
        <Moon aria-hidden size={20} strokeWidth={1.5} />
        <span className="sr-only">{labels.toDark}</span>
      </span>
      <span className="theme-icon-dark">
        <Sun aria-hidden size={20} strokeWidth={1.5} />
        <span className="sr-only">{labels.toLight}</span>
      </span>
    </button>
  );
}
