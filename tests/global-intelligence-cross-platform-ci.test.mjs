import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const testWorkflow = readFileSync(new URL('../.github/workflows/test.yml', import.meta.url), 'utf8');
const releaseWorkflow = readFileSync(new URL('../.github/workflows/build-desktop.yml', import.meta.url), 'utf8');

function jobBlock(workflow, jobName, nextJobName) {
  const start = workflow.indexOf(`  ${jobName}:`);
  const end = workflow.indexOf(`\n  ${nextJobName}:`, start + 1);
  assert.notEqual(start, -1, `${jobName} job must exist`);
  assert.notEqual(end, -1, `${jobName} job must terminate before ${nextJobName}`);
  return workflow.slice(start, end);
}

test('macOS compatibility is a read-only native Apple Silicon PR gate', () => {
  const block = jobBlock(testWorkflow, 'macos-compat', 'consumer-prices');

  assert.match(block, /runs-on: macos-14/);
  assert.match(block, /permissions:\s+contents: read/);
  assert.match(block, /npm ci/);
  assert.match(block, /NODE_TARGET: aarch64-apple-darwin/);
  assert.match(block, /bash scripts\/download-node\.sh --target "\$NODE_TARGET"/);
  assert.match(block, /desktop:tauri:build -- --no-bundle --target aarch64-apple-darwin/);
  assert.match(block, /run: npm run test:data/);
  assert.doesNotMatch(block, /WM_EXPECT_BUILT_OUTPUT/);
  assert.match(block, /git diff --exit-code/);
  assert.doesNotMatch(block, /secrets\./);
  assert.doesNotMatch(block, /upload-artifact|tauri-action|contents: write|gh release|softprops\/action-gh-release/);
});

test('macOS compatibility actions are immutable commit pins', () => {
  const block = jobBlock(testWorkflow, 'macos-compat', 'consumer-prices');
  const actionRefs = [...block.matchAll(/uses:\s+[^@\s]+@([^\s]+)/g)].map((match) => match[1]);

  assert.ok(actionRefs.length >= 4);
  for (const ref of actionRefs) {
    assert.match(ref, /^[0-9a-f]{40}$/, `action ref must be a full commit SHA: ${ref}`);
  }
});

test('release matrix builds Intel macOS on an explicit native Intel runner', () => {
  assert.match(
    releaseWorkflow,
    /platform: 'macos-15-intel'[\s\S]*?args: '--target x86_64-apple-darwin'[\s\S]*?label: 'macOS-x64'/,
  );
  assert.doesNotMatch(releaseWorkflow, /platform: 'macos-latest'/);
});
