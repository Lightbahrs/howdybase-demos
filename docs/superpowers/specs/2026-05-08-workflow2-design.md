# Workflow 2: Qualified Lead → Live Demo Site Design

## Context

HowdyBase is an AI-powered lead generation system that finds local roofing businesses on Google Maps with no websites, builds them demo sites, and cold emails them. Leads are scraped via Apify and stored in Airtable. When a lead is manually vetted and flipped to "Qualified," Workflow 2 fully automates the rest: scrape fresh data, generate a personalized site and cold email via Claude API, deploy to Vercel, and stage everything in Airtable for review.

## Goal

Build a single linear n8n workflow that triggers every 15 minutes, processes all newly-Qualified leads, and for each one: re-scrapes via Apify, generates site copy + photos + cold email via Claude API, fills the HTML template, pushes to GitHub (triggering Vercel deploy), and updates Airtable with the demo URL and email draft.

## Stack

- **n8n** (howdybase.app.n8n.cloud) — workflow orchestration
- **Airtable MCP** (base: `appdU7LEJbLPWK8LZ`, table: `tblsvMmqSriO8TyxY`) — lead data + status tracking
- **Apify** (`compass/crawler-google-places`) — fresh business data + photos
- **Claude API** (claude-sonnet-4-6) — photo selection, copy generation, email drafting
- **GitHub API** — push generated HTML to `Lightbahrs/howdybase-demos` repo
- **Vercel** — auto-deploys on GitHub push, serves at `demo.howdybase.com/{slug}`

---

## Workflow Design

### Trigger
Schedule node: every 15 minutes.

### Step 1: Poll Airtable
Fetch all records where:
- `Status` = `"Qualified"`
- `Demo URL` is empty

If no records match, workflow stops. If multiple records match, n8n loops through them one at a time — each record completes the full pipeline before the next begins.

**Airtable fields used as input:**
- `Name` — business name
- `City` — city (Dallas)
- `Phone` — formatted phone number
- `Rating` — star rating
- `reviewsCount` — total review count
- `Review 1`, `Review 2`, `Review 3` — review text snippets
- `Address` — full address

### Step 2: Apify Scrape
Call `compass/crawler-google-places` actor with:
```json
{
  "searchStringsArray": ["[Name] [City] TX"],
  "maxCrawledPlacesPerSearch": 1,
  "maxImages": 10,
  "language": "en"
}
```

Returns fresh `imageUrls` array (up to 10 photos), full business data, and reviews. This is the source of truth for photos — Airtable does not store image URLs.

### Step 3: Claude API
Send a single prompt to `claude-sonnet-4-6` containing all Apify output. Request structured JSON response with two sections:

**Site fields:**
- `heroPhotoStyle` — full inline style value: `--hero-bg: url('PHOTO_URL')`. Empty string if no suitable photo found (falls back to navy gradient).
- `photo1Url`, `photo2Url`, `photo3Url` — strip photos (different from hero). Empty string if unavailable.
- `businessNameMain` — first line of business name (for large Bebas Neue heading)
- `businessNameSub` — second line of business name (renders in orange)
- `heroSub` — 1-2 sentence personalized description based on reviews and rating
- `stat3Value`, `stat3Label` — third hero stat (e.g. `"100%"` / `"5-Star Reviews"`)
- `review1Text`, `review1Attribution`, `review2Text`, `review2Attribution`, `review3Text`, `review3Attribution` — best 3 reviews, attribution format: `"— Name · Google Review"`
- `googleMapsUrl` — Google Maps search URL for the business
- `ctaSub` — 1-2 sentence personalized closing line for the CTA section
- `pageTitle` — browser tab title, e.g. `"Comrade Roofing & Construction | Trusted Dallas Roofing"`
- `slug` — URL-safe business identifier, e.g. `aco-roofing-gutters`

**Email fields:**
- `emailSubject` — cold email subject line referencing the demo site
- `emailBody` — full cold email body, personalized to their reviews/rating, includes the demo URL `https://demo.howdybase.com/{slug}`

**Photo selection criteria (in Claude prompt):**
- Prefer landscape orientation
- Prefer exterior roofing work (roofs, crews, finished jobs)
- Skip headshots, office interiors, equipment close-ups
- Hero photo: first viable candidate
- Strip photos: next 3 viable candidates, different from hero
- If fewer than 2 strip photos available, set photo URLs to empty string (strip hides via JS)

