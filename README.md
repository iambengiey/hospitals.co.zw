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
2. Bundle the JavaScript and CSS (writes to `src/assets/`):
   ```bash
   npm run build
   ```
3. Sync the latest data into the `src` directory (Pages only receives files in `src/`):
   ```bash
   cp data/hospitals.json src/data/hospitals.json
   ```
   The frontend also fetches the canonical raw file from GitHub (`https://raw.githubusercontent.com/iambengiey/hospitals.co.zw/main/data/hospitals.json`), so new data appears without redeploying the site. Copying into `src/data/` still helps the in-repo preview and the Pages artifact stay in sync.
4. Regenerate the embedded offline fallback (used when the hosted JSON cannot be fetched):
   ```bash
   python - <<'PY'
   import json, pathlib
   data=json.loads(pathlib.Path('data/hospitals.json').read_text())
   pathlib.Path('src/embedded-data.js').write_text(
     '// Auto-generated fallback copy of data/hospitals.json. Keep in sync when data updates.\n'
     'window.EMBEDDED_HOSPITALS = ' + json.dumps(data, indent=2, ensure_ascii=False) + ';\n'
   )
   PY
   ```
5. Serve the site:
   ```bash
   python -m http.server --directory src 8000
   ```
6. Visit [http://localhost:8000](http://localhost:8000) to interact with the directory (list + optional map view).

> **Tip:** The deploy workflow copies `data/hospitals.json` into `src/data/` automatically. When developing locally just repeat step 1 whenever the data changes.

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
2. Installs Node dependencies and bundles the frontend with `npm run build` (minified assets land in `src/assets/`).
3. Copies the canonical `data/hospitals.json` into `src/data/` so the static site can fetch it.
4. Uploads the `src/` directory as the Pages artifact.
5. Deploys via `actions/deploy-pages`.

### Monthly scraping workflow

`.github/workflows/scrape-monthly.yml` runs on a monthly cron or manually via the workflow dispatch UI. It:

1. Sets up Python and installs `requirements.txt`.
2. Executes `python scripts/scrape_hospitals.py`.
3. Commits any JSON changes to a dated branch such as `auto/scrape-YYYY-MM-DD` and pushes it to the repository. Open a pull request manually from that branch if review is desired.

This keeps the directory fresh while respecting environments where GitHub Actions cannot create pull requests automatically.

### Why not redeploy every time the data changes?

- The frontend now prefers the canonical raw file on the `main` branch, so once the scraper lands updated JSON the live site immediately reflects it—no Pages redeploy needed.
- We still copy `data/hospitals.json` into `src/data/` during deployments to keep an on-site copy and offline fallback in sync.
- GitHub Pages does not serve symlinks for security reasons, so `src/data/hospitals.json` must be a real file (or copied during build) rather than a soft link to `data/hospitals.json`.

### Search indexing and robots.txt

The site now ships `src/robots.txt` (copied to the Pages root) allowing all crawlers to access both the UI and `data/hospitals.json`. This helps avoid the “robots.txt fetch” failures reported by Search Console and keeps the JSON catalogue discoverable.

## Analytics hook

A stubbed `trackEvent(eventName, payload)` in `src/app.js` centralises analytics wiring. It currently logs to the console and is called when users search, change filters, switch views, or expand hospital details. Replace the TODO comment in that function with your preferred provider (Google Analytics, Matomo, etc.) to enable real telemetry.

## Adding hospitals or fields

1. Edit `data/hospitals.json` to add or update records (include `latitude`/`longitude` to show on the map).
2. Rebuild the embedded fallback (`src/embedded-data.js`) so GitHub Pages has a baked-in copy.
3. Run `npm run build` to refresh bundled assets.
4. Commit and push; the deployment workflow will publish the latest JSON automatically.
