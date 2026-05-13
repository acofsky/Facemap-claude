# Membr (formerly FaceMap) — repo context for Claude Code

## What this is

**Membr** (renamed from FaceMap; iOS bundle ID kept for App Store continuity) is a Capacitor 7 iOS app: a Vite + React + TypeScript + shadcn/ui PWA wrapped in a native iOS shell.

- Bundle ID: `com.acofsky.facemap` (legacy — app display name is `Membr`)
- App display name: `Membr`
- Apple Team ID: `C59FSCZHFV` (Adam Cofsky)
- Supabase project: `sgkjdtbrnxrirymneyyq` (in user's own account; was previously a Lovable-managed project `qlsigdhtrjlplmeqcexu`)
- AI provider: Anthropic Claude Haiku 4.5 via `api.anthropic.com` (replaced Lovable's AI gateway)
- The user works on **iPad only** — no local terminal, no Mac. All editing happens through Claude Code.
- All builds happen on **Codemagic's cloud Mac**. The user never touches Xcode.
- The app is already in **TestFlight**.

## The Mac-free pipeline

```
iPad ── (chat with Claude) ──> Linux VM ── (git push) ──> Lovable proxy ──> GitHub ──> Codemagic cloud Mac ── (xcodebuild + signing) ──> TestFlight ──> iPhone
```

Three machines, the user only ever touches the iPad. Claude (you) does the editing on the Linux VM. Codemagic does the building. TestFlight delivers.

## Branches

There are **two branches** with `codemagic.yaml`:

- **The dev branch — `claude/ios-simulator-setup-XXXXX`** (the suffix is a random per-session ID assigned by Claude Code on the web; **don't hardcode it in docs or YAML**). All real work happens on whichever branch the current session is assigned to. Codemagic's `branch_patterns` uses a wildcard (`claude/ios-simulator-setup-*`) so auto-triggers fire from any session's branch.
- **`claude/pwa-to-ios-conversion-F3VuG`** — the GitHub default branch. Codemagic discovers `codemagic.yaml` here. Keep this branch in sync with the dev branch's `codemagic.yaml` and `CLAUDE.md` whenever they change. Otherwise no other code lives here that we modify.

**Workflow when changing `codemagic.yaml`:** edit on the dev branch → commit + push → checkout default branch → `git checkout <dev-branch> -- codemagic.yaml CLAUDE.md` → commit + push → checkout dev branch. Replace `<dev-branch>` with the current session's branch name (find it via `git branch --show-current`).

## Codemagic workflows

Two workflows live in `codemagic.yaml`:

### `ios-livereload` (the one you'll use 99% of the time)

- **Workflow ID is `ios-livereload`. Display name is "iOS Internal (TestFlight, every push)".** Don't rename the ID — it's intentionally kept to preserve the Codemagic cache keying that holds the distribution cert + private key. Renaming the ID orphans the cache, forcing a re-mint that Apple will reject (409: cert already exists).
- **Trigger:** auto on push to any branch matching `claude/ios-simulator-setup-*` *if the user has the auto-build toggle on in Codemagic settings*. The user typically prefers **manual triggers** ("Start new build" in Codemagic UI) because they batch changes.
- **What it does:** builds the iOS IPA with vanilla config (no `server.url`, no live-reload), uploads to TestFlight internal group `LiveReload`.
- **Build time:** ~10 min.
- **Bundle versions:** offset by `+99000` so internal builds sort visibly above production in App Store Connect.

### `ios-production`

- **Trigger:** push of a tag matching `v*.*.*` (e.g. `v0.1.0`).
- **What it does:** builds vanilla IPA, uploads to TestFlight `External Testers` group. **Does not yet auto-submit to App Store** — `submit_to_app_store: false`. To ship to the App Store production track: change that to `true` and add `release_type: AFTER_APPROVAL` (Codemagic rejects `release_type` unless `submit_to_app_store: true`).
- Apple's review still happens out-of-band in App Store Connect (~24–48h).

## Code signing — the painful history that's now solved

The signing pipeline took several iterations to get right. **Don't re-litigate this without a strong reason.** Current state:

- Signing identity: a fresh **iOS Distribution certificate** named `iOS Distribution: Adam Cofsky (R72Z2C534V)`, valid until **May 2027**. It was minted by Codemagic during the first successful build using a private key generated in-build with `openssl genrsa`.
- The user's friend's original distribution certificate still exists in App Store Connect but is **not used** — its private key only lives on his Mac.
- Apple allows 3 distribution certs per team; we currently use 1 of 3 slots (or 2, including the friend's).
- Provisioning profile: `FaceMap ios_app_store 1778153984 (82MQA99PG7)`, auto-created by `app-store-connect fetch-signing-files --create`.
- The cert + private key are persisted across builds via Codemagic cache (`/Users/builder/Library/codemagic-cli-tools` is in `cache_paths`). A flag file `dist_cert_minted.flag` in that cache prevents re-minting on every build.

If the cache is ever cleared (Codemagic UI → app → Cache → Clear), the next build will mint a NEW cert (using one more of the 3 slots). This is a destructive action — only do it if there's a real reason.

### Gotchas we hit

1. **Codemagic implicit `ios_signing` block was using `fetch-signing-files` without `--create`.** Removed the `environment.ios_signing` block; signing is now driven entirely by an explicit script.
2. **`certificates create` doesn't auto-generate a private key.** Must pass one in via `--certificate-key`. Generated locally with `openssl genrsa`.
3. **`xcode-project use-profiles` doesn't accept `--xcode-project-patterns` or `--warnings-as-errors`** in this version of the CLI. Just call it bare.
4. **`Pods.xcodeproj` exists alongside `App.xcodeproj` after pod install.** Default `**/*.xcodeproj` glob hits both; harmless because Pods has no signing requirements.

## Codemagic integration name

In `codemagic.yaml`, both workflows reference `app_store_connect: MembrCodeMagicAPIKey`. **This must match the alias** the user gave the App Store Connect API key in Codemagic → Teams → Integrations. Don't rename casually.

The actual Apple-side API key has **Admin** access — anything less can't auto-create certs/profiles.

## Daily workflow (the one we want to optimize for)

User asks Claude to make changes (typically in **batches** — they prefer to accumulate several edits before triggering a build).

1. Make the change(s) in `src/`.
2. `git add -A && git commit -m "..." && git push origin $(git branch --show-current)`. Multiple commits are fine — only one build will be triggered when the user manually clicks Start.
3. **The user manually triggers the Codemagic build** when they're ready: Codemagic UI → Start new build → branch (the session's current `claude/ios-simulator-setup-XXXXX`) → workflow `iOS Internal (TestFlight, every push)` (ID `ios-livereload`) → Start. ~10 min.
4. TestFlight notifies the user's iPhone. They install and test.
5. If broken: iterate. Don't squash-rebase mid-iteration unless asked.

**Be deliberate about commit/push frequency.** Each manual build trigger = ~10 min of CI. Free tier = 500 min/month ≈ 50 builds. Batching changes into one build is the user's stated preference.

## What's NOT set up

- **No live-reload to phone.** We considered it (cloudflared / localtunnel / ngrok) but the iPad-only setup means the dev server has nowhere persistent to live. User explicitly chose to skip it. If revisiting: see Capacitor's `server.url` config and the env-gate already present in `capacitor.config.ts` (`process.env.CAP_LIVE_RELOAD`). The infra would need an always-on cloud VM (e.g. Fly.io ~$5/mo) or a tunnel that reliably works from the Lovable Linux VM.
- **No Capacitor Live Updates / Capgo / CodePush.** Web-bundle OTA updates require a plugin that wasn't included in the build. Adding one is a future project.
- **No Android workflow.** `@capacitor/android` is in deps but no Codemagic workflow targets it. App Store-only for now.

## Critical files

- **`codemagic.yaml`** — the entire build pipeline. Two workflows, shared script anchors via YAML refs.
- **`capacitor.config.ts`** — Capacitor config. Has a no-op env-gate for `CAP_LIVE_RELOAD`; production builds always produce a vanilla config.
- **`ios/App/App.xcodeproj/project.pbxproj`** — the Xcode project. Don't hand-edit signing fields; `xcode-project use-profiles` writes them in the Codemagic build.
- **`package.json`** — standard Vite scripts. `dev`, `build`, `lint`, `test`. No live-reload tunnel script.
- **`vite.config.ts`** — Vite config, binds `host: "::"` (IPv6) by default. If running locally on a system that doesn't support IPv6, override with `vite --host 0.0.0.0`.

## Common operations

### "Make a UI change"

Edit React code in `src/`. Commit. Push. ~10 min later it's on the user's phone via TestFlight.

### "Add a Capacitor plugin"

```bash
npm install @capacitor/<plugin-name>
npx cap sync ios   # locally — Codemagic does this too in CI
```

Commit `package.json`, `package-lock.json`, and any iOS plugin config changes. Push.

### "Ship to public TestFlight"

```bash
git tag v0.1.0
git push origin v0.1.0
```

Triggers `ios-production` workflow. Goes to `External Testers` TestFlight group.

### "Ship to App Store production"

1. Edit `codemagic.yaml` → in `ios-production.publishing.app_store_connect`, set `submit_to_app_store: true` and add `release_type: AFTER_APPROVAL`.
2. Mirror change to default branch (see Branches section).
3. Tag a version, push the tag.
4. Apple reviews (~24–48h).
5. User clicks "Release" in App Store Connect when notified.

### "Investigate a Codemagic build failure"

1. Look at the failed step's name in the build log.
2. The `setup_signing` step ends with a `Signing settings after use-profiles:` block — useful for diagnosing signing issues.
3. The `Build IPA` step is xcodebuild; errors there usually mean signing didn't apply or there's a Capacitor/Pods conflict.

## Backend deploys (Supabase)

The Linux VM used by Claude Code on the web cannot reach `api.supabase.com` or `*.supabase.co` (proxy allowlist). So all Supabase work happens through GitHub Actions:

- `.github/workflows/supabase-deploy.yml` — manual trigger. Runs `supabase db push` against the new project and deploys the 3 edge functions (`describe-from-photo`, `meeting-brief`, `recall-search`). Also sets the `ANTHROPIC_API_KEY` function secret. Needs repo secrets: `SUPABASE_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`.
- `.github/workflows/migrate-data.yml` — one-shot, manual trigger. Runs `scripts/migrate-from-lovable.mjs` to copy people / circles / meetings / connections from the old Lovable project into Membr's new project. Needs additional repo secrets: `SUPABASE_SERVICE_ROLE_KEY`, `OLD_APP_EMAIL`, `OLD_APP_PASSWORD`. Skips photos.

To add/edit a migration or edge function: edit locally, commit, push, then trigger `supabase-deploy.yml` from the GitHub Actions tab.

## Hard constraints

- **No Mac access ever.** The user does not have one and will not get one. Don't suggest "open Xcode" or "run on a Mac." Codemagic does Mac things.
- **No App Store screenshots / store listing edits via code.** Those live in App Store Connect's web UI.
- **Don't push directly to the default branch** unless it's just to sync `codemagic.yaml` for Codemagic discovery. The dev branch is where work happens.
- **Don't experiment in `codemagic.yaml` without a reason.** Each test push burns 10 min of CI budget. Read the file carefully and reason from there before pushing speculative changes.
- **Don't try to run the Supabase CLI from this Linux VM.** Outbound to `api.supabase.com` is blocked. Use the GitHub Actions workflows above.

## Apple ecosystem accounts

- Apple Developer team: Adam Cofsky (`C59FSCZHFV`)
- App Store Connect API key alias in Codemagic: `MembrCodeMagicAPIKey` (Admin access)
- TestFlight internal group: `LiveReload` (current internal builds land here; name is legacy)
- TestFlight external group: `External Testers` (production builds land here when tagged)

## Useful command history (for orientation)

```bash
# Build locally (sanity check, doesn't deploy anywhere)
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Tests
npm test
```

## When Claude Code starts a fresh session here

If the user says something vague like "make this faster" or "fix the layout," start by skimming `src/` for the relevant component. The actual app code is React. The Capacitor/iOS layer is configured once and rarely changes.

If the user mentions builds, TestFlight, signing, or App Store: this file has the answers. If something's still ambiguous, the conversation that produced this setup is in git history under earlier `claude/ios-simulator-setup-*` branches (search for commits modifying `codemagic.yaml`).

## v2 design overhaul — locked decisions

A full UX/UI redesign is underway. The guiding documents are `Membr_UX_UI_Spec_v2.docx` and `Membr_Visual_Design_Brief_Updated.docx`. The brand identity (new logo, app icon, wordmark, hands mark) is documented in `Membr — Logo IdentityV2.pdf`. Those documents govern visuals; this section captures the founder decisions made during M1 kickoff so future sessions don't re-litigate them.

### Resolved Open Questions (Section 13 of the spec)

- **Q1 — Paywall:** None. Free, unlimited people/Circles/Events.
- **Q2 — Photo AI describe:** Output appears as pre-filled, inline-editable bullets in the About field. No accept/reject card.
- **Q3 — Encounter reminder toggle:** Removed entirely from Notification Preferences. The spec mentions it but the trigger source is undefined; revisit later.
- **Q4 — Recall search ranking:** Best semantic match first. Recency only as tiebreaker. No relevance indicators on result cards.
- **Q5 — Onboarding skip:** Shown once after account creation. Re-accessible via Profile → "Reintroduce me to Membr."
- **Q6 — Dark mode:** Permanent. `UIUserInterfaceStyle = Dark` in `Info.plist`. No light theme will ever ship.
- **Q7 + Q10 — Smart Circle Engine thresholds:** Trigger on 2+ people added in 48h with keyword overlap, OR 3+ people added in 24h regardless. Easy to retune post-launch.
- **Q8 — Archived Events access:** Small "Archived" link below the Events grid on CIRCLES-01 → archived list. Members and their data remain searchable everywhere.
- **Q9 — End-of-Day notification deep link:** Opens the Add Person sheet with the contextual variant header "Who'd you meet today?" instead of "Add Person."
- **Q11 — Person count display:** Shown as a small chip on the Home greeting line (alongside the date), not in the People List.

### Sequencing — milestone builds

Approved approach: ship one TestFlight build at the end of each milestone, not one giant push at the end. Each milestone is a clean checkpoint.

- **M1 — Visual foundation.** Tokens (`tailwind.config.ts` + `src/index.css` rewritten against the Visual Brief), DM Serif Display + DM Sans wired, new app icon (1024 master), new launch screen (wordmark on black), `Info.plist` set dark-only with status-bar light and `CFBundleDisplayName = Membr`, permission strings rewritten per spec, tab bar restyled (Surface 1, hairline border, Primary Red selected, no backdrop blur), `<Wordmark />` component, `Button`/`Card`/`Input` rewritten to v2 surfaces, FaceMap→Membr branding sweep in user-visible strings. Tab structure stays at 4 (Home/People/Circles/Profile) for M1; Recall becomes its own tab in M2.
- **M2 — Screen restructure + Events object.** 5-tab IA (add Recall). New Home, Person Detail, Circles & Events two-tier list. Corner-anchored Add Person FAB (red) + secondary Quick Actions FAB (dark) per spec §4.2. Migrate sheets (SHEET-AP, SHEET-LE, SHEET-MB, SHEET-CC) to native `UISheetPresentationController` detents. Replace any remaining legacy utility classes (`.warm-shadow`, `.icon-tile*`, etc.) that the M1 compat shim in `src/index.css` currently bridges.
- **M3 — New features.** Smart Circle Engine (on-device clustering, three suggestion surfaces per spec §7). End-of-Day push notification with the "Who'd you meet today?" sheet variant. Onboarding flow (ONBD-01..04) + Profile re-trigger row.

### Status as of M2+M3 completion

Everything from the spec that is implementable in JS-over-WebView is shipped. Two items are intentionally **not** as the spec describes them:

- **Sheets are Framer-Motion bottom sheets, not native `UISheetPresentationController`.** The visible chrome matches spec (drag handle, drag-to-dismiss, .large() height equivalent) but the underlying widget is web. Real native detents would require a custom Capacitor plugin (no maintained community one wraps `UISheetPresentationController` cleanly with WebView embedding) plus per-build TestFlight validation. Not worth the dependency churn for the visible delta. Revisit if the spec ever calls for multi-detent behaviour the user actually drags between.
- **Brief reminder notifications** (15/30/60 min before a scheduled encounter) are not scheduled. There's no UI for scheduling future encounters yet, so there's nothing to remind from. The toggle is shown as "Soon" in PROFILE-02. Adding scheduled-encounter data first is the prerequisite.

Everything else from the spec is wired: 5-tab IA, all screens (HOME, PEOPLE-01/02/03, CIRCLES-01/02/03/05/06, RECALL, PROFILE-01/02/03, ONBD-01..04, Auth + Forgot/Reset Password), all sheets, Smart Circle Engine all three surfaces, Events object + Supabase migration, EoD + weekly summary local notifications, haptics (light/medium/selection on FABs, toggles, swipes, long-press, drag-release), long-press context menus on Circle/Event tiles, swipe-to-reveal Log/Brief on People rows, prefers-reduced-motion handling, AI disclosure surfaces (Apple GL 2.5.18).

### Brand assets in the repo

- **App icon master:** `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` (1024×1024, opaque). Source: the embedded `app-icon.png` from the Visual Design Brief docx, resized from 1254×1254.
- **Launch screen images:** `ios/App/App/Assets.xcassets/Splash.imageset/*.png` — all 2732×2732, black background with centered "membr." wordmark in DM Serif Display, red period. Generated from the downloaded `DMSerifDisplay-Regular.ttf`.
- **Web favicon / OG:** `public/app-icon.png` (512×512). Same brand mark.
- **In-app wordmark:** `<Wordmark />` from `src/components/Wordmark.tsx` — renders DM Serif Display + red period span. Use this everywhere the brand name appears in the React UI (auth, onboarding, etc.). Do NOT use a raster wordmark inline.
- **Bare-hands SVG mark:** NOT in the repo yet. Spec calls for it at ≤32px (favicon, tab icons, notifications). Currently no UI uses it; will be vector-traced from the PDF or supplied by founder in M2.

### Visual Brief hard rules — quick reference

If you find yourself violating any of these, stop and re-read the brief:

- **One red moment per frame.** Primary Red (#E03030) appears exactly once per screen. If you use it twice, remove one.
- **No ambient red glow.** The body background is pure `#000000`. No radial gradients, no warm wash. Glow was intentionally removed in M1.
- **No glassmorphism / backdrop-blur.** Surfaces are flat with hairline borders. The old `.warm-shadow` with backdrop-filter is gone.
- **No pill buttons.** Buttons are 8px radius. Never fully rounded.
- **Two fonts only:** DM Serif Display (400) for emotionally-loaded headings; DM Sans (400/500/600/700) for everything operational. Never mix within a line.
- **Lucide icons only, stroke 1.5–2px.** No filled icons, no mixed icon families.
- **Tile colors are muted (~35% sat).** Only the Red tile is full saturation. New 8-tile palette lives in `src/index.css` as `--tile-{name}-from/to` and as Tailwind utility classes `.tile-red` through `.tile-teal`.

### Legacy compatibility shim

`src/index.css` has a `@layer utilities` block at the bottom marked "v1 → v2 compatibility shim" that maps old utility classes (`.warm-shadow`, `.warm-shadow-lg`, `.icon-tile`, `.icon-tile-red`, `.shadow-glow-primary`, `.bg-gradient-primary`) to v2-compliant equivalents. These exist only so M1 ships without breaking the existing pages — they will be removed in M2 as each screen gets a full rewrite. Don't add new usages of these classes; write to the v2 tokens directly.
