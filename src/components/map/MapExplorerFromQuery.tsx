"use client";

import { useSearchParams } from "next/navigation";
import type { ComponentProps } from "react";
import { MapExplorer } from "./MapExplorer";

type Props = ComponentProps<typeof MapExplorer>;

/** Reads ?type= in the browser, so the page can be prerendered (GitHub Pages). */
export function MapExplorerFromQuery({ types, ...props }: Omit<Props, "typeFilter"> & { types: readonly string[] }) {
  const type = useSearchParams().get("type");
  const typeFilter = type && types.includes(type) ? (type as Props["typeFilter"]) : null;
  return <MapExplorer key={typeFilter ?? "all"} {...props} typeFilter={typeFilter} />;
}
