#!/usr/bin/env python3
"""Collect BMW reference parts, then explicitly import reviewed records."""
import argparse
from collections import deque
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.robotparser import RobotFileParser

from lxml import html

AGENT = "PartsBuffResearch/1.0"
NUMBER = re.compile(r"[0-9A-Z]{11}")
HARDWARE = re.compile(r"\b(bolt|screw|nut|washer|clip|grommet|rivet|spacer|fastener)\b", re.I)
DEALERS = {
    "www.bmwpartspros.com", "www.bmwoemparts.com", "www.bmwpartsworldwide.com",
    "www.genuinebmwminiparts.com", "parts.performance-bmw.com",
    "bmw.oempartsonline.com",
}


class SourceStopped(Exception):
    def __init__(self, message, block_host=False):
        super().__init__(message)
        self.block_host = block_host


def clean(value):
    return " ".join(value.split())


def canonical(url):
    p = urlsplit(url)
    if p.scheme != "https" or p.username or p.password or p.port not in (None, 443):
        raise ValueError("Only public HTTPS source URLs are supported.")
    if p.hostname not in DEALERS | {"www.bmwpartsdeal.com"}:
        raise ValueError("Unsupported source. This version supports BMWPartsDeal and the listed dealer catalogs.")
    return urlunsplit((p.scheme, p.netloc.lower(), p.path, p.query, ""))


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Fetcher:
    def __init__(self, cache, delay=2.0, offline=False, refresh=False):
        self.cache = Path(cache)
        self.cache.mkdir(parents=True, exist_ok=True)
        self.delay = max(2.0, delay)
        self.offline, self.refresh = offline, refresh
        self.last_request = 0.0
        self.robots = {}
        self.opener = build_opener(NoRedirects())
        self.requests = 0

    def cache_path(self, url):
        return self.cache / (hashlib.sha256(url.encode()).hexdigest() + ".html")

    def request(self, url):
        time.sleep(max(0, self.delay - (time.monotonic() - self.last_request)))
        self.last_request = time.monotonic()
        self.requests += 1
        try:
            with self.opener.open(Request(url, headers={"User-Agent": AGENT}), timeout=25) as response:
                raw = response.read(8 * 1024 * 1024 + 1)
                if len(raw) > 8 * 1024 * 1024:
                    raise SourceStopped("Source page exceeds the 8 MiB size limit.")
                if "html" not in response.headers.get("Content-Type", "") and not url.endswith("/robots.txt"):
                    raise SourceStopped("Source did not return HTML.")
                return raw
        except HTTPError as error:
            if error.code in (401, 403, 429):
                raise SourceStopped(f"HTTP {error.code}: stopped; no blocked-page retries.", block_host=True) from error
            if 300 <= error.code < 400:
                raise SourceStopped("Source redirected. Update the catalog URL after checking the destination.") from error
            raise

    def allowed(self, url):
        p = urlsplit(url)
        origin = f"{p.scheme}://{p.netloc}"
        if origin not in self.robots:
            try:
                raw = self.request(origin + "/robots.txt")
            except HTTPError as error:
                if error.code != 404:
                    raise SourceStopped(f"Could not check robots.txt: HTTP {error.code}", block_host=True) from error
                raw = b"User-agent: *\nAllow: /\n"
            except URLError as error:
                raise SourceStopped("Could not check robots.txt; try again later.", block_host=True) from error
            parser = RobotFileParser()
            # Some source robots files contain literal backslash escape sequences.
            parser.parse(raw.decode("utf-8", "replace").replace("\\r\\n", "\n").splitlines())
            self.robots[origin] = parser
            crawl_delay = parser.crawl_delay(AGENT)
            rate = parser.request_rate(AGENT)
            self.delay = max(self.delay, crawl_delay or 0, rate.seconds / rate.requests if rate and rate.requests else 0)
        if not self.robots[origin].can_fetch(AGENT, url):
            raise SourceStopped("The site's robots.txt disallows this URL.")

    def fetch(self, url):
        url = canonical(url)
        path = self.cache_path(url)
        if self.offline:
            if not path.exists():
                raise SourceStopped(f"Offline cache missing: {url}")
            return html.fromstring(path.read_bytes())
        self.allowed(url)
        if path.exists() and not self.refresh:
            return html.fromstring(path.read_bytes())
        raw = self.request(url)
        doc = html.fromstring(raw)
        title = clean(" ".join(doc.xpath("//title/text()"))).lower()
        if any(t in title for t in ("access denied", "just a moment", "verify you are human", "captcha", "security check")):
            raise SourceStopped("Source returned an access challenge; stopped without bypassing it.", block_host=True)
        path.write_bytes(raw)
        return doc


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=path.name + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(data, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def load_profile(project, profile_id):
    index = read_json(Path(project) / "data/bmw-catalog-index.json")
    profile = next((p for p in index["profiles"] if p["id"] == profile_id), None)
    if not profile:
        raise ValueError(f"Unknown profile: {profile_id}. Use the profiles command to find an ID.")
    if not re.fullmatch(r"20\d{2}", str(profile["year"])):
        raise ValueError("Invalid profile year.")
    return index, profile


def source_scope(seed):
    p = urlsplit(canonical(seed))
    if p.hostname == "www.bmwpartsdeal.com":
        if p.path.startswith("/parts-list/"):
            vehicle = p.path.split("/")[2]
        else:
            vehicle = p.path.rsplit("/", 1)[-1].removesuffix("-parts.html")
        if not re.fullmatch(r"20\d{2}-bmw-[a-z0-9_-]+", vehicle):
            raise ValueError("Expected a year/model/variant catalog or diagram URL.")
        return "/parts-list/" + vehicle + "/"
    root = p.path.split("/", 2)[1]
    if not re.match(r"v-20\d{2}-bmw-.*--", root):
        raise ValueError("Dealer URL must identify a year, model and trim.")
    return "/" + root + "/"


def scoped_links(doc, page_url, seed):
    scope = source_scope(seed)
    origin = urlsplit(seed).netloc
    found = {}
    for a in doc.xpath("//a[@href]"):
        url = urljoin(page_url, a.get("href"))
        p = urlsplit(url)
        if p.scheme != "https" or p.netloc != origin or not p.path.startswith(scope):
            continue
        if origin == "www.bmwpartsdeal.com" and not p.path.endswith(".html"):
            continue
        if origin != "www.bmwpartsdeal.com" and not (p.path.endswith("/categories") or "--" in p.path.rsplit("/", 1)[-1]):
            continue
        if p.query and not p.query.startswith("assembly="):
            continue
        found.setdefault(canonical(url), clean(a.text_content()) or "Parts diagram")
    # Prioritize common maintenance categories, but allow other categories too.
    terms = ("filter", "service", "brake", "water_pump", "thermostat", "suspension", "ignition", "belt", "battery", "wiper")
    return sorted(found.items(), key=lambda item: next((i for i, word in enumerate(terms) if word in item[0]), len(terms)))


def category(url):
    path = urlsplit(url).path.lower()
    for terms, label in [(("brake",), "Brakes"), (("suspension", "front_rear_axle"), "Suspension"),
                         (("cooling", "water_pump", "thermostat"), "Cooling"), (("steering",), "Steering"),
                         (("wiper",), "Wash / Wipe"), (("electrical", "battery"), "Electrical"),
                         (("engine", "filter", "ignition"), "Engine"), (("body", "lamp"), "Body")]:
        if any(term in path for term in terms):
            return label
    return "Service"


def parse_rows(doc, url):
    """Read explicit part fields only; never search arbitrary page text for numbers."""
    dealer = urlsplit(url).hostname != "www.bmwpartsdeal.com"
    nodes = doc.xpath('//*[@data-part-num]') if dealer else doc.xpath('//ul[contains(concat(" ",normalize-space(@class)," ")," pl-pat-im ")]/li')
    for row in nodes:
        if dealer:
            number = re.sub(r"[\s-]", "", row.get("data-part-num", "").upper())
            links = row.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," product-title ")]/a')
            if not links:
                continue
            name, product = clean(links[0].text_content()), urljoin(url, links[0].get("href", ""))
            notes = row.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," specific_description ") or contains(concat(" ",normalize-space(@class)," ")," product-notes ") or contains(concat(" ",normalize-space(@class)," ")," product-position ")]')
        else:
            links = row.xpath('.//a[contains(concat(" ",normalize-space(@class)," ")," pl-pat-im-link ")]')
            if len(links) < 2:
                continue
            number = re.sub(r"[\s-]", "", clean(links[0].text_content()).upper())
            name, product = clean(links[1].text_content()), urljoin(url, links[0].get("href", ""))
            notes = row.xpath('.//ul[contains(@class,"pl-pat-im-etr")]/li')
        if not NUMBER.fullmatch(number) or not name:
            continue
        restrictions = list(dict.fromkeys(clean(n.text_content()) for n in notes if clean(n.text_content())))
        yield number, name, product, restrictions


