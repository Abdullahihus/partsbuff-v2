# PartsBuff — local app

PartsBuff runs on your own computer with Next.js. No ChatGPT hosting account or deployment setup is required.

## Start locally

1. Install Node.js 24 LTS.
2. Extract this ZIP, then open a terminal in the folder containing `package.json`.
3. Run:

```sh
npm install -g pnpm@11.25.0
pnpm install
pnpm dev
```

4. Open http://localhost:5173. Keep the terminal open; press Ctrl+C to stop the app.

For a production build on your computer:

```sh
pnpm build
pnpm start
```

If port 5173 is already in use, stop the other app or run `pnpm exec next dev --hostname 127.0.0.1 --port 5174` and open http://localhost:5174.

## What to keep

| Folder or file | Purpose |
| --- | --- |
| `app/` | Pages, styles, VIN lookup, search, and catalog API routes |
| `components/` | The interface, vehicle picker, and three UI components actually used |
| `lib/` | Catalog lookup, matching, and retailer helpers |
| `data/` | BMW vehicle lists and part catalogs; keep all JSON files |
| `public/` | Your chain logo and BMW photo |
| `vendor/` | CSS variants needed by the UI components |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | Dependencies and install settings |
| Next.js, TypeScript, and PostCSS config files | App and stylesheet build settings |

`node_modules/`, `.next/`, and `*.tsbuildinfo` are generated. You may delete them while the app is stopped; run `pnpm install` to restore dependencies and `pnpm build` to restore the production build. None are included in this ZIP. The README is optional after setup.

The local package omits the ChatGPT/Sites hosting configuration, Cloudflare/Vinext/Vite tooling, unused connector and database code, unused UI components, and catalog import/research scripts. No deployment credentials are included.

## Catalog and features

The package keeps VIN lookup, BMW model selection for 2000–2026, catalog search, inline part cards, individual detail pages, RealOEM links, saved parts, and comparison. The expanded catalogs contain 14,920 sourced OEM entries and 240 clearly marked starter entries that still need part numbers, across 758 year/model profiles. The original 2011 BMW 328i N51 November 2011 reference catalog is also retained. Part numbers are catalog references; confirm VIN, engine, build date, and options before ordering. Retailer prices are dated snapshots.

Internet access is needed for VIN decoding and external retailer/OEM pages. Local catalog browsing and keyword matching use the bundled data. Optional AI-assisted matching uses a server-side `OPENAI_API_KEY` in `.env.local`; no key is needed to run the app or use keyword matching. Never put an API key in browser code or share `.env.local`.

## Logo

`public/partsbuff-logo.png` contains the blue-and-black chain symbol without the PARTSBUFF wordmark. It is used in the header, footer, and browser icon.
