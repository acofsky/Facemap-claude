-- Add 'spreadsheet' to the import_candidates source CHECK constraint so the
-- new generic spreadsheet source can write rows. Plain ALTER — Postgres
-- preserves data through the DROP/ADD cycle since 'spreadsheet' is a strict
-- superset of the existing allowed values.

ALTER TABLE public.import_candidates
  DROP CONSTRAINT IF EXISTS import_candidates_source_check;

ALTER TABLE public.import_candidates
  ADD CONSTRAINT import_candidates_source_check
  CHECK (source IN ('contacts','linkedin','calendar','photo_ocr','spreadsheet'));

NOTIFY pgrst, 'reload schema';
