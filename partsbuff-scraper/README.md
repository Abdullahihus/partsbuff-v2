# PartsBuff parts scraper

A local Python tool for collecting **additional** BMW OEM reference records.
It uses the exact vehicle references in your PartsBuff project. Scraping writes
a review JSON file. Importing is a separate step, with preview and backups.
It does not publish changes to GitHub or Netlify.

## 1. Extract and install

Extract `PartsBuff-scraper.zip` **inside your `PartsBuff-modern` project**.
You should have `PartsBuff-modern/partsbuff-scraper/scripts/parts_scraper.py`.
The existing website files do not need replacing.

In your Ubuntu terminal:

```bash
cd ~/PartsBuff-modern
python3 -m venv .venv-scraper
source .venv-scraper/bin/activate
python3 -m pip install -r partsbuff-scraper/requirements-scraper.txt
cat partsbuff-scraper/gitignore-additions.txt >> .gitignore
```

If Ubuntu reports that `venv` is unavailable, install it with
`sudo apt update` and `sudo apt install python3-venv`, then repeat setup.
Python 3.10 or newer is required. This scraper uses Python; your website
continues to use `npm`.

## Batch mode: one command for the catalog

After installation, run from `~/PartsBuff-modern` with the Python environment
active. See which vehicle references are supported without making requests:

```bash
python3 partsbuff-scraper/scripts/parts_scraper.py batch --plan
```

Start an automatic run across the existing catalog:

```bash
python3 partsbuff-scraper/scripts/parts_scraper.py batch --limit 50 --max-pages 15
```

This tries up to **50 additional numbers per supported vehicle reference**.
It visits vehicles sequentially, shares the HTML cache and request timing,
and writes each vehicle's review file as it finishes. You do not need to type
hundreds of commands. The package's current catalog compatibility check found
742 supported references out of 758; the other 16 need different source
adapters or specific vehicle references. Supported means the URL matches an
adapter, not that the remote site is guaranteed to allow requests.

Progress and problems are recorded in `scraper-output/batch/batch-report.json`.
Press Ctrl+C to stop; completed profiles and a partially collected current
profile are saved. Run the same command again to skip completed work and
reconstruct unfinished work from cached pages. Keep your computer awake and
the terminal open while collecting. Collection can take hours; automation
removes manual repetition but does not eliminate source response time.

For a smaller initial batch, use:

```bash
python3 partsbuff-scraper/scripts/parts_scraper.py batch --year 2011 --max-vehicles 2 --limit 5 --max-pages 5
```

Increase the batch afterward by removing `--year` and `--max-vehicles`. The
same progress directory lets the larger run reuse already processed profiles.
Changing the record/page limits starts a new attempt for affected profiles;
cached pages are still reused and already imported numbers are skipped.

Unsupported references are reported and skipped. After a 401/403/429 or an
access challenge, all further profiles from that host are skipped; independently
available hosts can continue. The blocked-host decision persists across
resumes. `--retry-incomplete` retries other incomplete profiles but does not
clear blocked hosts. Do not repeatedly start new runs against a blocked site.

Inspect the report and the per-vehicle JSON files before importing. Source
errors do not mean the saved partial records have been verified for a VIN.
Remove any review files you do not want to import from the batch directory.
Preview all remaining results together:

```bash
python3 partsbuff-scraper/scripts/parts_scraper.py import-batch
```

After reviewing, import the batch:

```bash
python3 partsbuff-scraper/scripts/parts_scraper.py import-batch --apply
```

The bulk importer validates every file before writing, groups changes by year,
and backs up each changed year and the catalog index once. Normal write failures
restore all affected originals. Repeating the import adds no duplicates. As
with single imports, avoid running two import processes simultaneously.

Exit code 2 means the batch report includes unsupported or unfinished profiles;
successfully collected review files remain available.

## 2. Pick a vehicle

```bash
python3 partsbuff-scraper/scripts/parts_scraper.py profiles --year 2011
```

The list shows profile IDs, current part counts, source support, and the precise
catalog reference. Use a profile marked `supported`.

This version supports BMWPartsDeal and compatible dealer catalog layouts at
BMWPartsPros, BMW OEM Parts, BMW Parts Worldwide, Genuine BMW Mini Parts,
Performance BMW, and BMW OEM Parts Online. Each domain can change its layout
or restrict requests independently. These adapters are not a promise that
every year or every source is accessible.

RealOEM and BMW Spare Parts require additional adapters. Unresolved profiles
that only link to a generic vehicle selector need a year/model/variant source
reference established first. The tool will explain unsupported sources and
will not guess a replacement vehicle or part number.

## 3. Try a small collection

```bash
python3 partsbuff-scraper/scripts/parts_scraper.py scrape --profile bmw-2011-128i --limit 5 --max-pages 5
```

The default project is the current directory. If running elsewhere, add
`--project /path/to/PartsBuff-modern` to each command.

