# Future premium features

A scratchpad for things we've designed the placeholders for but haven't
shipped. The plumbing exists (UI surfaces, prompts, info modal copy);
the missing piece is the actual paywall + per-feature logic.

## AI enrichment per contact

**Where it's stubbed:**

- `src/components/EnrichInfoModal.tsx` — shared info/upsell modal
- `src/pages/ProfilePage.tsx` — Preferences → "AI Enrichment" row with `Soon` chip
- `src/pages/PeoplePage.tsx` — "Enrich all" glass pill next to "Smart Import"

**What it does (when shipped):**

Per-person AI run that goes beyond the import-source data: web-search for
recent role changes, public bio, company background, mutual connections.
Writes new bullets to the About field. Costs more compute per person than
the import scan (which only scores existing fields), so it lives behind a
Premium gate.

**Implementation notes:**

- New edge function, e.g. `enrich-person`, calling Claude with web search
  tool use. Takes a person id; returns merged bullets.
- Batch "Enrich all" should chunk and rate-limit.
- Gate via the eventual subscription mechanism (StoreKit on iOS, etc.).

## LinkedIn profile photo scrape

**Why it's deferred:**

LinkedIn's Connections.csv export does NOT include profile photos. Pulling
them would require scraping the `URL` field per contact, which is TOS gray
and would likely need an Anthropic computer-use-style flow. Acceptable in
a Premium tier with explicit user consent; not in a free import.

**What's in place:**

- `linkedin-source.ts` already stores `raw.linkedin_url` for every CSV row,
  so the field is available for a future enrichment pass.
- Disclosure copy in `LinkedInHowToModal` already notes that photos aren't
  in the export.

## Gmail as a source (v1.5)

**What:** OAuth Gmail, parse the last 6–12 months of "From:" addresses
plus extracted signatures into contact stubs. Pipe through the same
ranking + drawer flow.

**Pre-work needed:**

1. Google Cloud project + OAuth client + verified domain
2. Supabase edge function to handle the auth redirect (the Linux VM can't
   reach Google directly during dev, same constraint as the Supabase work)
3. A small parser for signature blocks (likely a Claude call per thread)
4. The `import_candidates` schema already accommodates this — just add
   `gmail` to the CHECK constraint on `source` and add a new
   `gmail-source.ts` module.

## PDF support in the "A file" source

The merged file picker accepts CSV / Excel / images today. PDFs throw a
friendly `UnsupportedFileError` — the plumbing in `file-source.ts` already
checks for the MIME type, the missing piece is the parser.

Two routes:

1. **Server-side via Claude Vision:** Anthropic's `document` content type
   accepts PDFs directly. The `describe-from-photo` edge function already
   handles the `extract_people` mode and just needs a branch for PDFs —
   stream the file to Supabase Storage, sign a URL, pass as a document
   block instead of an image block.
2. **Client-side via pdf.js:** render each page to a canvas, OCR each as
   an image. More bundle weight, no edge-function changes.

Probably (1). Worth doing whenever a user shows up with a PDF directory or
conference list.

## Calendar as a source

Plumbing is in place (`calendar-source.ts`, picker UI shows the option
with a "Soon" chip). What's needed:

1. Add `@ebarooni/capacitor-calendar` (or similar) to `package.json`
2. Add `NSCalendarsFullAccessUsageDescription` to `ios/App/App/Info.plist`
3. Flip `isCalendarSourceAvailable()` to true and implement
   `gatherCalendarCandidates()` per the TODO in that file
4. New Codemagic build to run `npx cap sync ios` and rebuild
