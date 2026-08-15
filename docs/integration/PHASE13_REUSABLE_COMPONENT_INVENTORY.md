# Phase 13 Reusable Component Inventory

This inventory maps the execution plan's seven required reuse areas to the
existing WorldMonitor implementation. Paths are entry points, not an exhaustive
file list. Later phases must inspect the current implementation and tests before
editing; this document does not authorize copying a parallel subsystem.

## 1. Map and Geospatial Rendering

| Existing asset | Reuse in V2 | Boundary |
|---|---|---|
| `src/components/MapContainer.ts` | Existing map ownership, lifecycle, overlays and mode integration | Keep one map surface and existing layout ownership |
| `src/components/DeckGLMap.ts` and `src/components/GlobeMap.ts` | 2D/3D rendering, clustering, overlays and tooltips | Viewport/zoom-gate large datasets; preserve source disclosures |
| `src/config/map-layer-definitions.ts` | Layer registry and per-variant ownership | New layers must be registered, gated and explainable |
| `src/config/basemap.ts` and `basemap-styles.ts` | Lazy MapLibre/PMTiles setup and basemap policy | Do not force map libraries into the initial bundle |
| `src/e2e/map-harness.ts`, `e2e/map-harness.spec.ts`, `tests/map-*` | Deterministic map and layer regression coverage | Harness data stays test-only and never becomes a runtime fallback |

Likely consumers: Phase 15, 17, 18, 19, 21 and 23.

## 2. Search and Command Surfaces

| Existing asset | Reuse in V2 | Boundary |
|---|---|---|
| `src/components/SearchModal.ts` and `search-scope.ts` | Global search presentation, scopes, keyboard and mobile behavior | One search surface; results retain entity type and source status |
| `src/app/search-manager.ts` | Open/close state, orchestration and lifecycle | Do not create a second command-modal controller |
| `src/config/commands.ts` | Command registration and navigation actions | New V2 entry points register here under existing ownership |
| `src/services/symbol-search.ts` and `api/symbol-search.ts` | Current provider-backed security search path | Symbol search is not a general stable-entity ID service |
| `tests/search-*` and `tests/symbol-search*` | State, debounce, command, mobile and provider-failure tests | Preserve fail-closed results and accessibility behavior |

Likely consumers: Phase 15, 16, 19, 21 and 23.

## 3. Status, Freshness and Source Labels

| Existing asset | Reuse in V2 | Boundary |
|---|---|---|
| `src/services/data-freshness.ts` and `health-freshness*.ts` | Freshness calculation and health mapping patterns | Phase 14 supplies one canonical V2 vocabulary and adapters |
| `src/services/panel-freshness-display.ts` | Panel-level freshness presentation | Do not relabel stale or unknown content as live |
| `src/services/market-data-truth.ts` | Market observation and fallback truth rules | Generalize contracts without weakening symbol/license checks |
| `src/components/provider-readiness-notice.ts` | Explicit disabled/provider-required presentation | Missing Provider is a visible state, not an empty success |
| `src/components/news/source-provenance.ts` and `map-popup-source-links.ts` | Source links and provenance rendering patterns | Source URLs/internal references require safe handling |
| `tests/panel-freshness-badge.test.mts`, `tests/source-provenance.test.mts` | Status/provenance regression patterns | Add one-to-one mapping and aggregation negative tests in Phase 14 |

Likely consumer: Phase 14 and every later data-bearing phase.

## 4. SSE and Relay Transport

| Existing asset | Reuse in V2 | Boundary |
|---|---|---|
| `api/market/stream.ts` | Existing same-origin SSE entry pattern | Browser never receives a private Provider secret |
| `server/worldmonitor/market/v1/market-stream-relay.ts` | Server-side Provider WebSocket-to-SSE normalization | Keep symbol-qualified isolation and licensed-state gates |
| `api/_relay.js` and `server/_shared/relay.ts` | Shared relay/auth/timeout behavior | New streams reuse rate, auth and error categories |
| AIS/shared relay tests such as `tests/ais-relay-*` and `tests/shared-relay.test.mjs` | Reconnect, health, auth and failure coverage | One Provider failure must not block other domains |

Likely consumers: Phase 19, 20, 21 and 24.

## 5. Provider Operations

| Existing asset | Reuse in V2 | Boundary |
|---|---|---|
| `src/features/provider-operations/provider-operations.ts` | Existing route UI and task control surface | A button is not proof of execution or success |
| `src/features/provider-operations/provider-operations-route.ts` | Existing route ownership | Extend `/provider-operations`; do not create a second control center |
| `src/services/provider-operations.ts` | Non-sensitive status, scheduling and action contract | Never expose credentials, payloads or false availability |
| `tests/provider-operations.test.mts` and Phase 9 evidence | Current control/fail-closed regression baseline | Phase 14 adds license and shared-envelope compatibility tests |

Likely consumer: Phase 14 and all Provider-backed phases.

## 6. Market and Stock Workspace

| Existing asset | Reuse in V2 | Boundary |
|---|---|---|
| `src/features/pokieticker/stock-workspace.ts` and route/CSS files | `/stocks` workspace, symbol navigation and panel layout | Preserve current routes and client behavior |
| `src/components/MarketPanel.ts` and market components | Existing market summary, disclosures and chart interaction | No shared-symbol fallback or unlicensed realtime label |
| `server/worldmonitor/market/v1/` | Current Market v1 handlers, calendar, provider and news evidence | Extend generated contracts; keep eight existing RPCs compatible |
| `src/generated/{client,server}/worldmonitor/market/v1/` | Generated client/server contract boundary | Never hand-edit generated files |
| `tests/stock-*`, `tests/market-*`, stock workspace E2E | Symbol, bars, session, news, adapter and fail-closed tests | Add MIC/global-calendar and envelope tests without deleting current coverage |

Likely consumers: Phase 14, 16, 21, 22 and 23.

## 7. Desktop, Sidecar and Notifications

| Existing asset | Reuse in V2 | Boundary |
|---|---|---|
| `src-tauri/` and `src-tauri/tauri.conf.json` | Existing Tauri 2 shell, capabilities and package identity | Keep one installed desktop application |
| `src-tauri/sidecar/local-api-server.mjs` | Loopback sidecar and desktop API bridge | Loopback availability is not Provider availability |
| `src/services/tauri-bridge.ts`, `desktop-runtime.ts`, `desktop-readiness.ts` | Native invocation, runtime detection and readiness | Protected values remain in system/server boundaries |
| `src/app/desktop-updater.ts` | Existing desktop update lifecycle | Phase 24 alerts do not create a second updater |
| `src/services/notifications-settings.ts`, `notification-channels.ts`, `push-notifications.ts` | Existing notification preferences and channel contracts | Respect permission, identity, quiet hours, dedupe and entitlement |
| `tests/desktop-*`, `tests/notification-*`, `tests/phase10-desktop-launcher.test.mjs` | Desktop/notification regression coverage | No automatic trade action or secret in notification payloads |

Likely consumers: Phase 24 and 25.

## Reuse Gate

Before adding a new subsystem, the implementing phase must record:

1. which entry point above is extended;
2. why an existing contract is insufficient, if a new module is still needed;
3. dependency direction and runtime boundary;
4. source, license, freshness and unavailable behavior; and
5. focused tests proving compatibility and negative truth cases.