`--limit` counts NEW part numbers: the existing catalog numbers are excluded.
The first run should be small so you can inspect the results. For more parts:

```bash
python3 partsbuff-scraper/scripts/parts_scraper.py scrape --profile bmw-2011-128i --limit 50 --max-pages 15
```

There is no guarantee that a reference contains 50 additional records. The
page budget includes the catalog page and the diagrams visited. Single-vehicle
limits are per run; batch mode applies those limits separately to each profile.

The results go to `scraper-output/bmw-2011-128i.json`. It contains names, OEM
numbers, categories, source/product URLs, source restrictions, the exact vehicle
reference, and the date the source HTML was downloaded. It also lists errors
and whether the page/part limit was reached. A budget-limited run is not a
complete inventory of the vehicle.

The package also includes `examples/2011-128i-review.json`: five additional
records collected in a live test on October 6, 2026 (UTC). This is a review
example, not a declaration that every listed revision fits every 128i. Some
numbers are alternative or superseded references; read the retained conditions.

Numbers are read from explicit part fields, not inferred from descriptions.
Common bolts, screws, clips and similar hardware are skipped by default;
add `--include-hardware` if needed. Repeated numbers are deduplicated within a
vehicle, with conditions from repeated rows retained.

## 4. Review and import

Open the review JSON in VS Code. Check each record against its source diagram
and the relevant engine, production date, market and options.

Preview changes:

```bash
python3 partsbuff-scraper/scripts/parts_scraper.py import --input scraper-output/bmw-2011-128i.json
```

After reviewing, import:

```bash
python3 partsbuff-scraper/scripts/parts_scraper.py import --input scraper-output/bmw-2011-128i.json --apply
```

Import adds new numbers to `data/bmw-parts/2011.json` and updates counts in
`data/bmw-catalog-index.json`. Counts can exceed 20. Existing part records are
preserved; repeating an import adds no duplicates. The source reference must
match the catalog reference, preventing automatic mixing of engine/body variants.
The original 174-part E90 catalog is not modified by this tool.

Both original files are copied to a timestamped `scraper-backups` directory.
If either normal write fails, both are restored. Do not run multiple imports
at the same time; the two files are replaced separately and an abrupt machine
shutdown could require restoring the backups.

Scraped records remain `option-dependent`. A source-listed number does not
establish exact VIN fitment. Source timestamps do not certify current stock,
price, or that a part has not been superseded.

## 5. Check and publish through your existing workflow

```bash
npm run build
git diff --stat
git diff -- data/bmw-catalog-index.json
```

When satisfied, commit and push the intended data changes through your usual
GitHub workflow. Your connected Netlify deployment then rebuilds the website.
The scraper has no deployment credentials and does not push changes itself.

## Cached pages and access errors

HTML is cached in `scraper-cache`. Rerunning uses cached pages, reconstructs
the crawl, and skips numbers already imported. Cache-only parsing uses
`--offline` and makes no network requests. `--refresh` fetches fresh source HTML.
Rerunning before importing will collect the same new numbers again; import
deduplication handles that.

Online runs check `robots.txt`, use a minimum two-second request interval
(longer when requested by the source), and stop on HTTP 401/403/429 or detected
access challenges. Partial results are saved. Exit code 2 means the review file
contains a stopped/partial run, and 1 means configuration or import failure.
Access restrictions are not bypassed. A blocked source needs a permitted feed,
API, manual export, or another independently established reference.

## What about Apify?

Apify Web Scraper can run a similar extraction on its platform, using start
URLs and a custom page function. It still needs source-specific extraction,
vehicle scope, deduplication, and a controlled PartsBuff import step. This local
tool is a starting point that does not require an Apify account or subscription.

Official documentation:
- https://apify.com/apify/web-scraper
- https://docs.apify.com/academy/apify-scrapers/web-scraper

## Tests

```bash
python3 -m unittest discover -s partsbuff-scraper/tests -v
```

Tests cover duplicate conditions, vehicle scope, blocked-source stop behavior,
robots rules, dealer fields, import preview, repeated imports, counts above 20,
invalid references, backups, and rollback on a failed second write.

Validation performed when packaging: all 15 tests passed, including the original
10 extraction/import tests and batch tests for resume, interruption, host
blocking, grouped imports, validation before writing and rollback across years.
A live batch collected two new records each for the 2011 128i and 135i;
bulk import into a copy preserved existing records and repeating it added zero.
The adapter recovered
the explicit numbers and names for the existing 20-record 2011 128i subset from
downloaded source pages; a live two-page run collected five additional records;
importing those records into a separate copy increased its catalog from 20 to
25, preserved all previous records, and a second import added no duplicates.
Dealer extraction was tested against a representative HTML fixture. The live
source test covered BMWPartsDeal; access to every dealer domain was not tested.
