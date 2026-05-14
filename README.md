# Sant Julià isochrones web prototype

This is a **separate prototype** for migrating the Sant Julià v6 Shiny app to a faster web app.

It is intentionally stored as a sibling of `v6/`:

```text
Isochrones/
├── v6/                    # current Shiny/R version, untouched
└── v6_web_prototype/      # this prototype
```

## Rule

Do not edit files inside `../v6/shiny_app/` from this prototype. The prototype reads from `../v6/outputs/` and `../v6/data/`, then writes browser-ready data only to `public/data/`.

## Architecture

```text
../v6/compute_isochrones.R
        ↓
../v6/outputs/isochrones.gpkg
        ↓
scripts/export_web_data.R
        ↓
public/data/*.json + public/data/layers/*.geojson
        ↓
Next.js + React + MapLibre
```

The web app should not compute isochrones, population intersections or category unions live. R remains the analytical engine; the browser only filters, styles and displays precomputed outputs.

Important data-contract decisions:

- Category mode uses precomputed category-union geometries exported by R.
- Isochrone polygons are simplified on export with a 1.5 m tolerance for faster first paint; the analytical GPKG is not changed.
- v1 exports stacked 5/10/15 minute polygons. If opacity looks muddy in MapLibre, the next iteration should export ring polygons directly from R.
- Text columns are exported as UTF-8, and NFC normalization is applied when `stringi` is available.
- The public static web app cannot call R. The polished PNG cartographic export remains an internal R tool for v1; the browser may later add a lightweight screenshot export.

## Setup on a machine with R and Node

From this folder:

```bash
npm install
npm run export:data
npm run dev
```

For a static build:

```bash
npm run build
```

Next.js is configured with `output: 'export'`, so a successful build creates a static `out/` folder.

## Data export

`scripts/export_web_data.R` is the hard gate for the migration. It must fail before writing trustworthy output if the exported web numbers do not match the Shiny-equivalent startup lookup tables.

Parity checks include:

- no duplicate `(destination/category, scenario, band)` rows;
- complete destination grid for every destination × scenario × 5/10/15 min band;
- exact numeric parity for people, sex/age columns, denominator, selected scenario value and percentage;
- category mode checked after precomputing the category-union geometries in R.

If any parity check fails, the script stops. Do not use the exported web data.

`scripts/export_web_data.R` creates:

```text
public/data/
├── config.json
├── scenarios.json
├── destinations.json
├── coverage_by_destination.json
├── coverage_by_category.json
├── layers/
│   ├── isochrones.geojson              # simplified destination geometries
│   ├── isochrones_by_category.geojson  # precomputed category-union geometries
│   ├── equipaments.geojson
│   ├── espais_entrades.geojson
│   ├── espais_polygons.geojson        # if available
│   └── aparcaments.geojson            # if available
└── qa/
    └── qa_origins.geojson
```

## Current status

This is a scaffold/prototype, not yet a replacement for the Shiny app.

Notes from the container setup:

- This OpenClaw container does not have `Rscript`, so `npm run export:data` must be run on a machine with R and the v6 R packages available.
- `npm install` was attempted here but stalled while extracting dependencies on the OneDrive-backed workspace. The partial dependency folder was renamed `_node_modules_partial_DO_NOT_USE/` and is ignored. Remove it locally before installing dependencies.

Known next steps:

1. Delete any `_node_modules_partial_DO_NOT_USE*/` folders if present.
2. Run `npm install` locally.
3. Run `npm run export:data` locally where R is available. This is a blocking parity gate, not just a conversion step.
4. Test `npm run dev`.
5. Manually spot-check several web filters/KPIs against the Shiny app after the automated parity gate passes.
6. Decide whether raw GeoJSON is fast enough or whether isochrones/network should move to PMTiles.
7. Keep the polished PNG export in R for now.

## Migration rationale checkpoint

Before treating this as more than a prototype, decide the actual reason for migrating:

- If the only problem is `shinyapps.io` sleeping, quotas or hosting friction, there may be cheaper fixes than a Next.js rebuild.
- If the goal is a permanent, fast, embeddable, UCMA/Sant Julià-facing product that can live on static infrastructure, this migration is worth it.
