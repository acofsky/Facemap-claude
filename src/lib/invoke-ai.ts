import { supabase } from '@/integrations/supabase/client';

// Three attempts with exponential backoff. Most cold starts on Supabase
// edge functions complete in 500ms-1.5s; if the isolate is rebuilding
// (deploy just happened, or it's been hours of inactivity) it can take
// up to ~2.5s. The 700ms / 1500ms gaps catch both cases without making
// real failures feel slow — the first retry fires before most users
// would have realized anything was off.
const RETRY_DELAYS_MS = [700, 1500];

/**
 * Invoke a Supabase edge function with automatic cold-start retries.
 *
 * The AI functions (describe-from-photo, meeting-brief, recall-search,
 * parse-voice-input) are read-only and idempotent. Their most common
 * failure is a cold start on the first call of a session — the on-demand
 * Deno isolate has to boot before it can answer. We do two retries with
 * exponential backoff, which clears the vast majority of cold-start
 * failures before the user ever sees an error.
 *
 * For non-2xx responses, Supabase's FunctionsHttpError swallows the body
 * and surfaces the unhelpful 'Edge Function returned a non-2xx status
 * code'. When the function returned `{ error: "..." }` in its body, we
 * fish the real message out via `error.context` so callers see something
 * actionable (rate limit, schema mismatch, missing API key, etc.) instead
 * of the generic wrapper.
 */
export async function invokeAI<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  let lastError: unknown;
  // Total attempts = 1 initial + RETRY_DELAYS_MS.length retries.
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
    }
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) {
        const unwrapped = await unwrapFunctionError(error);
        throw unwrapped;
      }
      if (
        data &&
        typeof data === 'object' &&
        'error' in data &&
        (data as { error?: unknown }).error
      ) {
        throw new Error(String((data as { error: unknown }).error));
      }
      return data as T;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

async function unwrapFunctionError(err: unknown): Promise<Error> {
  // FunctionsHttpError has a `context` property that is the raw Response.
  // We try to read its JSON body so the actual error message bubbles up.
  // If anything in this fishing expedition fails we fall back to the
  // original error.
  if (err && typeof err === 'object' && 'context' in err) {
    const ctx = (err as { context?: unknown }).context;
    if (ctx instanceof Response) {
      try {
        // `context` is the raw fetch Response; cloning lets the original
        // error keep its body in case anything else reads it.
        const cloned = ctx.clone();
        const body = await cloned.json();
        if (body && typeof body === 'object' && 'error' in body && body.error) {
          return new Error(String((body as { error: unknown }).error));
        }
      } catch {
        // Body wasn't JSON or already consumed — fall through.
      }
    }
  }
  if (err instanceof Error) return err;
  return new Error(String(err));
}

/**
 * Pre-warm an AI edge function by firing a `{ warm: true }` ping. The
 * function checks the flag and returns 200 immediately without calling
 * Anthropic, so the call is cheap (no model cost) but boots the Deno
 * isolate so the user's next real call hits a hot function.
 *
 * Fire-and-forget — errors are swallowed because pre-warming is best
 * effort and we don't want a stale token or network blip to turn into a
 * user-visible toast.
 */
export function prewarm(fn: string): void {
  supabase.functions.invoke(fn, { body: { warm: true } }).catch(() => {
    /* swallow — best-effort */
  });
}
