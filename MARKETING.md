# FaceMap — Master Marketing Brief

**Purpose of this document.** This is the canonical reference any Claude
marketing agent, copywriter, ad strategist, or content tool should ground in
before producing FaceMap-related output. Every section below is independently
quotable; later tools can pull a single section as context (e.g. "use the
`Brand Voice` and `Personas` sections from MARKETING.md").

If you are writing FaceMap copy, ads, scripts, social posts, landing pages,
emails, App Store descriptions, or pitch material — read this first and stay
inside its lanes.

---

## 1. One-liner

**FaceMap. Remember everyone. Miss no one.**

(Tagline is already shipped in the app's HTML metadata. Treat it as the
locked primary tagline. Do not invent new primary taglines.)

## 2. Elevator pitch (≤30 sec)

FaceMap is the iPhone app that turns every handshake into a relationship.
Add someone you just met by name, jot two lines about them, drop in a photo
if you've got one, and FaceMap remembers everything — their name, the room
you were in, what you talked about, the face that goes with it — forever.
Before you see them next, FaceMap hands you a thirty-second brief on who
they are. You walk up, use their name, ask about the thing they care about,
and become the person everyone remembers meeting.

## 3. Long-form description (≤120 words)

Every great career, friendship, and crew started with a name remembered.
FaceMap is a private, AI-powered memory layer for the people in your life —
the new ones, the casual ones, the ones who could matter later. Add their
name, jot a few details, drop in a photo if you have one, and FaceMap
stores them as a record you can search,
recall, and review on demand. Built around how real social moments
actually work — the cocktail hour, the first day, the rush event, the
networking dinner — FaceMap helps you walk into any room already knowing
who you'll meet, and walk out remembered. It's the social memory of the
person everyone wishes they were.

---

## 4. What FaceMap actually does (technical features)

Use this section when you need to be concrete and accurate. Do not invent
features that aren't here. If a campaign needs a feature that's not listed,
flag it as a roadmap question, don't ad-lib it.

### 4.1 Capture a person (the "I just met them" moment)
- **Name-first add.** Every entry's root is the name — that's all you need
  to create a record. A photo is optional but powerful: drop one in (camera
  roll, group shot, screenshot, anywhere) and the face becomes a mnemonic
  for you and the input that supercharges FaceMap's AI search later.
- **AI auto-describe from photo.** A backend AI function
  (`describe-from-photo`) generates an initial neutral description from the
  photo so the user has scaffolding to build on, not a blank field.
- **Quick add sheet.** A bottom-sheet UI (`QuickAddSheet`) optimized for
  one-handed entry in real social settings — name, a couple of context
  bullets, and you're back to the conversation.
- **Bullet-style notes.** A `BulletTextarea` makes notes feel like text
  messages, not a CRM form. Lower cognitive cost = higher likelihood of use
  in the moment.

### 4.2 Organize by context (Circles)
- **Circles** group people by where they belong in your life: internship
  cohort, fraternity pledge class, dorm floor, team, gym, conference, family
  friends, etc.
- A person can live in multiple Circles — the same person is "Goldman
  summer analyst" AND "Sigma Chi pledge brother."
- Circles are how the app handles social context drift: you don't need to
  remember someone "in the abstract," you remember them inside a scene.

### 4.3 Log encounters
- **`LogEncounterModal`** captures every time you see or interact with
  someone — quick log of when, where, what came up.
- The encounter log becomes a relationship history. Over months it shows
  cadence, shared topics, last-time-seen — the things humans naturally
  forget.

### 4.4 Recall (the "I'm about to walk in" moment)
- **`RecallSearch`** is AI-powered semantic search across every person and
  every note in your FaceMap. Backed by a server-side `recall-search` edge
  function with signed storage URLs for AI gateway access.
- You can search the way you actually think: *"the guy from the marketing
  internship who liked mountain biking,"* *"the girl I met at the dinner in
  October who works at Bain,"* *"my pledge brother whose dad is a doctor."*
- Returns the face, the notes, the Circle, and the encounter history.

### 4.5 Meeting Brief (the "30 seconds before I see them" moment)
- **`MeetingBriefModal`** + the `meeting-brief` edge function generate a
  short AI-written briefing for an upcoming or imminent encounter:
  - Who they are
  - Where you've crossed paths before
  - What you've talked about
  - What to ask about ("their summer in Spain," "the half marathon they
    were training for")
- This is the feature that turns "I think we met once?" into "Hey Sarah —
  how was the Madrid trip? Did you end up at El Sobrino de Botín?"

### 4.6 Contacts integration
- **`ContactLinkSection`** lets you tie a FaceMap person to an iPhone
  contact, so once a relationship matures, the data graduates from "person I
  just met" to "person in my phone."
- Permissions handled natively: camera, photos, contacts (already wired in
  `Info.plist`).

### 4.7 Privacy-by-default architecture
- All data is **per-user** and stored in the user's own authenticated
  account (Supabase auth + row-level access).
- Photos and notes belong to the user. There is no public feed, no social
  graph published to other users, no "who you met" leaderboard.
- FaceMap is **not** a face-recognition service — it's a personal memory
  tool. Photos, when added, are mnemonic aids for entries the user has
  already named, not search keys against strangers.

## 5. Tech stack (for credibility-building content)

- **Native iPhone app** built on a React + TypeScript codebase, packaged
  through Capacitor 7 into a native iOS shell (real Xcode build, real App
  Store distribution path — not a glorified bookmark).
- **Supabase** backend for auth, storage, and database (per-user, secure,
  scalable).
- **AI edge functions** for the three intelligent features:
  `describe-from-photo`, `meeting-brief`, `recall-search`.
- **Tailwind + shadcn/ui** front-end, designed for the mobile-first social
  moment.
- iOS-native permissions (camera, photo library, contacts) requested
  on-demand, with copy that explains *why*.

---

## 6. Value proposition

**The core promise.** FaceMap closes the gap between *meeting* people and
*knowing* people. It removes the single most common reason people fail to
build the network, friend group, or reputation they want: forgetting.

**The emotional promise.** FaceMap makes you the person who remembers. That
person is magnetic. They walk into rooms already winning. They make others
feel seen, important, recurring — not interchangeable. That feeling, given
back consistently, is the foundation of every great network and every
charismatic reputation.

**Why it works.** Memory is a status signal. When you remember someone's
name, their dog's name, the project they were stressed about, what they
were drinking at the last event — you signal that they matter. People
build their social impressions of you on those small signals more than on
any grand gesture. FaceMap industrializes the small signals.

**Why now.** The world is more horizontally connected and more shallow
than ever. Modern young adults move through dozens of "scenes" in a single
year — internship, club, school, gym, summer house, conference, group chat
— and the people from each scene blur within weeks. The cost of forgetting
has gone up. FaceMap is the first tool built for the way young, ambitious,
socially-active people actually meet people in 2026.

---

## 7. How the value is delivered (the user's loop)

The marketing should always ladder back to this 5-beat user loop.

1. **Encounter.** User meets someone in a real social setting.
2. **Add.** Later — at home, on the train, walking back to your desk — add
   the person by name, jot 2 bullets, and drop in a photo if you've got one.
3. **Organize.** That person lands in one or more Circles automatically.
4. **Recall on demand.** Days, weeks, or months later — at the next
   encounter — user pulls up the Meeting Brief in 5 seconds.
5. **Win the room.** They greet the person by name, by detail, by warmth.
   The other person feels remembered. The user becomes "that person."

Marketing should keep showing this loop, in different costumes, again and
again — internship hallway, rush week, dorm move-in, conference floor,
Sunday dinner.

---

## 8. Target markets / personas

These are the primary segments. Every campaign should be writable into one
of these. If a campaign idea doesn't fit any of these, flag it before
producing copy.

### 8.1 The Ambitious Intern
- 19–24, summer or rotational internship, often financial services,
  consulting, tech, law adjacent.
- Walks into Day 1 with 30 new colleagues, 5 directors, a mentor, a buddy,
  and a cohort of 20 fellow interns from other schools.
- Knows that the difference between "summer intern who got the offer" and
  "summer intern who didn't" is often who remembered who, who reached out
  to whom, who built the right relationships.
- **FaceMap promise**: walk into the Friday happy hour and use every
  full-time analyst's name. Remember the MD's daughter's name. Get the
  return offer.

### 8.2 The New Student
- College freshman, transfer, grad school first-year, study-abroad
  arrival.
- Meets ~200 people in the first 2 weeks; remembers 12 of them by Week 4.
- Wants to build *a real friend group* and a campus reputation, not just
  collect Instagram followers.
- **FaceMap promise**: by the end of the first month, recognize and greet
  half the dorm by name. Be the freshman everyone says is "weirdly good
  with people."

### 8.3 The Pledge / New Member
- Joining a fraternity, sorority, club sport, finance club, a cappella
  group, anything with a pledge or new-member process.
- Required to learn 50+ active members' names, hometowns, majors, and
  often more (jobs, internships, family details).
- High social cost of forgetting; high social reward for remembering.
- **FaceMap promise**: ace pledge testing. Be the pledge brother the
  actives actually like.

### 8.4 The Career Networker
- 22–35, post-graduation, building a professional network — recruiting,
  conferences, alumni events, demo days, dinners.
- Has 200+ LinkedIn connections from the last year and remembers 15 of
  them deeply.
- **FaceMap promise**: every coffee chat, demo, panel, and dinner
  compounds. Walk into year three with a network that *actually exists* in
  your head, not just on LinkedIn.

### 8.5 The New Hire / Career Changer
- Starting a new job, joining a 30+ person company, switching industries.
- First 90 days = remember everyone, become known by everyone.
- **FaceMap promise**: by Day 30, know the names of every person on your
  floor, who they report to, what they're working on, what they care about.

### 8.6 The Magnetic Operator (the "that guy / that girl")
- The above personas are *jobs* — this one is an *identity*. Some users
  don't fit a specific life-stage box but want the broader FaceMap promise:
  to be the most charismatic, most socially-capable version of themselves.
  Hosts dinners, throws parties, runs group chats, knows everyone's
  everyone.
- **FaceMap promise**: the upgrade from "social" to *legendary*. The
  person whose secret weapon nobody can quite name.

### Unifying thread
Across all six personas: **FaceMap is a status-of-presence tool.** It
elevates how people experience you, regardless of your seniority or
position. Intern or CEO, freshman or alum — the small things win, and
FaceMap makes the small things effortless.

---

## 9. Positioning

### What FaceMap IS
- A personal social memory tool.
- An AI-assisted upgrade to the human brain's weakest link.
- A private, mobile, always-with-you charisma multiplier.
- A career and friendship compounding tool, used quietly.

### What FaceMap IS NOT (do not position as these)
- ❌ A CRM. (CRMs are for selling to people. FaceMap is for *being* with
  people.)
- ❌ A Rolodex. (Old, transactional, dead.)
- ❌ A face-recognition service. (We don't ID strangers; we help users
  remember people they already met.)
- ❌ A networking app like LinkedIn or Lunchclub. (Those introduce you to
  new people; FaceMap helps you keep the ones you've already met.)
- ❌ A dating app. Never frame around romantic recall.
- ❌ A surveillance tool, a stalker tool, a "remember the bartender's
  name to manipulate them" tool. The tone is genuine warmth, not
  manipulation.

### Closest mental references for an outsider
"It's like a second brain, but only for the people you meet." Or:
"Imagine if your phone's contacts had a memory — faces, context, what you
talked about, where you met."

---

## 10. Brand voice

- **Confident, not cocky.** FaceMap users win quietly. The brand should too.
- **Warm, not corporate.** This is about human relationships. Avoid
  jargon ("synergy," "leverage your network," "10x your social ROI"). Talk
  the way a charismatic 24-year-old talks.
- **Aspirational, not insecure.** Don't sell "you forget people because
  you're bad with names." Sell "you're about to be the person everyone
  remembers."
- **Concrete, not abstract.** Say "the new analyst's name was Priya, she
  rowed at Princeton" — not "important relationship details." Use real
  specific scenes.
- **Mobile-first language.** Short sentences. SMS-grade. No paragraph
  walls in ads.

### Key phrases that are on-brand
- "Remember everyone. Miss no one." (locked tagline)
- "Walk into any room already winning."
- "Be the person everyone remembers meeting."
- "The small things, automated."
- "Charisma, with receipts."
- "Show up like you've been waiting for them."

### Key phrases that are off-brand (do not use)
- "Network like a pro."
- "Maximize your social capital."
- "Never forget a name again." (technically true, but flat and AARP-coded)
- "AI-powered" as a hero phrase. AI is *how*, not *what*. Lead with the
  human moment; the AI is the engine, not the headline.

---

## 11. Marketing pillars (use these as content anchors)

Every piece of content should ladder up to one of four pillars. Tag each
asset with its pillar.

### Pillar 1 — The Moment of Remembering
Show the **payoff scene**: the user walks up, uses the name, asks about
the specific thing, and the other person lights up. Best for short-form
video, Reels, TikTok, hero ads. The strongest emotional currency.

### Pillar 2 — The Cost of Forgetting
Show the **anti-payoff**: the awkward "hey... man," the "I think we met
last summer?", the missed return offer, the forgotten pledge brother.
Visceral. Best for retargeting ads and "before/after" stories.

### Pillar 3 — The Compounding Reputation
Show the **long arc**: month 1 → month 6 → year 2 of being the person who
remembers. Best for testimonials, founder posts, long-form thought
leadership. Speaks to the career-networker and operator personas.

### Pillar 4 — The Effortlessness
Show the **mechanic**: name, two bullets, optional photo, done. The product
UX itself.
Best for tutorial content, onboarding, App Store screenshots, demo
videos. Reassures skeptics that the tool isn't homework.

---

## 12. Channel guidance (starting hypotheses, not gospel)

- **TikTok / Reels** — Pillar 1 + 2. Short skits dramatizing the moment of
  remembering or forgetting. POV format works. Greek life, finance, and
  campus creators are the highest-leverage seeding partners.
- **Instagram (feed + Story ads)** — Pillar 4 hero, Pillar 1 retargeting.
- **X / Twitter** — Founder voice, Pillar 3. Threads about the underrated
  skill of remembering people; quote-tweets of "best career advice"
  threads.
- **Campus ambassadors** — Pledge classes, finance clubs, intern cohorts.
  The product is built for word-of-mouth inside tight groups; lean into
  it.
- **App Store** — Lead screenshot is the Meeting Brief moment. Subtitle is
  the locked tagline.
- **Founder content / LinkedIn** — Pillar 3 + thoughtful posts about the
  social cost of forgetting in a networked economy.

---

## 13. App Store / store-listing copy (canonical)

- **App name**: FaceMap
- **Subtitle**: Remember everyone. Miss no one.
- **Promotional text** (170 char): The iPhone app that makes you the
  person who remembers. Add a name, jot two lines, photo optional — and
  never blank on a name again, at work, at school, anywhere.
- **Description hero paragraph**: FaceMap is your private social memory.
  Add someone you just met by name, jot a couple of bullets, drop in a photo
  if you've got one, and FaceMap remembers them — their name, their context,
  your conversation, and the face that goes with it — forever. Before you
  see them next, FaceMap gives you a thirty-second brief on who they are.
  Walk in, use their name, ask about the thing they care about. Be the
  person everyone remembers meeting.

(Other tools writing App Store variants should treat the **app name,
subtitle, and tagline as locked**.)

---

## 14. Things any Claude marketing tool should NOT do

- Do not invent new product features. If a feature isn't in Section 4,
  it doesn't exist yet — flag it as a question to the founder.
- Do not change the locked tagline.
- Do not pivot the brand to "networking app," "CRM," or "dating-adjacent."
- Do not use surveillance/stalker framing, even ironically.
- Do not lead with "AI." Lead with the human moment; the AI is the
  engine, not the hood ornament.
- Do not use stock corporate vocabulary ("leverage," "synergy," "ROI on
  relationships," "social capital arbitrage").
- Do not write content longer than the channel demands. If TikTok asks
  for 9 seconds, deliver 9 seconds.

---

## 15. Open questions for the founder (flag, don't invent answers)

These are items future marketing work will need answers to. Any tool
running into one of these should ask the founder, not improvise:

- Pricing model (free, freemium, subscription tier?). Not yet decided.
- Beta access / waitlist mechanics.
- Privacy/legal language for photos of other people (jurisdiction-
  dependent — needs legal review before scaled ads featuring user-imported
  photos of identifiable people).
- Founder personal-brand strategy (will founder be a public face of the
  brand? Influences Pillar 3 heavily).
- Launch market: campus-first, NYC-finance-first, or both in parallel?
- Reference customers / first 50 power users — needed for Pillar 3
  testimonials.

---

*End of master brief. Any output that conflicts with this document should
defer to this document until the founder updates it.*
