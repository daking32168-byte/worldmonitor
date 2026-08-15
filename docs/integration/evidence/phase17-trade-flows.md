# Phase 17 Trade Flows and Multimodal Logistics Evidence

**Date:** 2026-08-15 (Asia/Shanghai)
**Status:** CANDIDATE — LOCAL GATES PASS, HOSTED ZERO-EXIT DESCENDANT PENDING

## Delivered Scope

- Runtime-neutral `TradeFlowObservation`, `ShipmentObservation`,
  `LogisticsNode` and `LogisticsRoute` contracts.
- Sea, air, rail, road and multimodal transport vocabularies.
- Owned, lazy `/trade-flows` workspace with explicit unavailable state.
- UN Comtrade adaptation boundary fixed to country aggregation.
- Lawful customs-file manifest validation boundary.
- Field-scoped contracted shipment/BOL Provider contract.
- Distinct actual-observation, company-disclosure and model-route layers.
- CSV export retaining period, units, Provider/evidence source and aggregation.
- Provider Operations extension for an intentionally disabled shipment import.
- Links to existing Maritime/AIS/PortWatch/Shipping operational surfaces without
  treating them as cargo evidence.

## Production Data Boundary

The production registry contains zero flows, shipments, nodes, routes and
evidence. Existing AIS positions, port configuration, airport configuration,
route configuration, company locations and national trade caches are not
promoted automatically. Test records live only inside the Node contract test.

Comtrade produces only `COUNTRY` observations. An actual-flow renderer requires
the requested geography ID and aggregation to equal the observation, so China
country data cannot appear as a Huidong/county actual. Customs imports require
a checksum, publisher, publication timestamp, aggregation, source reference
and a documented local-analysis right.

Shipment observations require an enabled provider contract, reviewed licence,
Provider identity match, field-level allowlist and `CONTRACTED_SHIPMENT`
evidence at `SHIPMENT` aggregation. `AIS_OBSERVATION` is rejected before any
cargo field can enter the registry.

## Acceptance Receipts

| Gate | Result |
|---|---|
| Phase 17 focused contract | PASS — 7/7 |
| Phase 14–17 plus China Factory/Maritime/Provider regression | PASS — 47/47 |
| Production TypeScript | PASS — `tsc --noEmit` |
| Changed-file Biome | PASS — 7 files, no fixes |
| Strict local Vite secret scan | PASS |
| Production Vite build | PASS — 2,518 modules; 21.75 seconds |
| AIS negative test | PASS — shipment admission rejects AIS evidence |
| Country-to-Huidong negative test | PASS — aggregation/geography mismatch returns false |
| Export truth fields | PASS — period, unit, source and aggregation retained |
| Fixture/template isolation | PASS — production entry does not import operator templates |

## Browser Receipt

The local Vite route was inspected through the in-app browser:

| Viewport | Result |
|---|---|
| 1440 x 900 | Body/document width 1440/1440; state `NOT_CONFIGURED`; actual/disclosed/modelled legends and AIS/country boundaries visible |
| 390 x 844 | Body/document width 390/390; workspace overflow remains `auto`; metric cards collapse to one column; no fixture/example text |

The local server was stopped, the tab closed and the viewport override reset
after inspection. Dev-only feed failures did not populate the empty registry.

## Remote Closure Condition

The implementation and receipt were committed and normally pushed. Run 15
passed native macOS and four other top-level workflows, but an unrelated
Ubuntu market-quote deadline timing test failed. Phase 17 becomes complete
only when the final Phase 20 descendant returns zero on authoritative Ubuntu
and native macOS.
No merge, deployment, release, signing, notarization, Provider activation or
production import is authorized by this candidate.
