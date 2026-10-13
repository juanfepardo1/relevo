---
name: Relevo · Compradores
description: Buyer-side visual system for Relevo, a dark, technical fintech world for registering a buy box and reading anonymous teasers.
colors:
  night-navy: "#0a1424"
  deep-navy: "#0c1a2e"
  raised-navy: "#112139"
  raised-navy-hi: "#16294a"
  hairline: "rgba(214,226,245,.09)"
  hairline-strong: "rgba(214,226,245,.16)"
  frost-ink: "#eaf0f8"
  mist-ink: "#b4c2d8"
  slate-ink: "#8696b0"
  placeholder-ink: "#6f7f99"
  relevo-blue: "#2c5186"
  signal-blue: "#5b86c8"
  blue-tint: "rgba(91,134,200,.14)"
  pale-steel: "#9fb6d9"
  relevo-orange: "#f47b3d"
  ember-orange: "#ff9058"
  orange-ink: "#1a0d05"
  orange-tint: "rgba(244,123,61,.14)"
  verified-green: "#7fc8a3"
  alert-coral: "#ff8f80"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(36px, 3.6vw, 50px)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(30px, 3.4vw, 44px)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body-small:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  figure:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "19px"
    fontWeight: 500
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
rounded:
  hairline: "3px"
  bar: "8px"
  control: "10px"
  inset: "12px"
  panel: "16px"
  dialog: "20px"
  stage: "24px"
  pill: "999px"
spacing:
  gutter-mobile: "16px"
  gutter: "24px"
  control-x: "20px"
  panel-pad: "28px"
  grid-gap: "16px"
  column-gap: "72px"
  section: "112px"
  section-compact: "80px"
components:
  button-primary:
    backgroundColor: "{colors.relevo-orange}"
    textColor: "{colors.orange-ink}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.ember-orange}"
  button-primary-large:
    backgroundColor: "{colors.relevo-orange}"
    textColor: "{colors.orange-ink}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "52px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.frost-ink}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "46px"
  button-secondary-hover:
    backgroundColor: "{colors.raised-navy}"
  input:
    backgroundColor: "{colors.night-navy}"
    textColor: "{colors.frost-ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    height: "50px"
  option-tile:
    backgroundColor: "{colors.night-navy}"
    textColor: "{colors.mist-ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "50px"
  option-tile-selected:
    backgroundColor: "{colors.orange-tint}"
    textColor: "{colors.frost-ink}"
  chip:
    backgroundColor: "{colors.raised-navy}"
    textColor: "{colors.mist-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  chip-selected:
    backgroundColor: "{colors.orange-tint}"
  panel:
    backgroundColor: "{colors.deep-navy}"
    textColor: "{colors.frost-ink}"
    rounded: "{rounded.panel}"
    padding: "28px"
  nav:
    backgroundColor: "{colors.night-navy}"
    textColor: "{colors.mist-ink}"
    height: "68px"
---

# Design System: Relevo · Compradores

## Overview

**Creative North Star: "The Night Ledger"**

Scope first. This file describes the **buyer world**: the dark navy system built in `compradores.html` (served at `/compradores`) and the default for every future buyer surface (buyer emails, teaser pages, data-room screens, buyer onboarding). The seller landing at `index.html` keeps its own earlier light system (warm paper, light blue `#EAF1FA` ground, form in the hero) and is **not** governed by this file. Shared across both worlds are only the brand commitments: the name, the two-pill logo, Relevo orange `#F47B3D` and Relevo blue `#2C5186`.

The buyer world is a category-standard fintech surface played straight, at the finish level of Mercury, Stripe and Ramp marketing pages. It reads like a well-kept ledger at night: a deep navy ground, figures set in monospace with tabular numerals, information arranged in quiet bordered panels separated by hairlines. Nothing glows for its own sake. The one warm thing on screen is Relevo orange, and it marks either the action to take or the thing that matched.

