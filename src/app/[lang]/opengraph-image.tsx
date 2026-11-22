import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SokhaPheap — Know your health risk early, and find care near you.";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          padding: 80, background: "linear-gradient(135deg, #0f766e 0%, #0b5c56 100%)", color: "white", fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.9, display: "flex" }}>❤️ SokhaPheap</div>
        <div style={{ fontSize: 72, fontWeight: 800, marginTop: 24, lineHeight: 1.1, display: "flex" }}>
          Know your health risk early, and find care near you.
        </div>
        <div style={{ fontSize: 30, marginTop: 32, opacity: 0.9, display: "flex" }}>
          Diabetes &amp; heart risk check · Blood test explainer · Health facility map — Cambodia
        </div>
      </div>
    ),
    size,
  );
}
