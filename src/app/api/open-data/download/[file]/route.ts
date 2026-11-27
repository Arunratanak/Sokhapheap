import { DOWNLOADS, readDownload, type DownloadFile } from "@/server/insights/data";

/** Processed open data given back as open data (CC BY 4.0). Prebuilt at build time. */
export const dynamic = "force-static";
export function generateStaticParams() {
  return Object.keys(DOWNLOADS).map((file) => ({ file }));
}

export async function GET(_req: Request, ctx: RouteContext<"/api/open-data/download/[file]">) {
  const { file } = await ctx.params;
  if (!(file in DOWNLOADS)) return new Response("Not found", { status: 404 });
  return new Response(readDownload(file as DownloadFile), {
    headers: {
      "Content-Type": DOWNLOADS[file as DownloadFile],
      "Content-Disposition": `attachment; filename="sokhapheap_${file}"`,
      "Cache-Control": "public, max-age=86400",
      "X-License": "CC-BY-4.0",
    },
  });
}
