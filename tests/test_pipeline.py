import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))
sys.path.append(str(ROOT / "scripts"))

from scripts.scrape_hospitals import (  # noqa: E402
    classify_facility_type,
    deduplicate_facilities,
    infer_default_services,
    infer_rural_urban,
    normalize_raw_record,
)


class PipelineTests(unittest.TestCase):
  def test_classify_facility_type(self):
    record = {"name": "Harare Central Hospital"}
    self.assertEqual(classify_facility_type(record), "Central Hospital")
    record = {"category": "pharmacy"}
    self.assertEqual(classify_facility_type(record), "Pharmacy")

  def test_infer_rural_urban(self):
    self.assertEqual(infer_rural_urban({"district": "Harare"}), "Urban")
    self.assertEqual(infer_rural_urban({"name": "Makumbe Rural Clinic"}), "Rural")

  def test_infer_default_services(self):
    services = infer_default_services({"facility_type": "District Hospital", "ownership": "Government"})
    self.assertIn("ER", services)
    clinic_services = infer_default_services({"facility_type": "Clinic"})
    self.assertIn("OPD", clinic_services)

  def test_deduplicate_facilities(self):
    facilities = [
      {"name": "Chitungwiza Central Hospital", "district": "Chitungwiza", "province": "Harare"},
      {"name": "Chitungwiza Central Hosp.", "district": "Chitungwiza", "province": "Harare"},
    ]
    merged = deduplicate_facilities(facilities)
    self.assertEqual(len(merged), 1)
    self.assertIn("Chitungwiza Central Hosp.", merged[0].get("aliases", []))

  def test_normalize_raw_record(self):
    record = {
      "services": "ER; Maternity",
      "medical_aids": "CIMAS / PSMAS",
      "open_hrs": "24/7",
      "latitude": "-17.1",
      "longitude": "31.1",
    }
    normalised = normalize_raw_record(record, "example_source")
    self.assertEqual(normalised["services"], ["ER", "Maternity"])
    self.assertEqual(normalised["medical_aids"], ["CIMAS", "PSMAS"])
    self.assertTrue(normalised["open_24h"])
    self.assertAlmostEqual(normalised["lat"], -17.1)
    self.assertAlmostEqual(normalised["lon"], 31.1)
    self.assertIn("example_source", normalised.get("source", []))


if __name__ == "__main__":
  unittest.main()