def make_part(profile, number, name, product, restrictions, url, title, checked_on=None):
    return {
        "id": profile["id"] + "-" + number, "name": name, "category": category(url),
        "location": title, "description": f"{name} is a candidate listed in the {title.lower()} diagram. Check source conditions for engine, trim and equipment.",
        "aliases": [], "symptoms": [], "oemNumber": number,
        "fitmentNotes": f"Catalog reference: {profile['year']} BMW {profile['model']} — {profile['reference']}. Confirm VIN, production date, body, engine and equipment before ordering.",
        "sourceRestrictions": restrictions, "verification": "option-dependent",
        "sourceLabel": urlsplit(url).hostname + " · " + title,
        "sourceUrl": url, "sourceProductUrl": product,
        "sourceCheckedOn": checked_on or datetime.now(timezone.utc).date().isoformat(),
        "vehicleLabel": f"{profile['year']} BMW {profile['model']}",
        "vehicleDetails": profile["reference"], "catalogProfileId": profile["id"],
    }


def collect(profile, fetcher, excluded=(), limit=50, max_pages=15, include_hardware=False):
    seed = canonical(profile["sourceUrl"])
    scope = source_scope(seed)
    # Dealer index entries sometimes point to one assembly: also visit its categories page.
    urls = [(seed, "Parts diagram")]
    if urlsplit(seed).hostname in DEALERS:
        p = urlsplit(seed)
        urls.append((urlunsplit((p.scheme, p.netloc, scope + "categories", "", "")), "Categories"))
    queue, seen, parts = deque(urls), set(), {}
    result = {"schemaVersion": 1, "profile": profile, "parts": [], "visitedPages": [], "errors": [], "rowsExamined": 0,
              "excludedExisting": len(set(excluded)), "status": "complete", "fetchedOn": datetime.now(timezone.utc).isoformat()}
    excluded = set(excluded)
    while queue and len(seen) < max_pages and len(parts) < limit:
        url, title = queue.popleft()
        if url in seen:
            continue
        seen.add(url)
        try:
            doc = fetcher.fetch(url)
            if title == "Parts diagram":
                heading = doc.xpath("//h1")
                title = clean(heading[0].text_content()) if heading else title
            result["visitedPages"].append(url)
            for number, name, product, notes in parse_rows(doc, url):
                result["rowsExamined"] += 1
                if number in excluded or (not include_hardware and HARDWARE.search(name)):
                    continue
                if number in parts:
                    existing = parts[number]["sourceRestrictions"]
                    existing.extend(n for n in notes if n not in existing)
                    continue
                checked_on = None
                if hasattr(fetcher, "cache_path"):
                    checked_on = datetime.fromtimestamp(fetcher.cache_path(url).stat().st_mtime, timezone.utc).date().isoformat()
                parts[number] = make_part(profile, number, name, product, notes, url, title, checked_on)
            # Parse the full page before truncation so duplicate rows retain conditions.
            if len(parts) >= limit:
                parts = dict(list(parts.items())[:limit])
                break
            queue.extend(scoped_links(doc, url, seed))
        except SourceStopped as error:
            result["errors"].append({"url": url, "message": str(error), "hostBlocked": error.block_host})
            result["status"] = "stopped"
            break
        except KeyboardInterrupt:
            result["status"] = "interrupted"
            break
        except (HTTPError, URLError, OSError, ValueError) as error:
            result["errors"].append({"url": url, "message": str(error)})
    if not result["rowsExamined"] and result["status"] != "stopped":
        result["errors"].append({"url": seed, "message": "No explicit OEM part rows found. The page layout may have changed, or more diagram pages are needed."})
    if result["errors"] and result["status"] not in ("stopped", "interrupted"):
        result["status"] = "partial"
    result["parts"] = list(parts.values())
    result["pagesAttempted"] = len(seen)
    result["pageLimitReached"] = bool(queue and len(seen) >= max_pages)
    result["partLimitReached"] = len(parts) >= limit
    return result


