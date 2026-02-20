import { ImageResponse } from "next/og";

import { LogoMark } from "./logo-mark";
import { CORMORANT_FONT_NAME, getCormorantFont } from "./og-font";

export const runtime = "edge";
export const alt = "Stage Link";
export const size = { width: 1200, height: 630 };

export default async function OpenGraphImage() {
  const fonts = await getCormorantFont();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0C0A09",
          padding: 80,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            marginBottom: 48,
          }}
        >
          <LogoMark size={120} />
        </div>
        <h1
          style={{
            color: "#F5F0E8",
            fontSize: 72,
            fontWeight: 600,
            fontFamily: `${CORMORANT_FONT_NAME}, serif`,
            letterSpacing: "-0.02em",
            margin: 0,
            marginBottom: 16,
          }}
        >
          Stage Link
        </h1>
        <p
          style={{
            color: "#A89B8C",
            fontSize: 32,
            fontWeight: 400,
            fontFamily: `${CORMORANT_FONT_NAME}, serif`,
            margin: 0,
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          Real-time stage monitoring for theater crews
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 48,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#B71C2E",
            }}
          />
          <span
            style={{
              color: "#A89B8C",
              fontSize: 24,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            See the stage from anywhere, in real-time
          </span>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
