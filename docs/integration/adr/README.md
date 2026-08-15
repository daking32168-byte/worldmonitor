# Global Intelligence V2 Architecture Decision Records

This directory contains the Phase 13 decisions that govern implementation from
Phase 14 onward. `docs/integration/DECISIONS.md` remains the chronological
decision ledger; these records provide the detailed, reviewable contracts.

| ID | Decision | Status |
|---|---|---|
| [D-0041](0041-domain-boundaries.md) | Preserve one WorldMonitor product and establish explicit domain boundaries | Accepted |
| [D-0042](0042-evidence-model.md) | Make evidence, scope, freshness, quality, and conflict state first-class | Accepted |
| [D-0043](0043-stable-entity-ids.md) | Use opaque stable IDs and persistent source-identity mappings | Accepted |
| [D-0044](0044-provider-licensing.md) | Gate Provider use by reviewed rights and fail closed | Accepted |
| [D-0045](0045-storage-strategy.md) | Separate durable facts, evidence, model output, cache, fixtures, and client state | Accepted |

These ADRs define boundaries, not proof that the Phase 14 contracts or later
domain features already exist. Implementation status remains in
`docs/integration/MASTER_STATUS.md` and acceptance evidence remains in
`docs/integration/ACCEPTANCE_EVIDENCE.md`.
