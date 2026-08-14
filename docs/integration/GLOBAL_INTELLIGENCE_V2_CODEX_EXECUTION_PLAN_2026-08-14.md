# 《全球实时热点追踪·探长版》后续建设总执行方案

**文档用途：** Codex 直接执行的工程方案与验收基线  
**版本：** V1.0  
**日期：** 2026-08-14  
**正式产品：** 全球实时热点追踪·探长版  
**正式母仓库：** `daking32168-byte/worldmonitor`  
**现有集成分支：** `integration/pokieticker-maritime-china-factory`  
**已验收功能头：** `c730fc6a2c4a6c390b305ce19cb04b1fa805c43e`  
**权威项目根目录：** `D:\使用AI专属文件夹\global-intelligence-earth`  
**方案性质：** 在现有 WorldMonitor 母体上增量建设，不重写、不另起第二套产品  

# 目录

| 第一部分 | 第二部分 |
|---|---|
| 文档控制与依据 | 14. 统一事件—产业—物流—市场影响图谱 |
| 0. Codex 执行总指令 | 15. 预警、自选和桌面通知 |
| 1. 当前项目事实基线 | 16. 数据采集、许可和更新频率 |
| 2. 终极产品定义 | 17. 分阶段执行计划 |
| 3. 范围、优先级和非目标 | 18. 依赖关系与并行执行 |
| 4. 总体技术架构 | 19. 测试与验收矩阵 |
| 5. 真实性、证据与数据状态 | 20. 关键端到端验收场景 |
| 6. 统一实体和关系模型 | 21. 数据导入模板 |
| 7. API、Provider 与后台任务 | 22. 固定 UI 警示文案 |
| 8. 产品信息架构与页面 | 23. 安全、隐私和合规 |
| 9. 全球产业与物流情报地图详细要求 | 24. 性能和可运维性要求 |
| 10. 新闻、X、B站与跨平台事件系统 | 25. Codex 阶段交付格式 |
| 11. 热度、上升速度与爆发检测 | 26. 最终交付清单 |
| 12. 全球股票与交易所系统 | 27. 执行优先级总结 |
| 13. AI 推演系统 | 28. 最终执行判断 |

## 文档控制与依据

本方案必须与仓库内以下文件共同使用，冲突时按“已记录事实优先、较新验收记录优先、真实性边界优先”的顺序处理：

1. `MASTER_STATUS.md`
2. `ACCEPTANCE_EVIDENCE.md`
3. `DECISIONS.md`
4. `docs/integration/evidence/` 下各 Phase 证据文件
5. 本方案在仓库中的最终落盘版本

本方案中属于“当前已完成”的内容，来自上述状态和验收文件；属于“后续目标、数据模型、接口、阶段拆解”的内容，是本次审核后确定的新执行要求。不得把新要求反写成已经完成的事实。

---

# 0. Codex 执行总指令

## 0.1 总目标

在现有已验收母体上，继续建设一套统一的全球情报桌面系统，使其能够：

1. 发现全球新闻、突发事件与热度快速上升信号；
2. 汇聚新闻、X、B站及其他依法授权的国内外平台；
3. 展示全球证券市场及各交易所开盘、闭市、盘前、盘后、休市、停牌和数据延迟状态；
4. 建立全球产业地图，精确到国家、省州、城市、区县、镇、工业园、企业和工厂；
5. 展示产品从生产集群、工厂、集货节点到港口、机场、铁路、公路和目的市场的贸易物流流向；
6. 将事件、地点、产业、产品、企业、工厂、物流节点、路线和股票连接成统一影响图谱；
7. 输出明确标记为“AI推演”的小范围概率判断，并保留模型版本、数据截止时间、失效条件和历史评估结果。

## 0.2 必须遵守的执行方式

Codex 必须先检查仓库真实状态，再执行任何修改。不得仅依据本方案假设文件结构、脚本名称、数据库或现有接口位置。

执行顺序：

1. 阅读本方案及现有状态、验收、决策、来源和许可证文件；
2. 确认权威工作区、当前分支、HEAD、远端、工作树状态和 Draft PR 状态；
3. 确认 `c730fc6...` 是当前后续工作基线的祖先；
4. 从现有集成分支最新干净提交创建独立后续分支和 worktree；
5. 先做架构与数据契约，再做真实 Provider、UI 和模型；
6. 每个阶段独立实现、测试、记录证据、提交；
7. 所有阶段完成后才执行完整集成验收。

建议后续分支：

```text
integration/global-intelligence-v2
```

建议创建新的堆叠式 Draft PR，目标分支先设为：

```text
integration/pokieticker-maritime-china-factory
```

不得修改、覆盖或关闭现有 Draft PR #1；不得直接向 `main` 推送。待原 PR 合并后，是否重定向新 PR 必须由项目所有者决定。

## 0.3 不可突破的红线

以下规则是硬约束，不是建议：

- WorldMonitor 仍是唯一正式代码母体；不得创建第二套 React、Express、Electron 或独立仪表盘。
- 不得使用 iframe 嵌入上游页面，不得复制上游完整 UI。
- 不得覆盖、合并或删除旧简化项目、备份、验收记录和现有 worktree。
- 不得直接修改 `main`，不得 force push、reset hard、重写已验收提交历史。
- 未经 Provider 合同、许可和运行验证的数据不得标为“实时”。
- 没有数据时显示 `NOT_CONFIGURED`、`UNAVAILABLE`、`DELAYED_UNVERIFIED`、`未观测` 或等价明确状态，禁止生成样本数字冒充结果。
- 历史测试数据只能标为 `HISTORICAL_SNAPSHOT`，不得充当实时或延迟行情。
- AIS 只能表示船舶自报广播字段，不能证明货物、订单、始发工厂、买方、价值、提单或最终卸货地。
- 国家级或省级贸易统计不能自动下推为某个镇、工业园或工厂的实际出口。
- 相关性、时间相邻和模型判断不得写成已证明因果。
- 不得绕过验证码、盗用浏览器会话、复制 Cookie、要求用户在聊天中发送密钥、私钥、密码或 Token。
- 所有密钥必须留在服务端或受保护桌面配置中，浏览器只接收非敏感状态。
- 不得通过删除测试、降低断言、修改基准结果或隐藏失败来让 CI 变绿。
- 不得声明“全球所有工厂”“全球所有股票实时覆盖”等无法由数据证明的绝对覆盖。

## 0.4 缺少 Provider 时的处理

缺少外部 Provider、授权或数据文件时，不得停下整个阶段。应完成：

- 接口契约；
- Provider 适配器边界；
- 配置和许可状态；
- 输入验证；
- 无 Provider 的真实禁用状态；
- 测试夹具与自动化门禁；
- 运维中心任务定义；
- 后续人工配置说明。

只有“真实数据可视验收”可以保持待办，不能因此跳过架构、契约、UI 和测试。

## 0.5 每阶段完成定义

每个阶段必须同时具备：

- 代码实现；
- 数据迁移或可逆导入方案；
- 类型和 API 契约；
- 正向、负向和无 Provider 测试；
- 来源、许可证和真实性检查；
- UI 浏览器证据；
- 完整命令日志、退出码和失败记录；
- `MASTER_STATUS.md` 与 `ACCEPTANCE_EVIDENCE.md` 更新；
- 单一职责提交及不可变 SHA；
- 明确列出尚未完成的 Provider 实测、授权和数据覆盖。

---

# 1. 当前项目事实基线

## 1.1 已确认基线

当前项目已经完成 Phase 0–12 的代码和功能验收，已验收功能头为：

```text
c730fc6a2c4a6c390b305ce19cb04b1fa805c43e
```

该提交的 GitHub Run 8 六组工作流全部成功，数据测试为 23,022 项、0 失败。现有 PR 仍是 Draft、未合并、未部署、未发布、未启用真实 Provider。

后续建设必须保留以下已完成能力：

- 独立产品品牌和 AGPL-3.0 来源边界；
- Market v1 八个股票 RPC 契约；
- Massive 服务端 REST/WebSocket 中继与 SSE；
- `/stocks`、`/stocks/:symbol` 股票工作区；
- 新闻来源、交易日对齐、实际收益和非因果边界；
- `/maritime-logistics` 海运物流工作区；
- `/china-factory` 中国产业集群出口调查工作区；
- `/provider-operations` Provider 运维控制中心；
- 市场优先的主仪表盘布局；
- Tauri 2 Windows 桌面应用、Node sidecar 和本地安全边界；
- 跨平台 CI、类型、DOM、数据、sidecar、构建和来源检查。

## 1.2 当前功能的真实状态

| 模块 | 已有能力 | 尚未完成 |
|---|---|---|
| 股票 | 美国市场导向的接口、UI、服务端中继、美国交易日历、禁用状态 | 全球证券主数据、全球交易所日历、各国实时许可、真实 Provider 视觉验收 |
| 新闻 | 来源保留、UTC/交易所时间对齐、T0/T1/T3/T5/T10 字段 | 全球多语言事件聚类、社交平台、非美国交易所对齐、运行中的分析模型 |
| 海运 | AIS 边界、关键航道、PortWatch/警告/模型路线分层 | 真实 AIS/PortWatch Provider、货物流、提单、买方、工厂到目的地链条 |
| 中国工厂 | 22 条来源标记种子；惠东、莆田完成 HS64 审核映射 | 其他集群 HS 映射、真实贸易数据、镇级工厂和企业、全球产业地图 |
| 运维中心 | 九类任务契约、调度、锁、重试、禁用状态 | 实际执行器、队列指标、外部数据授权和运行验收 |
| AI | 预测、相似事件和分析接口位置已预留 | 可运行、版本化、可评估的第一方或外部模型 |

