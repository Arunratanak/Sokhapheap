/**
 * Where the browser sends API calls. Empty means same origin (the Render deployment).
 * The GitHub Pages build sets NEXT_PUBLIC_API_BASE to the Render backend, because Pages only
 * serves static files and cannot run the /api routes.
 */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

/** Prefix for files in /public. Needed under a basePath, e.g. /Sokhapheap on GitHub Pages. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