def merge(project, staged, apply=False, prepared=None):
    result = read_json(staged)
    profile_id = result["profile"]["id"]
    if prepared is None:
        index, profile = load_profile(project, profile_id)
    else:
        index = prepared["index"]
        profile = next((p for p in index["profiles"] if p["id"] == profile_id), None)
        if profile is None:
            raise ValueError(f"Unknown profile: {profile_id}")
    year_path = Path(project) / "data/bmw-parts" / (profile["year"] + ".json")
    if prepared is None:
        bucket = read_json(year_path)
    else:
        if profile["year"] not in prepared["years"]:
            prepared["years"][profile["year"]] = read_json(year_path)
        bucket = prepared["years"][profile["year"]]
    existing = bucket.get(profile_id, [])
    incoming_profile = result["profile"]
    if any(str(profile[k]) != str(incoming_profile.get(k)) for k in ("year", "model", "reference", "sourceUrl")):
        raise ValueError("Source reference changed. Keep engine/body/market variants in separate reviewed catalogs.")
    scope = source_scope(profile["sourceUrl"])
    origin = urlsplit(profile["sourceUrl"]).netloc
    merged = {p["oemNumber"]: p for p in existing}
    additions = []
    for p in result["parts"]:
        n = p.get("oemNumber", "")
        if not isinstance(n, str) or not NUMBER.fullmatch(n) or p.get("id") != profile_id + "-" + n or p.get("catalogProfileId") != profile_id:
            raise ValueError("Invalid part number or profile ID in review file.")
        for field in ("name", "category", "location", "description", "fitmentNotes", "sourceLabel", "sourceCheckedOn"):
            if not isinstance(p.get(field), str) or not p[field].strip():
                raise ValueError(f"Missing or invalid {field} for {n}.")
        for field in ("aliases", "symptoms", "sourceRestrictions"):
            if not isinstance(p.get(field), list) or not all(isinstance(item, str) for item in p[field]):
                raise ValueError(f"Invalid {field} for {n}.")
        if p.get("verification") != "option-dependent" or p.get("vehicleDetails") != profile["reference"]:
            raise ValueError("New scraped records must preserve the reference and option-dependent status.")
        source = urlsplit(canonical(p.get("sourceUrl", "")))
        if source.netloc != origin or not source.path.startswith(scope):
            raise ValueError("Part source is outside the selected vehicle reference.")
        if n not in merged:
            merged[n] = p
            additions.append(n)
    print(f"{profile_id}: {len(existing)} existing + {len(additions)} new = {len(merged)} numbered parts.")
    if not apply:
        print("Preview only. Review the JSON, then add --apply to import.")
        return len(additions)
    if not additions:
        print("Nothing new to import.")
        return 0
    bucket[profile_id] = list(merged.values())
    profile.update(sourcePartCount=len(merged), starterPartCount=max(0, 20 - len(merged)),
                   status="sourced" if len(merged) >= 20 else "partial")
    # Count actual yearly records, rather than trusting stale metadata.
    for p in index["profiles"]:
        if p["year"] == profile["year"]:
            p["sourcePartCount"] = len(bucket.get(p["id"], []))
            p["starterPartCount"] = max(0, 20 - p["sourcePartCount"])
            p["status"] = "sourced" if p["sourcePartCount"] >= 20 else "partial" if p["sourcePartCount"] else "starter"
    index["summary"] = {
        "vehicles": len(index["profiles"]),
        "sourcedProfiles": sum(p["sourcePartCount"] >= 20 for p in index["profiles"]),
        "partialProfiles": sum(0 < p["sourcePartCount"] < 20 for p in index["profiles"]),
        "sourcedParts": sum(p["sourcePartCount"] for p in index["profiles"]),
        "starterParts": sum(p["starterPartCount"] for p in index["profiles"]),
    }
    index["retrievedOn"] = datetime.now(timezone.utc).date().isoformat()
    if prepared is not None:
        prepared["changed"].add(profile["year"])
        return len(additions)
    index_path = Path(project) / "data/bmw-catalog-index.json"
    backup = Path(project) / "scraper-backups" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    backup.mkdir(parents=True)
    shutil.copy2(year_path, backup / year_path.name)
    shutil.copy2(index_path, backup / index_path.name)
    try:
        write_json(year_path, bucket)
        write_json(index_path, index)
    except BaseException:
        shutil.copy2(backup / year_path.name, year_path)
        shutil.copy2(backup / index_path.name, index_path)
        raise
    print(f"Imported. Backups: {backup}")
    return len(additions)


