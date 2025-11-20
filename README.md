# hospitals-co-zw

A lightweight, data-driven directory of public, private, and mission hospitals in Zimbabwe &mdash; plus nearby clinics, pharmacies, opticians, and dental practices. The site is designed for GitHub Pages and backed by a simple JSON catalogue plus a monthly scraper workflow.

## Repository layout

```
├── data/               # Canonical hospital catalogue (JSON)
├── src/                # Frontend assets deployed to GitHub Pages
├── scripts/            # Data collection helpers
├── .github/workflows/  # Automation (deploy + scraping)
```

## Running the site locally

1. Sync the latest data into the `src` directory (Pages only receives files in `src/`):
   ```bash
   cp data/hospitals.json src/data/hospitals.json
   ```
   The frontend will try a couple of fallback URLs for `data/hospitals.json`, but copying the file into `src/data/` keeps the primary path healthy and prevents missing-data errors on GitHub Pages.
2. Regenerate the embedded offline fallback (used when the hosted JSON cannot be fetched):
   ```bash
   python - <<'PY'
   import json, pathlib
   data=json.loads(pathlib.Path('data/hospitals.json').read_text())
   pathlib.Path('src/embedded-data.js').write_text(
     '// Auto-generated fallback copy of data/hospitals.json. Keep in sync when data updates.\n'
     f"export const EMBEDDED_HOSPITALS = {json.dumps(data, indent=2)};\n"
   )
   PY
   ```
3. Serve the site:
   ```bash
   python -m http.server --directory src 8000
   ```
4. Visit [http://localhost:8000](http://localhost:8000) to interact with the directory.

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
- optional `latitude`/`longitude` (unused by the current UI but kept for data completeness)

The current catalogue mirrors 49 facilities, including 32 hospitals pulled from the public Wikipedia list (Harare, Bulawayo, Midlands, Manicaland, Mashonaland, Matabeleland, and Masvingo provinces) so dropdowns stay populated even before fresh scrapes land.

### Tiering rules

Tiering automatically categorises each facility by capacity and role (aligned with MoHCC 2025 planning notes such as the “Overview of Zim Healthcare System 2025” brief):

- **T1** – National/teaching/referral facilities or any site with `bed_count >= 300` (e.g., Harare Central, Mpilo Central).
- **T2** – Provincial and high-volume district facilities with `100 <= bed_count < 300`, usually offering core specialist cover.
- **T3** – Community, rural, mission, and private clinics below 100 beds or where capacity is unknown.

These rules are implemented both in the frontend (`src/app.js`) and in the scraper (`scripts/scrape_hospitals.py`) so that any ingestion path remains consistent.

The homepage also repeats these definitions in a short “How tiers work” section for visitors at the bottom of the listing.

## Google AdSense placeholders

`src/index.html` contains a dedicated `<section class="adsense">` that includes:

- An empty `<script>` tag where the official AdSense script should be pasted.
- An `<ins class="adsbygoogle">` element with `data-ad-client` and `data-ad-slot` attributes set to `TODO-*`. Replace both with your real AdSense IDs during production deployment.

## Filters and facility coverage

- The frontend provides facility, specialist, tier, province, and type dropdowns sourced from the dataset so users can quickly filter for hospitals, pharmacies, clinics, dentists, opticians, or disciplines like oncology and trauma.
- The homepage shows a compact “How tiers work” pill near the bottom of the listing to keep the rules visible without adding clutter.

## Automation

### GitHub Pages deployment

`.github/workflows/deploy.yml` runs on every push to `main` and performs:

1. Checkout + Pages environment setup.
2. Copies the canonical `data/hospitals.json` into `src/data/` so the static site can fetch it.
3. Uploads the `src/` directory as the Pages artifact.
4. Deploys via `actions/deploy-pages`.

### Monthly scraping workflow

`.github/workflows/scrape-monthly.yml` runs on a monthly cron or manually via the workflow dispatch UI. It:

1. Sets up Python and installs `requirements.txt`.
2. Executes `python scripts/scrape_hospitals.py`.
3. Commits any JSON changes to a dated branch such as `auto/scrape-YYYY-MM-DD` and pushes it to the repository. Open a pull request manually from that branch if review is desired.

This keeps the directory fresh while respecting environments where GitHub Actions cannot create pull requests automatically.
