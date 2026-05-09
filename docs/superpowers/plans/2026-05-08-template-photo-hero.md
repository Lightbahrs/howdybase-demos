# Template Photo-Hero Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the roofing demo template and Comrade Roofing site to use a full-bleed photo hero and a horizontal photo strip, making each demo feel personally built for the business.

**Architecture:** The hero background photo is injected via an inline CSS custom property (`--hero-bg`) on the `.hero` element. A new `.photo-strip` section sits between the hero and reviews. Both sections degrade gracefully when photos are unavailable — hero falls back to the existing navy gradient, strip is hidden. The `_template/index.html` uses `<!-- PLACEHOLDER -->` comments that the n8n Claude API step replaces at generation time.

**Tech Stack:** Static HTML/CSS, no build step. Deployed to Vercel. Verified visually in browser using the Claude Preview MCP (`mcp__Claude_Preview__*` tools).

---

## File Map

| File | Action | What changes |
|---|---|---|
| `_template/index.html` | Modify | Add photo hero CSS + inline `--hero-bg` var, add photo strip section + CSS |
| `comrade-roofing/index.html` | Modify | Same changes, with real Comrade Roofing photo URLs substituted for placeholders |

---

### Task 1: Add photo hero CSS to `_template/index.html`

**Files:**
- Modify: `_template/index.html`

The `.hero` currently uses `background: var(--navy)`. We need to layer a photo behind the navy overlay. The approach: set `background-image` from a CSS custom property, add a pseudo-element overlay instead of relying on the background color alone.

- [ ] **Step 1: Update the `:root` and `.hero` CSS**

In `_template/index.html`, find the `.hero` rule (currently starts around line 31) and replace it with:

```css
.hero {
  background-color: var(--navy);
  background-image: var(--hero-bg, none);
  background-size: cover;
  background-position: center;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 60px 24px 80px;
  position: relative;
  overflow: hidden;
}
```

Then replace the existing `.hero::before` rule (the radial gradient glow) with an overlay pseudo-element:

```css
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(13, 27, 42, 0.72);
  pointer-events: none;
  z-index: 0;
}
```

Also add `z-index: 1; position: relative;` to `.badge`, `.hero-eyebrow`, `.hero-title`, `.hero-sub`, `.hero-stats`, `.hero-cta` so they render above the overlay. The simplest way: add a rule targeting all direct children of `.hero`:

```css
.hero > * {
  position: relative;
  z-index: 1;
}
```

Keep `.hero::after` (the orange bottom border) unchanged, but add `z-index: 2` to it so it renders above the overlay:

```css
.hero::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--orange);
  z-index: 2;
}
```

- [ ] **Step 2: Add the inline `--hero-bg` placeholder to the `.hero` element**

Find the opening `<section class="hero">` tag in the HTML body and replace it with:

```html
<section class="hero" style="--hero-bg: url('<!-- HERO_PHOTO_URL -->')">
```

When `<!-- HERO_PHOTO_URL -->` is empty (i.e., not replaced), `url('')` is harmless — the `background-image: var(--hero-bg, none)` gracefully falls back to no image, showing only the navy `background-color`. No broken layout.

- [ ] **Step 3: Visual check**