def import_batch(project, directory, apply=False):
    files = sorted(Path(directory).glob("bmw-*.json"))
    if not files:
        raise ValueError("No bmw-*.json review files found in the batch directory.")
    state = {"index": read_json(Path(project) / "data/bmw-catalog-index.json"), "years": {}, "changed": set()}
    profiles, count = set(), 0
    for file in files:
        profile_id = read_json(file)["profile"]["id"]
        if profile_id in profiles:
            raise ValueError("Multiple review files for the same profile; choose one before importing.")
        profiles.add(profile_id)
        # Validate and prepare everything in memory before any catalog write.
        count += merge(project, file, apply=True, prepared=state)
    print(f"Batch: {len(files)} review files, {count} new parts, {len(state['changed'])} changed year files.")
    if not apply or not count:
        print("Preview only. Add --apply after reviewing." if not apply else "Nothing new to import.")
        return count
    index_path = Path(project) / "data/bmw-catalog-index.json"
    targets = [(Path(project) / "data/bmw-parts" / (year + ".json"), state["years"][year]) for year in sorted(state["changed"])]
    targets.append((index_path, state["index"]))
    backup = Path(project) / "scraper-backups" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    backup.mkdir(parents=True)
    for path, _ in targets:
        shutil.copy2(path, backup / path.name)
    try:
        for path, data in targets:
            write_json(path, data)
    except BaseException:
        for path, _ in targets:
            shutil.copy2(backup / path.name, path)
        raise
    print(f"Imported batch. Backups: {backup}")
    return count


