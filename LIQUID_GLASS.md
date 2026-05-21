# Liquid Glass — Membr style update

> Drop this guide + the mockups (`marketing/membr-redesign/`) into your repo and tell Claude Code: *"Apply the Liquid Glass style from `LIQUID_GLASS.md`. Match patterns 1:1. Keep all current functionality."*

The goal: take Membr from "flat dark cards on black" to a premium, layered, **frosted glass** aesthetic. Apple-style depth, done with restraint — *subtle, not gradient soup, not glow-everywhere*.

Existing brand foundations (black canvas, DM Serif Display + DM Sans, one red signal per frame) **do not change**. Only the surface treatment changes.

---

## 1 · The five visual moves

1. **Ambient warm backdrop.** A multi-stop radial gradient at the top of every screen suggests faint dawn light. This is what gives frosted glass something to blur. Without it, glass on flat black is invisible.
2. **Frosted glass surfaces.** All cards, search inputs, segmented controls, pills, and the bottom tab bar use real `backdrop-filter: blur(20-28px) saturate(180%)`, a low-opacity fill, a thin border, an inset white highlight, and a layered drop shadow.
3. **Serif italic accents.** DM Serif Display *italic* is used for emotional moments and quiet meta info (the user's first name, person notes, body copy on Recall, "see all" affordances). Replaces what would otherwise be a colored gradient word.
4. **One red signal per frame, on glass.** Red is reserved for: the active tab in the nav, the primary action inside the hero glass card (red-tinted glass), the red period after the user's name, and the FAB. Never decorate with red.
5. **Subtle SVG grain overlay.** A faint noise texture (`feTurbulence`) over the ambient backdrop. ~0.32 opacity, `mix-blend-mode: overlay`. Eliminates AI-flat feel; adds the *physical material* texture premium apps have.

---

## 2 · Design tokens

```css
/* === Ambient backdrop (every screen) === */
--bg-dawn-r1: radial-gradient(ellipse 80% 70% at 100% 0%, rgba(224, 90, 50, 0.32), transparent 55%);
--bg-dawn-r2: radial-gradient(ellipse 90% 60% at 0% 8%, rgba(178, 60, 90, 0.18), transparent 55%);
--bg-dawn-r3: radial-gradient(ellipse 60% 40% at 50% 35%, rgba(160, 60, 60, 0.08), transparent 70%);
--bg-base:   #000;

/* === Glass surfaces === */
--glass-fill-neutral: rgba(255, 255, 255, 0.06);
--glass-fill-warm:    rgba(255, 200, 160, 0.06);
--glass-fill-red:     rgba(224, 48, 48, 0.18);
--glass-blur:         blur(24px) saturate(180%);
--glass-blur-strong:  blur(28px) saturate(180%);

--glass-border:        1px solid rgba(255, 255, 255, 0.08);
--glass-border-warm:   1px solid rgba(255, 255, 255, 0.10);
--glass-border-red:    1px solid rgba(224, 48, 48, 0.32);

--glass-highlight:     inset 0 1px 0 rgba(255, 255, 255, 0.08);
--glass-highlight-up:  inset 0 1px 0 rgba(255, 255, 255, 0.12);
--glass-shadow:        0 4px 20px rgba(0, 0, 0, 0.35);
--glass-shadow-raised: 0 16px 40px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(0, 0, 0, 0.3);

/* === Text on glass === */
--text-on-glass:        #F4F4F4;
--text-on-glass-mid:    rgba(244, 244, 244, 0.70);
--text-on-glass-muted:  rgba(244, 244, 244, 0.55);
--text-on-glass-faint:  rgba(244, 244, 244, 0.40);

/* === Radii === */
--r-glass-pill:    14px;
--r-glass-card:    16px;
--r-glass-card-lg: 18-20px;
--r-glass-button:  11-14px;

/* === Type (unchanged from existing system) === */
--font-serif: "DM Serif Display", serif;   /* regular + italic — never bold */
--font-sans:  "DM Sans", system-ui;
```

---

## 3 · Component recipes

### 3.1 Ambient backdrop

Apply to the **root** of every screen. Sits behind everything.

```css
.ambient-backdrop {
  position: relative;
  width: 100%; height: 100%;
  background:
    radial-gradient(ellipse 80% 70% at 100% 0%, rgba(224, 90, 50, 0.32), transparent 55%),
    radial-gradient(ellipse 90% 60% at 0% 8%, rgba(178, 60, 90, 0.18), transparent 55%),
    radial-gradient(ellipse 60% 40% at 50% 35%, rgba(160, 60, 60, 0.08), transparent 70%),
    #000;
  overflow: hidden;
}
.ambient-backdrop::after {
  /* SVG grain overlay */
  content: "";
  position: absolute; inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>");
  opacity: 0.32;
  mix-blend-mode: overlay;
  pointer-events: none;
}
```

### 3.2 Glass surface (base card)

The most-used recipe. Drop this on any card.

```css
.glass {
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.03),
    0 4px 20px rgba(0, 0, 0, 0.35);
  position: relative;
}
.glass::before {
  /* top-edge "wet" highlight */
  content: "";
  position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 30%);
  pointer-events: none;
}
.glass--raised { box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.12),
    inset 0 0 0 0.5px rgba(255,255,255,0.04),
    0 1px 0 rgba(0,0,0,0.3),
    0 16px 40px rgba(0,0,0,0.45);
}
.glass--warm   { background: rgba(255, 200, 160, 0.06); border-color: rgba(255,255,255,0.10); }
.glass--red    { background: rgba(224, 48, 48, 0.18);   border-color: rgba(224,48,48,0.32);  }
```

### 3.3 Glass pill (status / chip)

```css
.glass-pill {
  display: inline-flex; align-items: center; gap: 8px;
  height: 28px; padding: 0 14px;
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 8px rgba(0,0,0,0.2);
  font: 500 12px var(--font-sans);
  color: #F4F4F4;
}
.glass-pill .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #2D9E5C;
  box-shadow: 0 0 8px rgba(45, 158, 92, 0.5);
}
```

### 3.4 Glass segmented control

For tab switchers (People / Circles). Active segment is a brighter glass-on-glass.

```css
.glass-segmented {
  display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
  padding: 4px;
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 13px;
}
.glass-segmented button {
  height: 36px; border: 0; cursor: pointer;
  background: transparent;
  font: 500 14px var(--font-sans);
  color: rgba(244,244,244,0.55);
  border-radius: 10px;
}
.glass-segmented button[aria-selected="true"] {
  background: rgba(255,255,255,0.10);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.10);
  color: #F4F4F4; font-weight: 600;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 1px 3px rgba(0,0,0,0.3);
}
```

### 3.5 Frosted bottom nav (with red FAB)

The nav floats above the content; rounded glass with the FAB protruding up.

```css
.frosted-nav {
  position: absolute; left: 12px; right: 12px; bottom: 12px;
  height: 76px;
  border-radius: 28px;
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.12),
    inset 0 0 0 0.5px rgba(255,255,255,0.04),
    0 12px 32px rgba(0,0,0,0.5);
  display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  align-items: center; justify-items: center;
}
.frosted-nav .fab {
  width: 52px; height: 52px; border-radius: 50%;
  background: #E03030;
  margin-top: -22px; /* protrudes above the nav */
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.3),
    0 8px 24px rgba(224,48,48,0.45),
    0 2px 6px rgba(0,0,0,0.4);
}
.frosted-nav .tab--active { color: #E03030; }
.frosted-nav .tab          { color: rgba(244,244,244,0.7); }
```

### 3.6 Primary red-glass action button

For the *one* hero action per screen (Pull a meeting brief, Recall, etc).

```css
.glass-action-primary {
  display: flex; align-items: center; gap: 14px;
  width: 100%; padding: 14px 16px;
  background: rgba(224,48,48,0.18);
  border: 1px solid rgba(224,48,48,0.32);
  border-radius: 14px;
  backdrop-filter: blur(10px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12),
              0 4px 16px rgba(224,48,48,0.18);
}
.glass-action-primary .icon-tile {
  width: 40px; height: 40px; border-radius: 11px;
  background: linear-gradient(135deg, #E03030, #BE3A15);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.25),
              0 4px 12px rgba(224,48,48,0.4);
}
```

### 3.7 Settings card (grouped rows)

A single glass card holds a list of rows divided by hairlines.

```css
.glass-list { /* same as .glass with padding:0 */ }
.glass-list .row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.glass-list .row:last-child { border-bottom: 0; }
.glass-list .row.destructive { color: #E03030; font-weight: 600; }
```

---

## 4 · Type rules (unchanged, but worth restating)

| Use | Family | Size | Style |
|---|---|---|---|
| Greeting / hero headline | DM Serif Display | 36–40 | Regular, italic on the user's first name, red period |
| Screen title (top nav) | DM Serif Display | 22–24 | Regular |
| Person name in list | DM Serif Display | 17–18 | Regular |
| Note / descriptor under name | DM Serif Display **italic** | 12–13 | Italic, muted |
| Body copy on Recall | DM Serif Display **italic** | 16–17 | Italic, muted |
| Section labels | DM Sans | 10–11 | **600**, uppercase, `letter-spacing: 0.16em` |
| Button labels, row labels | DM Sans | 13–15 | 500–600 |
| Meta lines (timestamps, locations) | DM Sans | 11 | Regular, muted, separated by `·` |

**Never use bold serif.** DM Serif Display ships only in regular + italic; never synthesize bold.

---

## 5 · Per-screen application checklist

### Home
- AmbientBackdrop wrapper.
- GlassPill at top (`● 5 added this week`).
- Serif greeting with red period.
- **Quick Actions glass hero card** (warm tint, raised) containing:
  - Red-tinted glass button: *Pull a meeting brief* (primary).
  - Neutral glass button: *Add someone* (secondary).
- Glass search input (`Recall anyone…`).
- Glass card: Recent (5 avatars in row, red ring on the newest 3).
- Glass card: Your Circles (4 emoji-on-gradient circles).
- Glass card: Ways to use Membr.
- FrostedBottomNav (Home active = red).

### Network
- Same AmbientBackdrop.
- Centered serif `Network` title.
- GlassSegmented: `People` / `Circles`.
- **People tab:** glass search + glass filter button, horizontal-scroll filter chips (active chip is red-glass, others are neutral glass with emoji prefix). Person rows are individual glass cards: avatar + serif name + italic-serif note snippet + meta line.
- **Circles tab:** Section label "CIRCLES" with a `+` glass icon button on the right. 2×2 grid of large (120px) emoji-on-tile-gradient circles, name in serif under each, member count in DM Sans. Hairline. Section label "EVENTS". Events are full-width tinted glass cards with the event color washed in as a gradient + serif title + meta.
- FrostedBottomNav (Network active = red).

### Recall
- AmbientBackdrop.
- Small `RECALL` section label.
- Big serif headline: *"Find anyone you've met."* (italic on "you've met", red period).
- Glass input row containing the search field on the left + a red glass `Recall` button on the right.
- `✦ AI generated` mini label.
- Italic-serif body copy as helper text.
- Quiet "Recent recalls" section: hairline-divided rows with clock icon + italic serif query.
- FrostedBottomNav (Recall active = red).

### Profile
- AmbientBackdrop.
- Centered serif `Profile` title.
- Glass user card (raised): 64px avatar + serif name with red period + email + pencil icon.
- `ACCOUNT` glass list card: Edit name (with current value), Change email, Change password, Sign out (destructive red).
- `PREFERENCES` glass list card: Reintroduce me to Membr (red sparkle), Notifications, App Permissions.
- `ABOUT` glass card: Where AI is used in Membr (sparkle icon, italic serif subline "Claude Haiku 4.5 · Anthropic").
- FrostedBottomNav (Profile active = red).

---

## 6 · SwiftUI translation

If the codebase is native iOS / SwiftUI, the iOS 18+ Liquid Glass material is built-in:

```swift
// Cards
.background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
.overlay(RoundedRectangle(cornerRadius: 16)
  .stroke(.white.opacity(0.08)))

// Pills / segmented
.background(.thinMaterial, in: Capsule())

// Bottom nav
.background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28))
```

Add the ambient warm radial as a `LinearGradient`/`RadialGradient` stack behind everything; layer a `Canvas` with `addFilter(.noise)` (or a static noise PNG at `~0.32` opacity with `.overlay` blend) on top.

For React Native: use `expo-blur`'s `BlurView` with `intensity={20}` and `tint="dark"`, layered over the same gradient backdrop. Add a transparent noise PNG `<Image>` with `mixBlendMode: 'overlay'` if your RN version supports it (0.74+).

---

## 7 · Don'ts

- ❌ **No glass on flat black with no backdrop.** It looks like translucent gray. Always have the ambient warm gradient behind.
- ❌ **No more than one red signal per frame.** The FAB and the primary action both being red is fine *only if* they belong to the same "moment." When in doubt, neutralize the FAB and let the primary action wear the red.
- ❌ **Don't pile gradients.** The warm ambient is enough. Don't add a second gradient on cards (the warm-tinted glass is already enough).
- ❌ **Don't bold the serif.** DM Serif Display is regular-only. Use italic for emphasis.
- ❌ **Don't emoji-decorate.** Per existing brand rules. The only emoji that survive are *inside* the Circle tile graphics — those are user-owned content, not chrome.
- ❌ **Don't add glow or `box-shadow: 0 0 40px var(--red)`.** Use inset highlights + tasteful layered drop shadows. That's it.

---

## 8 · Open implementation questions

When you wire this in, the following may need product decisions — flag them, don't improvise:

- **Home Quick Actions hero:** confirm exactly which 2 actions live here (currently *Pull a brief* + *Add someone*). If a third "Recall" shortcut belongs there too, it should be a *quieter* tertiary item.
- **Status pill content:** "5 added this week" is illustrative. Tie it to real data — additions in last 7 days. Tone stays `success` (green dot).
- **Ambient backdrop scope:** the current spec applies it to every tab. If a screen ever shows a real photo (e.g. a person detail), the backdrop should be hidden in favor of the photo backdrop.
- **Accessibility:** glass surfaces meet WCAG AA *only* against the warm-ambient backdrop; verify contrast on any screen that may show the glass over solid black (e.g. when the backdrop is suppressed during scroll-into-photo views).