## 1.3 新需求与旧基线的关系

本方案不是推倒重来。新增系统必须扩展现有 Market、Maritime、SupplyChain、Shipping、Provider Operations、地图、桌面和 API 生成体系。

任何新页面都必须：

- 使用现有路由、样式、构建、认证和桌面壳；
- 复用现有地图和数据状态组件；
- 保持独立滚动和移动端无横向溢出；
- 继续通过现有来源、产品事实、API、DOM、sidecar、构建和安全门禁。

---

# 2. 终极产品定义

## 2.1 产品定位

“全球实时热点追踪·探长版”最终是一套统一的全球事件、社交热度、金融市场、制造产业和贸易物流桌面情报系统。

系统持续发现全球新闻和跨平台异常信号，将事件与国家、城市、专业镇、工业园、工厂、产品、物流节点、目的市场和上市公司关联，并在清楚区分事实、观测、聚合统计、模型估算和 AI 推演的前提下，输出热度爆发、供应链影响和资产影响的小范围概率判断。

## 2.2 五个核心业务系统

### A. 全球热点与突发雷达

- 全球事件时间线；
- 热度排名；
- 热度速度和加速度；
- 即将爆发、已爆发、回落状态；
- 多语言、多国家、多平台扩散；
- 官方确认、未确认、争议和谣言风险标记。

### B. 新闻与国内外社交平台

- 新闻；
- X；
- B站；
- 其他依法授权的海外和国内平台；
- 原始链接、作者、发布时间、观测时间和互动指标；
- 跨平台去重、聚类和传播路径。

### C. 全球金融市场

- 全球交易所和证券主数据；
- 股票、ETF、指数及后续可扩展资产；
- 实时、延迟、盘前、盘后、闭市、休市和停牌；
- 事件、新闻、产业、工厂与证券关联；
- 多币种和交易所本地时间。

### D. 全球产业与物流情报地图

- 世界各国、省州、城市、区县、镇、工业园的主力产业和产品；
- 企业、工厂、品牌、母子公司和上市主体；
- 中国“世界工厂”专业镇和产业集群；
- 荷兰光刻设备、德国汽车等全球代表性工业集群；
- 产品从产地到港口、机场、铁路、公路和目的市场的流向；
- 事件对产业、物流和股票的影响。

### E. AI 推演与预警

- 事件热度爆发概率；
- 事件发展场景；
- 供应链和物流风险；
- 股票方向概率和波动区间；
- 关键驱动、反向证据、失效条件；
- 模型历史命中率、校准误差和版本追踪。

## 2.3 统一用户任务

系统必须能够回答以下类型问题：

- “现在全球哪些事件热度上升最快？”
- “某条新闻是否已经从 X 扩散到 B站和主流媒体？”
- “某事件未来 6 小时可能突然爆发吗？”
- “惠东女鞋、温州鞋、莆田鞋分别生产什么，主要发往哪里？”
- “东莞某个镇主要有哪些工厂类型、代表企业和上市公司？”
- “荷兰哪些地区集中光刻设备产业？德国汽车产业主要分布在哪里？”
- “某个港口、海峡、地震或政策事件会影响哪些产品、企业、路线和股票？”
- “某只股票所在交易所现在是盘前、开盘、午休、盘后还是休市？”
- “AI 对未来 1 小时、1 天和 5 个交易日的方向概率如何判断？”

---

# 3. 范围、优先级和非目标

## 3.1 本轮建设范围

本轮包括：

- 统一证据和来源模型；
- 全球地理、产业、产品、企业、工厂和证券主数据；
- 全球产业地图与中国世界工厂深度页面；
- 贸易和多式联运流向；
- 新闻、X、B站等平台的可插拔 Provider 框架；
- 多语言事件聚类、热度和爆发检测；
- 全球交易所状态和全球证券覆盖框架；
- 第一方可运行 AI 推演基线；
- 事件—产业—物流—股票影响图谱；
- 桌面预警和自选监控；
- 完整自动化与 Provider-backed 分层验收。

## 3.2 不作为本轮完成声明的内容

以下不得在首个版本中虚称完成：

- 全世界每一家工厂的完整名单；
- 每一个国家所有证券的实时授权行情；
- 未取得许可的 X、B站或其他平台全量数据；
- 未签约提单数据情况下的真实买家、订单、集装箱和工厂级流向；
- 根据 AIS 自动判定船上货物；
- 确定性股票涨跌或投资收益承诺；
- 自动交易、下单或资金托管；
- 将 AI 推演标为事实；
- 将国家级贸易额归属于某个镇或工厂。

## 3.3 覆盖策略

产品界面使用“全球统一入口”，数据覆盖使用分层声明：

```text
REALTIME_VERIFIED       已验证实时
DELAYED_VERIFIED        已验证延迟
OBSERVED_PERIODIC       周期性观测
COMPANY_DISCLOSED       企业披露
MODELLED_ESTIMATE       模型估算
AI_SPECULATION          AI推演
SOURCE_REQUIRED         等待来源
NOT_CONFIGURED          未配置
UNAVAILABLE             不可用
```

所有列表、地图和搜索结果必须显示覆盖状态，禁止用界面完整性掩盖数据不完整。

---

# 4. 总体技术架构

## 4.1 架构原则

继续使用现有 WorldMonitor 单体前端、现有服务端/API、Tauri 2 桌面壳和本地 sidecar。新增能力通过领域模块、协议契约、Provider 适配器和统一实体图谱接入。

逻辑结构：

```text
数据源与授权层
├── 新闻 Provider
├── X / B站 / 其他平台 Provider
├── 全球行情 Provider
├── 交易所日历与证券主数据
├── 政府/官方产业集群
├── 企业公告、年报和工厂披露
├── Comtrade / 合法海关文件
├── 合法商业提单与装运数据
├── AIS / PortWatch / 官方航运警告
└── 地理边界与地点数据

接入与标准化层
├── Provider Adapter
├── License / Entitlement Gate
├── Schema Validator
├── Provenance Recorder
├── Deduplication
├── Entity Resolution
└── Freshness / Quality Calculator

领域数据层
├── Event / Source Item
├── Trend Series
├── Geo / Industry / Product
├── Company / Facility / Brand
├── Security / Exchange / Session
├── Trade / Shipment / Logistics
├── Knowledge Graph
└── Prediction / Evaluation

服务层
├── RPC / REST
├── SSE / WebSocket Relay
├── Scheduler / Queue
├── Cache
├── Search
├── Alert Engine
└── Model Runtime

产品层
├── 全球热点
├── 社交情报
├── 全球股票
├── 全球产业地图
├── 中国世界工厂
├── 贸易流向
├── 海运物流
├── 事件影响
├── AI推演
└── Provider运维中心
```

## 4.2 不允许的架构捷径

- 不建立独立“V2 前端”；
- 不用静态 JSON 代替生产数据库和 Provider；
- 不把测试 fixture 打包进生产路径；
- 不让浏览器直连需要私钥的 Provider；
- 不在多个模块复制相同实体；
- 不用公司名称、股票代码或地点名称作为唯一主键；
- 不用同一股票代码跨交易所合并；
- 不让模型直接修改事实记录；
- 不让模型输出覆盖原始来源或观测时间。

---

# 5. 真实性、证据与数据状态

## 5.1 新增统一证据分类

必须实现统一 `EvidenceClass`，至少包含：

```text
OFFICIAL_REGISTRY       政府、交易所或正式机构名录
OFFICIAL_CLUSTER        正式认定产业集群
COMPANY_DISCLOSED       企业官网、年报、公告或交易所披露
VERIFIED_COMPANY        经多个来源核验的企业主体
VERIFIED_FACILITY       经来源核验的工厂或生产基地
OBSERVED_MARKET         Provider 返回的市场观测
OBSERVED_TRADE          海关、Comtrade 等聚合贸易观测
CONTRACTED_SHIPMENT     合法签约提单或装运观测
PORT_OBSERVATION        港口或官方物流节点观测
AIS_OBSERVATION         船舶自报广播观测
OFFICIAL_WARNING        政府或正式机构警告
SOCIAL_SIGNAL           社交平台信号，未自动等同事实
MODELLED_ROUTE          模型路线
MODELLED_FLOW           模型货物流向
MODELLED_IMPACT         模型影响关系
AI_SPECULATION          AI推演，非事实
HISTORICAL_SNAPSHOT     仅用于历史研究或测试
UNVERIFIED              未验证，不进入事实结论
```

## 5.2 每条数据的强制来源字段

所有可展示记录必须具有：

```text
source_id
provider_id
source_type
source_title
source_url 或可追溯内部引用
source_published_at
observed_at
retrieved_at
valid_from
valid_to
period_start
period_end
evidence_class
aggregation_level
license_status
freshness_status
quality_status
confidence
methodology_version
```

字段不适用时必须为明确空值并解释，不得用默认日期、0 或空字符串伪装有效数据。

## 5.3 数据状态与 UI 文案

必须统一实现并复用状态映射：

