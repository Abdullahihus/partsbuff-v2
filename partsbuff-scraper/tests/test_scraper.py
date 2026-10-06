"""Run with: python3 -m unittest discover -s partsbuff-scraper/tests -v"""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from lxml import html

SPEC = importlib.util.spec_from_file_location("scraper", Path(__file__).resolve().parents[1] / "scripts/parts_scraper.py")
s = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(s)
SEED = "https://www.bmwpartsdeal.com/2011-bmw-128i-convertible_n51_engine_e88-parts.html"
DIAGRAM = "https://www.bmwpartsdeal.com/parts-list/2011-bmw-128i-convertible_n51_engine_e88/engine/oil_filter.html"
PROFILE = {"id": "bmw-2011-128i", "year": "2011", "model": "128i", "reference": "Convertible N51 Engine(E88)",
           "sourceUrl": SEED, "sourcePartCount": 0, "starterPartCount": 20, "status": "starter", "variantCount": 1}


def row(number="11427566327", name="Oil filter", note="Only N51 engine"):
    return f'<li><a class="pl-pat-im-link" href="/parts/bmw-filter-{number}.html">{number}</a><a class="pl-pat-im-link">{name}</a><ul class="pl-pat-im-etr"><li>{note}</li></ul></li>'


class FakeSource:
    def __init__(self, pages):
        self.pages, self.calls = pages, []

    def fetch(self, url):
        self.calls.append(url)
        page = self.pages[url]
        if isinstance(page, Exception):
            raise page
        return html.fromstring(page)


