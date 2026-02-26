import { ImageResponse } from "next/og";

import { LogoMark } from "../logo-mark";
import { getCormorantFont } from "../og-font";

import { isSafari } from "./utils";

export const runtime = "edge";

export async function GET(request: Request) {
  const userAgent = request.headers.get("User-Agent");
  const transparent = isSafari(userAgent);
  const size = 128;
  const fonts = await getCormorantFont();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: transparent ? "transparent" : "#0C0A09",
      }}
    >
      <LogoMark size={size} noBorder transparent={transparent} />
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
