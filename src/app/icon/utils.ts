export function isSafari(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return userAgent.includes("Safari") && !userAgent.includes("Chrome");
}