class ScraperTests(unittest.TestCase):
    def test_links_exclude_different_engine_and_external_sites(self):
        other = DIAGRAM.replace("n51", "n52")
        doc = html.fromstring(f'<a href="{DIAGRAM}">Filter</a><a href="{other}">Wrong engine</a><a href="https://example.org/">Other site</a>')
        self.assertEqual(s.scoped_links(doc, SEED, SEED), [(DIAGRAM, "Filter")])

    def test_explicit_number_only_and_duplicate_restrictions(self):
        page = '<p>Order 12345678901 or call 12345678901</p><ul class="pl-pat-im">' + row() + row(note="From 09/2010") + row("NOT-A-PART", "Wrong") + '</ul>'
        fetcher = FakeSource({SEED: f'<a href="{DIAGRAM}">Oil filter</a>', DIAGRAM: page})
        result = s.collect(PROFILE, fetcher, limit=1)
        self.assertEqual([p["oemNumber"] for p in result["parts"]], ["11427566327"])
        self.assertEqual(result["parts"][0]["sourceRestrictions"], ["Only N51 engine", "From 09/2010"])
        self.assertEqual(result["parts"][0]["verification"], "option-dependent")

    def test_existing_numbers_are_skipped_to_collect_new_parts(self):
        page = '<ul class="pl-pat-im">' + row() + row("11517586925", "Water pump") + '</ul>'
        result = s.collect(PROFILE, FakeSource({SEED: page}), excluded=["11427566327"], limit=1)
        self.assertEqual(result["parts"][0]["oemNumber"], "11517586925")

    def test_block_stops_all_further_pages_and_preserves_partial_results(self):
        next_page = DIAGRAM.replace("oil_filter", "water_pump")
        page = '<ul class="pl-pat-im">' + row() + f'</ul><a href="{DIAGRAM}">Filter</a><a href="{next_page}">Pump</a>'
        fetcher = FakeSource({SEED: page, DIAGRAM: s.SourceStopped("HTTP 429")})
        result = s.collect(PROFILE, fetcher)
        self.assertEqual(result["status"], "stopped")
        self.assertEqual(len(result["parts"]), 1)
        self.assertNotIn(next_page, fetcher.calls)

    def test_dealer_part_rows_preserve_position(self):
        page = '<div data-part-num="11-42-7-566-327"><div class="product-title"><a href="/oem-parts/bmw-filter">Oil filter</a></div><span class="product-position">Front</span><span class="product-notes">N51 only</span></div>'
        rows = list(s.parse_rows(html.fromstring(page), "https://www.bmwpartspros.com/v-2011-bmw-128i--base--3-0l-l6-gas/engine--filters"))
        self.assertEqual(rows[0][0], "11427566327")
        self.assertEqual(rows[0][3], ["Front", "N51 only"])

    def test_http_403_and_429_stop_without_retry(self):
        with tempfile.TemporaryDirectory() as folder:
            for code in (403, 429):
                f = s.Fetcher(folder)
                with patch.object(f.opener, "open", side_effect=HTTPError(SEED, code, "Blocked", {}, None)) as request:
                    with self.assertRaises(s.SourceStopped):
                        f.request(SEED)
                    self.assertEqual(request.call_count, 1)

    def test_robots_disallow_prevents_page_request(self):
        with tempfile.TemporaryDirectory() as folder:
            f = s.Fetcher(folder)
            with patch.object(f, "request", return_value=b"User-agent: *\nDisallow: /\n") as request:
                with self.assertRaises(s.SourceStopped):
                    f.fetch(SEED)
                self.assertEqual(request.call_count, 1)
                self.assertTrue(request.call_args[0][0].endswith("/robots.txt"))

    def test_preview_import_idempotence_and_counts_above_twenty(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "data/bmw-parts").mkdir(parents=True)
            profile = copy.deepcopy(PROFILE)
            old = [s.make_part(profile, f"11420000{i:03}", "Old filter", DIAGRAM, [], DIAGRAM, "Filters") for i in range(20)]
            profile.update(sourcePartCount=20, starterPartCount=0, status="sourced")
            index_path, year_path = root / "data/bmw-catalog-index.json", root / "data/bmw-parts/2011.json"
            s.write_json(index_path, {"profiles": [profile], "summary": {}})
            s.write_json(year_path, {profile["id"]: old})
            new = s.make_part(profile, "11427566327", "New filter", DIAGRAM, ["N51"], DIAGRAM, "Filters")
            stage = root / "review.json"
            s.write_json(stage, {"profile": profile, "parts": [new, old[0]]})
            before = year_path.read_bytes()
            self.assertEqual(s.merge(root, stage), 1)
            self.assertEqual(year_path.read_bytes(), before)
            self.assertEqual(s.merge(root, stage, apply=True), 1)
            self.assertEqual(s.read_json(index_path)["summary"]["sourcedParts"], 21)
            self.assertEqual(s.read_json(index_path)["summary"]["sourcedProfiles"], 1)
            self.assertEqual(s.read_json(index_path)["summary"]["starterParts"], 0)
            self.assertEqual(s.read_json(year_path)[profile["id"]][0], old[0])
            self.assertEqual(s.merge(root, stage, apply=True), 0)
            self.assertEqual(len(list((root / "scraper-backups").glob("*/2011.json"))), 1)

    def test_wrong_reference_and_cross_vehicle_source_cannot_import(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "data/bmw-parts").mkdir(parents=True)
            s.write_json(root / "data/bmw-catalog-index.json", {"profiles": [PROFILE]})
            s.write_json(root / "data/bmw-parts/2011.json", {PROFILE["id"]: []})
            part = s.make_part(PROFILE, "11427566327", "Filter", DIAGRAM, [], DIAGRAM.replace("n51", "n52"), "Filters")
            stage = root / "review.json"
            s.write_json(stage, {"profile": PROFILE, "parts": [part]})
            with self.assertRaises(ValueError):
                s.merge(root, stage, apply=True)
            wrong = copy.deepcopy(PROFILE)
            wrong["reference"] = "N52 sedan"
            s.write_json(stage, {"profile": wrong, "parts": []})
            with self.assertRaises(ValueError):
                s.merge(root, stage, apply=True)
            self.assertFalse((root / "scraper-backups").exists())

    def test_failed_second_write_restores_both_catalog_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "data/bmw-parts").mkdir(parents=True)
            index_path, year_path = root / "data/bmw-catalog-index.json", root / "data/bmw-parts/2011.json"
            s.write_json(index_path, {"profiles": [PROFILE]})
            s.write_json(year_path, {PROFILE["id"]: []})
            stage = root / "review.json"
            part = s.make_part(PROFILE, "11427566327", "Filter", DIAGRAM, [], DIAGRAM, "Filters")
            s.write_json(stage, {"profile": PROFILE, "parts": [part]})
            before = (index_path.read_bytes(), year_path.read_bytes())
            original = s.write_json
            def fail_index(path, data):
                if path == index_path:
                    raise OSError("Disk full")
                original(path, data)
            with patch.object(s, "write_json", side_effect=fail_index):
                with self.assertRaises(OSError):
                    s.merge(root, stage, apply=True)
            self.assertEqual((index_path.read_bytes(), year_path.read_bytes()), before)


