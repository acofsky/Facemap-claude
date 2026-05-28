import type { Tables } from '@/integrations/supabase/types';

export type ImportSource = 'contacts' | 'linkedin' | 'spreadsheet' | 'calendar' | 'photo_ocr';

export type ImportCandidateRow = Tables<'import_candidates'>;
export type ImportSessionRow = Tables<'import_sessions'>;

/**
 * Extra free-text fields a source can pre-fill on a candidate, beyond the
 * always-known identity fields (name/email/phone/company/title). Mirror the
 * `persons` table columns so promote can copy them across without any
 * translation layer.
 *
 * Sources don't have to populate every field — a spreadsheet might fill
 * `how_we_met` + `misc_notes` but not `physical_description`, and a Contacts
 * row populates none of them.
 */
export interface MappedPersonFields {
  how_we_met?: string;
  where_when?: string;
  physical_description?: string;
  misc_notes?: string;
  important_info?: string;
  known_people_notes?: string;
}

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
  /** Source-mapped values that should land directly on the Person row. */
  mappedFields?: MappedPersonFields;
  /** Whatever the source returned, kept verbatim for debugging / future use. */
  raw?: Record<string, unknown>;
}
