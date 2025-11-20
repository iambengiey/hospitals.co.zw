# hospitals-co-zw

A lightweight, data-driven directory of public, private, and mission hospitals in Zimbabwe &mdash; plus nearby clinics, pharmacies, opticians, and dental practices. The site is designed for GitHub Pages and backed by a simple JSON catalogue plus a monthly scraper workflow. The UI is responsive, keyboard-friendly, and supports list and map views with client-side search + filters.

## Repository layout

```
├── data/               # Canonical hospital catalogue (JSON)
├── src/                # Frontend assets deployed to GitHub Pages
├── scripts/            # Data collection helpers
├── .github/workflows/  # Automation (deploy + scraping)
```

## Running the site locally

1. Install the frontend toolchain (esbuild for bundling/minification):
   ```bash
   npm install
   ```
2. Generate the browser data module (mirrors `data/hospitals.json` into `src/hospitalsData.js` and refreshes `src/data/hospitals.json` for downloads):
   ```bash
   npm run prepare:data
   ```
3. Bundle the JavaScript and CSS (writes to `src/assets/` if you prefer minified assets):
   ```bash
   npm run build
   ```
   > Bundling is optional during local dev; the published `index.html` loads `src/app.js` and `src/styles.css` directly when no bundled files are present.
4. Serve the site:
   ```bash
   python -m http.server --directory src 8000
   ```
