# Phase 14 Cross-Platform Environment Evidence

**Date:** 2026-08-15 (Asia/Shanghai)
**Status:** COMPLETE — RUN 12 UBUNTU AND NATIVE MACOS PASS

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

## Remote Closure Receipt

The user explicitly authorized the connected GitHub application. Draft PR #2
targets `integration/pokieticker-maritime-china-factory`; PR #1 and `main`
remain unchanged. Two normal HTTPS push attempts for the final workflow fix
failed through transient reset/443 transport errors, so the GitHub application
created the two exact blobs and a tree based on the current remote parent. Blob
SHAs and tree `b0dd7232a22813789036ef21e3c6322de69145b5` matched local Git exactly.
The application created single-parent commit
`a23d9af9a84f78aae43ffd1462619da42e8adffb` and advanced
`integration/global-intelligence-v2` with `force=false`. A subsequent fetch
verified the remote parent, tree, subject and zero content diff; the local and
remote branch refs are aligned.

GitHub Actions Run 12 at that head returned:

| Workflow/job | Receipt |
|---|---|
| Test / Ubuntu `unit` | PASS — 23,038 tests, 23,032 pass, 0 fail, 6 skip; 3,553 suites; 284,120.85 ms |
| Test / `macos-compat` data | PASS — 22,880 tests, 22,874 pass, 0 fail, 6 skip; 3,553 suites; 233,823.52 ms |
| Test / `macos-compat` native build | PASS — ARM64 release profile finished; checksum-verified Node sidecar prepared; generated inputs clean |
| Test workflow | PASS — run `31868040572`, all 14 jobs successful |
| Lint Code / Typecheck / Lint / Pro bundle freshness | PASS — Run 12 at the same head |

The compatibility job remained read-only and used no Apple signing or
notarization secret, uploaded no artifact, created no Release and performed no
deployment. Phase 14 is complete; this CI receipt authorizes Phase 15 work but
does not authorize merge or publication.
