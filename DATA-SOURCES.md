# Getting more OEM data for PartsBuff

This package already contains the recovered and newly checked OEM records. Run the app normally; no scraper is required. The exact per-vehicle counts and remaining gaps are in `CATALOG-COVERAGE.md` and `data/catalog-coverage.json`.

## A reliable source for ongoing updates

Ask an authorized BMW parts supplier for a **CSV export or API feed** that includes vehicle fitment, OEM part numbers, descriptions, supersessions and source conditions. Another option to evaluate is [TecAlliance's TecDoc products](https://www.tecalliance.net/products), including **TecDoc OE Parts Data** and its **WebService API**. TecAlliance offers data integration products, but the provider must confirm the BMW coverage and permitted use for your website. This is a provider-supplied feed, not a promise of a free complete BMW catalog.

Before choosing a feed, ask these questions:

1. Does it cover BMW model years 2000–2026 in the markets you need?
2. Can records be matched by engine, chassis, body, trim, production date, options and VIN where available?
3. Does your agreement permit storing the data and displaying it on a public parts website?
4. Are OEM part numbers, superseded numbers, names and fitment restrictions included?
5. Can you receive a sample CSV or API response, and what are the cost and update limits?

For a manual lookup, [RealOEM](https://www.realoem.com/bmw/enUS/select) allows vehicle selection and diagrams. Confirm the exact vehicle reference before using a number. Manual lookup helps with individual gaps; bulk coverage needs a suitable feed.

## How the app stores parts

`data/bmw-parts/2020.json`, for example, is a JSON dictionary keyed by vehicle profile ID. Each profile contains an array of records with `id`, `name`, `oemNumber`, `catalogProfileId`, `vehicleDetails`, `sourceUrl`, `sourceRestrictions` and other display fields. `data/bmw-catalog-index.json` identifies the selected reference and its counts. The same OEM number can appear under several vehicles; those are separate fitment records, not necessarily different physical parts.

When a feed is available, normalize its records to that format, merge by **vehicle profile plus OEM number**, retain fitment conditions, and update the profile counts. The website does not cap numbered catalogs at 20 parts. The original specialized E90 catalog remains in `data/e90-parts.json`.

## Why the old scraper stopped

A scraper reads web pages and extracts fields. Some sites refuse automated access, return a challenge, or limit requests. Repeatedly restarting a blocked scraper does not establish access or produce trustworthy data. Request an export or supported API from the source. This update used saved source pages and additional publicly accessible diagrams where available; unavailable references are reported instead of filled with invented numbers.

The app reads its bundled JSON; it does not automatically update parts from source websites. After changing the data locally, commit and push the changes to your GitHub repository so your connected Netlify deployment can rebuild.

## Focused E90 expansion

The original E90 has 478 numbered references, including 304 new dealer candidates. They are bundled in data/e90-parts.json and mirrored in the ordinary 2011 328i selection. Each new number/name was checked against an explicit dealer source row; recorded conditions are displayed on the detail card/page. Dealer pages mix variants and do not establish November 2011 VIN fitment. All new records remain option-dependent. Read E90-CATALOG.md and data/e90-catalog-coverage.json for the exact scope. Other BMW catalogs were not expanded in this focused update.

## Price snapshots

This pricing update retains the original price examples and adds source-confirmed product-page snapshots. Coverage is 448 of 478 E90 references (553 priced offers). Sources include BMWOEMParts, saved BMWPartsDeal pages, BMWPartsHub, Buy BMW Parts Now, OEM Vehicle Parts, BMW of South Atlanta, BMWPartsDirect, BMW OEM Parts Store, BMW Parts Express and BimmerWorld. Each quote links to its source and includes the date checked. Prices are advertised USD amounts, not current stock or VIN-fitment guarantees. Included refundable core deposits are identified. The comparison hides listings without a confirmed price and does not create an extra MSRP bar. The optional official eBay Browse API adds only actual priced listings. See PRICING-AND-SELLING.md.
