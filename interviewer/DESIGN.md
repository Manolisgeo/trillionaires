---
name: Aperture
description: An archival reading room for AI interviews; every claim catalogued, every rating traced to a quote and a timecode.
colors:
  hollinger: "#2f3b45"
  hollinger-2: "#3b4955"
  board: "#f4f5f2"
  card: "#ffffff"
  tab: "#e9ecea"
  rule: "#d5dad8"
  rule-faint: "#e3e7e5"
  rule-strong: "#a9b6bd"
  ink: "#1e262d"
  ink-2: "#3f4a53"
  muted: "#5c6770"
  faint: "#8a959c"
  chrome-link: "#c9d2d7"
  stamp: "#5a4aa8"
  stamp-deep: "#43358a"
  stamp-tint: "#eeebf7"
  stamp-wash: "rgba(90, 74, 168, 0.13)"
  redline: "#c23b2e"
  error-ink: "#a8322a"
  error-wash: "#fbf1f0"
  error-rule: "#e3b1ab"
typography:
  display:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "38px"
  headline:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: "34px"
  question:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: "24px"
  title:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "24px"
  body:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
  dense:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "21px"
  readout:
    fontFamily: "Courier Prime, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0.04em"
    fontFeature: "tnum"
  stamp-label:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.12em"
rounded:
  none: "0px"
  stamp: "3px"
  md: "6px"
  full: "9999px"
spacing:
  rule: "24px"
  half-rule: "12px"
  xs: "4px"
  sm: "8px"
  md: "16px"
  gutter: "28px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 22px"
    height: "48px"
  button-secondary-hover:
    backgroundColor: "{colors.board}"
  button-icon:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.full}"
    size: "48px"
  catalog-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 24px"
  stamp-ai:
    textColor: "{colors.stamp}"
    rounded: "{rounded.stamp}"
    typography: "{typography.stamp-label}"
    padding: "2px 8px"
  slip-marker:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.card}"
    rounded: "{rounded.stamp}"
    height: "24px"
    padding: "0 10px 0 8px"
  folder-tab:
    backgroundColor: "{colors.tab}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  folder-tab-selected:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  app-header:
    backgroundColor: "{colors.hollinger}"
    textColor: "{colors.card}"
    height: "56px"
    padding: "0 28px"
---

# Design System: Aperture

## Overview

**Creative North Star: "The Reading Room"**

Aperture treats a candidate's background the way an archive treats a record. The surface is a cool, acid-free board (#f4f5f2, never cream) under a Hollinger blue-grey chrome bar; documents are white catalog cards with a red top rule; everything the AI marks is stamped in violet ink. The materials are the archive's own: stamps, slip markers, folder tabs, finding-aid outlines, typewriter readouts. The product refuses the AI-dashboard default (no glowing orb, no gradients, no score rings) and reads as a calm, precise place where a person can check the work.

Density is document-first. Exactly one document owns the desk at a time (a CV, a report, a ledger); folder tabs swap it hard, never tile it. Dense surfaces (transcript, ledger, evidence) keep one text size and get rank from weight, case, reversal and rule. The 24px card rule is the layout armature: ruled cards put every text row on a 24px baseline, and spacing moves in 12/24 steps.

Color is spent by meaning. Violet means the AI marked this. Red means a recording, and also the top rule of every catalog card. Ink buttons carry the one primary action per view. Nothing else is chromatic.

**Key Characteristics:**
- Cool board, white cards, blue-grey chrome; one violet voice, one red voice.
- Public Sans for reading, Courier Prime for call numbers, timecodes and readouts.
- Flat surfaces with 1px rules; depth by tonal layering and a single sheet shadow.
- Every record carries a call number (R-014, C-0388, Q2.3, T-118) in mono.
- Only readouts and stamp presses move; everything else is still.

## Colors

A cool archive palette: blue-grey chrome, neutral board, violet stamp ink, one red.

### Primary
- **Stamp Ink Violet** (stamp): everything the AI marks. The AI stamp, slip markers, the line-being-asked-about wash (stamp-wash, 13% alpha) with its 2px underline, suggested ratings, focus rings, links, form accents. Tinted hover surface is stamp-tint; pressed link is stamp-deep.

