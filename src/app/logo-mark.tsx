import { CORMORANT_FONT_NAME } from "./og-font";

/** Shared logo mark for icon.tsx, apple-icon.tsx, opengraph-image.tsx. Inline styles only (Satori). */
export function LogoMark({
  size,
  fontFamily = CORMORANT_FONT_NAME,
  noBorder = false,
  /** Bright variant for favicon — Safari adds white bg when icon is too dark */
  bright = false,
}: {
  size: number;
  fontFamily?: string;
  /** Omit border for favicon to avoid white artifact in Safari */
  noBorder?: boolean;
  /** Gold bg + dark text for PWA/Safari — prevents Safari adding white border */
  bright?: boolean;
}) {
  const stroke = Math.max(1, Math.floor(size / 48));
  const fontSize = Math.floor(size * 0.5);
  const dotR = Math.floor(size * 0.08);
  const bg = bright ? "#C9A227" : "#0C0A09";
  const textColor = bright ? "#0C0A09" : "#C9A227";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        borderRadius: Math.floor(size / 6),
        ...(noBorder ? {} : { border: `${stroke}px solid rgba(201, 162, 39, 0.4)` }),
      }}
    >
      <span
        style={{
          color: textColor,
          fontSize,
          fontWeight: 600,
          fontFamily: `${fontFamily}, serif`,
          letterSpacing: "-0.04em",
        }}
      >
        SL
      </span>
      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: Math.floor(size * 0.1),
          right: Math.floor(size * 0.1),
          width: dotR * 2,
          height: dotR * 2,
          borderRadius: "50%",
          backgroundColor: "#B71C2E",
        }}
      />
    </div>
  );
}
