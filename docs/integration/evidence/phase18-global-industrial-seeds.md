# Phase 18 China Factory Deepening and Global Seed Evidence

**Date:** 2026-08-15 (Asia/Shanghai)
**Status:** COMPLETE — LOCAL AND HOSTED CROSS-PLATFORM GATES PASS

## Delivered Scope

The Phase 18 registry uses one model for six requested case families across
China, the Netherlands and Germany. Every case records geography, products,
processes, company/facility/security candidates, evidence IDs, reviewed
dimensions, verification time, explicit gaps and HS/trade admission status.

The displayed coverage percentage is strictly the fraction of five finite
source-review dimensions completed (`GEOGRAPHY`, `PRODUCT`, `PROCESS`,
`COMPANY`, `FACILITY`). It is not a claim about market, company or factory
coverage. All cases retain `hs_trade_status = SOURCE_REQUIRED`.

## Reviewed Sources and Limits

| Case | Official sources | Admitted claim | Explicit limit |
|---|---|---|---|
| Wenzhou footwear | [Wenzhou 2025 government work report](https://wzstb.wenzhou.gov.cn/art/2025/2/13/art_1229499910_58903225.html) | City and footwear cluster | No process, company, factory, HS or export fact |
| Jingdezhen ceramics | [Jingdezhen 2024-2026 manufacturing-chain plan](https://jdz.gov.cn/zwgk/fdzdgknr/zcwj/zfwj/szfwj/t949845.shtml) | City, four ceramic product groups and stated development processes | No company, facility, product-level HS or trade fact |
| Dongguan town case | [Dalang Xiangtou official profile](https://www.dg.gov.cn/dalang/gk/xzqh/content/post_4382594.html) | Town/community knitwear concentration and production/trade/logistics model | One reviewed town case, not all Dongguan towns or firms |
| Shenzhen manufacturing | [Shenzhen BYD site-plan notice](https://pnr.sz.gov.cn/xxgk/gggs/content/post_11883946.html), [BYD 2024 annual report](https://www.hkexnews.hk/listedco/listconews/sehk/2025/0324/2025032401238.pdf), [HKEX 01211 circular](https://www.hkex.com.hk/-/media/HKEX-Market/Services/Circulars-and-Notices/Participant-and-Members-Circulars/SEHK/2023/ce_SEHK_CT_080_2023.pdf) | Named Pingshan production base, disclosed issuer and exchange ticker candidates | Operator subsidiary, listed issuer and security remain separate; registration/MIC/ownership edge is `SOURCE_REQUIRED` |
| Netherlands lithography | [ASML corporate identity](https://www.asml.com/en/terms-of-use), [ASML 2025 strategy/manufacturing report](https://www.asml.com/en/investors/annual-report/2025/strategy-and-stories) | ASML Holding N.V., KvK 17085815, Veldhoven lithography development/engineering/manufacturing hub | MIC listing, exact boundary, HS and trade remain unadmitted |
| German automotive | [BMW legal imprint](https://www.einvoicing.bmwgroup.com/en/impressum.html), [BMW Group Plant Munich](https://www.bmwgroup-werke.com/content/grpw/websites/bmwgroup-werke_com/muenchen/en.html) | BMW AG HRB 42243 and Munich automotive production site/processes | Security, exact boundary, HS and trade remain unadmitted |

No search result, map configuration, news report or model output was used as a
fact source. No numerical output, export quantity, capacity or complete-list
claim was added.

## Identity Boundary

The Shenzhen review deliberately does not insert any Phase 16 company,
facility or security fact. The government planning notice names
`比亚迪汽车工业有限公司` as the site operator, while the issuer filing and HKEX
circular name BYD Company Limited and 01211. This does not prove the required
registered identity, MIC-qualified security or ownership/operation edge across
those objects. They therefore remain separate candidates with named gaps.

ASML and BMW official materials support company and facility claims in the
review queue, but the queue is not the Phase 16 authoritative entity registry.
Promotion requires the relationship-edge review and exact field mapping in a
later controlled change.

## Acceptance Receipts

| Gate | Result |
|---|---|
| Six requested case families | PASS — Wenzhou, Jingdezhen, Dongguan/Dalang, Shenzhen/BYD, Netherlands/ASML and Germany/BMW |
| Same cross-country model | PASS — China, NL and DE records share one schema and validation path |
| Official evidence | PASS — 10 HTTPS government, exchange, filing or company-official evidence records |
| Source-required preservation | PASS — all six HS/trade states disabled; every unresolved candidate carries a named gap |
| Product to location | PASS — ceramic and lithography reverse lookups return their reviewed locations |
| Location to product | PASS — stable Geo ID lookup returns the same product set |
| Phase 16 isolation | PASS — authoritative company/facility/security arrays remain empty |
| Phase 18 focused contract | PASS — 7/7 |
| Combined Phase 14-18 regression | PASS — 54/54 |
| TypeScript and Biome | PASS — production typecheck and four changed-file checks |
| Strict local Vite secret scan | PASS |
| Production Vite build | PASS — 2,519 modules; 21.83 seconds |

## Browser Receipt

| Route / viewport | Result |
|---|---|
| `/industry-map?q=光刻`, 1440 x 900 | Width 1440/1440; exactly one Phase 18 Veldhoven result; five review dimensions and HS/trade gap visible |
| `/industry-map?q=BYD`, 390 x 844 | Width 390/390; horizontal overflow hidden and vertical overflow auto; Shenzhen candidate-separation warning visible; no “全部工厂” claim |

The local tab, Vite server and viewport override were cleaned after inspection.

## Hosted Closure Receipt

The implementation and receipt were committed and normally pushed. Run 16
passed Ubuntu and four other top-level workflows, but an unrelated native
macOS news-digest timeout timing test failed. No waiver was applied. Run 19 at
`8ddd9cc1...` passed all five workflows, Ubuntu 23,088/23,082/0/6 and native
macOS 22,930/22,924/0/6, plus the optimized unsigned Tauri build and clean-input
gate. This descendant contains Phase 18 and closes it. No production import,
Provider activation, merge, deployment, release, signing or notarization
occurred.