| 状态 | UI 含义 |
|---|---|
| `NOT_CONFIGURED` | Provider、模型或数据文件尚未配置 |
| `UNAVAILABLE` | 已配置但当前请求不可用 |
| `DELAYED_UNVERIFIED` | 延迟或展示授权尚未完全确认 |
| `STALE` | 数据超过该类型允许的新鲜度阈值 |
| `OBSERVED` | 已有来源支持的观测 |
| `REALTIME_VERIFIED` | 合同允许且实时路径已经验证 |
| `MODELLED_ESTIMATE` | 模型估算，不是实际观测 |
| `AI_SPECULATION` | AI推演，可能完全错误 |
| `SOURCE_REQUIRED` | 需求已登记，尚缺合格来源 |

## 5.4 聚合层级不得越级

新增 `AggregationLevel`：

```text
GLOBAL
COUNTRY
STATE_PROVINCE
CITY
COUNTY_DISTRICT
TOWN
INDUSTRIAL_PARK
CLUSTER
COMPANY
FACILITY
PORT
ROUTE
SHIPMENT
```

显示某个地点、企业或工厂的数值时，必须验证来源的 `aggregation_level` 与目标层级相同或更细。国家级 HS64 数据不能显示为“惠东实际出口”；最多显示为“中国 HS64 对外贸易背景”，并明确与惠东集群没有直接归属证明。

## 5.5 来源冲突

同一事实出现冲突时：

- 保留所有来源记录；
- 不静默覆盖；
- 显示来源日期、可信度和冲突状态；
- 规范化实体可以指定“当前首选值”，但必须保留选择规则；
- AI 不得自行删除冲突来源；
- 争议数据不能进入确定性结论。

---

# 6. 统一实体和关系模型

## 6.1 主键原则

所有核心实体使用稳定内部 ID，不使用名称、股票代码、URL 或经纬度作为主键。

建议前缀：

```text
geo_        地理单元
cluster_    产业集群
product_    产品
company_    企业
facility_   工厂/生产基地
brand_      品牌
security_   证券
exchange_   交易所
node_       物流节点
event_      事件
item_       来源内容
flow_       贸易流观测
shipment_   装运观测
route_      路线
pred_       推演
source_     来源证据
```

## 6.2 地理实体 `GeoUnit`

必需字段：

```text
geo_id
parent_geo_id
level
country_iso2
country_iso3
subdivision_code
local_name
zh_name
en_name
alternate_names
centroid_lat
centroid_lon
boundary_ref
boundary_review_status
timezone_ids
valid_from
valid_to
source_evidence_ids
```

层级必须支持：

```text
WORLD > COUNTRY > STATE_PROVINCE > CITY > COUNTY_DISTRICT > TOWN > INDUSTRIAL_PARK
```

中国行政边界必须继续执行审查门禁；未加载经过审查的边界数据时，只显示点位、范围说明或明确不可用状态。

## 6.3 产业集群 `IndustryCluster`

```text
cluster_id
canonical_name
alternate_names
geo_scope_ids
cluster_type
official_recognition_status
recognizing_authority
recognition_date
industry_category_ids
product_ids
hs_mapping_ids
representative_company_ids
coverage_status
coverage_note
source_evidence_ids
last_verified_at
```

集群名称只证明产业标签和地理范围，不自动证明产量、出口额、港口、路线或企业名单。

## 6.4 产品与 HS 映射

### `ProductTaxonomyNode`

```text
product_id
parent_product_id
industry_category
local_name
zh_name
en_name
synonyms
process_tags
material_tags
hs2_candidates
hs4_candidates
hs6_candidates
```

### `ProductHsMapping`

```text
mapping_id
product_id
hs_version
hs_code
mapping_scope
mapping_status
reviewer_or_authority
evidence_id
valid_from
valid_to
```

自然语言产品、产业分类、HS 商品分类和制造工艺必须分开。比如“鞋类”“女鞋”“鞋面加工”“鞋底制造”“成鞋组装”不能使用同一层级表示。

## 6.5 企业、品牌、工厂和上市主体

### `Company`

```text
company_id
legal_name
registration_country
registration_number
canonical_name
alternate_names
company_type
parent_company_id
ultimate_parent_id
headquarters_geo_id
website
listed_status
source_evidence_ids
coverage_tier
last_verified_at
```

### `Facility`

```text
facility_id
company_id
facility_name
facility_type
geo_id
address
lat
lon
industrial_park_id
operational_status
product_ids
process_tags
capacity_disclosures
employment_range
oem_odm_brand_mode
source_evidence_ids
last_verified_at
```

### `Brand`

```text
brand_id
brand_name
owner_company_id
operator_company_ids
source_evidence_ids
```

### `Security`

```text
security_id
issuer_company_id
instrument_type
local_ticker
mic
isin
currency
primary_listing
provider_instrument_ids
valid_from
valid_to
```

以下关系必须明确分离：

```text
品牌 ≠ 公司
公司总部 ≠ 工厂
母公司 ≠ 子公司
上市主体 ≠ 所有生产主体
股票代码 ≠ 全球唯一证券 ID
```

## 6.6 交易和物流实体

### `TradeFlowObservation`

```text
flow_id
reporter_geo_id
origin_geo_id
origin_aggregation_level
destination_geo_id
product_id
hs_version
hs_code
period_start
period_end
trade_direction
value
value_currency
quantity
quantity_unit
net_weight_kg
transport_mode
customs_or_port_ref
provider_id
evidence_id
quality_status
```

### `ShipmentObservation`

```text
shipment_id
provider_shipment_id
shipper_company_id
consignee_company_id
origin_facility_id
origin_node_id
destination_node_id
product_description
hs_code
container_count
weight
vessel_imo
bill_of_lading_ref
observed_at
license_scope
evidence_id
```

只有合法签约数据明确提供时，才可填写对应字段。缺失字段保持空值，不得从 AIS 或企业所在地推断。

### `LogisticsNode`

```text
node_id
node_type
geo_id
name
lat
lon
codes
operator_company_id
capabilities
source_evidence_ids
```

节点类型：

```text
FACILITY
WAREHOUSE
CONSOLIDATION_CENTER
ROAD_BORDER
RAIL_TERMINAL
AIR_CARGO_TERMINAL
PORT
TERMINAL
INLAND_WATERWAY_NODE
OVERSEAS_WAREHOUSE
MARKET_DESTINATION
```

### `LogisticsRoute`

```text
route_id
origin_node_id
destination_node_id
via_node_ids
transport_modes
route_class
observed_or_modelled
distance
estimated_duration
valid_period
methodology_version
evidence_ids
```

## 6.7 事件与来源内容

### `SourceItem`

```text
item_id
platform
provider_item_id
content_type
author_id
author_display_name
published_at
observed_at
language
country_hint
geo_mentions
text_or_summary
source_url
view_count
like_count
comment_count
share_or_repost_count
engagement_observed_at
rights_status
source_evidence_id
dedup_hash
```

### `Event`

```text
event_id
canonical_title
localized_titles
summary
category
status
first_seen_at
last_seen_at
confirmed_at
geo_ids
source_item_ids
official_source_ids
related_cluster_ids
related_product_ids
related_company_ids
related_security_ids
related_route_ids
verification_status
trend_status
```

## 6.8 热度和推演实体

### `TrendPoint`

```text
entity_type
entity_id
window_start
window_end
item_count
unique_author_count
engagement_total
view_total
platform_count
country_count
language_count
velocity
acceleration
cross_platform_score
source_quality_score
duplicate_penalty
coordination_risk
heat_score
algorithm_version
```

### `Prediction`

```text
prediction_id
prediction_type
target_type
target_id
classification
horizon
created_at
data_as_of
expires_at
model_provider
model_name
model_version
feature_version
probability_distribution
predicted_range
confidence_level
drivers
counter_signals
invalidation_conditions
input_evidence_ids
disclaimer
evaluation_status
```

---

# 7. API、Provider 与后台任务

## 7.1 契约扩展原则

先检查现有 proto、OpenAPI、生成器、路由和 sidecar 约定。优先扩展现有领域，不得绕过生成体系直接创建不受审计的临时接口。

建议新领域契约：

- `Industry v1`
- `Trade v1`
- `Trend v1`
- `Prediction v1`
- 现有 `Market v1` 的全球化扩展
- 现有 `Maritime v1`、`Shipping v2` 的引用而非复制

具体命名以仓库现有规范为准；如命名不同，须在 ADR 中记录映射。

## 7.2 建议 RPC

### Industry v1

```text
SearchIndustryEntities
ListIndustryClusters
GetIndustryCluster
GetLocationIndustryProfile
ListProductProductionHubs
SearchCompanies
GetCompany
GetFacility
ListFacilitiesByLocation
ListSecuritiesByCompany
```

### Trade v1

```text
GetTradeFlowSeries
GetTradeFlowMap
ListLogisticsNodes
GetLogisticsNetwork
GetRouteEstimate
ListShipmentObservations
ExportTradeFlowCsv
```

### Trend v1

```text
ListGlobalTrends
GetTrendSeries
GetEvent
ListEventSources
SearchEvents
StreamTrendUpdates
GetCrossPlatformSpread
```

### Market v1 扩展

```text
ListExchanges
GetExchange
GetExchangeCalendar
GetMarketSession
SearchGlobalInstruments
GetGlobalQuote
GetGlobalBars
StreamGlobalQuotes
GetCorporateActions
```

现有八个 RPC 保持兼容，不得破坏已有客户端。

### Prediction v1

```text
GetTrendBurstForecast
GetEventScenarioForecast
GetAssetImpactForecast
GetSupplyChainForecast
ListPredictionHistory
GetPredictionEvaluation
```

## 7.3 所有响应的统一信封

```text
provider_status
provider_id
license_status
evidence_class
freshness_status
observed_at
as_of
period_start
period_end
fallback_status
warnings
source_evidence_ids
value 或 items
```