### Step 4: Template Fill
n8n Code node (JavaScript):
1. Fetch raw template HTML from GitHub:
   `https://raw.githubusercontent.com/Lightbahrs/howdybase-demos/main/_template/index.html`
2. Replace all `<!-- PLACEHOLDER -->` comments with Claude's output values:

| Placeholder | Value source |
|---|---|
| `<!-- HERO_PHOTO_STYLE -->` | `heroPhotoStyle` |
| `<!-- CITY -->` | Airtable `City` |
| `<!-- BUSINESS_NAME_MAIN -->` | `businessNameMain` |
| `<!-- BUSINESS_NAME_SUB -->` | `businessNameSub` |
| `<!-- HERO_SUB -->` | `heroSub` |
| `<!-- REVIEW_COUNT -->` | Apify `reviewsCount` |
| `<!-- RATING -->` | Apify `totalScore` |
| `<!-- STAT_3_VALUE -->` | `stat3Value` |
| `<!-- STAT_3_LABEL -->` | `stat3Label` |
| `<!-- PHONE_DIGITS -->` | Airtable `Phone` stripped of non-numeric chars, prefixed with `+1` (e.g. `+19409458043`) |
| `<!-- PHONE_DISPLAY -->` | Airtable `Phone` (formatted display) |
| `<!-- REVIEW_1_TEXT -->` | `review1Text` |
| `<!-- REVIEW_1_ATTRIBUTION -->` | `review1Attribution` |
| `<!-- REVIEW_2_TEXT -->` | `review2Text` |
| `<!-- REVIEW_2_ATTRIBUTION -->` | `review2Attribution` |
| `<!-- REVIEW_3_TEXT -->` | `review3Text` |
| `<!-- REVIEW_3_ATTRIBUTION -->` | `review3Attribution` |
| `<!-- GOOGLE_MAPS_URL -->` | `googleMapsUrl` |
| `<!-- CTA_SUB -->` | `ctaSub` |
| `<!-- PAGE_TITLE -->` | `pageTitle` |
| `<!-- PHOTO_1_URL -->` | `photo1Url` |
| `<!-- PHOTO_2_URL -->` | `photo2Url` |
| `<!-- PHOTO_3_URL -->` | `photo3Url` |

### Step 5: GitHub Push
HTTP Request node — GitHub Contents API:
```
PUT https://api.github.com/repos/Lightbahrs/howdybase-demos/contents/{slug}/index.html
Authorization: Bearer {GITHUB_PAT}
Content-Type: application/json

{
  "message": "feat: add demo site for {Business Name}",
  "content": "{base64-encoded HTML}"
}
```

Vercel detects the push and deploys automatically. Live URL: `https://demo.howdybase.com/{slug}`.

### Step 6: Airtable Update (Success)
Update the record with:
- `Status` → `"Site Built"`
- `Demo URL` → `https://demo.howdybase.com/{slug}`
- `Email Subject` → Claude's `emailSubject`
- `Email Body` → Claude's `emailBody`

### Step 7: Error Handling
If any step (Apify, Claude, GitHub) throws an error, n8n catches it and updates the Airtable record:
- `Status` → `"Qualified"` (reset so it retries on next poll)
- `Notes` → error message and failed step name

This prevents records silently getting stuck and makes failures visible in Airtable.

---

## Airtable Fields Required

The following fields must exist on the table before the workflow runs. Fields that don't exist yet need to be created:

| Field | Type | Notes |
|---|---|---|
| `Status` | Single select | Already exists. Add `"Site Built"` option if not present. |
| `Demo URL` | URL | Create if not present. |
| `Email Subject` | Single line text | Create if not present. |
| `Email Body` | Long text | Create if not present. |
| `Notes` | Long text | Create if not present. Used for error messages. |

---

## Credentials Required in n8n

| Credential | Used for |
|---|---|
| Airtable API key | Polling + updating records |
| Apify API token | Google Places scrape |
| Anthropic API key | Claude API call |
| GitHub PAT (`repo` scope) | Pushing HTML files |
