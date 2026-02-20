/** Cormorant Garamond 600 for OG/icon (Satori). Satori supports TTF/OTF/WOFF only, not WOFF2. */
const CORMORANT_WOFF_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@5.0.0/files/cormorant-garamond-latin-600-normal.woff";

export const CORMORANT_FONT_NAME = "Cormorant Garamond";

export async function getCormorantFont() {
  const res = await fetch(CORMORANT_WOFF_URL);
  if (!res.ok) throw new Error("Failed to load Cormorant font");
  const data = await res.arrayBuffer();
  return [
    {
      name: CORMORANT_FONT_NAME,
      data,
      style: "normal" as const,
      weight: 600 as const,
    },
  ];
}
