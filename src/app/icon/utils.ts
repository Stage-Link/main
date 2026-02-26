export function isSafari(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return userAgent.includes("Safari") && !userAgent.includes("Chrome");
}

/** SVG favicon (gold SL + red dot, transparent bg) — Safari uses this for true transparency. */
export function safariIconSvg(size: number): string {
  const dotR = Math.floor(size * 0.08);
  const fontSize = Math.floor(size * 0.5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="600" fill="#C9A227" font-family="Georgia, serif" letter-spacing="-0.04em">SL</text>
<circle cx="${size - dotR * 2}" cy="${size - dotR * 2}" r="${dotR}" fill="#B71C2E"/>
</svg>`;
}
