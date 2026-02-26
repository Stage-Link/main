import { ImageResponse } from "next/og";

import { LogoMark } from "./logo-mark";
import { getCormorantFont } from "./og-font";

export const runtime = "edge";
export const size = { width: 128, height: 128 };
export const contentType = "image/png";

export default async function Icon() {
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
      <LogoMark size={128} noBorder />
    </div>,
    { ...size, fonts }
  );
}
