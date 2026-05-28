import type { Tables } from '@/integrations/supabase/types';

export type ImportSource = 'contacts' | 'linkedin' | 'spreadsheet' | 'calendar' | 'photo_ocr';

export type ImportCandidateRow = Tables<'import_candidates'>;
export type ImportSessionRow = Tables<'import_sessions'>;

/**
 * Raw stub produced by a source adapter, before insertion into the DB.
 * Everything optional except name + source — sources differ wildly in what
 * fields they can fill, and the ranking pass downstream handles sparseness.
 */
export interface CandidateDraft {
  source: ImportSource;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  /** Storage-bucket path. Use `uploadPhoto()` from store.ts to produce one. */
  photoPath?: string;
  /** Free-form per-source detail folded into the AI prompt as `context:`. */
  context?: string;
  /** Whatever the source returned, kept verbatim for debugging / future use. */
  raw?: Record<string, unknown>;
}
