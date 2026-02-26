import { ImageResponse } from "next/og";

import { LogoMark } from "../logo-mark";
import { getCormorantFont } from "../og-font";
import { isSafari, safariIconSvg } from "../icon/utils";

export const runtime = "edge";

export async function GET(request: Request) {
  const userAgent = request.headers.get("User-Agent");
  const useSafariSvg = isSafari(userAgent);
  const size = 64;

  if (useSafariSvg) {
    const svg = safariIconSvg(size);
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

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
