# Phase 14 Cross-Platform Environment Evidence

**Date:** 2026-08-15 (Asia/Shanghai)
**Status:** LOCAL READY — REMOTE AUTHENTICATION AND EXECUTION PENDING

## Selected Environment

| Responsibility | Environment | Contract |
|---|---|---|
| Phase 14/15 data and production truth | GitHub-hosted Ubuntu 24.04, Node 24, lockfile `npm ci` | Existing PR `unit` job builds tracked output and runs `WM_EXPECT_BUILT_OUTPUT=1 npm run test:data`. |
| Apple Silicon desktop compatibility | GitHub-hosted `macos-14` ARM64 | Read-only PR job downloads the checksum-verified Node sidecar, performs unsigned Tauri `--no-bundle` compilation and runs the full data suite. |
| Intel macOS release compatibility | GitHub-hosted `macos-15-intel` | Existing release matrix retains the x86_64 package target on a native Intel runner. |
| Windows development | Current local host | Focused implementation feedback only; it is not used to waive Linux or macOS gates. |

WSL was rejected as the primary solution because it changes the developer host,
duplicates only Linux semantics and cannot prove native macOS/Tauri behavior.
The repository already has the correct Tauri 2 architecture and platform
package formats (`app`, `dmg`, `nsis`, `msi`, `appimage`).

## Security Boundary

- Workflow default and job permissions are read-only.
- Every external action in the new job is pinned to a full 40-character commit
  SHA.
- The compatibility job contains no `secrets.*` reference and imports no Apple
  certificate, password, keychain password or notarization credential.
- It uses `--no-bundle`, uploads no artifact and cannot create or mutate a
  GitHub Release.
- Signed `.app`/DMG creation and notarization remain separate release actions.
- The release workflow's x64 runner is an explicit native Intel label rather
  than the moving `macos-latest` label.

References used for the decision:

- <https://docs.github.com/en/actions/reference/runners/github-hosted-runners>
- <https://docs.github.com/en/actions/reference/security/secure-use>
- <https://v2.tauri.app/start/prerequisites/>
- <https://v2.tauri.app/distribute/>
- <https://v2.tauri.app/distribute/sign/macos/>

## Local Verification

| Gate | Result |
|---|---|
| Cross-platform workflow and one-binary contracts | PASS — 19 tests |
| Deploy-gate aggregation and immutable action pins | PASS — 3 focused tests |
| `test.yml`, `build-desktop.yml`, `deploy-gate.yml` YAML parsing | PASS — 3 files |
| New macOS job secret/write/release negative assertions | PASS |
| Checksum-verified macOS Node sidecar step present | PASS |

The broader workflow suites still reproduce documented native-Windows-only
failures when they spawn `awk`/`bash` or convert file URL pathnames into
`D:\\D:\\...`. Those are the exact environmental failures this hosted gate is
designed to adjudicate; they are not recorded as new workflow regressions.

## Remote Stop Condition

The installed GitHub CLI reports no authenticated host. The connected GitHub
application confirms repository access, but it is not used to reconstruct a
different remote commit graph through individual Git-database mutations.

No push, Draft PR, CI run, artifact, signature, Release or deployment has
occurred. Phase 14 stays blocked and Phase 15 stays unstarted until:

1. the owner authenticates locally with `gh auth login` without sharing a token
   in chat;
2. the branch is normally and non-forcibly pushed;
3. a stacked Draft PR targets
   `integration/pokieticker-maritime-china-factory` without modifying PR #1;
4. the Ubuntu full-data job exits zero; and
5. the macOS compatibility job returns its native build and data receipts.