Density is moderate and calm: generous section spacing (112px), short ledes held to ~58ch, and product evidence shown as real-looking objects (an anonymous teaser, a reconciliation table, a financing stack), each captioned "Ejemplo ilustrativo" because Relevo shows nothing it cannot yet prove. Depth comes from tonal navy steps and hairline borders, with a single soft drop shadow reserved for the panels that represent a deliverable.

**Key Characteristics:**
- Night navy ground with three raised navy steps; white hairlines at 9% and 16% opacity do all the dividing.
- Relevo orange is the only accent: primary actions, focus rings, selected states, active timeline nodes, matched chips.
- Brand blue appears as atmosphere (radial washes, gradient tints) and as a chart series, never as a button or text color.
- Geist for words, Geist Mono with tabular numerals for every figure.
- Two radii govern: 10px for controls, 16px for panels.
- Example data is always labeled as an example.

## Colors

A cold, low-chroma navy family carrying one hot accent; the palette is almost monochrome so that orange can mean something.

### Primary
- **Relevo Orange** (`{colors.relevo-orange}`): primary button fill, focus outline, text selection, caret, checked option tiles, active timeline nodes and progress line, the confidentiality and success icons. One orange action per view region.
- **Ember Orange** (`{colors.ember-orange}`): hover state of the primary button and the bright end of the timeline progress gradient. Never a resting color.
- **Orange Ink** (`{colors.orange-ink}`): text on orange (7.0:1 on Relevo Orange). Text on orange is never white.
- **Orange Tint** (`{colors.orange-tint}`): fill of selected option tiles and selected chips, paired with an orange border at 45% opacity.

### Secondary
- **Relevo Blue** (`{colors.relevo-blue}`): used only inside gradients at 42-60% alpha: the hero's radial wash, the verified-figures cell, the closing band. It tints; it never fills a control.
- **Signal Blue** (`{colors.signal-blue}`): second series in the financing bar and legend; its 14% alpha form (`{colors.blue-tint}`) is the reserved blue tint token.
- **Pale Steel** (`{colors.pale-steel}`): third chart series (seller note / earn-out).

### Tertiary (status)
- **Verified Green** (`{colors.verified-green}`): check icons in match rows, reconciliation "ok" cells, the done-state checklist. Status only.
- **Alert Coral** (`{colors.alert-coral}`): invalid field borders, error text, failed fieldset legends.

### Neutral
- **Night Navy** (`{colors.night-navy}`): page ground, input and option-tile fill (inputs sit "into" the darker ground), nav backdrop at 78% with blur. Also the `theme-color`.
- **Deep Navy** (`{colors.deep-navy}`): panel and cell fill, dialog panel, KPI cells, teaser gradient end.
- **Raised Navy** (`{colors.raised-navy}`): hover fill for secondary buttons and the close button, chip fill, teaser gradient start.
- **Raised Navy Hi** (`{colors.raised-navy-hi}`): top step, scrollbar thumb.
- **Hairline** (`{colors.hairline}`): row dividers, panel-internal separators, the nav border once scrolled.
- **Hairline Strong** (`{colors.hairline-strong}`): borders of panels that stand alone (teaser, financing stack, dialog, closing band), control borders, inactive timeline line and nodes, redaction bars.
- **Frost Ink** (`{colors.frost-ink}`): headings and primary text (16.1:1 on Night Navy).
- **Mist Ink** (`{colors.mist-ink}`): ledes, body copy inside panels, nav links (10.2:1).
- **Slate Ink** (`{colors.slate-ink}`): metadata, labels, captions, the muted second line of the hero headline (6.2:1 on Night Navy, 5.4:1 on Raised Navy).
- **Placeholder Ink** (`{colors.placeholder-ink}`): input placeholders only (4.5:1 on Night Navy). Do not use it for any content text.

### Named Rules
**The One Flame Rule.** Orange is the only saturated warm color in the buyer world, and it is spent on action, focus and match. If something orange is neither clickable, focused, selected nor a confirmed match, it should not be orange.

**The Blue Is Weather Rule.** Relevo Blue is atmosphere: radial washes and gradient tints behind content. It never fills a button, a chip or a text run.

