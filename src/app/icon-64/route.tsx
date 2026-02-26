import { ImageResponse } from "next/og";

import { LogoMark } from "../logo-mark";
import { getCormorantFont } from "../og-font";

export const runtime = "edge";

export async function GET() {
  const size = 64;
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
      <LogoMark size={size} noBorder />
    </div>,
    {
      width: size,
      height: size,
      fonts,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "image/png",
      },
    }
  );
}
