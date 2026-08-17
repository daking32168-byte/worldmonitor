import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  MANUAL_ACTION_CENTER_PATH,
  isManualActionCenterPath,
  manualActionCenterUrl,
} from '../src/features/manual-action-center/manual-action-center-route.ts';
import {
  GLOBAL_INTELLIGENCE_IMPORT_DATASETS,
  GLOBAL_INTELLIGENCE_IMPORT_HEADERS,
} from '../shared/global-intelligence-import.ts';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Global Intelligence navigation and manual action center', () => {
  it('makes every current Global Intelligence workspace discoverable from global command search', () => {
    const expectedPaths = {
      'industry-map': '/industry-map',
      'trade-flows': '/trade-flows',
      trends: '/trends',
      'provider-operations': '/provider-operations',
      'manual-action-center': '/manual-action-center',
      'global-markets': '/global-markets',
      'predictions': '/predictions',
      'impact-graph': '/impact-graph',
      'intelligence-center': '/intelligence-center',
    } as const;
    const commands = read('src/config/commands.ts');
    for (const [id, path] of Object.entries(expectedPaths)) {
      assert.match(commands, new RegExp(`['"]${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]:\\s*['"]${path.replaceAll('/', '\\/')}['"]`));
      assert.match(commands, new RegExp(`id:\\s*['"]workspace:${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"][^\n]+category:\\s*['"]navigate['"]`));
    }
    assert.match(read('src/app/search-manager.ts'), /case 'workspace'/);
    assert.match(read('src/app/search-manager.ts'), /window\.location\.assign\(path\)/);
  });

  it('owns the manual action route and renders load failures visibly', () => {
    assert.equal(MANUAL_ACTION_CENTER_PATH, '/manual-action-center');
    assert.equal(manualActionCenterUrl(), '/manual-action-center');
    assert.equal(isManualActionCenterPath('/manual-action-center'), true);
    assert.equal(isManualActionCenterPath('/manual-action-center/'), true);
    assert.equal(isManualActionCenterPath('/manual-action-center/secret'), false);
    const main = read('src/main.ts');
    assert.match(main, /isManualActionCenterPath/);
    assert.match(main, /renderOwnedRouteError/);
    assert.match(main, /人工操作中心/);
  });

  it('uses a system file picker, dry-run gate, automatic commit verification and no secret fields', () => {
    const ui = read('src/features/manual-action-center/manual-action-center.ts');
    assert.match(ui, /textInput\('import-file', '', 'file'\)/);
    assert.match(ui, /\.dryRun\(submission\)/);
    assert.match(ui, /lastDryRunSha !== fileSha256/);
    assert.match(ui, /await globalIntelligenceLocalRepository\.load\(\)/);
    assert.match(ui, /回滚最近一次导入/);
    assert.doesNotMatch(ui, /textInput\([^\n]*(?:password|api[_-]?key|private[_-]?key|cookie|token)/i);
  });

  it('keeps checked-in templates in lockstep with the validated schemas', () => {
    for (const dataset of GLOBAL_INTELLIGENCE_IMPORT_DATASETS) {
      const template = read(`docs/integration/templates/${dataset}.csv`).trim();
      assert.equal(template, GLOBAL_INTELLIGENCE_IMPORT_HEADERS[dataset].join(','));
    }
  });
});
