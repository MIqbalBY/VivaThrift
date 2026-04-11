/**
 * useMediaUrl — normalises all media URLs to the working endpoint.
 *
 * The database stores absolute CDN URLs: https://cdn.vivathrift.store/{key}
 * or R2 dev URLs: https://pub-fd635ea6682d4ca4a516ca0f81bb25f8.r2.dev/{key}
 *
 * R2 bucket public access has not been enabled yet, so we proxy through
 * our own Nitro route at /media/{key} which uses server-side S3 credentials.
 *
 * Once the Cloudflare R2 custom domain is properly configured, just change
 * `r2PublicUrl` in nuxt.config.ts (or .env) back to the CDN URL and this
 * composable will automatically stop re-writing (CDN URLs will serve directly).
 */
const CDN_ORIGIN = 'https://cdn.vivathrift.store'
const R2_DEV_ORIGIN = 'https://pub-fd635ea6682d4ca4a516ca0f81bb25f8.r2.dev'

/**
 * Transform an absolute media URL to the correct serving endpoint.
 * - cdn.vivathrift.store/... → /media/...  (proxy via Nitro)
 * - pub-*.r2.dev/...        → /media/...  (proxy via Nitro)
 * - anything else           → unchanged
 */
/**
 * Transform an absolute media URL to the correct serving endpoint.
 * - cdn.vivathrift.store/... → /media/...  (proxy via Nitro)
 * - pub-*.r2.dev/...        → /media/...  (proxy via Nitro)
 * - anything else           → unchanged
 *
 * Exported as both a standalone function (for use anywhere) and a composable
 * wrapper for components that prefer destructuring.
 */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null

  // Strip query-string before comparing origin so ?t=... is preserved separately
  let base = url
  let qs = ''
  const qi = url.indexOf('?')
  if (qi !== -1) { base = url.slice(0, qi); qs = url.slice(qi) }

  if (base.startsWith(CDN_ORIGIN + '/')) {
    return '/media/' + base.slice(CDN_ORIGIN.length + 1) + qs
  }
  if (base.startsWith(R2_DEV_ORIGIN + '/')) {
    return '/media/' + base.slice(R2_DEV_ORIGIN.length + 1) + qs
  }
  return url
}

/** Composable wrapper — kept for backwards compat with components that already destructure it. */
export function useMediaUrl() {
  return { mediaUrl }
}