### Secondary
- **Redline** (redline): two uses only, the 3px top rule of a catalog card and the recording indicator. On the dark chrome the recording stamp uses lighter reds (#e06a5f border, #e2554a dot) for contrast.

### Neutral
- **Hollinger Blue-Grey** (hollinger, hollinger-2): the header bar and dark chrome.
- **Acid-Free Board** (board): page ground and hover ground. **Catalog White** (card): every document surface. **Tab Grey** (tab): unselected folder tabs.
- **Rules** (rule, rule-faint, rule-strong): card borders, ruled-paper lines (faint), control borders and dashed "unfilled" outlines (strong).
- **Ink** (ink, ink-2, muted, faint): text, in descending rank. Muted (#5c6770) is the smallest-text floor for AA on card and board.
- **Error** (error-ink, error-wash, error-rule): inline field errors and error notes only.

### Named Rules
**The Two Inks Rule.** Violet is what the AI marked; red is a recording or a card's top rule. A human action, a status, or decoration never borrows either.
**The Cool Board Rule.** Backgrounds are blue-grey neutrals. Warm or cream grounds are out of the world.

## Typography

**Body Font:** Public Sans (system-ui, sans-serif), weights 400/500/600/700.
**Readout Font:** Courier Prime (ui-monospace), 400/700, always tabular.

**Character:** A plain civic sans for reading beside a typewriter face for the catalog's metadata. The sans is calm and legible; the mono marks what is indexed, timed or counted.

### Hierarchy
- **Display** (700, 30px, 38px): page titles on recruiter and candidate pages.
- **Headline** (700, 26px, 34px; 30px at sm+ on the report): report and lobby titles, completion.
- **Question** (500, 20px, 24px, balanced wrap, max 62ch): the interview question on its catalog card.
- **Title** (700, 16px, 24px): empty-state and card titles.
- **Body** (400, 15px, 24px): controls, form fields, running text; paragraphs capped at 62ch.
- **Dense** (400, 14px, 21px): transcript, ledgers, evidence, nav, tabs. One size; rank by weight and rule.
- **Readout** (400, 13px, +0.04em, tabular): call numbers, timecodes, phase clocks, page:line.
- **Stamp label** (700, 11px, +0.12em, uppercase): stamp text only.

### Named Rules
**The One Size Rule.** Dense surfaces use 14px throughout. Rank comes from weight, case, reversal (a white-on-ink current line) and rule, never from stepping size.
**The Typewriter Rule.** Anything indexed, timed or counted is mono and tabular. Prose is never mono.
**The One Label Rule.** A question has one call tag (Q2.3) from `questionLabel`; no surface composes its own.

## Layout

Single-column documents on the board with a desk-and-side split in the room: a flexible desk (CV, whiteboard, browser, pad) beside a fixed 380px (420px at xl) status column of stamp, finding-aid phases and transcript, stacked under the desk below lg. Page gutters are 16px on phones and 28-32px at sm+; recruiter content caps near 1240px, reading text at 62-72ch. The room fills the viewport (100dvh at lg) with the footer bar static; on phones the footer sticks and secondary controls fold under "More". Rhythm runs on the 24px rule with 12px half-steps; controls are 40/44/48px high with 44px the default and 48px for in-call actions.

## Elevation & Depth

Flat by default. Documents are separated from the board by 1px rules and by white-on-cool tonal contrast, not shadow. One sheet shadow exists for a lifted document on the desk (`0 1px 0 #d5dad8, 0 0 0 1px #e3e7e5, 0 12px 28px rgba(47,59,69,0.1)`, soft and blue-grey, never hard-offset). The whiteboard island uses a lighter equivalent. State is shown by stamp press, border darkening and tonal fill, not by lift.

### Named Rules
**The Flat Sheet Rule.** Cards sit on the board with a rule, not a shadow. The sheet shadow belongs only to a document lifted onto the desk.

## Shapes

Mostly square paper. Catalog cards, ledgers and empty drawers have square corners with a 1px border; the card's identity is the 3px redline top rule (dashed rule-strong border for an empty or provisional card). Controls, fields and folder tabs use a 6px radius (tabs round the top only). Stamps and slip markers use 3px; a slip is flush right and rounded only on its left, as if tucked into a margin. Stamps may tilt (about -1.5deg). Only the mic and play buttons are circles. Unfilled things (rating 4, "Extra think time" label, empty cards) use dashed rule-strong outlines.

## Components

### Buttons
- **Shape:** 6px radius, 44px default, 48px in the room, 40px compact.
- **Primary:** Ink fill, white text, 600 weight, one per view ("I'm finished answering"). Hover shifts to ink-2.
- **Secondary:** White fill, rule-strong border, ink text; hover fills board. **Danger** is a secondary with an ink-2 border and 600 weight (it is not red; red is reserved).
- **Icon:** 48px (44px) ink circle with white 20px line icon; muted state inverts to a white fill with an ink border.
- **Disabled:** 50% opacity, not-allowed cursor.

### Catalog Card
White, square, 1px rule border, 3px redline top rule, 24px side padding. Optional mono header row: call number and kicker at left, source or right slot in violet at right. The ruled variant paints 24px faint lines as paper and aligns every row to them. The question card uses the strips variant: rules sit only on the call-number row and the source row, and the question text between them sits on clean card with 12px clear of each rule (20px/24px type, py 12px), so no rule strikes through a line of text. Empty variants are dashed.

### Stamp
Bordered uppercase label (1.5px border, 3px radius) in violet (AI), ink-2 (neutral), redline (recording) or dashed rule-strong. Presses on mount and when its text changes (scale 1.04 to 1, 120ms, ease-out). The recording stamp is a red dot plus mono label with a clock.

### Slip Marker
Violet tag, 24px high, mono 12px white call tag with an arrow ("Q2.3"), slides in from the margin (180ms). Paired with the line wash. The same tag is the report citation, rendered in `EvidenceQuote` next to a play glyph, timecode and transcript call number, with the quote under the violet wash. The tag text always comes from one helper, `questionLabel` in `lib/questions.ts`, so the room slip, the finding-aid outline, the card kicker, the interview page and the report chip cannot disagree. In the report, `questionForEvidence` picks the question (latest asked at or before the quote, else the first planned question targeting the criterion, else no chip), and each criterion closes with a mono 12px line: the violet bold call tag, then "asked as" the question's source.

### Folder Tabs
Hard-swap tablist (arrow, Home, End keys). Selected tab is white with a semibold ink label and merges into the document; others are tab grey, white on hover. One panel visible.

### Fields
Label above (14px, 600), optional hint (13px muted), control 44px (15px text, white, rule-strong border, 6px radius), inline error in error-ink 600 with an error-ink border. File input is dashed. Checkboxes are 20px with a 24px-line label and violet accent.

### Header and Navigation
56px Hollinger bar: APERTURE wordmark (700, +0.14em), nav at 14px in chrome-link with the current item white, semibold and underlined by an inset 2px white rule; mono call-number title in rule-strong; centered phase clock and right-hand readouts in the room. Focus rings turn white on the bar.

### Finding Aid (Phase Outline)
Numbered phase list: done muted, current bold with its questions beneath a 1px left rule, the current question reversed white on ink, upcoming with minutes in mono at right.

### Ledger and Rating
Ledger: white sheet, 2px ink rule under a mono bold title row, 14px table with faint row rules and board hover, scrolling in its own region on narrow screens. Rating: four 28px mono boxes, the suggested one filled violet; box 4 is dashed because only a person can award it.

### States
Empty: dashed drawer that says what is missing and what to do. Loading: a mono "Cataloguing..." line with stepped ticking dots, no spinner. Error: error-wash note with error-rule border, bold error-ink title and the recovery. Interim actions confirm inline in the footer, not in a modal.

### Motion
Stamp-press (120ms) and slip-in (180ms) are the only transitions that matter; readouts tick. Buttons use a colour transition only. `prefers-reduced-motion` removes all animation and transition.

## Do's and Don'ts

### Do:
- **Do** use violet only for what the AI marked and red only for a recording or a catalog card's top rule.
- **Do** put a mono call number on every record, quote and rating.
- **Do** keep dense surfaces at 14px and rank by weight, case, reversal and rule.
- **Do** align ruled cards to the 24px rule and space in 12/24 steps.
- **Do** keep targets at 44px minimum (48px in the room) and a visible 2px violet focus ring (white on the header).
- **Do** keep one primary ink button per view and confirm risky actions inline.

### Don't:
- **Don't** add gradients, glows, orbs, score rings or avatars; the AI is a stamp, not a persona.
- **Don't** use warm or cream grounds, or hard offset shadows.
- **Don't** make danger red; danger is an ink-2 border and weight.
- **Don't** tile documents; one owns the desk and tabs hard-swap.
- **Don't** animate anything except stamp presses, slip entry and readouts, and never past reduced-motion.
- **Don't** treat the mono small-caps section labels (kicker line over a card, "FINDING AID", SERIES headings) as a pattern for new surfaces; see the note below.

### Not canonized (defects the build carries)
The build ships small mono, tracked, uppercase label lines that act as kickers or eyebrows (the CatalogCard `kicker` row, the "FINDING AID" and "CAPTIONS" labels, SeriesHeading). They are in the code but are not recorded as house style; new surfaces should name sections with real headings or the call number alone.
