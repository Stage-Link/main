import { ImageResponse } from "next/og";

import { LogoMark } from "../logo-mark";
import { getCormorantFont } from "../og-font";

export const runtime = "edge";

export async function GET() {
  const size = 64;
  const fonts = await getCormorantFont();
  return new ImageResponse(<LogoMark size={size} />, {
    width: size,
    height: size,
    fonts,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/png",
    },
  });
}