5. Visit [http://localhost:8000](http://localhost:8000) to interact with the directory (list + optional map view).

## Running the scraper locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/scrape_hospitals.py
```

The script loads the existing catalogue, normalises names/cities for resilient matching, runs each configured scraper stub (including a "gap filler" list for hard-to-source facilities such as Makumbe, Makumbi, Avenues, Baines, Mazowe, and Chinhoyi), merges results by `(name, city)`, recalculates tiers via the helper, stamps `last_verified` with the current date, and rewrites `data/hospitals.json` in a stable order.

## Data shape and tiering rules

Each record in `data/hospitals.json` includes:

- `id`, `name`, `province`, `city`, `address`
- `type` (public/private/mission/etc) and `ownership`
- `category` (hospital, clinic, pharmacy, optician, dental_clinic, etc.)
- `bed_count` (integer or null)
- `specialists` (array of strings like `oncology`, `trauma`, `optometry`)
- `tier` (T1/T2/T3), `phone`, `website`
- `operating_hours` and `manager`
- optional `latitude`/`longitude` (used for the "Nearest to me" sort once location is enabled)

The current catalogue mirrors 49 facilities, including 32 hospitals pulled from the public Wikipedia list (Harare, Bulawayo, Midlands, Manicaland, Mashonaland, Matabeleland, and Masvingo provinces) so dropdowns stay populated even before fresh scrapes land.

### Tiering rules

Tiering now follows the “Overview of Zim Healthcare System 2025” thresholds used by MoHCC planning teams:

- **T1 (Central / Teaching / Referral):** Central, referral, or teaching/university hospitals; any facility with `bed_count >= 350`; or those providing critical disciplines such as oncology, cardiology, ICU/critical care, trauma, neurosurgery, hematology, or neonatology.
- **T2 (Provincial / High-Volume District):** Provincial or district general hospitals and multi-specialty facilities with `bed_count` roughly `120–349` or at least two distinct specialist services.
- **T3 (Primary / Community):** Rural, mission, primary clinics, pharmacies, and small facilities under 120 beds or with unknown capacity.

These rules are implemented both in the frontend (`src/app.js`) and in the scraper (`scripts/scrape_hospitals.py`) so that any ingestion path remains consistent. The homepage also repeats these definitions in a short “How tiers work” section for visitors at the bottom of the listing.

## Search, filters, map view, and accessibility

- **Search:** Instant client-side search bar covers hospital name and city/town.
- **Filters:** Province, ownership/type, facility category, tier, and specialist dropdowns combine with search to narrow results. Distance-aware sorting unlocks after enabling location.
- **Map view:** A view toggle switches between list and map. Facilities with `latitude`/`longitude` plot via Leaflet; clicking a marker highlights the corresponding card. Map assets are lazy-loaded to keep the default payload small.
- **Accessibility:** High-contrast palette, large tap targets on mobile, focus-visible outlines, and ARIA labels on filters, toggles, and map region.
- **Performance:** JS/CSS are bundled/minified by `npm run build`; rendering is scheduled via `requestAnimationFrame` and DOM diffing to avoid unnecessary reflows when filters change. GitHub Pages will serve `src/assets/*` with ETags—append a simple query string (e.g., `?v=DATE`) in `index.html` if you ever need to force cache-busting between releases.

### Official MoHCC reference

For the latest policy circulars, emergency guidance, and referral pathways, check the Ministry of Health & Child Care site at [https://www.mohcc.gov.zw/](https://www.mohcc.gov.zw/). This repository aligns its tiering copy with the 2025 overview and links to MoHCC from the landing page so users can reach authoritative updates.

## Google AdSense placeholders

`src/index.html` contains a dedicated `<section class="adsense">` that includes:

- An empty `<script>` tag where the official AdSense script should be pasted.
- An `<ins class="adsbygoogle">` element with `data-ad-client` and `data-ad-slot` attributes set to `TODO-*`. Replace both with your real AdSense IDs during production deployment.

## Filters and facility coverage

- The frontend provides facility, specialist, tier, province, and type dropdowns sourced from the dataset so users can quickly filter for hospitals, pharmacies, clinics, dentists, opticians, or disciplines like oncology and trauma.
- A "Nearest to me" sort becomes available after clicking **Enable location**, ordering facilities with coordinates by proximity.
- The homepage shows a compact “How tiers work” pill near the bottom of the listing to keep the rules visible without adding clutter.

## Automation

### GitHub Pages deployment

`.github/workflows/deploy.yml` runs on every push to `main` and performs:

1. Checkout + Pages environment setup.
2. Installs Node dependencies.
3. Runs `npm run prepare:data` to regenerate `src/hospitalsData.js` and refresh `src/data/hospitals.json` for direct download.
4. Bundles the frontend with `npm run build` (minified assets land in `src/assets/`).
5. Uploads the `src/` directory as the Pages artifact and deploys via `actions/deploy-pages`.

### Monthly scraping workflow

`.github/workflows/scrape-monthly.yml` runs on a monthly cron or manually via the workflow dispatch UI. It:

1. Sets up Python and installs `requirements.txt`.
2. Executes `python scripts/scrape_hospitals.py`.
3. Commits any JSON changes to a dated branch such as `auto/scrape-YYYY-MM-DD` and pushes it to the repository. Open a pull request manually from that branch if review is desired.

This keeps the directory fresh while respecting environments where GitHub Actions cannot create pull requests automatically.

### How the data reaches the UI

- `data/hospitals.json` is the canonical catalogue. Running `npm run prepare:data` mirrors it into `src/hospitalsData.js` (ES module) and `src/data/hospitals.json` (direct download copy).
- `src/app.js` imports the generated module so the browser never has to fetch a separate JSON file. If you also run `npm run build`, esbuild bundles/minifies everything into `src/assets/` for production.
- GitHub Pages does not serve symlinks for security reasons, so the generated copies are real files committed to the repo or produced in the deploy workflow.

### Search indexing and robots.txt

The site ships `src/robots.txt` (copied to the Pages root) allowing crawlers to index the UI. If you want the raw JSON discoverable too, keep `src/data/hospitals.json` in sync via `npm run prepare:data`.

## Analytics hook

A stubbed `trackEvent(eventName, payload)` in `src/app.js` centralises analytics wiring. It runs when users search, change filters, switch views, or expand hospital details. Replace the TODO comment in that function with your preferred provider (Google Analytics, Matomo, etc.) to enable real telemetry.

## Adding hospitals or fields

1. Edit `data/hospitals.json` to add or update records (include `latitude`/`longitude` to show on the map).
2. Run `npm run prepare:data` to regenerate `src/hospitalsData.js` (and refresh `src/data/hospitals.json`).
3. Optionally run `npm run build` to refresh bundled/minified assets.
4. Commit and push; the deployment workflow will publish the latest files automatically.
