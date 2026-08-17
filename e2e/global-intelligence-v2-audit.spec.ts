import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const EVIDENCE_DIR = process.env.AUDIT_EVIDENCE_DIR;

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  if (!EVIDENCE_DIR) return;
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({
    path: join(EVIDENCE_DIR, `${testInfo.project.name}-${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth
      && document.body.scrollWidth <= window.innerWidth,
  )).toBe(true);
}

async function gotoOwned(page: Page, path: string, heading: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await expect(page.locator('.owned-route-error')).toHaveCount(0);
}

test.describe('Global Intelligence V2 independent formal-UI acceptance', () => {
  test('scenarios 1-3: source-bound industry queries remain honest and drillable', async ({ page }, testInfo) => {
    await gotoOwned(page, '/industry-map?q=%E5%A5%B3%E9%9E%8B', '全球产业情报地图');
    const shoeResult = page.locator('.industry-map__result', { hasText: '广东惠州惠东县女鞋产业集群' });
    await expect(shoeResult).toContainText('来源可核验 · 许可待审');
    await shoeResult.click();
    await expect(page.getByRole('heading', { level: 2, name: '广东惠州惠东县女鞋产业集群' })).toBeVisible();
    await expect(page.locator('body')).toContainText('HS 2012 · HS64');
    await expect(page.locator('body')).toContainText('当前没有地点级贸易观测');
    await expect(page.locator('body')).toContainText('覆盖率');
    await expect(page.locator('body')).toContainText('相关事件、证券与 AI 推演');
    await expect(page.locator('.industry-map__ai-card')).toContainText('INSUFFICIENT_DATA');
    await expect(page.locator('.industry-map__ai-card')).toContainText('AI/模型推演不是事实');
    await capture(page, testInfo, 'scenario-01-womens-footwear');

    await page.goto('/industry-map?q=%E4%B8%9C%E8%8E%9E');
    const city = page.locator('.industry-map__review-result', { hasText: '东莞（市级产业画像）' });
    const dalang = page.locator('.industry-map__review-result').filter({
      has: page.getByText('中国 · 广东 · 东莞 · 大朗镇（巷头社区案例）', { exact: true }),
    });
    await expect(city).toBeVisible();
    await expect(dalang).toBeVisible();
    await city.locator('summary').click();
    await dalang.locator('summary').click();
    await expect(city).toContainText('层级 CITY');
    await expect(city).toContainText('新一代电子信息');
    await expect(city).toContainText('不是企业/工厂覆盖率');
    await expect(city).toContainText('企业 0 · 工厂 0 · 证券 0');
    await expect(dalang).toContainText('层级 TOWN');
    await expect(dalang).toContainText('研发、生产、展贸、电商物流');
    await expect(dalang).toContainText('不代表东莞全部镇街');
    await expect(city.getByRole('link')).toHaveAttribute('href', /^https:\/\/www\.dg\.gov\.cn\//);
    await capture(page, testInfo, 'scenario-02-dongguan-city-and-town');

    for (const [query, location, company, facility] of [
      ['荷兰光刻设备', '荷兰 · Veldhoven', 'ASML Holding N.V.', 'ASML Veldhoven manufacturing hub'],
      ['德国汽车', '德国 · 慕尼黑', 'BMW AG', 'BMW Group Plant Munich'],
    ] as const) {
      await page.goto(`/industry-map?q=${encodeURIComponent(query)}`);
      const review = page.locator('.industry-map__review-result', { hasText: location });
      await expect(review).toBeVisible();
      await review.locator('summary').click();
      await expect(review).toContainText(company);
      await expect(review).toContainText(facility);
      await expect(review).toContainText('SOURCE_REQUIRED');
      await expect(review).toContainText('仅列审查候选，不自动准入');
    }
    await capture(page, testInfo, 'scenario-03-global-industry-review');
  });

  test('scenarios 4-5: licensed test Providers reach event, trend, prediction and impact UIs', async ({ page }, testInfo) => {
    await gotoOwned(page, '/trends', '跨平台热度与爆发');
    const seeded = await page.evaluate(async () => {
      const { globalContentRepository } = await import('/src/services/global-content-repository.ts');
      const { predictionRepository } = await import('/src/services/prediction-repository.ts');
      const { impactGraphRepository } = await import('/src/services/impact-graph-repository.ts');
      const { createStableEntityId } = await import('/shared/global-intelligence-contract.ts');

      const cutoff = '2026-08-15T03:00:00Z';
      const factSource = createStableEntityId('source', 'e2e-port-authority');
      const modelSource = createStableEntityId('source', 'e2e-route-model');
      const companyId = createStableEntityId('company', 'e2e-port-operator');
      const geoId = createStableEntityId('geo', 'e2e-port-city');
      const portId = createStableEntityId('node', 'e2e-port');
      const clusterId = createStableEntityId('cluster', 'e2e-nearby-industry');
      const productId = createStableEntityId('product', 'e2e-industrial-parts');
      const securityId = createStableEntityId('security', 'e2e-xnas-port');
      const routeId = createStableEntityId('route', 'e2e-alternative-route');

      const records = [
        { id: 'x-first', platform: 'X', published: '2026-08-15T02:05:00Z', authority: 'SOCIAL', engagement: 120 },
        { id: 'news-confirm', platform: 'NEWS', published: '2026-08-15T02:15:00Z', authority: 'OFFICIAL', engagement: 80 },
        { id: 'bili-follow', platform: 'BILIBILI', published: '2026-08-15T02:25:00Z', authority: 'SOCIAL', engagement: 200 },
      ];
      const itemIds: string[] = [];
      for (const record of records) {
        const provider = {
          provider_id: `licensed-e2e-${record.platform.toLowerCase()}`,
          platform: record.platform,
          status: 'READY',
          policy: {
            license_status: 'VERIFIED', permits_ingest: true, permits_display: true,
            permits_export: false, requests_per_minute: 30, max_retries: 0, retry_base_ms: 1,
          },
          async fetch() {
            return {
              records: [{
                platform_item_id: record.id,
                canonical_url: `https://official.example.test/port/${record.id}?utm_source=e2e`,
                author_id: `author-${record.id}`,
                author_handle: null,
                published_at: record.published,
                title: '港口航道异常已观测',
                body: `港口航道异常与附近产业供应链观测 ${record.id}`,
                language_hint: 'zh-CN',
                source_authority: record.authority,
                author_audience_size: 10_000,
                engagement_count: record.engagement,
              }],
              next_cursor: null,
              rate_limit_remaining: 29,
            };
          },
        };
        const ingest = await globalContentRepository.ingestProvider(
          provider as never,
          { cursor: null, limit: 10, transport: 'LICENSED_FILE', now: cutoff, server_credential_present: false },
          { window_started_at: '2026-08-15T02:59:00Z', requests_in_window: 0 },
          { entities: { 产业: companyId }, locations: { 港口: geoId } },
        );
        itemIds.push(...ingest.insertedItemIds);
      }
      const event = (await globalContentRepository.createEvent(itemIds as never)).event;
      await globalContentRepository.computeTrend(event.event_id, cutoff);

      const trendFeatureValues: Record<string, number> = {
        heat_score: 78, velocity_per_hour: 14, acceleration_ratio: 1.2,
        platform_diversity: 3, official_confirmation: 1, audience_concentration: 0.25,
      };
      for (const horizon of [60, 360, 1440] as const) {
        await predictionRepository.create({
          target_kind: 'TREND_BURST', target_id: event.event_id, horizon_minutes: horizon,
          data_cutoff_at: cutoff, generated_at: '2026-08-15T03:01:00Z',
          historical_sample_count: 40, distinct_source_count: 3,
          features: Object.entries(trendFeatureValues).map(([feature_id, value], index) => ({
            feature_id, value, observed_at: cutoff,
            source_evidence_ids: [index % 2 === 0 ? factSource : modelSource],
          })),
        });
      }
      const logisticsFeatureValues: Record<string, number> = {
        event_heat: 78, route_overlap: 0.8, observed_disruption: 0.9, corroboration: 0.75, uncertainty: 0.3,
      };
      await predictionRepository.create({
        target_kind: 'LOGISTICS_DISRUPTION', target_id: routeId, horizon_minutes: 60,
        data_cutoff_at: cutoff, generated_at: '2026-08-15T03:01:00Z',
        historical_sample_count: 40, distinct_source_count: 2,
        features: Object.entries(logisticsFeatureValues).map(([feature_id, value], index) => ({
          feature_id, value, observed_at: cutoff,
          source_evidence_ids: [index % 2 === 0 ? factSource : modelSource],
        })),
      });

      const factEvidence = {
        sourceId: factSource, providerId: 'licensed-e2e-port-authority', sourceType: 'OFFICIAL_PORT_ALERT',
        sourceTitle: 'Official E2E port alert', sourceUrl: 'https://official.example.test/port/alert',
        sourceReference: 'e2e-alert-001', sourcePublishedAt: '2026-08-15T02:10:00Z',
        observedAt: '2026-08-15T02:10:00Z', retrievedAt: cutoff, validFrom: '2026-08-15T02:10:00Z',
        validTo: null, periodStart: null, periodEnd: null, evidenceClass: 'OFFICIAL_REGISTRY',
        aggregationLevel: 'CITY', licenseStatus: 'VERIFIED', freshnessStatus: 'CURRENT', qualityStatus: 'VERIFIED',
        confidence: 1, methodologyVersion: 'official-alert/v1',
        nullReasons: {
          validTo: { code: 'NOT_PROVIDED', explanation: 'Open official alert.' },
          periodStart: { code: 'NOT_APPLICABLE', explanation: 'Not a period aggregate.' },
          periodEnd: { code: 'NOT_APPLICABLE', explanation: 'Not a period aggregate.' },
        },
      };
      const modelEvidence = {
        ...factEvidence,
        sourceId: modelSource, providerId: 'local-e2e-route-model', sourceType: 'LOCAL_MODEL',
        sourceTitle: 'E2E alternative route model', sourceUrl: null, sourceReference: 'route-model/v1',
        sourcePublishedAt: null, observedAt: null, validFrom: cutoff,
        evidenceClass: 'MODELLED_IMPACT', aggregationLevel: 'GLOBAL', freshnessStatus: 'NOT_APPLICABLE',
        qualityStatus: 'MODELLED', confidence: 0.62, methodologyVersion: 'route-model/v1',
        nullReasons: {
          sourceUrl: { code: 'NOT_APPLICABLE', explanation: 'Local model output.' },
          sourcePublishedAt: { code: 'NOT_APPLICABLE', explanation: 'Local model output.' },
          observedAt: { code: 'NOT_APPLICABLE', explanation: 'Not an observation.' },
          validTo: { code: 'NOT_PROVIDED', explanation: 'Open model horizon.' },
          periodStart: { code: 'NOT_APPLICABLE', explanation: 'Not a period aggregate.' },
          periodEnd: { code: 'NOT_APPLICABLE', explanation: 'Not a period aggregate.' },
        },
      };
      const nodes = [
        { node_id: event.event_id, node_type: 'EVENT', label: '港口航道异常已观测', detail_path: `/impact-graph/${event.event_id}` },
        { node_id: portId, node_type: 'LOGISTICS_NODE', label: '受影响港口节点', detail_path: '/maritime-logistics' },
        { node_id: clusterId, node_type: 'INDUSTRY_CLUSTER', label: '附近产业集群', detail_path: '/industry-map' },
        { node_id: productId, node_type: 'PRODUCT', label: '工业零部件', detail_path: '/trade-flows' },
        { node_id: companyId, node_type: 'COMPANY', label: '相关运营企业', detail_path: '/industry-map?mode=companies' },
        { node_id: securityId, node_type: 'SECURITY', label: 'E2E / XNAS', detail_path: '/global-markets' },
        { node_id: routeId, node_type: 'LOGISTICS_ROUTE', label: '模型替代路线', detail_path: '/trade-flows' },
      ];
      const factEdge = (id: string, from_id: string, to_id: string, relationship_type: string) => ({
        edge_id: `edge_${id}`, from_id, to_id, relationship_type,
        evidence_class: 'OFFICIAL_REGISTRY', source_evidence_ids: [factSource], confidence: 0.95,
        valid_from: cutoff, valid_to: null, methodology_version: 'fact-link/v1',
      });
      const modelEdge = (id: string, from_id: string, to_id: string, relationship_type: string, evidence_class = 'MODELLED_IMPACT') => ({
        edge_id: `edge_${id}`, from_id, to_id, relationship_type,
        evidence_class, source_evidence_ids: [modelSource], confidence: 0.62,
        valid_from: cutoff, valid_to: null, methodology_version: 'route-model/v1',
      });
      await impactGraphRepository.commit(nodes as never, [
        factEdge('event_port', event.event_id, portId, 'LOCATED_IN'),
        modelEdge('port_cluster', portId, clusterId, 'POTENTIALLY_IMPACTS'),
        factEdge('cluster_product', clusterId, productId, 'PRODUCES'),
        factEdge('product_company', productId, companyId, 'SUPPLIES'),
        factEdge('company_security', companyId, securityId, 'LISTED_AS'),
        modelEdge('port_route', portId, routeId, 'MODELLED_ROUTE_TO', 'MODELLED_ROUTE'),
      ] as never, [factEvidence, modelEvidence] as never);
      return { eventId: event.event_id, routeId };
    });

    await page.reload();
    await expect(page.locator('body')).toContainText('已验证生产快照');
    await page.getByRole('link', { name: seeded.eventId }).click();
    await expect(page.locator('body')).toContainText('跨平台最早观测路径');
    await expect(page.locator('body')).toContainText('X → NEWS');
    await expect(page.locator('body')).toContainText('NEWS → BILIBILI');
    await expect(page.locator('body')).toContainText('不证明转发或因果关系');
    await capture(page, testInfo, 'scenario-04-cross-platform-trend');

    await page.goto('/predictions');
    await expect(page.locator('.predictions__card')).toHaveCount(4);
    await expect(page.locator('body')).toContainText('未来 60 分钟估计概率');
    await expect(page.locator('body')).toContainText('未来 360 分钟估计概率');
    await expect(page.locator('body')).toContainText('未来 1440 分钟估计概率');
    await expect(page.locator('body')).toContainText('LOGISTICS_DISRUPTION');

    await page.goto(`/impact/${encodeURIComponent(seeded.eventId)}`);
    await expect(page.locator('body')).toContainText('受影响港口节点');
    await expect(page.locator('body')).toContainText('附近产业集群');
    await expect(page.locator('body')).toContainText('工业零部件');
    await expect(page.locator('body')).toContainText('E2E / XNAS');
    await expect(page.locator('body')).toContainText('模型替代路线');
    const modelRoute = page.locator('[data-kind="MODELLED"]', { hasText: 'MODELLED_ROUTE_TO' });
    await expect(modelRoute).toContainText('不是已证明因果');
    await capture(page, testInfo, 'scenario-05-port-impact-and-model-route');
  });

  test('scenario 6: closed and offline market keeps the last quote non-realtime', async ({ page }, testInfo) => {
    await gotoOwned(page, '/global-markets', '全球交易所与证券市场');
    await page.evaluate(async () => {
      const { initGlobalMarketsWorkspace } = await import('/src/features/global-markets/global-markets.ts');
      const { createStableEntityId } = await import('/shared/global-intelligence-contract.ts');
      const { marketSessionAt } = await import('/shared/global-markets.ts');
      const source = createStableEntityId('source', 'e2e-market-calendar');
      const company = createStableEntityId('company', 'e2e-market-issuer');
      const exchange = {
        exchange_id: createStableEntityId('exchange', 'xhkg'), mic: 'XHKG', canonical_name: 'Hong Kong Test Exchange',
        country_iso2: 'HK', timezone: 'Asia/Hong_Kong', currency: 'HKD', regular_weekdays: [1, 2, 3, 4, 5],
        phases: [{ status: 'OPEN', start_local: '09:30', end_local: '16:00' }], calendar_exceptions: [],
        calendar_version: 'licensed-e2e-2026.08', source_evidence_ids: [source], metadata_license_status: 'VERIFIED',
        coverage_level: 'LEVEL_4_DAILY_CLOSE',
      };
      const security = {
        security_id: createStableEntityId('security', 'xhkg-e2e'), issuer_company_id: company,
        instrument_type: 'COMMON_STOCK', local_ticker: 'E2E', mic: 'XHKG', isin: null,
        currency: 'HKD', primary_listing: true, provider_instrument_ids: { 'licensed-e2e-market': 'XHKG:E2E' },
        source_evidence_ids: [source],
      };
      const quote = {
        security_id: security.security_id, mic: 'XHKG', provider_id: 'licensed-e2e-market',
        provider_instrument_id: 'XHKG:E2E', price: 88.5, currency: 'HKD',
        observed_at: '2026-08-14T08:10:00Z', received_at: '2026-08-14T08:10:02Z',
        quote_status: 'DAILY_CLOSE', delay_minutes: null, license_status: 'VERIFIED', source_evidence_ids: [source],
      };
      const session = marketSessionAt(exchange as never, '2026-08-16T02:00:00Z');
      initGlobalMarketsWorkspace('app', {
        observations: [{ exchange, security, session, quote, network_status: 'OFFLINE', related_industry_event: '经证据关联的产业事件' }] as never,
      });
    });
    const card = page.locator('[data-session-status="CLOSED"][data-network-status="OFFLINE"]');
    await expect(card).toContainText('交易所当地');
    await expect(card).toContainText('网络离线');
    await expect(card).toContainText('最后有效报价 88.5 HKD');
    await expect(card).toContainText('不是当前实时价格');
    await expect(card).toContainText('当地交易日对齐');
    await expect(card).toContainText('不代表价格因果');
    await expect(card).toContainText('AI 推演数据截止');
    await capture(page, testInfo, 'scenario-06-market-closed-offline');
  });

  test('scenario 7: every owned page loads honestly without Providers at all target viewports', async ({ page }, testInfo) => {
    const routes = [
      ['/industry-map', '全球产业情报地图'],
      ['/trade-flows', '贸易流向与多式联运'],
      ['/trends', '跨平台热度与爆发'],
      ['/global-markets', '全球交易所与证券市场'],
      ['/predictions', 'AI 推演、到期评估与历史表现'],
      ['/impact-graph', '统一影响图谱'],
      ['/intelligence-center', '个人情报中心'],
      ['/provider-operations', 'Provider 统一控制中心'],
      ['/manual-action-center', '人工操作中心'],
    ] as const;
    for (const viewport of [
      { width: 1440, height: 900, name: '1440x900' },
      { width: 1280, height: 720, name: '1280x720' },
      { width: 390, height: 844, name: '390x844' },
    ]) {
      await page.setViewportSize(viewport);
      for (const [path, heading] of routes) {
        await gotoOwned(page, path, heading);
        await expectNoHorizontalOverflow(page);
      }
      await page.goto('/industry-map');
      await capture(page, testInfo, `scenario-07-no-provider-${viewport.name}`);
    }

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/industry-map');
    const results = page.locator('.industry-map__results');
    await expect.poll(() => results.evaluate((node) => ({
      overflowY: getComputedStyle(node).overflowY,
      scrollable: node.scrollHeight > node.clientHeight,
    }))).toEqual({ overflowY: 'auto', scrollable: true });
    await page.getByRole('button', { name: '企业与工厂' }).click();
    await expect(page.getByRole('heading', { level: 2, name: '经审核企业与生产基地' })).toBeVisible();

    await page.goto('/trade-flows');
    await expect(page.locator('body')).toContainText('Provider 未配置；尚无可展示观测');
    await expect(page.locator('body')).toContainText('空状态不代表贸易量为零');
    await page.goto('/trends');
    await expect(page.locator('body')).toContainText('新闻、X 与 B站 Provider 均未配置');
    await page.goto('/global-markets');
    await expect(page.locator('body')).toContainText('生产行情未配置');
    await page.goto('/predictions');
    await expect(page.locator('body')).toContainText('当前没有生产推演');
    await page.goto('/impact-graph');
    await expect(page.locator('body')).toContainText('不会用测试夹具或模型结果填充生产图谱');
    await page.goto('/provider-operations');
    await expect(page.locator('[data-data-status="OBSERVED"], [data-data-status="REALTIME_VERIFIED"]')).toHaveCount(0);
    await expect(page.locator('[data-data-status="UNAVAILABLE"]')).not.toHaveCount(0);
    await expect(page.locator('body')).toContainText('服务器端状态不可观测');
    await expect(page.locator('body')).toContainText('不读取、显示、散列或传递任何密钥');
  });

  test('scenario 8: no-secret local Provider import dry-runs, commits, verifies and rolls back in the UI', async ({ page }, testInfo) => {
    await gotoOwned(page, '/manual-action-center', '人工操作中心');
    const headers = 'geo_id,parent_geo_id,level,country_iso2,country_iso3,subdivision_code,local_name,zh_name,en_name,alternate_names,centroid_lat,centroid_lon,boundary_ref,boundary_review_status,timezone_ids,source_id';
    const csv = `${headers}\ngeo_e2e-audit-city,,CITY,ZZ,ZZZ,,E2E Audit City,审核测试城市,E2E Audit City,,0,0,,SOURCE_REQUIRED,UTC,\n`;
    await page.locator('#import-file').setInputFiles({
      name: 'e2e-audit-geo.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8'),
    });
    await page.locator('#import-publisher').fill('Independent Audit Local Provider');
    await page.locator('#import-source-title').fill('No-secret E2E source');
    await page.locator('#import-source-reference').fill('audit-e2e-v1');
    await page.locator('#import-license-reference').fill('Local test data created for this audit; display permitted');
    await page.getByRole('button', { name: '运行 Dry run' }).click();
    await expect(page.getByRole('status')).toContainText('Dry run 通过');
    await expect(page.getByRole('status')).toContainText('未发现覆盖冲突');
    const commit = page.getByRole('button', { name: '提交并自动验证' });
    await expect(commit).toBeEnabled();
    await commit.click();
    await expect(page.getByRole('status')).toContainText('提交并自动验证成功');
    await expect(page.locator('.manual-center__metric', { hasText: 'Revision' }).locator('strong')).toHaveText('1');
    await expect(page.locator('.manual-center__metric', { hasText: '事实记录' }).locator('strong')).toHaveText('1');
    await expect(page.locator('body')).toContainText('不接受密钥、密码、Cookie、Token、私钥或验证码');
    await capture(page, testInfo, 'scenario-08-manual-import-verified');

    await page.getByRole('button', { name: '回滚最近一次导入' }).click();
    await expect(page.getByRole('status')).toContainText('已回滚 revision 1；当前 revision 0');
    await expect(page.locator('.manual-center__metric', { hasText: 'Revision' }).locator('strong')).toHaveText('0');
  });
});