**The Three Inks Rule.** Text uses exactly three inks: Frost for what you read first, Mist for what explains it, Slate for what labels it. A fourth text tone is a defect.

## Typography

**Display Font:** Geist (with ui-sans-serif, system-ui)
**Body Font:** Geist
**Label/Mono Font:** Geist Mono (with ui-monospace), for figures only

**Character:** A single neo-grotesk carries everything at weight 600 for headings and 400 for body, tightened hard at large sizes; the monospace is not a style but a data type, appearing wherever a number is money, a ratio or a percentage. Both are self-hosted variable fonts (`/fonts/Geist-Variable.woff2`, `/fonts/GeistMono-Variable.woff2`).

### Hierarchy
- **Display** (600, clamp(36px, 3.6vw, 50px), 1.04, -0.04em): hero headline only. Two lines: the first in Frost Ink, the second in Slate Ink, so the claim and its qualifier read as one sentence in two tones. 38px fixed below 600px.
- **Headline** (600, clamp(30px, 3.4vw, 44px), 1.08, -0.035em, max 20ch): section headings. The closing band uses clamp(28px, 3.2vw, 40px); dialog steps use 28px / 1.12.
- **Title** (600, 18-21px, 1.2, -0.02 to -0.025em): cell, profile and timeline headings; teaser title at 20px.
- **Lede** (400, 18-19px, 1.6, Mist Ink, 40-58ch): the one paragraph under a headline.
- **Body** (400, 17px, 1.6): page default. **Body small** (15.5px) inside panels, cells, FAQ answers.
- **Label** (500, 12.5-14px, Slate Ink): KPI terms, table heads, panel headers, captions. Sentence case; never uppercase-tracked.
- **Figure** (Geist Mono, tabular-nums, -0.01em): KPI values (19px / 500), totals (30px / 500), table cells, ticket ranges.

### Named Rules
**The Mono Means Money Rule.** Every financial figure (COP amounts, margins, multiples, percentages) is set in Geist Mono with tabular numerals. Words stay in Geist. Do not set prose or labels in mono for flavor.

**The Two-Tone Headline Rule.** The hero headline pairs a Frost Ink claim with a Slate Ink qualifier in the same size and weight. Hierarchy comes from tone, not from a second size or a label above it.

## Layout

A centered 1200px container with a 24px gutter (16px below 600px). Sections are separated by 112px of vertical padding (80px below 980px); consecutive sections that continue one argument drop their top padding so the rhythm stays even.

Grids are deliberately asymmetric two-column splits: the hero runs 1.2fr / 0.8fr with a 64px gap; financing, profiles and FAQ run 1fr / 1fr or 0.8fr / 1.2fr with a 72px gap; the benefits grid is 1.25fr / 1fr with the verified-figures cell spanning two rows and a 16px gap. The how-it-works timeline is a four-column ordered row connected by a hairline. Row lists (profiles, financing structures, FAQ) are divided by top hairlines with a closing bottom hairline, not boxed.

Responsive behavior: at 980px every split collapses to one column (gap 40-48px), nav links hide, the timeline becomes 2x2 without its connector line, and the hero loses its viewport-height minimum. At 600px the timeline goes single column, hero CTAs stretch to equal width, and the onboarding dialog becomes a full-screen sheet with no radius. The sticky nav is 68px tall; anchor scrolling offsets by 84px.

## Elevation & Depth

Depth is mostly tonal: four navy steps (Night, Deep, Raised, Raised Hi) plus hairline borders. Shadows are rare and soft, used only for objects that stand for a deliverable (the teaser, the financing stack), the primary button, and the dialog. Atmosphere comes from large, low-alpha radial gradients of Relevo Blue with a faint orange ember, placed behind the hero and the closing band.

