import { ImageResponse } from "next/og";

import { LogoMark } from "./logo-mark";
import { getCormorantFont } from "./og-font";

export const runtime = "edge";
export const size = { width: 128, height: 128 };
export const contentType = "image/png";

export default async function Icon() {
  const fonts = await getCormorantFont();
  return new ImageResponse(<LogoMark size={128} />, { ...size, fonts });
}
