#!/usr/bin/env python3
"""Stub scraper orchestrator for hospitals.co.zw."""

from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
from typing import Dict, List

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "hospitals.json"
TODAY = dt.date.today().isoformat()

Hospital = Dict[str, object]


def slugify(name: str, city: str) -> str:
  slug = re.sub(r"[^a-z0-9]+", "-", f"{name}-{city}".lower()).strip("-")
  return slug or f"hospital-{int(dt.datetime.now().timestamp())}"


def load_existing() -> Dict[str, Hospital]:
  if not DATA_PATH.exists():
    return {}
  with DATA_PATH.open() as fh:
    hospitals: List[Hospital] = json.load(fh)
  return {f"{h['name'].lower()}::{h['city'].lower()}": h for h in hospitals}


def scraper_ministry_portal() -> List[Hospital]:
  """TODO: Implement real scraper for ministry portal."""
  return [
    {
      "name": "Gweru Provincial Hospital",
      "province": "Midlands",
      "city": "Gweru",
      "address": "Hospital Rd, Gweru",
      "type": "public",
      "ownership": "government",
      "bed_count": 320,
      "specialists": ["general", "maternity"],
      "tier": None,
      "phone": "+263-54-222-333",
      "website": "",
    }
  ]


def scraper_private_networks() -> List[Hospital]:
  """TODO: Implement scraping of private hospital networks."""
  return [
    {
      "name": "Borrowdale Trauma Centre",
      "province": "Harare",
      "city": "Harare",
      "address": "Borrowdale Rd, Harare",
      "type": "private",
      "ownership": "corporate",
      "bed_count": 80,
      "specialists": ["trauma", "icu"],
      "tier": None,
      "phone": "+263-4-870-000",
      "website": "https://www.traumacentre.co.zw",
    }
  ]


SCRAPERS = [scraper_ministry_portal, scraper_private_networks]


def tier_from_record(record: Hospital) -> str:
  bed_count = record.get("bed_count")
  descriptor = " ".join(record.get("specialists") or []).lower()
  type_value = (record.get("type") or "").lower()
  if "teaching" in descriptor or "referral" in type_value or (isinstance(bed_count, int) and bed_count >= 300):
    return "T1"
  if isinstance(bed_count, int) and bed_count >= 100:
    return "T2"
  return "T3"


def merge_records(existing: Dict[str, Hospital], new_records: List[Hospital]) -> Dict[str, Hospital]:
  for record in new_records:
    key = f"{record['name'].lower()}::{record['city'].lower()}"
    base = existing.get(key)
    if not base:
      record.setdefault("id", slugify(record["name"], record["city"]))
      record["tier"] = tier_from_record(record)
      record["last_verified"] = TODAY
      existing[key] = record
      continue

    updated = False
    for field, value in record.items():
      if not value:
        continue
      if base.get(field) != value:
        base[field] = value
        updated = True
    if updated:
      base["tier"] = tier_from_record(base)
    base["last_verified"] = TODAY
  return existing


def save_records(records: Dict[str, Hospital]) -> None:
  ordered = sorted(records.values(), key=lambda h: h["name"])
  DATA_PATH.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
  existing = load_existing()
  for scraper in SCRAPERS:
    new_records = scraper()
    existing = merge_records(existing, new_records)
  save_records(existing)
  print(f"Updated {len(existing)} hospital records on {TODAY}")


if __name__ == "__main__":
  main()