任何成功响应都不能只有空数组和 `OK`。无数据时必须使用明确状态和原因。

## 7.4 缓存和隔离

缓存键必须包含所有会改变结果的维度，例如：

```text
provider:entityType:entityId:marketOrGeo:interval:range:currency:language:licenseTier
```

必须防止：

- 跨证券、跨交易所、跨产品、跨地点和跨期间缓存串值；
- 把延迟数据写入实时缓存；
- 把模型结果写入事实缓存；
- 把测试 fixture 写入生产缓存；
- 把国家级流量缓存命中到镇级查询。

## 7.5 Provider 运维中心扩展

在现有 `/provider-operations` 中新增任务契约：

| 任务 | 默认节奏 | 幂等范围 | 真实性边界 |
|---|---|---|---|
| 地理主数据同步 | 月度/版本触发 | 数据集版本 | 未审查边界不启用 |
| 产业集群同步 | 周/月 | 来源+集群+版本 | 不自动生成 HS 映射 |
| 企业/工厂同步 | 日/周 | 企业/工厂+来源版本 | 总部不得当工厂 |
| 证券主数据同步 | 日 | MIC+证券ID+日期 | ticker 非全球唯一 |
| 交易所日历同步 | 日/事件触发 | MIC+日期 | 不套用美国日历 |
| 全球行情流 | 交易时段 | Provider+证券+时间 | 许可决定实时标签 |
| 新闻采集 | 分钟级 | 来源URL/Provider ID | 保留原始来源 |
| X 数据采集 | Provider 允许节奏 | 平台内容 ID | 仅授权 API |
| B站数据采集 | Provider 允许节奏 | BV/AV ID | 仅授权能力 |
| 事件聚类 | 1–5 分钟 | 时间窗+算法版本 | 聚类不是事实确认 |
| 热度评分 | 1 分钟 | 事件+时间窗+版本 | 输出评分来源 |
| Comtrade | 月度/发布触发 | reporter+period+HS | 聚合层级不越级 |
| 中国海关导入 | 文件到达 | 文件哈希 | 仅合法来源文件 |
| 提单/装运 | Provider 节奏 | Provider shipment ID | 受许可和字段限制 |
| AIS | 分钟级 | MMSI+时间 | 不推断货物 |
| PortWatch/港口 | Provider 节奏 | 节点+时间 | 观测和估算分开 |
| AI推演 | 新数据/定时 | 目标+截止时间+模型版本 | 只写推演表 |
| 模型评估 | 每日/预测到期 | prediction_id | 不删除失败预测 |
| 预警派发 | 事件触发 | 规则+用户+窗口 | 去重和限流 |

每项任务继续具备调度、锁、有限重试、最后尝试、最后成功、失败原因和非敏感配置状态。

---

# 8. 产品信息架构与页面

## 8.1 一级入口

建议最终一级入口：

```text
1. 全球热点
2. 热度上升
3. 新闻与社交平台
4. 全球股票与市场
5. 全球产业地图
6. 中国世界工厂
7. 贸易流向
8. 海运与物流
9. 事件影响
10. AI推演
11. Provider运维中心
```

不得为了新增入口复制一套主仪表盘。现有首页保持市场优先，同时增加热点、产业和物流的统一跳转。

## 8.2 建议路由

```text
/trends
/trends/:eventId
/social-intelligence
/global-markets
/global-markets/:securityId
/industry-map
/industry-map/location/:geoId
/industry-map/cluster/:clusterId
/industry-map/company/:companyId
/industry-map/facility/:facilityId
/trade-flows
/trade-flows/product/:productId
/impact/:eventId
/predictions
/provider-operations
```

保留：

```text
/stocks
/stocks/:symbol
/maritime-logistics
/china-factory
```

旧路由可逐步重定向到统一实体页，但不得在迁移完成前破坏兼容性。

## 8.3 全局搜索

实现一个统一搜索入口，可搜索：

- 事件；
- 产品；
- HS 编码；
- 国家、省、市、县、镇和工业园；
- 产业集群；
- 企业、品牌和工厂；
- 股票代码、ISIN、公司；
- 港口、机场、铁路节点和路线。

搜索结果必须显示实体类型、地点、覆盖状态和来源状态，避免名称相同造成误选。

## 8.4 统一事件详情页

事件页至少分为：

1. 事实摘要；
2. 来源时间线；
3. 热度曲线；
4. 跨平台传播；
5. 官方确认与冲突来源；
6. 地理位置；
7. 相关产业、产品和企业；
8. 相关物流节点和路线；
9. 相关证券及市场状态；
10. AI推演；
11. 证据和数据截止时间。

## 8.5 地图工作模式

统一产业地图使用一个地图和模式切换：

```text
INDUSTRY_DISTRIBUTION   全球产业分布
COMPANY_FACILITY        企业与工厂
PRODUCT_FLOW            产品贸易流向
LOGISTICS_NETWORK       物流网络
EVENT_IMPACT            事件影响
```

地图图例必须区分：

- 实际观测；
- 企业披露；
- 聚合贸易统计；
- 商业装运观测；
- 模型路线；
- AI推演；
- 数据不可用。

---

# 9. 全球产业与物流情报地图详细要求

## 9.1 地理下钻

支持：

```text
世界
└── 国家
    └── 州/省
        └── 城市
            └── 区/县
                └── 镇/街道
                    └── 工业园
                        └── 工厂/生产基地
```

每一级页面使用同一数据模型，按可用证据显示不同粒度。

## 9.2 地点画像

点击任何地点后显示：

| 区域 | 内容 |
|---|---|
| 地点 | 行政层级、多语言名称、时区、范围来源 |
| 主力产业 | 产业排名、证据和统计期间 |
| 主力产品 | 产品、HS 映射、工艺标签 |
| 集群 | 正式认定或经验证产业集群 |
| 企业 | 已验证企业数量及覆盖等级 |
| 工厂 | 已验证生产基地、状态和产品 |
| 上市公司 | 证券、交易所、当前市场状态 |
| 贸易 | 出口/进口目的地、期间、聚合层级 |
| 物流 | 港口、机场、铁路、公路节点 |
| 风险 | 当前事件和异常信号 |
| AI推演 | 非事实影响概率 |
| 数据质量 | 来源、更新时间、覆盖率和缺口 |

## 9.3 产品反向查询

输入“女鞋”“陶瓷”“汽车零部件”“光刻设备”等产品时，返回：

- 全球主要生产国家和地区；
- 城市、专业镇和工业园；
- 产业集群；
- 代表企业与工厂；
- HS 编码和工艺类别；
- 主要出口目的市场；
- 主要运输节点和方式；
- 当前热点、风险和 AI 推演。

结果只显示有来源支持的关系。仅存在需求但尚无来源的候选点使用 `SOURCE_REQUIRED`，不进入默认排名。

## 9.4 企业和工厂覆盖等级

```text
TIER_A  上市制造企业、官方龙头、公开披露主要工厂
TIER_B  官方产业集群内经验证重点企业
TIER_C  工业园内有可靠公开来源的中型企业
TIER_D  合法商业或企业注册数据覆盖的长尾企业
```

每个地点显示：

- 已验证企业数；
- 已验证工厂数；
- 覆盖等级；
- 来源数量；
- 最后验证时间；
- 是否完整覆盖；
- 明确的缺口说明。

不得因列出部分企业而显示“全部工厂”。

## 9.5 中国世界工厂优先种子

### 已有事实种子

- 惠东女鞋；
- 莆田荔城运动鞋；
- 20 条工信部 2024 参考产业集群记录。

现有文件只支持惠东和莆田的经审查 HS64 映射。其他记录在完成逐条产品和 HS 来源审核前继续保持统计禁用。

### 新增需求种子

以下属于产品需求，不是当前已验证事实：

- 温州鞋业；
- 景德镇陶瓷；
- 东莞各镇产业；
- 深圳主要制造企业、工厂和上市公司；
- 广东、福建、浙江及其他专业镇；
- 荷兰光刻设备产业；
- 德国汽车及工业产品集群；
- 后续全球主要工业国家和专业城市。

Codex 必须为每条种子建立来源审查流程。没有来源时只能建立 `SOURCE_REQUIRED` 候选，不得直接填写产量、出口、企业或路线。

## 9.6 第一批可验收纵向案例

至少实现以下纵向案例的完整 UI 和数据边界：

### 案例 A：惠东女鞋

- 集群来源；
- 行政范围；
- HS64 映射；
- 产品详情；
- 企业/工厂覆盖状态；
- 有数据时显示合法贸易目的地；
- 无镇级数据时禁止显示“惠东实际出口”；
- 物流节点使用观察或模型标签；
- 关联事件、股票和 AI推演卡。

### 案例 B：东莞地点画像

- 市级和镇级下钻框架；
- 主力产业和产品；
- 代表企业、工厂和上市主体；
- 每条信息来源；
- 覆盖率而非“全部”；
- 贸易和物流层级限制。

### 案例 C：全球工业案例

优先选择一个完成来源审核的荷兰光刻设备案例和一个德国汽车案例，证明系统不是仅支持中国。若外部来源尚未完成，只能验收契约、候选状态和禁用 UI，不能验收事实数据。

## 9.7 贸易流向分层

产品流向线分为：

```text
OBSERVED_AGGREGATE      海关或 Comtrade 聚合观测
OBSERVED_SHIPMENT       合法装运/提单观测
COMPANY_DISCLOSED       企业披露路线或市场
MODELLED_ROUTE          模型运输路线
MODELLED_FLOW           模型货物流向
AI_SPECULATION          AI推演未来变化
```