### Shadow Vocabulary
- **Panel lift** (`box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 24px 60px -24px rgba(2,8,20,.8)`): the teaser panel and the financing stack. A faint top highlight plus a long, dark, offset-free falloff.
- **Primary button** (`box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 6px 16px -8px rgba(2,8,20,.7)`): gives the orange button a lit top edge.
- **Secondary button border** (`box-shadow: inset 0 0 0 1px rgba(214,226,245,.16)`): the outline is an inset shadow, so the button does not shift on hover.
- **Dialog** (`box-shadow: 0 40px 120px -30px rgba(0,0,0,.8)`) over a backdrop of `rgba(4,10,20,.72)` with `blur(10px)`.
- **Glass nav** (`background: color-mix(in srgb, #0a1424 78%, transparent); backdrop-filter: blur(14px) saturate(140%)`): the only translucent surface; it gains a hairline bottom border once the page scrolls.

### Named Rules
**The Deliverable Lifts Rule.** Only surfaces that depict what a buyer will actually receive (teaser, financing structure) carry the panel lift. Explanatory cells stay flat with a hairline border.

## Shapes

Two radii run the system: **10px** for anything you press or type into (buttons, inputs, option tiles, the close button) and **16px** for panels and cells. Around them sit a small set of purposeful exceptions: 12px for tables and KPI grids inset inside a panel, 20px for the dialog panel, 24px for the full-width closing band, 999px for chips and the example tag, 8px for financing bar segments, 3px for legend swatches and redaction bars, 2px for the step-progress ticks. Borders are always 1px hairlines; the focus ring is a 2px orange outline offset 3px. Icons are Phosphor regular weight, inlined as SVG symbols at 16-20px (28px for the privacy and done-state icons).

The logo mark is two 6px-tall rounded pills (16px long, 3px radius) offset diagonally, Frost Ink over Relevo Orange.

## Components

### Buttons
Confident, compact, and quiet until touched.
- **Shape:** gently rounded (10px), min-height 46px, 600 weight at 15px, -0.005em tracking; the large size is 52px tall, 24px side padding, 16px text.
- **Primary:** Relevo Orange fill, Orange Ink text, lit top edge. Hover moves to Ember Orange.
- **Secondary:** transparent with a 1px inset Hairline Strong outline, Frost Ink text; hover fills Raised Navy.
- **Hover / Focus / Active:** a trailing arrow icon slides 3px right on hover (0.35s, expo-out ease); press nudges the button 1px down; focus shows the 2px orange outline. Busy state drops to 65% opacity and disables pointer events.
- **Tertiary:** text buttons ("Atrás", "ver más") in Slate Ink at 500 weight, turning Frost Ink on hover.

### Chips
- **Style:** pill (999px), Raised Navy fill, Hairline Strong border, Mist Ink text at 13.5px, 6px 12px padding.
- **State:** selected chips switch to Orange Tint with a 45% orange border and a light peach text (`#ffc4a3`). Used to depict a buy box filter, not as interactive filters on the landing.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Deep Navy; feature cells may add a directional radial or linear gradient of Relevo Blue (or a faint orange ember for the privacy cell) fading into Deep Navy by 60%.
- **Shadow Strategy:** flat with a Hairline border by default; deliverable panels use Hairline Strong plus the panel lift.
- **Internal Padding:** 28px for cells and the financing stack; the teaser uses a 16px/20px header, 22px/20px body and 14px/20px footer separated by hairlines.

### Inputs / Fields
- **Style:** Night Navy fill (darker than the Deep Navy dialog around it), 1px Hairline Strong border, 10px radius, 50px min-height, 16px text, 12px 14px padding. Labels sit above at 14px / 600 with an optional Slate Ink `small` qualifier.
- **Hover:** border brightens to `rgba(214,226,245,.32)`.
- **Focus:** 2px orange outline offset 1px and an orange border.
- **Error:** Alert Coral border via `aria-invalid`, Alert Coral message at 13.5px below; a failed fieldset turns its legend coral and its tile borders coral at 45%.
- **Option tiles:** radio/checkbox choices rendered as full tiles in a 2- or 3-column grid (single column on mobile, 3-column becomes 2), same fill, border and radius as inputs; checked tiles take the Orange Tint fill, orange border and Frost Ink text. A large variant (64px) carries a leading icon that turns orange when checked.

