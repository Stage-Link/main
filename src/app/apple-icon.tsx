import { ImageResponse } from "next/og";

import { LogoMark } from "./logo-mark";
import { getCormorantFont } from "./og-font";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — iOS requires PNG. Transparent renders white in Resvg, so we use dark bg. */
export default async function AppleIcon() {
  const fonts = await getCormorantFont();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0C0A09",
      }}
    >
      <LogoMark size={180} noBorder />
    </div>,
    { ...size, fonts }
  );
}