视觉要求：

- 实际观测与模型线型明显不同；
- 显示指标类型：金额、重量、数量、装运次数或集装箱；
- 显示期间、币种、单位和来源；
- 不能混合不同指标形成一条无说明的“热度线”。

## 9.8 多式联运

支持：

- 海运；
- 航空货运；
- 国际铁路；
- 公路跨境；
- 内河；
- 多式联运。

原 `/maritime-logistics` 继续负责船舶、航道和港口观察；新 `/trade-flows` 负责产品和货物流向。两者通过物流节点和路线关联，但不得把 AIS 船位自动变成货物证据。

---

# 10. 新闻、X、B站与跨平台事件系统

## 10.1 Provider 原则

每个平台实现独立 Provider Adapter，优先使用：

1. 官方 API；
2. 用户明确授权的数据访问；
3. 合同允许的商业数据；
4. 平台公开且许可明确的接口。

禁止：

- 绕过登录、验证码、访问限制；
- 盗取或复用用户会话；
- 未经许可的大规模抓取；
- 把页面显示数字当作稳定 API；
- 删除原始来源 URL 和观测时间。

## 10.2 首批平台

优先实现：

- 新闻 Provider；
- X；
- B站；
- 通用平台适配器框架。

后续平台通过配置注册，不修改事件核心模型。

## 10.3 事件标准化流程

```text
原始内容
→ 字段校验
→ 语言检测
→ 去重
→ 实体识别
→ 地理解析
→ 事件候选
→ 多语言聚类
→ 来源可信度
→ 官方确认状态
→ 热度时间序列
→ 影响关联
```

原始内容必须可追溯。摘要和翻译不能替代原文来源。

## 10.4 去重和聚类

至少使用：

- 规范化 URL；
- Provider 内容 ID；
- 文本指纹；
- 标题相似度；
- 时间窗；
- 地点和实体重叠；
- 转发/引用关系；
- 多语言语义相似度。

聚类结果必须有算法版本和置信度。低置信度内容保留为候选，不自动合并。

## 10.5 事件验证状态

```text
SIGNAL_ONLY             仅信号
UNCONFIRMED             未确认
MULTI_SOURCE_REPORTED   多来源报道
OFFICIALLY_CONFIRMED    官方确认
DISPUTED                存在冲突
LIKELY_FALSE            高风险不实
RETRACTED               已撤回
RESOLVED                 已结束
```

社交平台热度高不等于事件已确认。

---

# 11. 热度、上升速度与爆发检测

## 11.1 指标窗口

至少计算：

```text
5 分钟
15 分钟
30 分钟
1 小时
6 小时
24 小时
7 天基线
30 天基线
```

## 11.2 输入指标

- 新内容数量；
- 独立作者数量；
- 互动量和观看量；
- 互动速度；
- 平台数量；
- 国家和语言数量；
- 权威来源数量；
- 跨平台传播延迟；
- 与平台历史基线的异常程度；
- 重复转载惩罚；
- 疑似协同行为风险；
- 官方确认加权；
- 来源质量。

## 11.3 状态机

```text
NORMAL
RISING
FAST_RISING
BREAKOUT_RISK
BREAKOUT
COOLING
RESOLVED
```

状态转换必须由配置化阈值和算法版本决定，并记录触发原因。

## 11.4 热度分数

初始版本可以采用可解释、配置化的确定性公式，不得硬编码不可追踪权重。建议结构：

```text
heat_score =
  volume_velocity
+ engagement_velocity
+ unique_author_growth
+ cross_platform_spread
+ geographic_spread
+ authority_signal
- duplicate_penalty
- coordination_risk_penalty
```

所有分项归一化后计算。后续模型可替换，但历史分数必须保留算法版本。

## 11.5 爆发预警

每个事件输出：

- 当前热度；
- 速度；
- 加速度；
- 相对基线倍数；
- 主要增长平台；
- 最早来源；
- 跨平台传播路径；
- 未来 1 小时、6 小时、24 小时爆发推演；
- 支持因素和反向因素。

---

# 12. 全球股票与交易所系统

## 12.1 证券身份

任何行情查询必须由：

```text
security_id + MIC + provider_instrument_id
```

确定。ticker 仅用于显示和搜索，不是全球唯一主键。

## 12.2 交易所状态

实现：

```text
PRE_OPEN
OPENING_AUCTION
OPEN
MIDDAY_BREAK
CLOSING_AUCTION
AFTER_HOURS
HALTED
CLOSED
HOLIDAY
DELAYED
UNAVAILABLE
```

每个交易所拥有自己的：

- 时区；
- 工作日；
- 节假日；
- 提前收市；
- 集合竞价；
- 午间休市；
- 盘前和盘后规则；
- 临时停牌状态。

非美国交易所不得默认复用 NYSE/Nasdaq 日历。

## 12.3 开市和闭市显示

开市时：

- 按许可显示实时或延迟行情；
- 显示 Provider、观测时间和延迟；
- 使用服务端中继，密钥不下发。

闭市时：

- 显示最后有效观测；
- 明确“市场已闭市”；
- 显示最后交易时间；
- 不把最后价格标成当前实时价格。

## 12.4 全球覆盖等级

```text
LEVEL_1_REALTIME
LEVEL_2_DELAYED
LEVEL_3_INTRADAY_PERIODIC
LEVEL_4_DAILY_CLOSE
LEVEL_5_METADATA_ONLY
LEVEL_0_UNAVAILABLE
```

界面按交易所显示覆盖等级和授权状态。

## 12.5 新闻和事件对齐

在现有美国交易日对齐基础上扩展到主要交易所。每条新闻或事件保存：

- UTC 时间；
- 主要交易所本地时间；
- 交易日；
- 盘前、盘中、盘后、休市；
- 对齐规则；
- 实际 T0/T1/T3/T5/T10 收益；
- 非因果说明。

## 12.6 企业、工厂和证券关联

```text
Facility
→ Operating Company
→ Parent Company
→ Listed Issuer
→ Security
→ Exchange Session
→ Quote/Bars
```

影响展示必须标出关系路径，避免把供应商、客户、母公司和上市主体混为一体。

---

# 13. AI 推演系统

## 13.1 基本原则

AI 推演是独立数据层，不修改事实记录。所有结果统一显示：

> **AI推演｜非事实｜可能完全错误｜不得作为投资、采购、物流或安全决策依据**

## 13.2 必须输出结果卡，但不得随机造数

每个支持推演的对象必须渲染结果卡，状态分为：

```text
AVAILABLE               可形成推演
LOW_CONFIDENCE          可形成低置信度推演
INSUFFICIENT_DATA       输入不足，无法形成方向判断
MODEL_NOT_CONFIGURED    模型未配置
EXPIRED                 推演已过期
```

“必须输出”指必须输出一张明确结果卡，不代表在没有任何输入时随机生成概率。

为避免长期停留在 `MODEL_NOT_CONFIGURED`，Phase 22 必须实现一个第一方、确定性、版本化的本地基线模型，例如：

```text
LOCAL_BASELINE_V1
```

该模型只使用已经验证的输入，不使用随机数。满足最低输入条件时输出 `AI_SPECULATION`；不满足时输出 `INSUFFICIENT_DATA` 和缺失原因。

## 13.3 事件热度推演

输出：

```text
未来 1 小时爆发概率
未来 6 小时爆发概率
未来 24 小时爆发概率
预测热度区间
置信度
主要驱动
反向信号
失效条件
数据截止时间
到期时间
模型版本
```

## 13.4 股票推演

支持周期：

```text
15 分钟
1 小时
当日收盘
1 个交易日
5 个交易日
20 个交易日
```

输出概率分布，不输出无依据的确定目标价：

```text
上涨概率
横盘概率
下跌概率
预期波动区间
成交量异常概率
影响持续时间
关键驱动
反向风险
失效条件
```

## 13.5 产业和物流推演

输出：

- 供应链中断概率；
- 受影响地区；
- 受影响产品；
- 可能替代路线；
- 运输时间变化区间；
- 目的市场影响；
- 相关企业和证券；
- 数据不足项。

## 13.6 推演评估

每个预测到期后必须记录：

- 实际结果；
- 方向是否命中；
- 区间是否覆盖；
- Brier Score 或等价概率校准指标；
- 置信度分桶表现；
- 模型版本；
- 数据版本；
- 不允许删除的失败记录。

UI 必须展示模型最近表现，不能只展示成功案例。

---

# 14. 统一事件—产业—物流—市场影响图谱

## 14.1 图谱目标

建立以下可追溯路径：

```text
Event
→ GeoUnit
→ IndustryCluster
→ Product
→ Facility
→ Company
→ Security
→ LogisticsNode
→ LogisticsRoute
→ DestinationMarket
```

## 14.2 关系类型

```text
LOCATED_IN
RECOGNIZED_AS_CLUSTER
PRODUCES
OPERATES
OWNS
BRANDS
LISTED_AS
SUPPLIES
CUSTOMER_OF
USES_LOGISTICS_NODE
OBSERVED_TRADE_TO
OBSERVED_SHIPMENT_TO
MODELLED_ROUTE_TO
MENTIONED_BY
RELATED_TO
POTENTIALLY_IMPACTS
```

每条边具有：

```text
edge_id
from_id
to_id
relationship_type
evidence_class
source_evidence_ids
confidence
valid_from
valid_to
methodology_version
```

