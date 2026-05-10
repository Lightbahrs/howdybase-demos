// n8n Code node — Workflow 2: Fill template + prepare GitHub payload
// Inputs expected from previous nodes:
//   $('Poll Airtable').first().json  — Airtable record
//   $('Apify Scrape').first().json   — first item from Apify dataset array
//   $('Claude API').first().json     — Anthropic API response

// 1. Pull data from upstream nodes
const airtableRecord = $('Poll Airtable').first().json;
const apifyItem = $('Apify Scrape').first().json;
const claudeResponse = $('Claude API').first().json;

// 2. Parse Claude JSON output
let claude;
try {
  let rawText = claudeResponse.content[0].text.trim();
  rawText = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  claude = JSON.parse(rawText);
} catch (e) {
  throw new Error('Claude response is not valid JSON: ' + e.message + '\nRaw: ' + claudeResponse.content[0].text.slice(0, 200));
}

// 3. Fetch the HTML template from GitHub
const templateUrl = 'https://raw.githubusercontent.com/Lightbahrs/howdybase-demos/main/_template/index.html';
const templateResponse = await fetch(templateUrl);
if (!templateResponse.ok) {
  throw new Error('Failed to fetch template from GitHub: HTTP ' + templateResponse.status);
}
const template = await templateResponse.text();

// 4. Build phone variants
const rawPhone = airtableRecord.fields['Phone'] || '';
const phoneDigits = '+1' + rawPhone.replace(/\D/g, '');

// 5. Replace all placeholders (some appear multiple times — use replaceAll)
let html = template
  .replace('<!-- HERO_PHOTO_STYLE -->', claude.heroPhotoStyle || '')
  .replaceAll('<!-- CITY -->', airtableRecord.fields['City'] || 'Dallas')
  .replace('<!-- BUSINESS_NAME_MAIN -->', claude.businessNameMain || '')
  .replace('<!-- BUSINESS_NAME_SUB -->', claude.businessNameSub || '')
  .replace('<!-- HERO_SUB -->', claude.heroSub || '')
  .replaceAll('<!-- REVIEW_COUNT -->', String(apifyItem.reviewsCount || ''))
  .replaceAll('<!-- RATING -->', String(apifyItem.totalScore || ''))
  .replace('<!-- STAT_3_VALUE -->', claude.stat3Value || '')
  .replace('<!-- STAT_3_LABEL -->', claude.stat3Label || '')
  .replaceAll('<!-- PHONE_DIGITS -->', phoneDigits)
  .replaceAll('<!-- PHONE_DISPLAY -->', rawPhone)
  .replace('<!-- REVIEW_1_TEXT -->', claude.review1Text || '')
  .replace('<!-- REVIEW_1_ATTRIBUTION -->', claude.review1Attribution || '')
  .replace('<!-- REVIEW_2_TEXT -->', claude.review2Text || '')
  .replace('<!-- REVIEW_2_ATTRIBUTION -->', claude.review2Attribution || '')
  .replace('<!-- REVIEW_3_TEXT -->', claude.review3Text || '')
  .replace('<!-- REVIEW_3_ATTRIBUTION -->', claude.review3Attribution || '')
  .replace('<!-- GOOGLE_MAPS_URL -->', claude.googleMapsUrl || '')
  .replace('<!-- CTA_SUB -->', claude.ctaSub || '')
  .replace('<!-- PAGE_TITLE -->', claude.pageTitle || '')
  .replaceAll('<!-- BUSINESS_NAME -->', claude.businessName || airtableRecord.fields['Name'] || '')
  .replace('<!-- PHOTO_1_URL -->', claude.photo1Url || '')
  .replace('<!-- PHOTO_2_URL -->', claude.photo2Url || '')
  .replace('<!-- PHOTO_3_URL -->', claude.photo3Url || '');

// 6. Base64 encode for GitHub Contents API
const htmlBase64 = Buffer.from(html).toString('base64');

const slug = claude.slug;
const demoUrl = `https://demo.howdybase.com/${slug}`;

// 7. Return payload for downstream nodes
return [{
  json: {
    // For GitHub push node
    slug,
    htmlBase64,
    commitMessage: `feat: add demo site for ${claude.businessName || airtableRecord.fields['Name']}`,
    // For Airtable update node
    recordId: airtableRecord.id,
    demoUrl,
    emailSubject: claude.emailSubject,
    emailBody: claude.emailBody.replace('https://demo.howdybase.com/SLUG', demoUrl),
    businessName: claude.businessName || airtableRecord.fields['Name'],
  }
}];
