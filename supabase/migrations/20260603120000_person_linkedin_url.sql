-- Add a LinkedIn profile URL to people, parallel to ios_contact_id.
-- Lets a Membr person be linked to a LinkedIn profile — set manually from
-- the person's "Links" section, or auto-filled when the person was imported
-- from a LinkedIn connections export (which carries the URL in the row).
alter table public.persons
  add column if not exists linkedin_url text;
