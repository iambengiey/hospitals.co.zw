# hospitals-co-zw

A lightweight, data-driven directory of public, private, and mission hospitals in Zimbabwe. The site is designed for GitHub Pages and backed by a simple JSON catalogue plus a monthly scraper workflow.

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

The script loads the existing catalogue, runs each configured scraper stub, merges results by `(name, city)`, recalculates tiers via the helper, stamps `last_verified` with the current date, and rewrites `data/hospitals.json` in a stable order.

## Tiering rules

Tiering automatically categorises each hospital by capacity:

- **T1** – Teaching/referral hospitals or any facility with `bed_count >= 300`.
- **T2** – Regional and district facilities with `100 <= bed_count < 300`.
- **T3** – Rural, mission, or small clinics below 100 beds or unknown capacity.

These rules are implemented both in the frontend (`src/app.js`) and in the scraper (`scripts/scrape_hospitals.py`) so that any ingestion path remains consistent.

## Google AdSense placeholders

`src/index.html` contains a dedicated `<section class="adsense">` that includes:

- An empty `<script>` tag where the official AdSense script should be pasted.
- An `<ins class="adsbygoogle">` element with `data-ad-client` and `data-ad-slot` attributes set to `TODO-*`. Replace both with your real AdSense IDs during production deployment.

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
3. Uses [`peter-evans/create-pull-request`](https://github.com/peter-evans/create-pull-request) to open a PR named `Monthly hospitals data update (YYYY-MM-DD)` from a branch like `auto/scrape-YYYY-MM-DD` whenever the JSON changes.

This keeps the directory fresh while giving maintainers a chance to review any diff before it lands on `main`.
