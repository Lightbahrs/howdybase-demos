# Template Upgrade: Photo-Driven Hero Design

## Context

HowdyBase builds demo landing pages for local roofing businesses scraped from Google Maps. The site is the cold pitch — the business owner clicks the link in a cold email and sees their own business on a live site. The page needs to create an immediate "holy shit, this looks real" reaction.

The current template (navy gradient hero, text-only) is functional but plain. This upgrade makes the hero personal by using the business's own Google photos.

## Goal

Upgrade `_template/index.html` (and backport to `comrade-roofing/index.html`) to use a full-bleed photo hero that makes each demo feel custom-built for that specific business.

## Design

### Hero Section

- **Background:** Full-viewport photo from the business's `imageUrls` array (Google Places scrape data)
- **Overlay:** Navy (`#0d1b2a`) at 70% opacity over the photo — keeps text readable regardless of photo brightness or color
- **Layout:** Same content as current (badge, eyebrow, business name, sub, stats, CTA) — the photo lives behind everything
- **Photo selection logic (Claude API):** When generating a site, Claude picks the best photo from `imageUrls` using these criteria:
  - Prefer landscape orientation
  - Prefer photos showing exterior roofing work (roofs, crews on roofs, finished jobs)
  - Skip headshots, office interiors, equipment close-ups
  - Take the first viable candidate
  - **Fallback:** if no suitable photo found, use the existing navy gradient (site never looks broken)
- **Implementation:** Photo URL goes into a CSS custom property `--hero-bg` set inline on the `<body>` or `.hero` element. The `.hero` CSS uses `background-image: var(--hero-bg)` with `background-size: cover; background-position: center`

### Photo Strip Section

New section immediately below the hero, above reviews:

- **3 photos** from the business's `imageUrls` array (different from the hero photo)
- Horizontal row, equal width, fixed height (~240px), `object-fit: cover`
- No captions, no padding between photos — edge-to-edge visual strip
- Shows more of their actual work before the social proof section
- **Fallback:** section is hidden (`display: none`) if fewer than 2 strip photos are available. With exactly 2 photos they span full width; with 3 they're equal thirds.

### Unchanged Sections

- Reviews (3 cards, Google link)
- Services grid (6 cards)
- CTA footer (orange, phone number)
- Footer

## Template Placeholders Added

Two new placeholders for the n8n workflow to populate:

- `<!-- HERO_PHOTO_URL -->` — single URL for the hero background
- `<!-- PHOTO_1_URL -->`, `<!-- PHOTO_2_URL -->`, `<!-- PHOTO_3_URL -->` — strip photos (strip section hidden if these are empty)

## Workflow Impact (n8n)

Claude API step (triggered on Airtable "Qualified" flip) gains responsibility for:
1. Receiving `imageUrls` array from the Airtable record
2. Selecting best hero photo (criteria above)
3. Selecting 3 strip photos (different from hero)
4. Outputting selections alongside the existing copy placeholders

No other workflow changes required.

## Files to Change

1. `_template/index.html` — primary change, adds photo hero + strip
2. `comrade-roofing/index.html` — backport: use a real Comrade Roofing Google photo for hero; add photo strip with their actual job photos
