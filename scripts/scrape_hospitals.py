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


def normalize_text(value: str) -> str:
  """Lowercase, strip punctuation, and collapse whitespace for matching."""
  cleaned = re.sub(r"[^a-z0-9]+", " ", value.lower())
  return re.sub(r"\s+", " ", cleaned).strip()


def make_key(name: str, city: str) -> str:
  return f"{normalize_text(name)}::{normalize_text(city)}"


def slugify(name: str, city: str) -> str:
  slug = re.sub(r"[^a-z0-9]+", "-", f"{name}-{city}".lower()).strip("-")
  return slug or f"hospital-{int(dt.datetime.now().timestamp())}"


def apply_defaults(record: Hospital) -> Hospital:
  record.setdefault("category", "hospital")
  record.setdefault("operating_hours", "24/7 for emergencies; outpatient 08:00-17:00")
  record.setdefault("manager", "Operations manager: TBD")
  return record


def load_existing() -> Dict[str, Hospital]:
  if not DATA_PATH.exists():
    return {}
  with DATA_PATH.open() as fh:
    hospitals: List[Hospital] = json.load(fh)

  existing: Dict[str, Hospital] = {}
  for record in hospitals:
    key = make_key(record["name"], record["city"])
    existing[key] = record
  return existing


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
      "category": "hospital",
      "operating_hours": "24/7 for emergencies; outpatient 08:00-17:00",
      "manager": "Provincial medical director: TBD",
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
      "category": "hospital",
      "operating_hours": "24/7",
      "manager": "Medical director: TBD",
    }
  ]


def scraper_gap_filler() -> List[Hospital]:
  """Stub for known gaps we keep missing in open sources."""
  return [
    {
      "name": "Chinhoyi Provincial Hospital",
      "province": "Mashonaland West",
      "city": "Chinhoyi",
      "address": "Hospital Road, Chinhoyi",
      "type": "public",
      "ownership": "government",
      "bed_count": 120,
      "specialists": ["general", "maternity"],
      "tier": None,
      "phone": "+263-67-212-3456",
      "website": "",
      "category": "hospital",
      "operating_hours": "24/7 for emergencies; outpatient 08:00-17:00",
      "manager": "Hospital superintendent: TBD",
    },
    {
      "name": "Makumbe Mission Hospital",
      "province": "Manicaland",
      "city": "Buhera",
      "address": "Buhera Growth Point",
      "type": "mission",
      "ownership": "church",
      "bed_count": 150,
      "specialists": ["general", "maternity"],
      "tier": None,
      "phone": "",
      "website": "",
      "category": "hospital",
      "operating_hours": "24/7 for emergencies; outpatient 08:00-17:00",
      "manager": "Mission administrator: TBD",
    },
    {
      "name": "Makumbi Mission Hospital",
      "province": "Mashonaland Central",
      "city": "Domboshava",
      "address": "Domboshava Rd",
      "type": "mission",
      "ownership": "church",
      "bed_count": 90,
      "specialists": ["general", "outpatient"],
      "tier": None,
      "phone": "",
      "website": "",
      "category": "hospital",
      "operating_hours": "24/7 for emergencies; outpatient 08:00-17:00",
      "manager": "Mission administrator: TBD",
    },
    {
      "name": "The Avenues Clinic",
      "province": "Harare",
      "city": "Harare",
      "address": "7 Josiah Chinamano Ave, Harare",
      "type": "private",
      "ownership": "corporate",
      "bed_count": 176,
      "specialists": ["general", "maternity", "icu"],
      "tier": None,
      "phone": "+263-4-707-861",
      "website": "https://www.avenuesclinic.co.zw",
      "category": "hospital",
      "operating_hours": "24/7",
      "manager": "Hospital administrator: TBD",
    },
    {
      "name": "Baines Imaging Group",
      "province": "Harare",
      "city": "Harare",
      "address": "88 Baines Ave, Harare",
      "type": "private",
      "ownership": "corporate",
      "bed_count": None,
      "specialists": ["radiology", "imaging"],
      "tier": None,
      "phone": "+263-24-274-8471",
      "website": "https://www.bainesimaginggroup.com",
      "category": "imaging_centre",
      "operating_hours": "Mon-Fri 07:30-17:00; Sat 08:00-12:00",
      "manager": "Operations manager: TBD",
    },
    {
      "name": "Mazowe District Hospital",
      "province": "Mashonaland Central",
      "city": "Mazowe",
      "address": "Mazowe Town",
      "type": "public",
      "ownership": "government",
      "bed_count": 110,
      "specialists": ["general"],
      "tier": None,
      "phone": "",
      "website": "",
      "category": "hospital",
      "operating_hours": "24/7 for emergencies; outpatient 08:00-17:00",
      "manager": "Hospital superintendent: TBD",
    },
  ]


SCRAPERS = [scraper_ministry_portal, scraper_private_networks, scraper_gap_filler]


def tier_from_record(record: Hospital) -> str:
  bed_count = record.get("bed_count")
  descriptor = [spec.lower() for spec in (record.get("specialists") or [])]
  type_value = (record.get("type") or "").lower()
  category_value = (record.get("category") or "").lower()

  tier1_specialists = [
    "oncology",
    "cardiology",
    "neurosurgery",
    "icu",
    "critical care",
    "trauma",
    "hematology",
    "neonatology",
  ]

  has_tier1_discipline = any(key in spec for spec in descriptor for key in tier1_specialists)
  has_multiple_specialists = len(descriptor) >= 2

  is_central = (
    "central" in type_value
    or "referral" in type_value
    or "teaching" in type_value
    or "university" in type_value
    or "central" in category_value
  )
  if is_central or (isinstance(bed_count, int) and bed_count >= 350) or has_tier1_discipline:
    return "T1"

  is_provincial_or_district = (
    "provincial" in type_value or "general" in type_value or "district" in type_value
  )
  if (isinstance(bed_count, int) and bed_count >= 120) or is_provincial_or_district or has_multiple_specialists:
    return "T2"

  return "T3"


def merge_records(existing: Dict[str, Hospital], new_records: List[Hospital]) -> Dict[str, Hospital]:
  for record in new_records:
    apply_defaults(record)
    key = make_key(record["name"], record["city"])
    base = existing.get(key)
    if not base:
      record.setdefault("id", slugify(record["name"], record["city"]))
      record["tier"] = tier_from_record(record)
      record["last_verified"] = TODAY
      existing[key] = record
      continue

    base = apply_defaults(base)
    updated = False
    for field, value in record.items():
      if value in (None, ""):
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
