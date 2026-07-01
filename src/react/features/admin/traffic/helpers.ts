/**
 * Traffic view helpers — URL classification (main site vs portal) and formatting.
 */

/**
 * Path prefixes that identify portal/authenticated traffic. Everything else is
 * treated as public "main site" traffic. Mirrors the portal routes proxied to
 * the API server (see vercel.json rewrites).
 */
const PORTAL_PATH_MARKERS = [
  '/dashboard',
  '/portal',
  '/client',
  '/admin',
  '/intake',
  '/set-password',
  '/forgot-password',
  '/reset-password'
];

/** Extract the path (+ hash) from a stored URL, tolerating relative values. */
export function urlPath(url: string): string {
  if (!url) return '/';
  try {
    const u = new URL(url, 'https://placeholder.local');
    return `${u.pathname}${u.hash}` || '/';
  } catch {
    return url;
  }
}

/** True when a page-view URL belongs to the portal rather than the public site. */
export function isPortalUrl(url: string): boolean {
  const path = urlPath(url).toLowerCase();
  return PORTAL_PATH_MARKERS.some((marker) => path.startsWith(marker));
}

/** Human label for where a URL lives. */
export function trafficSource(url: string): 'Portal' | 'Main Site' {
  return isPortalUrl(url) ? 'Portal' : 'Main Site';
}

/** Format a duration in seconds as `m:ss` (or `0:ss`). */
export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Compact relative time like "just now", "3m ago", "2h ago". */
export function formatRelativeTime(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffSec = Math.max(0, Math.round((nowMs - then) / 1000));
  if (diffSec < 45) return 'just now';
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
