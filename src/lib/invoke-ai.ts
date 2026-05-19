import { supabase } from '@/integrations/supabase/client';

const RETRY_DELAY_MS = 700;

/**
 * Invoke a Supabase edge function with one automatic retry.
 *
 * The AI functions (describe-from-photo, meeting-brief, recall-search)
 * are read-only and idempotent, and their most common failure is a cold
 * start on the first call of a session — the on-demand Deno isolate has
 * to boot before it can answer. A single retry after a short pause
 * clears that transient failure before the user ever sees an error.
 *
 * A genuine error (bad API key, Anthropic down) fails both attempts and
 * is thrown to the caller, which surfaces it via friendlyError().
 */
export async function invokeAI<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
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