Start the Claude Preview MCP server for this file:
```
mcp__Claude_Preview__preview_start  path: _template/index.html
```
Take a screenshot. Verify:
- Hero is navy (no photo yet since placeholder is empty — that's correct)
- Text and CTA render correctly on top of the overlay
- Orange bottom border is visible

- [ ] **Step 4: Commit**

```bash
git add _template/index.html
git commit -m "feat: add photo hero CSS and placeholder to template"
```

---

### Task 2: Add photo strip section to `_template/index.html`

**Files:**
- Modify: `_template/index.html`

New section between the closing `</section>` of the hero and the opening `<section class="reviews"`. Three photos in a flush horizontal row.

- [ ] **Step 1: Add the photo strip CSS**

In the `<style>` block, add after the `.hero::after` rule:

```css
/* PHOTO STRIP */
.photo-strip {
  display: grid;
  grid-template-columns: repeat(var(--strip-cols, 3), 1fr);
  height: 240px;
  overflow: hidden;
}

.photo-strip.strip-2 { --strip-cols: 2; }
.photo-strip.hidden { display: none; }

.photo-strip img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

- [ ] **Step 2: Add the photo strip HTML**

Between `</section><!-- end hero -->` and `<section class="reviews"`, add:

```html
<!-- PHOTO STRIP — hidden by default; JS below shows it if photos are present -->
<div class="photo-strip hidden" id="photoStrip">
  <img src="<!-- PHOTO_1_URL -->" alt="" loading="lazy" id="stripPhoto1">
  <img src="<!-- PHOTO_2_URL -->" alt="" loading="lazy" id="stripPhoto2">
  <img src="<!-- PHOTO_3_URL -->" alt="" loading="lazy" id="stripPhoto3">
</div>
```

- [ ] **Step 3: Add the strip visibility script**

Directly before `</body>`, add:

```html
<script>
  (function() {
    var strip = document.getElementById('photoStrip');
    var p1 = document.getElementById('stripPhoto1');
    var p2 = document.getElementById('stripPhoto2');
    var p3 = document.getElementById('stripPhoto3');
    var validSrc = function(el) { return (el.getAttribute('src') || '').startsWith('http'); };
    var count = [p1, p2, p3].filter(validSrc).length;
    if (count >= 2) {
      strip.classList.remove('hidden');
      if (count === 2) {
        strip.classList.add('strip-2');
        p3.style.display = 'none';
      }
    }
  })();
</script>
```

This runs synchronously before paint on modern browsers. If fewer than 2 photos are present, the strip stays hidden. If exactly 2, the third `<img>` is hidden and the grid switches to 2-column.

- [ ] **Step 4: Visual check**

The template placeholders are still empty, so the strip should be hidden. Refresh the preview:
```
mcp__Claude_Preview__preview_screenshot
```
Verify the photo strip is not visible and reviews section appears immediately after the hero.

- [ ] **Step 5: Commit**

```bash
git add _template/index.html
git commit -m "feat: add photo strip section to template"
```

---

### Task 3: Backport to `comrade-roofing/index.html` with real photos

**Files:**
- Modify: `comrade-roofing/index.html`

Apply the same CSS and HTML changes, but substitute real Comrade Roofing Google photo URLs.

- [ ] **Step 1: Find Comrade Roofing photo URLs**

The Apify Google Places scrape for Comrade Roofing stored photo URLs in Airtable (base: `appdU7LEJbLPWK8LZ`, table: `tblsvMmqSriO8TyxY`). Use the Airtable MCP to fetch the Comrade Roofing record and retrieve the `imageUrls` field:

```
mcp__c5a62dd5__list_records_for_table  baseId: appdU7LEJbLPWK8LZ  tableId: tblsvMmqSriO8TyxY
```

From the returned `imageUrls` array:
- **Hero photo:** pick the first landscape exterior roofing photo (skip headshots/interiors)
- **Strip photos:** pick the next 3 different URLs after the hero pick

If Airtable doesn't have `imageUrls`, search Google for "Comrade Roofing Construction Dallas" and note 4 direct image URLs from their Google Business listing to use manually.

- [ ] **Step 2: Apply hero CSS changes to `comrade-roofing/index.html`**

Make the same CSS edits as Task 1 Step 1 — update `.hero`, `.hero::before`, `.hero::after`, add `.hero > *` rule.

Then update the hero opening tag with the real hero photo URL (replace `HERO_URL_HERE` with the actual URL selected in Step 1):

```html
<section class="hero" style="--hero-bg: url('HERO_URL_HERE')">
```

- [ ] **Step 3: Add photo strip HTML and CSS to `comrade-roofing/index.html`**

Add the same `.photo-strip` CSS as Task 2 Step 1.

Add the strip HTML with real photo URLs (replace `PHOTO_N_URL_HERE` with the actual URLs):

```html
<div class="photo-strip hidden" id="photoStrip">
  <img src="PHOTO_1_URL_HERE" alt="" loading="lazy" id="stripPhoto1">
  <img src="PHOTO_2_URL_HERE" alt="" loading="lazy" id="stripPhoto2">
  <img src="PHOTO_3_URL_HERE" alt="" loading="lazy" id="stripPhoto3">
</div>
```

Add the same `<script>` block from Task 2 Step 3 before `</body>`.

- [ ] **Step 4: Visual check — hero photo**

```
mcp__Claude_Preview__preview_start  path: comrade-roofing/index.html
mcp__Claude_Preview__preview_screenshot
```

Verify:
- Hero shows a real roofing photo as background
- Navy overlay makes text clearly readable
- Business name, phone, stats, and CTA are all visible and correct
- Orange bottom border is present

- [ ] **Step 5: Visual check — photo strip**

Scroll down past the hero:
```
mcp__Claude_Preview__preview_scroll  direction: down  pixels: 800
mcp__Claude_Preview__preview_screenshot
```

Verify:
- Photo strip is visible (3 photos in a row, flush edge-to-edge)
- Photos are not distorted (object-fit: cover)
- Reviews section appears directly below the strip

- [ ] **Step 6: Mobile check**

Resize to mobile width and verify the photo strip doesn't break layout:
```
mcp__Claude_Preview__preview_resize  width: 390  height: 844
mcp__Claude_Preview__preview_screenshot
```

The strip stays as a horizontal row at 240px tall on mobile — this is intentional (a visual accent, not a gallery). If it looks problematic, add to the CSS:

```css
@media (max-width: 480px) {
  .photo-strip { height: 160px; }
}
```

- [ ] **Step 7: Commit**

```bash
git add comrade-roofing/index.html
git commit -m "feat: apply photo hero and strip to comrade-roofing with real photos"
```

---

### Task 4: Push branch and verify Vercel preview

**Files:** none (deployment)

- [ ] **Step 1: Push branch**

```bash
git push origin claude/epic-varahamihira-052084
```

- [ ] **Step 2: Check Vercel preview URL**

Use Vercel MCP to get the preview deployment URL for this branch:
```
mcp__cb3f2c19__list_deployments
```

Open the preview URL for `comrade-roofing/` and verify the photo hero and strip render correctly on the live Vercel deployment (not just local preview).

- [ ] **Step 3: Confirm and close**

If everything looks good, report the preview URL to the user for sign-off before merging to main.
