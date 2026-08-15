# Phase 13 Baseline and Architecture Evidence

**Date:** 2026-08-14 (Asia/Shanghai)
**Scope:** Local baseline protection, architecture documentation, and audit-tool portability

## Protected Inputs

| Item | Observed state before Phase 13 writes |
|---|---|
| Formal repository | `daking32168-byte/worldmonitor` |
| Protected local/remote main | `0fca203c776dd5fa4913c4bd52f99cd2c3c13a25` |
| Existing integration local/remote tip | `cc5d8bfd81a8320f0940dee91e39572b13a47c2e` |
| Accepted functional head | `c730fc6a2c4a6c390b305ce19cb04b1fa805c43e` |
| Draft PR #1 | Open, Draft, unmerged, mergeable; base `main@0fca203c...`; head `cc5d8bfd...` |
| Main worktree | Existing user state retained; 5,517 tracked-only porcelain entries in the compact audit |
| Upstream integration worktree | Existing 790-entry expanded state retained |
| Phase 12 gate worktree | Clean on independent storage-consolidation evidence branch |

Remote configuration observed through local Git:

```text
origin   https://github.com/daking32168-byte/worldmonitor.git
upstream https://github.com/koala73/worldmonitor.git
```

No remote was written by Phase 13.

## Ancestor Proof

The following read-only commands returned exit code `0`:

```text
git merge-base --is-ancestor c730fc6... integration/pokieticker-maritime-china-factory
git merge-base --is-ancestor c730fc6... integration/project-storage-consolidation-20260814
git merge-base --is-ancestor integration/pokieticker-maritime-china-factory integration/project-storage-consolidation-20260814
```

The accepted functional head is therefore an ancestor of the Phase 13 parent.
The two commits from `c730fc6...` to `cc5d8bfd...` change only the seven existing
integration ledgers and add the Phase 12 run-8 log.

## Isolated Branch and Worktree

Phase 13 created:

```text
branch:   integration/global-intelligence-v2
worktree: D:\使用AI专属文件夹\global-intelligence-earth\worldmonitor-global-intelligence-v2
base:     cc5d8bfd81a8320f0940dee91e39572b13a47c2e
```

Immediately after checkout, branch and HEAD matched the requested values and
`git status --porcelain=v1 --untracked-files=all` returned zero entries. No
existing worktree was switched, cleaned, reset, moved, or overwritten.

## Specification Receipt

The controlling specification was copied byte-for-byte to:

`docs/integration/GLOBAL_INTELLIGENCE_V2_CODEX_EXECUTION_PLAN_2026-08-14.md`

Source and destination both measured 71,181 bytes with SHA-256:

```text
975F72D8BA5CA18ACAD8A8BF1F4B68679B67E9B30A44EE573C8BE82D796FB961
```

## Architecture Deliverables

- `docs/integration/GLOBAL_INTELLIGENCE_V2_ARCHITECTURE.md`
- `docs/integration/PHASE13_REUSABLE_COMPONENT_INVENTORY.md`
- `docs/integration/adr/README.md`
- `docs/integration/adr/0041-domain-boundaries.md`
- `docs/integration/adr/0042-evidence-model.md`
- `docs/integration/adr/0043-stable-entity-ids.md`
- `docs/integration/adr/0044-provider-licensing.md`
- `docs/integration/adr/0045-storage-strategy.md`

## Truth and Product Effect

Phase 13 adds architecture and evidence documentation plus narrowly scoped
repairs to repository audit tooling and focused tests. The repairs make source
inventory, Markdown frontmatter, and generated-text comparisons stable across
LF and CRLF checkouts. They do not add a Provider, account, credential,
entitlement, live observation, data import, database, schema migration, route,
product component, deployment, release, or model output. They do not
reclassify any prior market, AIS, news, trade, factory, or prediction state.

## Verification Receipt

Final verification ran on 2026-08-15 (Asia/Shanghai) with the bundled Node.js
v24.19.0 runtime. The clean worktree bootstrap hooks and environment guard ran
with `--skip-env --skip-install`; the dependency tree was exposed through the
existing ignored local `node_modules` junction because this bundled runtime did
not include npm. No dependency installation or lockfile-equivalence claim is
made by this receipt.

| Command or guard | Result |
|---|---|
| `node --test tests/source-attribution.test.mjs` | PASS — 10 passed, 0 failed |
| `node --test tests/blog-seo-contract.test.mjs` | PASS — 6 passed, 0 failed |
| `node scripts/source-attribution.mjs --check` | PASS — 533 active hosts |
| `node scripts/docs-stats.mjs --check` | PASS — 150 documented claims match code |
| `node --import tsx scripts/generate-public-product-facts.mjs --check` | PASS — generated product facts are current |
| `markdownlint-cli2` with the repository `lint:md` globs | PASS — exit code 0 |
| `git diff --check` | PASS — exit code 0 |
| Phase 13 changed-path allowlist | PASS — 23 changed paths, 23 allowed, 0 outside scope |

The audit-tool changes repair three pre-existing Windows checkout failures:

- explicitly excluded source hosts remain observed even when a URL is not next
  to a fetch-shaped hint;
- generated source sections and blog frontmatter accept LF and CRLF; and
- product-fact generation compares normalized text instead of treating normal
  `core.autocrlf=true` checkouts as 38 stale files.

No generated product-fact artifact was rewritten. Final protected-ref checks
measured:

```text
Phase 13 branch parent:      cc5d8bfd81a8320f0940dee91e39572b13a47c2e
Phase 13 implementation:    f026caedefb71f60034bcb169b92dabf91edf5c3
main/origin-main:            0fca203c776dd5fa4913c4bd52f99cd2c3c13a25
original local/remote tip:   cc5d8bfd81a8320f0940dee91e39572b13a47c2e
c730fc6... ancestor exit:    0
plan SHA-256:                975F72D8BA5CA18ACAD8A8BF1F4B68679B67E9B30A44EE573C8BE82D796FB961
plan bytes:                  71181
```

The local work remains unpublished. No remote, Draft PR, deployment, Provider,
credential, database or retained user worktree was mutated.

The sole repository-metadata change is a path-specific `-whitespace` attribute
for the immutable controlling-plan copy. This follows the repository's existing
immutable-patch precedent, allows cached `git diff --check` to pass, and leaves
the plan's required byte-for-byte hash unchanged.
