/**
 * Turn raw errors into a sentence safe to show a user.
 *
 * Supabase's `functions.invoke` throws low-level strings on a flaky
 * connection — e.g. "Failed to send a request to the Edge Function" — which
 * are confusing in a toast. Detect connectivity failures and swap in a plain
 * explanation; for anything else fall back to a friendly, context-specific
 * message rather than leaking internal error text.
 */

export const OFFLINE_MESSAGE =
  "You're offline or your connection is weak. Check your connection and try again.";

const CONNECTIVITY_HINTS = [
  'failed to send a request',
  'failed to fetch',
  'networkerror',
  'network request failed',
  'load failed',
  'err_network',
  'err_internet_disconnected',
  'err_connection',
  'the network connection was lost',
  'timeout',
  'timed out',
  'fetch event',
];

function messageOf(e: unknown): string {
  if (!e) return '';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return '';
}

/**
 * @param e        the caught error
 * @param fallback context-specific message for non-connectivity failures
 *                 (e.g. "Couldn't generate a description. Try again.")
 */
export function friendlyError(e: unknown, fallback: string): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return OFFLINE_MESSAGE;
  }
  const raw = messageOf(e).toLowerCase();
  if (raw && CONNECTIVITY_HINTS.some((hint) => raw.includes(hint))) {
    return OFFLINE_MESSAGE;
  }
  return fallback;
}
