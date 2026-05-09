# Analytics options for Cubist

Notes on free analytics options if/when GitHub's built-in Insights stops being enough.

## Currently in use

**GitHub repo Insights → Traffic** — zero setup, last-14-days only, no custom events.
Visit https://github.com/zcsstar/rubik-cube/graphs/traffic

## Options to upgrade to

### 1. Umami Cloud (recommended if custom events matter)

- Free tier: 3 sites, 100k events/month, no credit card.
- Pageviews, sessions, unique visitors, referrers, devices, countries, average session duration.
- **Custom events** via `umami.track('cube-solved', { size: 3, moves: 22 })`.
- Privacy-friendly, no cookies, GDPR-compliant.
- Sign up: https://cloud.umami.is

Wiring (when ready):
1. Add one `<script>` tag from the Umami dashboard to `index.html`.
2. In `src/ui/hooks/useSolveSession.ts` (or wherever a solve completes), call
   `window.umami?.track('cube-solved', { size, moves: solution.length })`.
3. Optionally track tutorial completions with `window.umami?.track('tutorial-completed', { size })`.

### 2. Cloudflare Web Analytics (simplest, no custom events)

- Free, unlimited, privacy-first, no cookies.
- Pageviews, unique visitors, referrers, top pages, country.
- One script tag, sign up at https://www.cloudflare.com/web-analytics/
- Downside: no custom events — can't measure "cubes solved", only page visits.

### 3. Google Analytics 4

- Free, custom events supported, ubiquitous.
- Heavy script (~50KB), often blocked by ad-blockers (undercounts), privacy concerns,
  confusing UI.
- Only worth it if you need GA-specific integrations.

### 4. GoatCounter

- Free for non-commercial use.
- Simple, lightweight, privacy-friendly.
- Limited custom event support.
- https://www.goatcounter.com

## Comparison

| Tool          | Free?     | Custom events | Privacy | Setup effort |
|---------------|-----------|---------------|---------|--------------|
| GitHub Traffic| ✓         | ✗             | ✓       | None         |
| Umami Cloud   | ✓ (3 sites)| ✓            | ✓       | ~5 min       |
| Cloudflare WA | ✓         | ✗             | ✓       | ~5 min       |
| GA4           | ✓         | ✓             | ✗       | ~10 min      |
| GoatCounter   | ✓ (non-commercial) | partial | ✓ | ~5 min     |