### Navigation
- **Style:** sticky 68px glass bar; brand mark and wordmark (600, 20px) at left, section links at 15px Mist Ink with a 26px gap, then a right cluster with a Slate Ink cross-link to the seller side and the primary button.
- **States:** links go to Frost Ink on hover, no underline. A hairline bottom border appears after scroll.
- **Mobile:** links hide at 980px; at 600px the seller cross-link hides and the button compresses to 40px tall, 14px text.

### Anonymous Teaser (signature)
The product's core deliverable, shown as an object. A panel with a header (eye-slash icon in orange, "Ficha anónima", and an "Ejemplo ilustrativo" pill tag), a title and location meta line, a 2x2 KPI grid built from 1px hairline gaps over Deep Navy cells with mono figures, a "fit" list of check rows comparing the company to the buy box ("3 de 3"), and a footer with a lock icon and a redaction bar where the legal name will appear after the NDA.

### Data Exhibits (signature)
Reconciliation tables and the financing stack follow one pattern: an inset 12px-radius block on a translucent Night Navy (`rgba(10,20,36,.6)`), Slate Ink column heads at 12.5px, hairline row dividers, right-aligned mono figures, Verified Green check cells, and a figcaption marking the data as illustrative. The financing bar is a 56px row of 8px-radius segments with 4px gaps in Orange, Signal Blue and Pale Steel.

### Stage Timeline (signature)
Four steps on a hairline; nodes are 13px rings that fill orange as the line draws left to right (1.6s expo-out) when the timeline enters view. Each step's icon turns from Slate Ink to orange with its node.

### Onboarding Dialog
A native `<dialog>` over a blurred navy backdrop: a 640px Deep Navy panel (20px radius) with a top bar (brand, four 28px x 4px step ticks that turn orange as steps complete, close button), a scrolling body, and a sticky footer with back and next. It rises 16px and scales from 0.985 on open (0.5s). Full-screen sheet on phones.

### Motion
One easing curve, `cubic-bezier(.16,1,.3,1)` (expo-out), for every meaningful movement. Hero elements reveal with a 18px rise, 6px blur clearing and fade over 0.9s, staggered 90ms. Color and border transitions run 0.15-0.2s; icon nudges and FAQ plus-to-x rotation run 0.35s. All reveal and draw-in motion sits behind `prefers-reduced-motion: no-preference`; with reduced motion, content renders in its final state and smooth scrolling is off.

## Do's and Don'ts

### Do:
- **Do** keep every buyer surface on the Night Navy ground with Deep and Raised Navy steps and white hairlines at 9% / 16% opacity.
- **Do** spend Relevo Orange only on the primary action, focus, selection and confirmed matches (The One Flame Rule).
- **Do** set every money figure, ratio and percentage in Geist Mono with tabular numerals.
- **Do** use 10px radius for controls and 16px for panels; reach for the listed exceptions only for their stated roles.
- **Do** caption every example company, table or structure as "Ejemplo ilustrativo", and redact names until an NDA is signed.
- **Do** put text on orange in Orange Ink (`#1a0d05`), never white.
- **Do** gate reveal and draw-in motion behind `prefers-reduced-motion` and use the single expo-out curve.

### Don't:
- **Don't** apply this system to the seller landing (`index.html`); it keeps its own light world.
- **Don't** fill buttons, chips or text with Relevo Blue; blue is atmosphere and chart series only (The Blue Is Weather Rule).
- **Don't** introduce a second accent color or a fourth text ink.
- **Don't** show seller counts, deal counts, buyer demand, testimonials, client logos or team bios; there is no publishable evidence yet.
- **Don't** put the registration form in the hero; on buyer surfaces it lives in the onboarding dialog.
- **Don't** add the panel lift shadow to explanatory cells; it is reserved for deliverable objects.
- **Don't** add uppercase tracked labels or small kicker lines above headings; hierarchy comes from the three inks and the type scale.
