# D-0041: Preserve One Product and Establish Domain Boundaries

- **Status:** Accepted
- **Date:** 2026-08-14
- **Phase:** 13

## Context

Global Intelligence V2 extends the existing WorldMonitor application. The
repository already contains the Preact/Vite SPA, Edge/API and server layers,
generated protocol contracts, Redis-backed services, Tauri 2 desktop shell,
local sidecar, market workspace, maritime surfaces, Provider operations, and
test gates. A second frontend or parallel API stack would split truth,
licensing, authentication, layout, and release behavior.

## Decision

Keep one product and one repository. New capabilities enter through five
logical layers without creating a separate V2 application:

1. **Source and authorization:** approved source clients, user-authorized
   platform access, Provider entitlement, and secret boundaries.
2. **Ingestion and normalization:** adapters, schema validation, provenance,
   deduplication, entity resolution, freshness, and quality calculation.
3. **Domain records:** evidence/source items, events/trends, geography and
   industry, company/facility/brand/security, trade/logistics, and predictions.
4. **Services:** generated RPC/REST contracts, same-origin SSE/WebSocket relay,
   schedulers, queues, caches, search, alerts, and model runtimes.
5. **Product surfaces:** the existing dashboard, routes, map, market workspace,
   Provider operations, and Tauri desktop application.

Repository dependency direction remains:

```text
types -> config -> services -> components -> app -> App.ts
```

Generated code remains generated. Edge functions keep their self-contained
runtime boundary and do not import directly from browser or server source.
Existing Market v1, Maritime v1, Shipping v2, sidecar, and relay contracts are
extended or referenced rather than copied.

## Domain Ownership

| Domain | Owns | Must not own |
|---|---|---|
| Evidence and identity | Source evidence, status vocabulary, stable IDs, source aliases | Domain-specific presentation or Provider secrets |
| Industry and geography | Geo units, clusters, products, companies, facilities, brands | Market observations, shipment claims, or predictions |
| Trade and logistics | Aggregate trade, lawful shipment observations, nodes, routes | Inferred cargo facts from AIS or country data at town level |
| Events and trends | Source items, event clusters, trend windows, cross-platform spread | Unlabelled causal conclusions or market facts |
| Market | Exchanges, securities, sessions, licensed observations, corporate actions | Company identity keyed only by ticker or US-only calendars |
| Prediction | Versioned inputs, outputs, expiry, invalidation, and evaluation | Writes to canonical fact or evidence records |
| Product | Rendering, navigation, user actions, disclosure, and unavailable states | Direct private-Provider access or truth reclassification |

## Consequences

- Phase 14 supplies shared evidence and identity contracts before new domain
  entities are implemented.
- Domain modules may depend on shared contracts but may not redefine their own
  evidence/status/ID vocabulary.
- No Phase 13 product source, route, Provider, database, or runtime behavior is
  changed by this decision.
