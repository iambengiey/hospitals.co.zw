#!/usr/bin/env python3
"""Merge newly scraped facilities into the existing canonical dataset.

Rules:
- Never drop existing hospitals.
- Use a stable key (name + city/district) to match records.
- Only fill empty/missing fields from the new scrape; do not overwrite richer existing data.
- Track first_seen/last_seen dates for provenance.
"""

from __future__ import annotations

import datetime as dt
import json
import pathlib
from collections import Counter
from typing import Any, Dict, List

ROOT = pathlib.Path(__file__).resolve().parents[1]
CURRENT_PATH = ROOT / "data" / "hospitals.json"
SCRAPED_PATH = ROOT / "data" / "hospitals_scraped_new.json"
SCRAPED_FALLBACK_PATH = ROOT / "data" / "hospitals_scraped_full.json"
FULL_PATH = ROOT / "data" / "hospitals_full.json"
TODAY = dt.date.today().isoformat()

Hospital = Dict[str, Any]


def normalize(value: str) -> str:
  return " ".join(str(value or "").strip().lower().split())


def make_key(record: Hospital) -> str:
  name = normalize(record.get("name", ""))
  location = normalize(record.get("city") or record.get("town") or record.get("district") or record.get("province"))
  return f"{name}::{location}"


def has_value(value: Any) -> bool:
  if value is None:
    return False
  if isinstance(value, str):
    return bool(value.strip())
  if isinstance(value, (list, tuple, set, dict)):
    return bool(value)
  if isinstance(value, bool):
    return True
  return True


def remove_suggest_correction(record: Hospital) -> None:
  """Drop "Suggest correction" links for verified records.

  Some scraped records carry a ``links`` array and a human-friendly
  ``verified_text`` label. If that text already contains the word
  "verified" we should hide the "Suggest correction" link to avoid
  inviting edits on confirmed listings.
  """

  verified_text = str(record.get("verified_text", ""))
  if "verified" not in verified_text.lower():
    return

  links = record.get("links")
  if not isinstance(links, list):
    return

  filtered = [link for link in links if "suggest correction" not in str(link).lower()]
  if filtered:
    record["links"] = filtered
  else:
    record.pop("links", None)


def source_labels(record: Hospital) -> list[str]:
  raw = record.get("source")
  if isinstance(raw, list):
    return [str(item) for item in raw if str(item).strip()]
  if isinstance(raw, str) and raw.strip():
    return [raw]
  return []


def update_record(existing: Hospital, incoming: Hospital) -> None:
  for key, new_value in incoming.items():
    if key in {"first_seen", "last_seen"}:
      continue

    if not has_value(new_value):
      continue

    current_value = existing.get(key)
    if has_value(current_value):
      if isinstance(current_value, list) and isinstance(new_value, list) and not current_value:
        existing[key] = list(new_value)
      continue

    if isinstance(new_value, list):
      existing[key] = list(new_value)
    else:
      existing[key] = new_value

  existing["last_seen"] = TODAY
  if "first_seen" not in existing:
    existing["first_seen"] = TODAY

  remove_suggest_correction(existing)


def load_json(path: pathlib.Path) -> list[Hospital]:
  if not path.exists():
    return []
  with path.open() as fh:
    return json.load(fh)


def save_json(path: pathlib.Path, records: list[Hospital]) -> None:
  path.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
  existing = load_json(CURRENT_PATH)
  scraped_primary = load_json(SCRAPED_PATH)
  scraped_fallback = load_json(SCRAPED_FALLBACK_PATH)

  scraped: list[Hospital] = []
  seen_keys: set[str] = set()
  scraped_sources: Counter[str] = Counter()

  for record in scraped_primary:
    key = make_key(record)
    if not key or key in seen_keys:
      continue
    scraped.append(record)
    seen_keys.add(key)
    scraped_sources.update(source_labels(record) or ["unknown"])

  for record in scraped_fallback:
    key = make_key(record)
    if not key or key in seen_keys:
      continue
    scraped.append(record)
    seen_keys.add(key)
    scraped_sources.update(source_labels(record) or ["unknown"])

  existing_map = {make_key(record): record for record in existing if make_key(record)}

  new_count = 0
  updated_count = 0
  new_by_source: Counter[str] = Counter()
  updated_by_source: Counter[str] = Counter()

  for record in scraped:
    key = make_key(record)
    if not key:
      continue

    if key in existing_map:
      before = existing_map[key].copy()
      update_record(existing_map[key], record)
      if before != existing_map[key]:
        updated_count += 1
        updated_by_source.update(source_labels(record) or ["unknown"])
    else:
      record = dict(record)
      record.setdefault("first_seen", TODAY)
      record["last_seen"] = TODAY
      remove_suggest_correction(record)
      existing_map[key] = record
      new_count += 1
      new_by_source.update(source_labels(record) or ["unknown"])

  merged_records = list(existing_map.values())
  for record in merged_records:
    remove_suggest_correction(record)
  save_json(CURRENT_PATH, merged_records)
  save_json(FULL_PATH, merged_records)

  print(f"Existing records: {len(existing)}")
  print(f"New scraped records: {len(scraped_primary)}")
  if scraped_fallback:
    print(f"Historical scrape records: {len(scraped_fallback)}")
  print(f"Updated records: {updated_count}")
  print(f"Newly added: {new_count}")
  print(f"Total after merge: {len(merged_records)}")

  if scraped_sources:
    print("Scraped source coverage (deduped records per source):")
    for name, count in scraped_sources.most_common():
      print(f"  - {name}: {count}")
  if new_by_source:
    print("New additions by source:")
    for name, count in new_by_source.most_common():
      print(f"  - {name}: {count}")
  if updated_by_source:
    print("Updated records by source:")
    for name, count in updated_by_source.most_common():
      print(f"  - {name}: {count}")


if __name__ == "__main__":
  main()
