# Phase 15 Global Industry Map Evidence

**Date:** 2026-08-15 (Asia/Shanghai)
**Status:** CANDIDATE — LOCAL GATES PASS, HOSTED RUN PENDING
**Implementation commit:** `ac5ab6a403ce36f6c756fb73aa4815438e1d7f10`

## Implemented Scope

- Runtime-neutral `GeoUnit`, `IndustryCluster`, `ProductTaxonomyNode` and
  `ProductHsMapping` contracts in `shared/industry-map.ts`.
- Stable `geo_`, `cluster_`, `product_` and `source_` identifiers plus four
  valid Phase 14 `SourceEvidence` records.
- Non-copying adaptation of the existing 22-record China Factory registry.
- Reviewed HS 2012 chapter 64 mappings only for Huidong women's footwear and
  Putian Licheng sports/leisure footwear.
- Twenty MIIT reference clusters remain `REFERENCE_ONLY`, have no HS mapping
  and have statistics disabled.
- Owned `/industry-map`, `/industry-map/location/:geoId` and
  `/industry-map/cluster/:clusterId` routes, loaded as a lazy workspace inside
  the existing Preact/Vite/Tauri application.
- Five-mode map contract with only `INDUSTRY_DISTRIBUTION` implemented. Future
  company/facility, trade-flow, logistics and impact modes are disabled and
  visibly marked source-required.
- Cluster/product search, source links, coverage/gap panel, reviewed-HS panel
  and explicit absence of location-level trade data.
- Operator-only maintenance CSV template and fail-closed validator. Neither
  the template nor test fixtures are imported by production code.

## Truth and Geography Boundary

All 22 seeds retain the source text, administrative label and source URL from
`shared/china-factory-clusters.ts`; this phase does not duplicate those facts
into a second maintained dataset. The registry intentionally contains no
trade amount, weight, destination, port, shipment or buyer field.

Current sources establish administrative labels but do not provide separately
reviewed boundary geometry or sourced centroids. Every current `GeoUnit`
therefore has:

```text
boundary_review_status = NOT_REVIEWED
boundary_ref = null
centroid_lat = null
centroid_lon = null
```

The UI renders an administrative distribution index, not a geographic point or
polygon. It states the missing-boundary status directly. A reviewed HS mapping
is also shown separately from trade availability; no location-level trade
number is rendered.

## Acceptance Receipts

| Gate | Result |
|---|---|
| Phase 15 contract suite | PASS — 10/10 |
| Phase 14 + China Factory focused regression | PASS — combined 23/23 |
| Production TypeScript | PASS — `tsc --noEmit` |
| Changed-file Biome | PASS — 8 files, no fixes |
| CSV template CLI | PASS — non-ASCII Windows path accepted |
| Strict local Vite secret scan | PASS |
| Production Vite build | PASS — 2,513 modules; 22.08 seconds |
| Production bundle isolation | PASS — no maintenance template marker or `tests/fixtures`; Phase 15 domain remains in the lazy `industry-map` chunk |
| Search `女鞋` | PASS — exactly one sourced Huidong result |
| Boundary fail-closed | PASS — all 22 records explicitly `NOT_REVIEWED`, with no boundary or centroid |
| Trade-value fail-closed | PASS — no value-bearing trade field; UI states `UNAVAILABLE` and renders no trade amount/ranking |

## Browser Layout Receipt

The local Vite route was inspected in the in-app browser at both desktop and
mobile viewports:

| Viewport | Page/client width | Result |
|---|---:|---|
| 1440 x 900 | 1440 / 1440 | No horizontal overflow; distribution and detail panes independently scroll |
| 390 x 844 | 390 / 390 | No horizontal overflow; distribution and detail panes independently scroll |

The product search loaded `?q=女鞋`, displayed one sourced Huidong card and
navigated successfully to both cluster and location detail URLs. No Phase 15
console error occurred. The only warning was the existing Vite-development PWA
service-worker MIME warning; production `generateSW` completed normally.

## CSV Maintenance Boundary

`docs/integration/templates/industry-map-maintenance.csv` contains one
self-identifying `TEMPLATE` row. The validator rejects:

- unexpected headers or column counts;
- invalid stable IDs or duplicate clusters;
- partial/out-of-range centroids;
- a boundary reference without `REVIEWED` boundary status;
- unreviewed HS codes;
- non-HTTPS reviewed sources; and
- statistics without a reviewed record, reviewed HS mapping and source.

The validator does not import a CSV into the production registry. Promotion of
any row remains a source-review and code-review operation.

## Remote Closure Condition

This evidence records a local candidate only. Phase 15 becomes complete after
the implementation and this receipt are pushed to stacked Draft PR #2 and the
authoritative Ubuntu plus native macOS Run 13-or-later gates return zero. No
merge, deployment, release, signing, notarization, Provider activation or
boundary-data purchase is authorized by this candidate.
