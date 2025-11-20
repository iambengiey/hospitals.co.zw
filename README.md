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
2. Serve the site:
   ```bash
   python -m http.server --directory src 8000
   ```
3. Visit [http://localhost:8000](http://localhost:8000) to interact with the directory.

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
- optional `latitude`/`longitude` to enable nearest-to-me sorting

### Tiering rules

Tiering automatically categorises each hospital by capacity:

- **T1** – Teaching/referral hospitals or any facility with `bed_count >= 300`.
- **T2** – Regional and district facilities with `100 <= bed_count < 300`.
- **T3** – Rural, mission, or small clinics below 100 beds or unknown capacity.

These rules are implemented both in the frontend (`src/app.js`) and in the scraper (`scripts/scrape_hospitals.py`) so that any ingestion path remains consistent.

The homepage also repeats these definitions in a short “How tiers work” section for visitors.

## Google AdSense placeholders

`src/index.html` contains a dedicated `<section class="adsense">` that includes:

- An empty `<script>` tag where the official AdSense script should be pasted.
- An `<ins class="adsbygoogle">` element with `data-ad-client` and `data-ad-slot` attributes set to `TODO-*`. Replace both with your real AdSense IDs during production deployment.

## Filters, facility coverage, and location sorting

- The frontend provides facility and specialist dropdowns sourced from the dataset so users can quickly filter for hospitals, pharmacies, clinics, dentists, opticians, or disciplines like oncology and trauma.
- If visitors enable geolocation, they can sort results by “Nearest to me.” Hospitals without coordinates will remain in the list but are placed after those with distances.
- Records can include optional `latitude` and `longitude` fields; the sample catalogue demonstrates this so the nearest-sort works out of the box.

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