## 14.3 因果边界

只有明确证据支持时才能使用强关系。AI 和统计关联只能使用：

```text
RELATED_TO
POTENTIALLY_IMPACTS
MODELLED_ROUTE_TO
```

不得写成“事件导致股票上涨”或“某船装载某镇产品”，除非有独立事实证据。

---

# 15. 预警、自选和桌面通知

## 15.1 可监控对象

用户可关注：

- 事件；
- 关键词；
- 产品；
- 国家、城市、镇和工业园；
- 产业集群；
- 企业和工厂；
- 股票；
- 港口、航道和路线。

## 15.2 预警类型

```text
热度快速上升
疑似爆发
跨平台共振
官方确认或撤回
工厂/港口/航道异常
贸易流显著变化
股票价格或成交量异常
交易所开闭市或停牌
AI推演显著变化
预测失效或反转
Provider 数据中断
```

## 15.3 派发规则

- 首先实现 Windows 桌面本地通知；
- 支持静音时段、频率限制和相同事件合并；
- 每条通知说明触发规则、数据截止时间和证据等级；
- AI 通知必须带完整推演标识；
- Provider 中断不能伪装成“无事件”。

---

# 16. 数据采集、许可和更新频率

## 16.1 来源优先级

### 产业和企业

1. 政府或正式产业集群认定；
2. 企业年报、官网、公告和交易所披露；
3. 官方企业注册和工业园资料；
4. 合法授权商业数据库；
5. 新闻和社交仅作为信号，不自动进入企业事实层。

### 贸易和物流

1. Comtrade 或正式海关统计；
2. 合法中国海关文件；
3. 合法签约提单/装运数据；
4. 港口和官方物流节点数据；
5. AIS 仅作船舶观测；
6. 模型路线和 AI 推演明确单列。

### 市场

1. 具有展示和再分发权的行情 Provider；
2. 交易所或官方证券主数据；
3. 延迟 Provider；
4. 日线/收盘 Provider；
5. 历史快照仅用于研究和测试。

### 新闻和社交

1. 原始新闻或官方公告；
2. 官方 API；
3. 用户授权 API；
4. 合同允许的商业聚合；
5. 不使用未经授权会话。

## 16.2 合理更新频率

| 数据 | 默认更新频率 |
|---|---|
| 新闻/社交 | 秒级至 5 分钟，受 Provider 限制 |
| 热度评分 | 1 分钟 |
| 股票行情 | 交易时段实时或明确延迟 |
| 交易所日历 | 每日及事件触发 |
| AIS | 分钟级，受 Provider 限制 |
| 港口状态 | 分钟、小时或日级 |
| 提单/装运 | 日级或 Provider 周期 |
| 海关/Comtrade | 月度、季度或年度 |
| 产业集群 | 月度、季度、年度或事件触发 |
| 企业/工厂 | 周、月或披露触发 |
| AI推演 | 新数据触发或定时 |

UI 必须显示真实时间，不得统一标为“实时”。

## 16.3 许可注册表

为每个 Provider 保存：

```text
provider_id
terms_url
license_status
allowed_use
display_rights
redistribution_rights
retention_policy
cache_ttl
export_allowed
user_authorization_required
reviewed_at
reviewer
```

未经确认时，相关实时、导出或再分发功能保持禁用。

---

# 17. 分阶段执行计划

## Phase 13：基线保护与架构落盘

### 目标

建立后续分支、worktree、架构决策和执行文件，不改变现有已验收功能。

### 必做任务

1. 验证权威根目录、所有 worktree、当前 integration 分支和远端；
2. 验证 `c730fc6...` 为后续分支祖先；
3. 确认工作树干净；若不干净，记录并使用新 worktree，不清理用户文件；
4. 创建 `integration/global-intelligence-v2`；
5. 将本方案落盘到 `docs/integration/`；
6. 新增 ADR：领域边界、证据模型、实体 ID、Provider 许可、存储策略；
7. 盘点可复用地图、搜索、状态标签、SSE、Provider 运维、市场和桌面组件；
8. 建立 Phase 13 证据和状态记录。

### 验收

- 无产品代码变更或仅有无行为变化的架构骨架；
- `main`、现有 PR 和原分支不变；
- 完成路径、分支、HEAD、远端和祖先证据；
- 文档 lint、diff check、来源和产品事实检查通过。

## Phase 14：统一证据、来源、实体 ID 与 Provider 信封

### 目标

为后续所有系统建立共享真实性基础。

### 必做任务

- 实现 `EvidenceClass`、`AggregationLevel`、覆盖、许可、新鲜度和质量状态；
- 实现 `SourceEvidence`；
- 实现统一响应信封；
- 实现实体稳定 ID；
- 实现来源冲突和空值规则；
- 扩展 Provider Operations 契约；
- 建立迁移和兼容层；
- 为现有 Market、Maritime、China Factory 数据映射新证据模型，不破坏原 API。

### 验收

- 旧路由和旧 RPC 通过；
- 新状态在 UI 有唯一映射；
- 无 Provider 时不返回空成功；
- 国家级数据不能通过验证器进入镇级结果；
- 模型数据不能写入事实表；
- API 生成、类型、DOM、数据、来源和生产构建通过。

## Phase 15：全球产业地图核心

### 目标

完成统一地图、地理下钻、集群和产品搜索的可运行骨架。

### 必做任务

- 实现 `GeoUnit`、`IndustryCluster`、`ProductTaxonomyNode`、`ProductHsMapping`；
- 实现 `/industry-map` 及地点、集群详情路由；
- 实现地图五种模式中的产业分布基础模式；
- 导入现有 22 条种子；
- 惠东、莆田保留已审查 HS64；
- 20 条参考集群继续统计禁用；
- 实现来源、覆盖和缺口面板；
- 实现维护型 CSV 模板和验证器。

### 验收

- 搜索“女鞋”能返回有来源的惠东记录；
- 无贸易数据时不显示数字；
- 地图无审查边界时显示明确状态；
- 移动端无横向溢出，独立滚动有效；
- 测试 fixture 不进入生产 bundle。

## Phase 16：企业、工厂、品牌和证券关联

### 目标

建立企业和工厂注册表，并与现有股票系统连接。

### 必做任务

- 实现 `Company`、`Facility`、`Brand`、`Security`；
- 实现公司、工厂搜索和详情页；
- 区分总部和生产基地；
- 支持母子公司、品牌和上市主体；
- 实现覆盖等级和覆盖率；
- 在地点和集群页显示已验证企业/工厂；
- 在股票页显示有证据的工厂和产业关系；
- 提供企业/工厂批量导入模板。

### 验收

- 同名企业不串联；
- 同 ticker 不同 MIC 不合并；
- 没有来源的企业不进入事实列表；
- “全部工厂”不出现；
- 每个关系可以回溯到来源。

## Phase 17：贸易流向与多式联运

### 目标

把产业集群、产品、物流节点和目的市场连接起来。

### 必做任务

- 实现 `TradeFlowObservation`、`ShipmentObservation`、`LogisticsNode`、`LogisticsRoute`；
- 实现 `/trade-flows`；
- 接入 Comtrade 适配器和合法海关文件导入边界；
- 设计提单/装运 Provider 契约；
- 连接现有 Maritime、PortWatch 和 Shipping；
- 实现实际观测、企业披露和模型路线分层；
- 支持海运、空运、铁路、公路和多式联运；
- 扩展 Provider Operations。

### 验收

- AIS 不生成货物、买方或工厂字段；
- 国家级贸易不能显示为惠东实际出口；
- 实际流和模型流图例不同；
- 导出文件保留期间、单位、来源和聚合层级；
- 无 Provider 时呈现禁用状态。

## Phase 18：中国世界工厂深化与全球产业种子

### 目标

在统一模型上扩展用户指定的重点产业地点。

### 必做任务

- 建立来源审查队列；
- 优先审查温州鞋业、景德镇陶瓷、东莞各镇、深圳制造企业；
- 建立荷兰光刻设备和德国汽车候选；
- 每个地点逐条确认地理范围、产品、工艺、企业和来源；
- 完成后再启用 HS 和贸易查询；
- 未完成来源审核的记录保持 `SOURCE_REQUIRED`；
- 提供覆盖率和验证日期。

### 首期数据目标

此目标是工作量目标，不是预先确认事实：

- 至少完成用户指定六类案例的来源审查；
- 东莞至少形成市级画像和一组经验证镇级案例；
- 深圳至少形成一组上市制造企业与公开工厂关系；
- 全球至少完成一个荷兰工业案例和一个德国工业案例；
- 所有案例均有来源和覆盖声明。

### 验收

- 无来源的产品、企业、工厂和出口数字不展示；
- 地点、公司、工厂和证券关系不混淆；
- 可从产品反查地点，也可从地点查询产品；
- 中国和海外案例使用同一数据模型。

## Phase 19：新闻、X、B站与事件标准化

### 目标

建立跨平台数据层和事件候选。

### 必做任务

- 实现通用 `SocialProvider`/`ContentProvider` 接口；
- 实现新闻、X、B站适配器骨架；
- 实现 `SourceItem`；
- 实现许可、限流、重试和禁用状态；
- 实现语言、去重、实体和地点提取；
- 实现事件候选和原始来源时间线；
- 不授权的平台保持未配置。

### 验收

- 原始 URL、平台 ID 和时间保留；
- 无 API 时不抓取页面替代；
- 同一内容不会重复计数；
- 社交信号不自动标为官方确认；
- Provider 密钥不进入浏览器。

