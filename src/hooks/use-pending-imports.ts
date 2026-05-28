import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Counts unpromoted, undismissed import candidates across all sessions.
 * Used by PeoplePage to show a "N waiting" badge on the import button.
 *
 * Stale-while-revalidate so the count updates after a promote/dismiss but
 * doesn't refetch on every page navigation. The wizard and pending-sheet
 * both invalidate this query on mutations.
 */
export function usePendingImportsCount() {
  return useQuery({
    queryKey: ['import_candidates_pending'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('import_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('promoted', false)
        .eq('dismissed', false);
      if (error) throw error;
      return count || 0;
    },
    staleTime: 30_000,
  });
}
