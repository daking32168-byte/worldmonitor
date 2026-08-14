# D-0042: Make Evidence and Data State First-Class

- **Status:** Accepted
- **Date:** 2026-08-14
- **Phase:** 13

## Context

The product combines official registries, company disclosures, licensed market
observations, aggregate trade records, AIS broadcasts, social signals, modelled
relationships, historical fixtures, and AI speculation. These inputs cannot
share an undifferentiated success state without creating false precision or
unsupported causality.

## Decision

Phase 14 will define one shared evidence contract used by all later domains.
The contract must represent:

- the controlled `EvidenceClass` vocabulary from the execution plan;
- `AggregationLevel` and the target scope to which a record may be applied;
- source, Provider, publication, observation, retrieval, validity, and period
  timestamps;
- license, freshness, quality, confidence, and methodology state;
- explicit nulls with an unavailable/not-applicable reason;
- conflict membership and a documented preferred-value rule; and
- immutable references from domain records to one or more source-evidence IDs.

The shared presentation status vocabulary is:

```text
NOT_CONFIGURED
UNAVAILABLE
DELAYED_UNVERIFIED
STALE
OBSERVED
REALTIME_VERIFIED
MODELLED_ESTIMATE
AI_SPECULATION
SOURCE_REQUIRED
```

`REALTIME_VERIFIED` requires both a verified transport path and reviewed rights.
An empty result cannot be returned as a content-bearing `OK`; the response
envelope must carry the reason and applicable warnings.

## Truth Boundaries

- Preserve conflicting source records; do not silently overwrite or delete
  them through model output.
- A coarser aggregate cannot populate a finer target. Country-level HS data,
  for example, may provide country context but cannot become a town export fact.
- AIS is an observation of received broadcast fields, not proof of cargo,
  buyer, bill of lading, origin, or final discharge.
- Social content is a signal until separately verified.
- Modelled routes, flows, impacts, and AI speculation remain outside fact
  records and retain model/method/version/cutoff metadata.
- Historical fixtures remain test or research inputs and cannot become a live
  fallback.

## Consequences

- Phase 14 must add validators and compatibility mappings before Phase 15+
  domains consume the contract.
- Existing Market, Maritime, and China Factory APIs keep their public behavior;
  adapters add the new envelope without breaking current clients.
- UI status labels have one canonical mapping rather than per-panel wording.