## Phase 20：跨平台热度与爆发引擎

### 目标

完成热度、速度、加速度、状态机和预警候选。

### 必做任务

- 实现 `TrendPoint`；
- 实现多窗口指标；
- 实现配置化可解释评分；
- 实现 `NORMAL` 至 `RESOLVED` 状态机；
- 实现跨平台传播路径；
- 实现 `/trends`、趋势详情和实时 SSE；
- 提供算法版本和分项解释。

### 验收

- 同样输入得到确定性结果；
- 重复转载不会线性放大热度；
- 单一大账号与大量独立作者可区分；
- 热度状态变化有原因；
- 无实时 Provider 时可用明确测试环境验证，但生产不显示 fixture。

## Phase 21：全球交易所和证券市场

### 目标

把现有美国导向股票工作区升级为全球市场框架。

### 必做任务

- 建立 Exchange 和 Security Master；
- 实现 MIC、ISIN、多币种和 Provider ID；
- 实现各交易所日历和状态；
- 扩展行情接口和服务端中继；
- 显示实时、延迟、闭市和不可用；
- 扩展非美国新闻交易日对齐；
- 在产业、企业和事件页显示相关证券；
- 保持现有 `/stocks` 兼容。

### 验收

- 同 ticker 跨交易所不串数据；
- 午间休市、节假日和停牌有独立状态；
- 闭市显示最后观测时间；
- Provider 许可不满足时不打开实时流；
- 全球覆盖矩阵可见。

## Phase 22：AI 推演、回测和模型评估

### 目标

提供可运行的第一方推演基线，并接入可选外部模型。

### 必做任务

- 实现 `Prediction` 和评估表；
- 实现 `LOCAL_BASELINE_V1`；
- 实现事件爆发、股票、产业和物流推演；
- 实现结果卡必显示规则；
- 实现数据不足状态；
- 实现到期评估；
- 保留所有失败预测；
- 在 Provider Operations 中加入模型任务；
- 外部模型通过服务端适配器接入。

### 验收

- 不使用随机数；
- 所有结果带数据截止时间、版本和免责声明；
- 事实和推演存储分开；
- 输入不足时不生成虚假概率；
- 预测到期后自动评估；
- UI 展示历史表现。

## Phase 23：统一影响图谱

### 目标

将事件、产业、物流和证券真正连接。

### 必做任务

- 实现关系边和证据；
- 实现事件影响页；
- 支持从事件追踪到地点、集群、产品、工厂、公司、股票和路线；
- 支持反向查询；
- 将模型关系和事实关系分开；
- 提供关系路径解释。

### 验收

- 每条边可追溯；
- AI 不能创建事实边；
- 关系路径不循环失控；
- 事件页面可显示直接、间接和模型影响；
- 股票影响不写成已证明因果。

## Phase 24：自选、桌面预警和个人情报中心

### 目标

让用户持续监控事件、地点、产品、公司、股票和路线。

### 必做任务

- 实现 watchlist；
- 实现规则式预警；
- 实现桌面通知；
- 实现去重、限流和静音；
- 显示触发依据；
- Provider 中断单独告警；
- 预测失效或反转告警。

### 验收

- 相同事件不会重复轰炸；
- 通知能回到具体详情页；
- AI通知带完整标识；
- 关闭应用后本地 sidecar 行为符合现有桌面安全边界。

## Phase 25：端到端验收、发布准备和交付

### 目标

完成所有模块的无 Provider、测试 Provider 和真实授权 Provider 分层验收。

### 必做任务

- 全部目标浏览器矩阵；
- Windows 桌面安装和升级；
- Linux GitHub CI；
- 数据迁移回滚；
- 性能和内存；
- 来源和许可证审计；
- 密钥和隐私审计；
- 可访问性和移动端；
- Provider-backed 手工验收清单；
- 完整用户文档和运维手册；
- Draft PR 和证据记录。

### 验收

- 现有所有 Phase 0–12 门禁继续通过；
- 新模块无 Provider 时完全真实；
- Provider-backed 声明均有截图、时间、来源、许可和请求证据；
- 无跨证券、跨地点、跨产品和跨层级数据串值；
- 不修改 `main`，不部署，除非用户另行明确授权。

---

# 18. 依赖关系与并行执行

## 18.1 依赖图

```text
Phase 13
  ↓
Phase 14 统一契约
  ├── Phase 15 → Phase 16 → Phase 17 → Phase 18
  ├── Phase 19 → Phase 20
  └── Phase 21
                ↓
             Phase 22
                ↓
             Phase 23
                ↓
             Phase 24
                ↓
             Phase 25
```

## 18.2 可并行范围

Phase 14 完成后，可以在独立 worktree 中并行：

- 产业地图 UI 与种子审查；
- 社交 Provider 适配器；
- 全球交易所主数据研究；
- 数据导入模板和文档。

不得并行修改：

- 同一 proto 或 OpenAPI 生成文件；
- 同一迁移序列；
- 同一路由注册表；
- 同一全局实体枚举；
- 同一 Provider Operations 核心文件。

并行分支合并前必须先同步共同基线并重新生成所有代码，禁止手工拼接生成物。

## 18.3 高效执行原则

- 每阶段先做代码和测试盘点，避免重复已有组件；
- 先跑定向测试，阶段结束再跑完整门禁；
- 大数据导入与 UI 解耦；
- 将可配置权重、阈值和平台能力放入注册表，不散落硬编码；
- 使用批量导入和幂等 upsert；
- 所有外部请求具备超时、重试、限流、缓存和审计；
- 不进行与本阶段无关的大规模重构；
- 一个提交解决一个明确问题；
- 保留失败命令和修复过程，不重写历史为“从未失败”。

---

# 19. 测试与验收矩阵

## 19.1 自动化测试层级

### 单元测试

- 枚举和状态映射；
- 时间、时区和交易日历；
- HS 映射；
- 聚合层级验证；
- 去重和聚类；
- 热度计算；
- 预测输出和评估；
- 缓存键隔离；
- 关系图谱边界。

### 契约测试

- proto/OpenAPI 生成；
- 请求验证；
- Provider 信封；
- 许可和状态；
- SSE/WebSocket；
- CSV 导入/导出；
- 无 Provider 响应。

### 集成测试

- Provider Adapter → 标准化 → 存储 → API → UI；
- 行情流和修复；
- 新闻/社交到事件；
- 事件到热度；
- 产业到贸易流；
- 事件到影响图谱；
- 预测到评估。

### 浏览器 E2E

至少覆盖：

- 1440×900；
- 1280×720；
- 390×844；
- 独立滚动；
- 无横向溢出；
- 地图加载和模式切换；
- 无 Provider 状态；
- 测试 Provider 数据；
- 搜索、筛选、URL 状态；
- 通知跳转；
- 屏幕阅读和键盘操作。

### 桌面测试

- 安装、升级、卸载；
- 单实例；
- sidecar 只监听本地；
- 无旧端口回退；
- Provider 配置不泄露；
- 桌面通知；
- 离线和闭市状态。

## 19.2 强制负向测试

- 错误证券 ticker/MIC；
- 跨证券返回；
- 重复 K 线时间；
- 非法 OHLC；
- 国家级数据请求镇级结果；
- AIS 记录试图填充 cargo；
- 公司总部试图作为工厂；
- 无来源的企业进入事实列表；
- 模型结果写入事实表；
- X/B站无授权时尝试抓取；
- Provider 密钥进入前端环境；
- 过期预测仍显示当前有效；
- 重复帖子造成热度异常；
- 相同 ticker 不同交易所缓存冲突；
- 测试 fixture 打入生产 bundle。

## 19.3 现有门禁

执行前检查 `package.json` 和 CI 文件，继续使用现有实际脚本。已知门禁包括：

```text
npm run typecheck:all
npm run lint
npm run test:dom
npm run test:data
npm run test:sidecar
npm run lint:api-contract
npm run sources:generate
npm run sources:check
npm run build:full
```

若脚本名称已变化，应记录新旧映射，不能跳过对应能力。

## 19.4 Provider-backed 验收证据

每个真实 Provider 验收必须记录：

- Provider 名称和许可状态；
- 测试时间；
- 数据观测时间；
- 延迟；
- 请求范围；
- 返回来源；
- 页面截图；
- 日志；
- 密钥未泄露证明；
- 导出/再分发权状态；
- 尚未验证项。

---

# 20. 关键端到端验收场景

## 场景 1：女鞋产业查询

用户搜索“女鞋”：

1. 返回有来源支持的生产集群；
2. 惠东记录显示来源和 HS64；
3. 显示企业/工厂覆盖状态；
4. 有合格贸易数据时显示目的国家；
5. 只有国家级数据时明确标为国家背景；
6. 模型路线与实际流向分开；
7. 显示相关事件和证券；
8. AI推演卡必显示。

## 场景 2：东莞地点画像

用户点击东莞：

1. 显示市级产业画像；
2. 可下钻已验证镇级案例；
3. 显示企业、工厂和上市公司；
4. 显示覆盖率而不是“全部”；
5. 显示产品和工艺；
6. 显示来源和更新时间；
7. 贸易数据不越级；
8. 事件可关联到相关产业和股票。

## 场景 3：全球工业案例

用户搜索荷兰光刻设备或德国汽车：

1. 有来源时显示地点、企业和工厂；
2. 未完成审核时显示候选和 `SOURCE_REQUIRED`；
3. 不生成无来源产量、出口或市场份额；
4. 证券关联使用公司—上市主体路径；
5. 事件影响路径可解释。