def run_batch(args, fetcher=None):
    index = read_json(args.project / "data/bmw-catalog-index.json")
    selected = [p for p in index["profiles"] if not args.year or p["year"] == args.year]
    if args.max_vehicles:
        selected = selected[:args.max_vehicles]
    supported = []
    for p in selected:
        try:
            source_scope(p["sourceUrl"])
            supported.append(p)
        except ValueError:
            pass
    print(f"Selected {len(selected)} profiles: {len(supported)} supported, {len(selected) - len(supported)} unsupported.")
    print(f"Per supported profile: up to {args.limit} NEW records and {args.max_pages} pages.")
    if args.plan:
        return 0
    args.output_dir.mkdir(parents=True, exist_ok=True)
    manifest = args.output_dir / "batch-report.json"
    report = read_json(manifest) if manifest.exists() else {"schemaVersion": 1, "profiles": {}, "blockedHosts": {}}
    fetcher = fetcher or Fetcher(args.cache, args.delay, args.offline, args.refresh)
    years = {}
    interrupted = False

    def save_report():
        entries = [report["profiles"][p["id"]] for p in selected if p["id"] in report["profiles"]]
        report["updatedOn"] = datetime.now(timezone.utc).isoformat()
        report["selectedProfiles"] = len(selected)
        report["summary"] = {"processed": len(entries), "collectedParts": sum(e.get("parts", 0) for e in entries),
                             "complete": sum(e["status"] == "complete" for e in entries),
                             "unsupported": sum(e["status"] == "unsupported" for e in entries),
                             "needsAttention": sum(e["status"] in ("stopped", "partial", "interrupted", "source-blocked", "error") for e in entries)}
        write_json(manifest, report)

    try:
        for pos, profile in enumerate(selected, 1):
            pid = profile["id"]
            fingerprint = hashlib.sha256(json.dumps({"id": pid, "source": profile["sourceUrl"], "reference": profile["reference"],
                                                     "limit": args.limit, "maxPages": args.max_pages,
                                                     "hardware": args.include_hardware}, sort_keys=True).encode()).hexdigest()
            previous = report["profiles"].get(pid, {})
            output = args.output_dir / (pid + ".json")
            same = previous.get("fingerprint") == fingerprint
            # Interrupted work resumes automatically. Other incomplete work is explicit.
            completed = previous.get("status") == "complete" and output.exists()
            terminal = previous.get("status") in ("unsupported", "source-blocked", "stopped", "partial", "error")
            if same and ((completed and not args.refresh) or (terminal and not args.retry_incomplete)):
                print(f"[{pos}/{len(selected)}] {pid}: already processed ({previous['status']}).", flush=True)
                continue
            entry = {"fingerprint": fingerprint, "parts": 0}
            try:
                source_scope(profile["sourceUrl"])
            except ValueError as error:
                entry.update(status="unsupported", message=str(error))
                report["profiles"][pid] = entry
                save_report()
                print(f"[{pos}/{len(selected)}] {pid}: unsupported source/reference.", flush=True)
                continue
            host = urlsplit(profile["sourceUrl"]).hostname
            if host in report["blockedHosts"] and not args.offline:
                entry.update(status="source-blocked", message=report["blockedHosts"][host])
            else:
                if profile["year"] not in years:
                    years[profile["year"]] = read_json(args.project / "data/bmw-parts" / (profile["year"] + ".json"))
                excluded = [p["oemNumber"] for p in years[profile["year"]].get(pid, [])]
                result = collect(profile, fetcher, excluded, args.limit, args.max_pages, args.include_hardware)
                write_json(output, result)
                entry.update(status=result["status"], parts=len(result["parts"]), file=output.name,
                             pages=len(result["visitedPages"]), errors=result["errors"],
                             pageLimitReached=result["pageLimitReached"])
                for error in result["errors"]:
                    if error.get("hostBlocked"):
                        report["blockedHosts"][host] = error["message"]
                interrupted = result["status"] == "interrupted"
            report["profiles"][pid] = entry
            save_report()
            print(f"[{pos}/{len(selected)}] {pid}: {entry['status']}, {entry['parts']} new parts.", flush=True)
            if interrupted:
                break
    except KeyboardInterrupt:
        interrupted = True
    finally:
        save_report()
    print(f"Progress saved: {manifest}")
    print(f"Collected records in this selection: {report['summary']['collectedParts']}. See report for unsupported/unfinished entries.")
    return 130 if interrupted else 2 if report["summary"]["needsAttention"] or report["summary"]["unsupported"] else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    profiles = sub.add_parser("profiles", help="List existing vehicle profiles and their source support.")
    profiles.add_argument("--project", type=Path, default=Path("."))
    profiles.add_argument("--year")
    scrape = sub.add_parser("scrape", help="Collect additional records into review JSON; never edits the catalog.")
    scrape.add_argument("--project", type=Path, default=Path("."))
    scrape.add_argument("--profile", required=True)
    scrape.add_argument("--limit", type=int, default=50, help="Maximum NEW records, excluding existing OEM numbers.")
    scrape.add_argument("--max-pages", type=int, default=15)
    scrape.add_argument("--delay", type=float, default=2.0)
    scrape.add_argument("--cache", type=Path, default=Path("scraper-cache"))
    scrape.add_argument("--output", type=Path)
    scrape.add_argument("--offline", action="store_true", help="Parse cached pages only; makes no network requests.")
    scrape.add_argument("--refresh", action="store_true", help="Fetch fresh HTML instead of reusing cached pages.")
    scrape.add_argument("--include-hardware", action="store_true")
    batch = sub.add_parser("batch", help="Collect supported profiles automatically; saves/resumes progress.")
    batch.add_argument("--project", type=Path, default=Path("."))
    batch.add_argument("--year")
    batch.add_argument("--max-vehicles", type=int)
    batch.add_argument("--limit", type=int, default=50)
    batch.add_argument("--max-pages", type=int, default=15)
    batch.add_argument("--delay", type=float, default=2.0)
    batch.add_argument("--cache", type=Path, default=Path("scraper-cache"))
    batch.add_argument("--output-dir", type=Path, default=Path("scraper-output/batch"))
    batch.add_argument("--plan", action="store_true", help="Show coverage without making network requests.")
    batch.add_argument("--offline", action="store_true")
    batch.add_argument("--refresh", action="store_true")
    batch.add_argument("--include-hardware", action="store_true")
    batch.add_argument("--retry-incomplete", action="store_true", help="Retry unfinished profiles, but never a blocked host automatically.")
    imp = sub.add_parser("import", help="Preview merging a review file; --apply writes with backups.")
    imp.add_argument("--project", type=Path, default=Path("."))
    imp.add_argument("--input", type=Path, required=True)
    imp.add_argument("--apply", action="store_true")
    imp_batch = sub.add_parser("import-batch", help="Preview or import all reviewed batch files, backing up each changed year once.")
    imp_batch.add_argument("--project", type=Path, default=Path("."))
    imp_batch.add_argument("--input-dir", type=Path, default=Path("scraper-output/batch"))
    imp_batch.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.command == "profiles":
            index = read_json(args.project / "data/bmw-catalog-index.json")
            for p in index["profiles"]:
                if args.year and str(p["year"]) != args.year:
                    continue
                try:
                    source_scope(p["sourceUrl"])
                    supported = "supported"
                except ValueError:
                    supported = "needs another adapter/source reference"
                print(f"{p['id']:<28} {p['sourcePartCount']:>4} parts  {supported}  | {p['reference']}")
            return 0
        if args.command == "import":
            merge(args.project, args.input, args.apply)
            return 0
        if args.command == "import-batch":
            import_batch(args.project, args.input_dir, args.apply)
            return 0
        if not 1 <= args.limit <= 500 or not 1 <= args.max_pages <= 100:
            raise ValueError("Use --limit 1–500 and --max-pages 1–100.")
        if args.offline and args.refresh:
            raise ValueError("Choose --offline or --refresh, not both.")
        if args.command == "batch":
            if args.max_vehicles is not None and args.max_vehicles < 1:
                raise ValueError("--max-vehicles must be positive.")
            return run_batch(args)
        _, profile = load_profile(args.project, args.profile)
        source_scope(profile["sourceUrl"])
        bucket = read_json(args.project / "data/bmw-parts" / (profile["year"] + ".json"))
        excluded = [p["oemNumber"] for p in bucket.get(profile["id"], [])]
        result = collect(profile, Fetcher(args.cache, args.delay, args.offline, args.refresh),
                         excluded, args.limit, args.max_pages, args.include_hardware)
        output = args.output or Path("scraper-output") / (profile["id"] + ".json")
        write_json(output, result)
        print(f"Collected {len(result['parts'])} new parts from {len(result['visitedPages'])} pages. Status: {result['status']}.")
        print(f"Review file: {output}")
        for error in result["errors"]:
            print(f"  {error['message']} ({error['url']})", file=sys.stderr)
        return 2 if result["status"] != "complete" else 0
    except (ValueError, OSError, KeyError, SourceStopped) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