class BatchTests(unittest.TestCase):
    def create_project(self, root):
        profiles = [copy.deepcopy(PROFILE) for _ in range(3)]
        profiles[1].update(id="bmw-2011-135i", model="135i", sourceUrl=SEED.replace("128i", "135i"))
        profiles[2].update(id="bmw-2000-323i", model="323i", year="2000", sourceUrl=SEED.replace("2011", "2000").replace("128i", "323i"))
        unsupported = copy.deepcopy(PROFILE)
        unsupported.update(id="bmw-2011-328i", model="328i", sourceUrl="https://www.realoem.com/bmw/enUS/select")
        profiles.append(unsupported)
        (root / "data/bmw-parts").mkdir(parents=True)
        s.write_json(root / "data/bmw-catalog-index.json", {"profiles": profiles, "summary": {}})
        for year in ("2000", "2011"):
            s.write_json(root / "data/bmw-parts" / (year + ".json"), {p["id"]: [] for p in profiles if p["year"] == year})
        return profiles

    def args(self, root, **overrides):
        values = dict(project=root, year=None, max_vehicles=None, limit=1, max_pages=2,
                      delay=2.0, cache=root / "cache", output_dir=root / "reviews", plan=False,
                      offline=False, refresh=False, include_hardware=False, retry_incomplete=False)
        values.update(overrides)
        return SimpleNamespace(**values)

    def test_resume_skips_completed_and_batch_import_groups_year_files(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            profiles = self.create_project(root)
            page = '<ul class="pl-pat-im">' + row() + '</ul>'
            first = FakeSource({p["sourceUrl"]: page for p in profiles[:2]})
            self.assertEqual(s.run_batch(self.args(root, max_vehicles=2), first), 0)
            self.assertEqual(len(first.calls), 2)
            second = FakeSource({profiles[2]["sourceUrl"]: page})
            self.assertEqual(s.run_batch(self.args(root), second), 2)
            self.assertEqual(second.calls, [profiles[2]["sourceUrl"]])
            report = s.read_json(root / "reviews/batch-report.json")
            self.assertEqual(report["summary"]["complete"], 3)
            self.assertEqual(report["summary"]["unsupported"], 1)
            # Seed URLs are valid for scraping, but imports require a diagram URL.
            for p in profiles[:3]:
                file = root / "reviews" / (p["id"] + ".json")
                staged = s.read_json(file)
                staged["parts"][0]["sourceUrl"] = "https://www.bmwpartsdeal.com" + s.source_scope(p["sourceUrl"]) + "engine/filter.html"
                s.write_json(file, staged)
            before = (root / "data/bmw-catalog-index.json").read_bytes()
            self.assertEqual(s.import_batch(root, root / "reviews"), 3)
            self.assertEqual((root / "data/bmw-catalog-index.json").read_bytes(), before)
            self.assertEqual(s.import_batch(root, root / "reviews", apply=True), 3)
            self.assertEqual(s.read_json(root / "data/bmw-catalog-index.json")["summary"]["sourcedParts"], 3)
            self.assertEqual(s.import_batch(root, root / "reviews", apply=True), 0)
            backups = list((root / "scraper-backups").iterdir())
            self.assertEqual(len(backups), 1)
            self.assertEqual({p.name for p in backups[0].iterdir()}, {"2000.json", "2011.json", "bmw-catalog-index.json"})

    def test_blocked_host_is_persisted_and_never_retried_by_resume(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            profiles = self.create_project(root)
            source = FakeSource({profiles[0]["sourceUrl"]: s.SourceStopped("HTTP 429", block_host=True)})
            self.assertEqual(s.run_batch(self.args(root), source), 2)
            self.assertEqual(source.calls, [profiles[0]["sourceUrl"]])
            report = s.read_json(root / "reviews/batch-report.json")
            self.assertIn("www.bmwpartsdeal.com", report["blockedHosts"])
            empty = FakeSource({})
            s.run_batch(self.args(root, retry_incomplete=True), empty)
            self.assertEqual(empty.calls, [])

    def test_interrupt_saves_current_profile_and_resumes_it(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            profiles = self.create_project(root)
            source = FakeSource({profiles[0]["sourceUrl"]: KeyboardInterrupt()})
            # KeyboardInterrupt inherits BaseException, so use a custom source here.
            source.fetch = lambda url: (_ for _ in ()).throw(KeyboardInterrupt())
            self.assertEqual(s.run_batch(self.args(root, max_vehicles=1), source), 130)
            report = s.read_json(root / "reviews/batch-report.json")
            self.assertEqual(report["profiles"][profiles[0]["id"]]["status"], "interrupted")
            page = '<ul class="pl-pat-im">' + row() + '</ul>'
            resumed = FakeSource({profiles[0]["sourceUrl"]: page})
            self.assertEqual(s.run_batch(self.args(root, max_vehicles=1), resumed), 0)
            self.assertEqual(len(resumed.calls), 1)

    def test_bad_review_blocks_entire_batch_before_any_write(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            profiles = self.create_project(root)
            reviews = root / "reviews"
            for p in profiles[:2]:
                diagram = "https://www.bmwpartsdeal.com" + s.source_scope(p["sourceUrl"]) + "engine/filter.html"
                part = s.make_part(p, "11427566327", "Filter", diagram, [], diagram, "Filters")
                if p["id"].endswith("135i"):
                    part["oemNumber"] = "INVALID"
                s.write_json(reviews / (p["id"] + ".json"), {"profile": p, "parts": [part]})
            before = {f: f.read_bytes() for f in (root / "data").rglob("*.json")}
            with self.assertRaises(ValueError):
                s.import_batch(root, reviews, apply=True)
            self.assertTrue(all(f.read_bytes() == data for f, data in before.items()))
            self.assertFalse((root / "scraper-backups").exists())

    def test_failed_batch_index_write_restores_every_changed_year(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            profiles = self.create_project(root)
            reviews = root / "reviews"
            for p in (profiles[0], profiles[2]):
                diagram = "https://www.bmwpartsdeal.com" + s.source_scope(p["sourceUrl"]) + "engine/filter.html"
                part = s.make_part(p, "11427566327", "Filter", diagram, [], diagram, "Filters")
                s.write_json(reviews / (p["id"] + ".json"), {"profile": p, "parts": [part]})
            before = {f: f.read_bytes() for f in (root / "data").rglob("*.json")}
            original = s.write_json
            def fail_index(path, data):
                if path.name == "bmw-catalog-index.json":
                    raise OSError("Disk full")
                original(path, data)
            with patch.object(s, "write_json", side_effect=fail_index):
                with self.assertRaises(OSError):
                    s.import_batch(root, reviews, apply=True)
            self.assertTrue(all(f.read_bytes() == data for f, data in before.items()))


if __name__ == "__main__":
    unittest.main()
