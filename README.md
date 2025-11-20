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
The ETL pipeline loads the canonical dataset, any JSON/CSV/XLSX files under `data/raw/`, and the stub scrapers (ministry, private networks, Google seed). It normalises facility fields, deduplicates near-matches with fuzzy logic, infers facility type, rural/urban, default services, and tiers, then writes `data/hospitals.json` plus a debug copy. Core helpers (`classify_facility_type`, `infer_rural_urban`, `infer_default_services`, `deduplicate_facilities`) are covered by `python -m unittest tests/test_pipeline.py`.

New raw drop points have been added for vetted sources:

- `data/raw/hpa_registered_facilities.json` — Health Professions Authority registrations (facility-level only). Entries here bump confidence and mark sources as verified.
- `data/raw/provincial_district_hospitals.json` — bulk provincial/district lists (e.g., the Scribd PDF).
- `data/raw/doctor4africa_rural_clinics.json` — rural clinic lists pulled from public directories.
- `data/raw/mcaz_pharmacies.json` (or `.xlsx`) — pharmacies from the MCAZ renewal list; tagged as a trusted source and flagged as verified in the export.

Place the downloaded JSON/CSV in those filenames (or drop additional files into `data/raw/`), then rerun `python scripts/scrape_hospitals.py && node scripts/prepare-data.js` to propagate the updates into the bundled site data.

## Data shape and tiering rules

Each record in `data/hospitals.json` is exported in a compact, structured format:

- `id`, `name`, `aliases`
- `facility_type` (Central Hospital, Provincial Hospital, District Hospital, Mission Hospital, Clinic, Pharmacy, Dental Clinic, etc.)
- `ownership` (Government, Mission, Council, Private, NGO)
- `rural_urban` (Rural, Urban, Peri-urban)
- `province`, `district`, `ward`, `city`, `address`
- `services` (array such as `ER`, `Maternity`, `ICU`, `Lab`, `HIV`, `MCH`)
- `open_24h`, `emergency_level` (None/Basic/Full)
- `cost_band` (`$`, `$$`, `$$$` when known) and `medical_aids` (list of accepted aids/payments)
- `phone`, `whatsapp`, `email`, `website`
- `lat`, `lon` (optional coordinates for mapping)
- `tier` (`Tier 1`, `Tier 2`, `Tier 3` where applicable)
- `last_verified`, `source`, `confidence`, `verified`

The catalogue currently mirrors hundreds of facilities drawn from the public Wikipedia list, provincial/district lists, HPA/MCAZ feeds, and manual seeds (including Hwange and Victoria Falls) so the filters stay populated on first load.

### Tiering rules

Tiering now follows the “Overview of Zim Healthcare System 2025” thresholds used by MoHCC planning teams:

- **Tier 1:** Central, referral, or teaching/university hospitals; any facility with `bed_count >= 350`; or those providing critical disciplines such as oncology, cardiology, ICU/critical care, trauma, neurosurgery, hematology, or neonatology.
- **Tier 2:** Provincial or district general hospitals and multi-specialty facilities with `bed_count` roughly `120–349` or at least two distinct specialist services.
- **Tier 3:** Rural, mission, primary clinics, pharmacies, and small facilities under 120 beds or with unknown capacity.

These rules are implemented in both the frontend (`src/app.js`) and the scraper (`scripts/scrape_hospitals.py`). The homepage repeats the definitions in the “How tiers work” chip near the listing.

## Search, filters, map view, and accessibility

- **Search:** Instant client-side search bar covers facility name and city/district.
- **Filters:** Province, ownership, facility type, services, rural/urban, tier, 24-hour toggle, and quick buttons (emergency, maternity, dentist, pharmacy, rural/urban clinic, mission/district/provincial hospital, 24h) combine to narrow results.
- **Cards:** Text-only, compact badges for tier/ownership/rural-urban, service flags, cost/medical aid line, distance when location is enabled, and action links for call/WhatsApp/share/suggest-correction. Last verified dates render in a friendly month/year format.
- **Verification cues:** A results summary shows how many visible facilities are verified. Cards sourced from trusted bodies (HPA/MCAZ/MoHCC feeds) render with a green accent and “Verified source” text.
- **Map view:** A view toggle switches between list and map. Facilities with `lat`/`lon` plot via Leaflet; clicking a marker highlights the corresponding card. Map assets are lazy-loaded to keep the default payload small.
- **Accessibility & performance:** High-contrast palette, large tap targets on mobile, focus-visible outlines, and ARIA labels on filters, toggles, and map region. JS/CSS can be bundled/minified by `npm run build`; rendering is scheduled via `requestAnimationFrame` to avoid unnecessary reflows.

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

The scraper includes stubs for ministry portals, private networks, known gaps, and a lightweight Google Places/manual seed step that currently refreshes Hwange and Victoria Falls coordinates. Extend `scraper_google_places_stub` with new sources or a real API integration when keys are available.

### How the data reaches the UI

- `data/hospitals.json` is the canonical catalogue. Running `npm run prepare:data` mirrors it into `src/hospitalsData.js` (ES module) and `src/data/hospitals.json` (direct download copy).
- `src/app.js` imports the generated module so the browser never has to fetch a separate JSON file. If you also run `npm run build`, esbuild bundles/minifies everything into `src/assets/` for production.
- GitHub Pages does not serve symlinks for security reasons, so the generated copies are real files committed to the repo or produced in the deploy workflow.

### Search indexing and robots.txt

The site ships `src/robots.txt` (copied to the Pages root) allowing crawlers to index the UI. If you want the raw JSON discoverable too, keep `src/data/hospitals.json` in sync via `npm run prepare:data`.

## Analytics hook

A stubbed `trackEvent(eventName, payload)` in `src/app.js` centralises analytics wiring. It runs when users search, change filters, switch views, or expand hospital details. Replace the TODO comment in that function with your preferred provider (Google Analytics, Matomo, etc.) to enable real telemetry.

## Adding hospitals or fields

1. Edit `data/hospitals.json` (or drop JSON/CSV files into `data/raw/`) to add or update records. Include `lat`/`lon` to show facilities on the map.
2. Run `npm run prepare:data` to regenerate `src/hospitalsData.js` (and refresh `src/data/hospitals.json`).
3. Optionally run `npm run build` to refresh bundled/minified assets.
4. Commit and push; the deployment workflow will publish the latest files automatically.

Additional guidance:

- Use `medical_aids` (and `cost_band`, `open_24h`, `emergency_level`, `services`) to describe affordability and coverage. The scraper infers defaults for missing services and 24h flags so cards remain readable even with sparse source data.