## 场景 4：跨平台热点爆发

某事件先在 X 出现，后进入新闻和 B站：

1. 保留首发时间和来源；
2. 聚类为一个事件；
3. 热度速度和加速度更新；
4. 显示跨平台传播；
5. 社交信号保持未确认，直到官方或多来源验证；
6. AI 输出未来 1/6/24 小时爆发概率；
7. 预警去重。

## 场景 5：港口或航道异常

1. 事件定位到物流节点；
2. 显示附近产业和产品；
3. 显示有证据的贸易流；
4. 模型替代路线单列；
5. 不从 AIS 推断货物；
6. 显示相关企业和证券；
7. AI 输出供应链风险区间。

## 场景 6：全球股票闭市

1. 显示交易所当地时间和状态；
2. 显示最后有效报价和时间；
3. 不标实时；
4. 新闻按该交易所日历对齐；
5. 相关产业事件显示证据和非因果说明；
6. AI 推演显示数据截止时间。

## 场景 7：完全无 Provider

1. 所有页面正常加载；
2. 无假新闻、假 K 线、假船、假贸易和假企业；
3. 每个模块显示明确未配置状态；
4. Provider Operations 显示需要的非敏感配置；
5. 本地基线模型只有在最低输入满足时输出推演；
6. 所有自动化门禁通过。

---

# 21. 数据导入模板

## 21.1 地理

`geo_units.csv`

```text
geo_id,parent_geo_id,level,country_iso2,country_iso3,subdivision_code,local_name,zh_name,en_name,alternate_names,centroid_lat,centroid_lon,boundary_ref,boundary_review_status,timezone_ids,source_id
```

## 21.2 产业集群

`industry_clusters.csv`

```text
cluster_id,canonical_name,alternate_names,geo_scope_ids,cluster_type,official_recognition_status,recognizing_authority,recognition_date,industry_category_ids,coverage_status,coverage_note,source_id
```

## 21.3 产品和 HS

`product_taxonomy.csv`

```text
product_id,parent_product_id,industry_category,local_name,zh_name,en_name,synonyms,process_tags,material_tags
```

`product_hs_mappings.csv`

```text
mapping_id,product_id,hs_version,hs_code,mapping_scope,mapping_status,valid_from,valid_to,source_id
```

## 21.4 企业和工厂

`companies.csv`

```text
company_id,legal_name,registration_country,registration_number,canonical_name,alternate_names,company_type,parent_company_id,ultimate_parent_id,headquarters_geo_id,website,listed_status,coverage_tier,source_id
```

`facilities.csv`

```text
facility_id,company_id,facility_name,facility_type,geo_id,address,lat,lon,industrial_park_id,operational_status,product_ids,process_tags,capacity_disclosures,employment_range,oem_odm_brand_mode,source_id
```

`securities.csv`

```text
security_id,issuer_company_id,instrument_type,local_ticker,mic,isin,currency,primary_listing,provider_instrument_ids,valid_from,valid_to,source_id
```

## 21.5 物流和贸易

`logistics_nodes.csv`

```text
node_id,node_type,geo_id,name,lat,lon,codes,operator_company_id,capabilities,source_id
```

`trade_flow_observations.csv`

```text
flow_id,reporter_geo_id,origin_geo_id,origin_aggregation_level,destination_geo_id,product_id,hs_version,hs_code,period_start,period_end,trade_direction,value,value_currency,quantity,quantity_unit,net_weight_kg,transport_mode,provider_id,source_id
```

所有导入器必须支持：

- dry run；
- schema validation；
- 行级错误报告；
- 文件 SHA-256；
- 幂等导入；
- 可逆或可追踪更新；
- 不覆盖来源冲突；
- 仅导出实际存在的记录。

---

# 22. 固定 UI 警示文案

## 22.1 AI 推演

```text
AI推演｜非事实｜可能完全错误｜不得作为投资、采购、物流或安全决策依据
```

## 22.2 AIS

```text
AIS仅表示船舶自报广播观测，不能证明货物、始发工厂、买方、价值、提单或最终卸货地。
```

## 22.3 聚合贸易

```text
该数据为所示行政或统计层级的聚合贸易观测，不能自动归属于某个镇、企业或工厂。
```

## 22.4 相关性

```text
事件、新闻与价格变化的时间相关不构成已证明因果关系。
```

## 22.5 覆盖率

```text
列表仅包含当前已验证和已授权覆盖的企业或工厂，不代表该地区全部主体。
```

## 22.6 实时

```text
只有在 Provider 合同允许、展示/再分发权已确认且实时路径实际验证后，数据才标记为实时。
```

---

# 23. 安全、隐私和合规

- 密钥只存服务端或系统安全存储；
- 前端环境变量严格扫描；
- 日志不得包含密钥、Cookie、授权头和个人敏感数据；
- Provider 配置 UI 只显示存在性、有效性和最后验证时间；
- 社交作者仅保存业务需要的公开或授权字段；
- 遵守 Provider 数据保留和删除要求；
- 导出功能检查许可；
- 用户自选和本地设置使用现有桌面安全边界；
- 所有外部 URL 经过验证和安全打开；
- 不建立自动交易功能；
- 股票预测界面保留非投资建议；
- 中国地图继续使用审查数据，未审查时禁用边界展示。

---

# 24. 性能和可运维性要求

## 24.1 地图

- 使用视口查询、聚合和渐进加载；
- 大量工厂点使用服务器分页或瓦片化，不一次加载全世界；
- 只在足够缩放级别显示工厂；
- 事件和流向图层可单独开关；
- 无地图数据时页面仍可用列表和详情。

## 24.2 实时流

- 浏览器只连接同源 SSE/WebSocket；
- 服务端统一限流、重连和心跳；
- 断线后显示最后观测和状态；
- 不因一个 Provider 故障阻塞其他模块；
- 热度计算使用幂等时间窗。

## 24.3 可观测性

至少记录：

- 任务最后尝试和成功时间；
- Provider 状态；
- 请求错误分类；
- 输入/输出记录数；
- 去重数；
- 聚类数；
- 数据新鲜度；
- 预测生成和评估数；
- 预警派发和抑制数；
- 不记录秘密值。

---

# 25. Codex 阶段交付格式

每个阶段结束时，Codex 必须按以下结构汇报：

```text
阶段：Phase XX — 名称

1. 基线
- 工作区
- 分支
- 起始 SHA
- 结束 SHA
- main 是否未变

2. 已实现
- 代码
- 契约
- 数据迁移
- UI
- Provider/运维

3. 真实性边界
- 已验证事实
- 模型估算
- AI推演
- 尚未配置 Provider
- 尚未获得许可

4. 测试与证据
- 命令
- 退出码
- 测试数
- 截图
- 日志和 SHA-256
- 保留失败

5. 数据覆盖
- 已验证实体数
- 来源数
- 覆盖等级
- 缺口

6. 变更清单
- 文件
- 迁移
- 配置项
- 新环境变量名称，不含值

7. 未完成事项
- Provider-backed 验收
- 许可证
- 数据来源
- 人工决策

8. 下一阶段入口条件
```

不得只写“已完成”而没有可复核证据。

---

# 26. 最终交付清单

完成 Phase 25 时至少交付：

- 可审查 Draft PR；
- 所有阶段提交和不可变 SHA；
- 更新后的 `MASTER_STATUS.md`；
- 更新后的 `ACCEPTANCE_EVIDENCE.md`；
- 架构和数据字典；
- Provider 许可矩阵；
- 全球交易所覆盖矩阵；
- 产业和工厂覆盖矩阵；
- 数据导入模板；
- 运维手册；
- 模型卡和评估报告；
- Windows 安装包；
- 无 Provider 和 Provider-backed 两套验收证据；
- 未完成和需要用户提供的配置清单；
- 不含任何密钥、私钥、Cookie 或用户敏感值。

---

# 27. 执行优先级总结

## P0：不可跳过

- Phase 13 基线保护；
- Phase 14 统一证据和契约；
- 无假数据和许可边界；
- 分支、测试和证据制度。

## P1：最先形成用户价值

- 全球产业地图核心；
- 企业/工厂注册表；
- 女鞋、东莞、荷兰、德国纵向案例；
- 贸易流向；
- 新闻、X、B站跨平台事件；
- 热度上升和爆发检测。

## P2：金融和推演闭环

- 全球交易所和股票；
- AI推演；
- 事件—产业—物流—股票图谱；
- 桌面预警。

## P3：规模化

- 更多国家、镇、产业和企业；
- 更多合法 Provider；
- 更高粒度提单和物流数据；
- 模型升级和长期校准；
- 性能、覆盖和商业授权扩展。

---

# 28. 最终执行判断

现有项目已经具备稳定母体、股票工作区、海运、中国工厂、Provider 运维、桌面端和完整验收体系。后续工作的核心不是继续增加孤立页面，而是建立一套统一的数据和证据底座，把以下对象连接起来：

```text
全球事件
+ 新闻与社交热度
+ 地理位置
+ 产业集群
+ 产品和工艺
+ 企业与工厂
+ 贸易和物流
+ 全球证券
+ AI推演
```

Codex 必须以“事实不造假、模型可解释、覆盖可量化、来源可追溯、阶段可验收”为最高执行原则。任何真实 Provider、产业事实、工厂名单、贸易流向和股票行情，只能在来源、许可、时间和聚合层级均满足要求后进入正式事实层。

本方案审核通过后，即作为 Phase 13 的正式输入文件执行。
