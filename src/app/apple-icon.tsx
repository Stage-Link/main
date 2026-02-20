import { ImageResponse } from "next/og";

import { LogoMark } from "./logo-mark";
import { getCormorantFont } from "./og-font";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const fonts = await getCormorantFont();
  return new ImageResponse(<LogoMark size={180} />, { ...size, fonts });
}
