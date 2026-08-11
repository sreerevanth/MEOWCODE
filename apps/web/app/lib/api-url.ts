/** Public API base URL. Empty string uses same-origin /v1/* (proxied by Next.js). */
export function getPublicApiUrl(): string {
  return process.env.NEXT_PUBLIC_MEOW_API_URL?.replace(/\/$/, "") ?? "";
}
