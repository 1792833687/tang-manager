# 《我在唐朝当掌柜》独立项目 · 交接报告

> 生成时间：2026-08-04 16:04（部署上线后更新）
> 交接方：游戏开发工作室（主理人·游承峰）
> 接手方：tang-manager 独立项目维护团队

---

## 一、项目概况

| 项 | 值 |
|---|---|
| 项目名 | 我在唐朝当掌柜（Tang Manager） |
| 版本 | v1.0.0（发布版） |
| 技术栈 | Next.js 15 + TypeScript + Zustand v5 + Tailwind CSS |
| 新项目路径 | `C:\Users\17928\WorkBuddy\tang-manager\` |
| 源项目路径 | `C:\Users\17928\WorkBuddy\游戏开发\`（凛冬要塞 + 唐朝掌柜共存，**提取后源零修改**） |
| 构建方式 | 静态导出（output: export，basePath 空，images unoptimized） |
| 部署目标 | GitHub Pages（gh-pages 分支，JamesIves action 待接入） / EdgeOne Makers 备用 |

## 二、功能清单（v1.0 完整版）

- **开局流程**：身份确认、店型选择（酒楼/布庄/药铺）、难度选择（A/B/C）
- **经营循环**：动态客流（客人数随评分/声望浮动 2-20）、六操作接待（正常/通晓人心/推荐/闲聊/赠礼/婉拒四法）、打烊结算
- **库存管理**：陈损（保质期/仓储费/库房扩建）、批量折扣、籴粜契（预付三成）、市易务挂牌、庖制/染织/炮制加工、食盒/锦匣/药囊组合、预购订单（预留/交货/逾期）
- **员工系统**：招聘、四态排班（早/晚/全/休）、过劳检测、学艺拜师（束脩/绝技）、师徒关系、人际关系网（和睦/竞争/矛盾）、遣散
- **金融系统**：现银/飞钱/信用三货币、钱庄（兑换/存款/抵押/高利贷）、投资（商会/沈听澜/地下）、通胀（±5% 月浮动）、循环借贷、商业赊账、人情债、被栽赃
- **商业地图**：三层长安舆图（永乐坊/东市西市/长安京畿）、跑商（区域物价差）、镖队物流（6 类商队事件）、绿色通道、节点繁荣度、商路可视化、图层筛选、自定义标记、快速移动、路线规划、事件徽章、季节性色调
- **势力博弈**：六大派系（东市商会/西市商团/京兆府/地下/平康坊/朝廷）、门路关系、特权阈值 20-100、从商转政（phase='politics'）
- **线索系统**：蛛丝马迹（22 条线索池）、自动/手动关联、隐藏剧情
- **迷雾系统**：三类迷雾（区域/势力/人物）、按好感度逐步揭示、坊间传言池
- **NPC 系统**：9 位（阿昭/沈听澜/谢七/苏大娘/程掌柜/陆伯/萨迪/上官公子/阿萤）、登场条件/专属功能/好感揭示/3 天拜访冷却
- **AI 叙事**：天机阁（5 模型预设，默认 deepseek-chat）、加密存储、10s 超时试连、离线模板降级
- **成瘾性玩法**：手札占候（8 卦）、今日要务（8 任务红印）、周间要务、陆家遗命（4 链）、谢七赌约（4 彩头）、市易务暗标（3 盲拍）、伙计小传（4 阶段）、商阶（7 段位）、局外成长（8 传承，独立 localStorage）、月度总结
- **负反馈**：树大招风/集体涨薪/自然灾害/员工挖角/沈听澜使绊/阿昭偷钱/赊账跑路/钱庄挤兑
- **新手引导**：25 引导点（21 基础 + 里程碑：首次存款/跑商/排班/雇佣）、三形式（手札弹窗/阿昭气泡/描金微光）、重读手札重置
- **八种结局**：一代商圣/皇商之路/归隐田园/商界教父/家道中落/权倾朝野/无人问津/执棋者（隐藏）
- **UI 打磨**：12 面板切面切换、功能解锁 12 项、统一 modal-container 弹窗、action-feedback 浮动反馈、按钮点击/悬停反馈、formatMoney 金额取整、通知系统（3 条排队）

## 接待系统重设计（2026-08-05 · 模块一~七）

**目标**：三店接待特色化（酒楼宴席/布庄量身/药铺问诊）、对话感（状态机 + AI 对话）、决策后故事弹窗。

| 模块 | 内容 | 关键文件 |
|---|---|---|
| 一 | 三店独立接待流程（纯函数，rng 注入，禁止共用处理函数） | src/systems/tang-reception-tavern.ts / tang-reception-clothier.ts / tang-reception-herbalist.ts；配置 src/config/tang-reception-content.ts |
| 二 | 对话状态机（greeting→player_response→guest_reply→recommend→guest_feedback→follow_up→resolution）+ 心情系统 + 对话 UI | src/systems/tang-dialogue-engine.ts；src/components/tang-manager/dialogue-panel.tsx |
| 三 | 店员提醒（每阶段最多 1 条：阿昭/账房/护卫，可采纳/忽略） | src/systems/tang-staff-reminders.ts |
| 四 | 故事弹窗（叙事+NPC台词+数值小字+打字机） | src/components/tang-manager/story-modal.tsx；src/config/tang-story-templates.ts |
| 五 | AI 对话接入（开场白/回应/结果叙事；>8s 超时降级模板；模板池：开场 10/店、回应 5/心情、成交 8/店、失败 5/店、评价 5/店） | src/systems/tang-narrator.ts（新增 generateGuestGreeting/generateGuestReply/generateResolutionNarrative）；src/config/tang-dialogue-templates.ts |
| 六 | Store：dialogueHistory + appendDialogue/clearDialogue/setGuestMood/completeDialogueReception/showStoryNarrative/dismissStoryNarrative（persist 保持 v16，新字段不持久化） | src/stores/tang-manager.ts；src/types/tang-dialogue.ts |
| 七 | 测试：+5 文件 43 用例（tavern/clothier/herbalist/dialogue-engine/staff-reminders） | tests/unit/systems/tang-reception-*.test.ts 等 |

**接线**：reception-panel 当前客人卡改用 DialoguePanel（右上「传统操作」可切回旧六操作）；page.tsx 全局挂载 StoryModal；event-panel 事件决策后弹故事弹窗。AI 不可用/离线/超时一律模板兜底，绝不 throw。

---## 店员互动提升（2026-08-05 · 模块一~六）

**目标**：阿昭与员工从数值面板变为会主动观察/提醒/给建议的"活人"。

| 模块 | 内容 | 关键文件 |
|---|---|---|
| 一 | 经营全局提醒系统：generateStaffReminders（条件过滤→优先级排序→同阶段最多 2 条）/ applyReminderEffect（采纳→效果+满意度+2；忽略×3→满意度-5） | src/systems/tang-staff-reminders.ts；src/types/tang-reminders.ts |
| 二 | 各店员提醒池（阿昭/账房/厨师/裁缝/药师/护卫；清晨/接待/午后/打烊/库存/金融/员工 阶段，~25 条） | src/config/tang-staff-reminder-pools.ts |
| 三 | 提醒气泡 UI（30×30 头像/三角气泡/照办·知道了/高朱砂·中描金·低竹青/滑出淡入）+ 宿主（最多 2 条 + 问候/报告横幅） | src/components/tang-manager/staff-reminder-bubble.tsx / staff-reminder-host.tsx |
| 四 | 每日清晨随机员工问候 + 打烊按满意度分档报告（积极/中性/消极/沉默） | src/systems/tang-staff-daily.ts |
| 五 | Store：staffReminders/staffIgnoreCounts/dailyStaffGreeting/dailyStaffReport + generateReminders/applyReminder/dismissReminder/clearReminders/setDailyStaffGreeting/setDailyStaffReport；persist **v17**（保留旧存档 + 新字段取 base 初始态） | src/stores/tang-manager.ts |
| 六 | 测试：tang-staff-reminders（14）+ tang-staff-daily（7）= +15 用例 | tests/unit/systems/tang-staff-*.test.ts |

**接线**：startNewDay 清晨 → 问候 + morning 提醒；settleDay 打烊 → 报告 + closing 提醒；StaffReminderHost 挂 main 顶部（接待对话区上方即全局顶部）；采纳效果落账（阿昭满意度/好感直接应用，其余记 eventLog 供后续系统接线）。

---## 店铺特色产业系统（2026-08-05 · 模块一~六）

**目标**：三店各自拥有独特深度玩法（酒楼研发+宴席 / 布庄织造合作+定制 / 药铺坐堂医+药方），完全独立、各 5 级升级路径。

| 模块 | 内容 | 关键文件 |
|---|---|---|
| 一 | 酒楼：新菜研发（方向/投入/厨师/1-5天/大成功10%·成功70%·失败20% + 招牌菜机制）+ 宴席承办（寿/婚/洗尘/饯行/商会宴；筹备6-8菜+酒水+雅间；结算净利+声望+引荐） | src/systems/tang-tavern-recipes.ts / tang-tavern-banquets.ts |
| 二 | 布庄：织造合作（寻访织工/技艺→抽成/寄卖分账/满意度离开）+ 定制订单（嫁衣/官服/寿衣/常服/批量；交货完美/基本/瑕疵/拒收） | src/systems/tang-clothier-cooperative.ts / tang-clothier-custom-orders.ts |
| 三 | 药铺：坐堂医（聘请/专长/医术→月薪·病患/每日自动问诊·开方/库存匹配·缺药降满意度/误诊纠纷）+ 药方研发（汤丸散膏/2-7天/成功·改良·失败/独家秘方品质≥4·售价+50%·泄露风险） | src/systems/tang-herbalist-physician.ts / tang-herbalist-recipes.ts |
| 四 | 升级路径（三产业各 5 级）+ 经营之道（me 面板产业等级/进度/条件/手札贺词） | src/config/tang-industry-content.ts；src/components/tang-manager/industry-panel.tsx（挂载 me-panel） |
| 五 | Store：tavernDishes/tavernBanquets/tavernLevel/weavers/customOrders/clothierLevel/physicians/herbRecipes/herbalistLevel 等 17 字段 + 17 actions + industryTick（每日研发/宴席/问诊/补货）+ persist **v18** | src/stores/tang-manager.ts |
| 六 | 测试：6 新文件 37 用例（tavern-recipes/tavern-banquets/clothier-cooperative/clothier-custom-orders/herbalist-physician/herbalist-recipes） | tests/unit/systems/tang-*-*.test.ts |

**接线**：startNewDay 清晨调用 industryTick（研发到期结算/宴席到期举办/郎中坐堂问诊/织工补货）；me 面板「经营之道」展示三产业等级与升级；采纳式升级带手札贺词。三产业逻辑完全独立（各自 systems 文件，不共用处理函数）。

---## 地图与事件系统深化（2026-08-05 · 模块一~八）

**目标**：长安舆图成为探索空间（节点微型故事+居民对话），随机事件不再单调（分支连锁/区域风味/多样触发/疲劳度）。

| 模块 | 内容 | 关键文件 |
|---|---|---|
| 一 | 节点微型故事（首次必触发/重复 30%/特殊时机）+ 节点居民对话（店伙计/老住户/路人/小孩；部分带效果如羊肉进价-10%） | src/systems/tang-node-stories.ts / tang-node-residents.ts；config/tang-node-stories-content.ts；map-node-card 加「听一段轶闻/与居民攀谈」 |
| 二 | 事件选择影响追踪（eventHistory/pendingConsequences）+ 连锁事件（邻居借粮/官府征用/乞丐讨食/竞争对手分支树 A/B/C；指定天数到期自动触发） | src/systems/tang-event-consequences.ts |
| 三 | 四区域特色事件池（永乐坊邻里/东市商业/西市胡商/长安城权力，各 4-5 事件×3 选项） | config/tang-events-yongle.ts / east-market / west-market / changan |
| 四 | 触发条件多样化（行为/库存/人际 → checkBehaviorTriggers）+ 事件疲劳度（30天/事件、7天/类2次、连续3天休息、一次性） | src/systems/tang-event-fatigue.ts |
| 五 | 事件叙事增强：AI 场景/结果叙事 + 正面/负面结果模板兜底（≥3 套） | config/tang-story-templates.ts（RESULT_TEMPLATES）；既有 AiNarration |
| 六 | 地图可视化：活跃事件节点脉冲光晕（金=商机/红=威胁） | src/components/map-view.tsx |
| 七 | Store：eventHistory/pendingConsequences/nodeStoriesRevealed/eventFatigue + recordEvent/addPendingConsequence/checkPendingConsequences/revealNodeStory/triggerRegionEvent + persist **v19**；startNewDay 每日查连锁；resolveEventChoice 记录选择+登记连锁+疲劳 | src/stores/tang-manager.ts |
| 八 | 测试：3 新文件 14 用例（node-stories/event-consequences/event-fatigue） | tests/unit/systems/tang-*.test.ts |

**接线**：resolveEventChoice → 记录 eventHistory + 登记 pendingConsequences + 疲劳度；startNewDay → checkPendingConsequences（到期弹窗+数值应用）；map-node-card 轶闻/攀谈；map-view 事件节点脉冲。区域事件经 triggerRegionEvent 入队。

---## v1.1 深化整合（2026-08-05 · 五大模块）

整合规格书五大模块全部落地：① 接待重设计 ② 店员互动提升 ③ 店铺特色产业 ④ 地图与事件深化 ⑤ **AI 文本生成全量接入**。

| v1.1 模块 | 交付 |
|---|---|
| 一 接待重设计 | dialogue-panel + story-modal + 三店独立接待系统（见前章节） |
| 二 店员互动 | staff-reminder-bubble/host + 各店员提醒池 + 晨间问候/打烊报告 |
| 三 产业系统 | 三产业独立玩法 + 5 级升级 + 经营之道 |
| 四 地图事件 | 节点故事/居民 + 事件连锁 + 四区域事件池 + 疲劳度 + 地图脉冲光晕 |
| 五 **AI 全量接入** | 统一生成器 `tang-ai-generator.ts`（8 类内容 × 专用系统提示词；优先级：类型开关→在线→key→AI 8s→模板；流式/非流式统一；静默降级）；店员提醒/节点故事已接线 AI 优先；兜底模板聚合 `tang-fallback-templates.ts`；store：`aiContentToggles`（天机阁逐类开关）+ `aiGenerationLog`（调试成功率）+ persist **v20** |

**验收**：tsc 零错误 → 全量 **89 文件 / 1116 用例全绿**（零回归）→ build 成功（251kB）。五模块提交见 git log（d236d88 / f7308e3 / 041fbbb / 563614f / +AI）。
- **P0 修复集（2026-08-05，已上线）**：① 开局界面被新手引导遮罩盖住（FIRST_GUEST 在身份阶段误触发）→ 状态型引导仅 `phase==='playing'` 触发；② 产业面板不再三产业全显 → 按所选店型隔离（选酒楼只见酒楼产业）；③ 行为/库存/人际触发事件与四区域事件池接入每日清晨事件流（checkBehaviorEvents + maybeRegionEvent，按疲劳度）；④ 天机阁新增 AI 内容逐类开关 + 调试成功率；⑤ me 面板新增「重新开档」（清档重走开局，成就保留）。Playwright 真机验证：开局全流程可走通、产业隔离正确、0 错误。
- **P1 继续（2026-08-05，已上线）**：对话式接待结算接入「接待策略（delegate/priority→伙计代劳）」「大单预购（big_order 20% 转预购）」；DialoguePanel 推荐阶段新增「通晓人心」入口（揭示偏好）；事件决策后弹窗去重（移除内联 AiNarration，保留 StoryModal）；+3 store 集成测试（正常/预购/策略）。验收：tsc 零错误 + 全量 1123 用例全绿 + build 成功；Playwright 线上 0 错误。
- **P2 收尾（2026-08-05，已上线）**：月度总结/客人评价接入 AI 生成（best-effort 模板兜底，onLog 记录）；连锁事件弹窗数值区展示实际银两/声望变动；+3 store 接线集成测试（连锁到期/行为触发/产业每日结算）。验收：tsc 零错误 + 全量 1126 用例全绿 + build 成功；Playwright 线上 0 错误。
- **P1 执行（2026-08-05，已上线，据诊断报告确认执行）**：① 派系党争接线——已选政治派系后每 30 天触发 runFactionPowerStruggle + 结果弹窗；② 月度政令接线——每月初 generateDecree（巍明楼政令横幅动态渲染）；③ 转政最小闭环——官场线每日一道政务（5 道：漕运/党争/边军/商税/皇商），抉择影响声望/评分/政治立场，尽办→权倾朝野结局；④ 购店方案 A——me 面板「购置分店」（第一家 800 两、逐店递增，shopCount+1、maxEmployees+2）。+2 store 集成测试。验收：tsc 零错误 + 全量 1128 用例全绿 + build 成功；Playwright 线上 0 错误。
- **体验优化包（2026-08-05，已上线）**：① 修「布店/药铺客人点菜」——需求描述改为按店型×类型生成（GUEST_DESC_TEMPLATES 分店型，药铺含症状关键词）；② 经营看板优化——新增今日概览条（评分/声望/气氛/季节/产业Lv/资产）+ 消息待办面板（NPC 代办：谢七赌约/市易务暗标等，清晨生成）；③ AI 文案淡附注（对话气泡 ✦天机 / 故事弹窗 天机所拟，低对比不扰沉浸）；④ 打烊结算面板——弹窗展示今日收益/支出/净收益 + 今日之事（事件回顾）+ 伙计禀报；⑤ 店铺资产系统——购置 8 种物件（描金招牌/古风灯笼/檀木柜台/铁灶/织机/药柜/雅间/酒旗）带来声望/评分/常驻气氛·满意度（buildReceptionPatch 接线）。+6 测试。验收：全量 1134 用例全绿；Playwright 线上 0 错误（布庄描述无点菜）。
- **体验优化包·第2波（2026-08-05，已上线）**：① 修 AI 文案重复——开场白/客人回应改为只入对话历史一次（AI 成功替换最后一条，打字机作用于末条客人消息）；② 经营看板优化——今日概览条**吸附屏幕上方**（sticky）且每项可点开二级详情弹窗，产业/资产点击跳转「店铺管理」；③ 面板去重整合——me 面板瘦身为「概况」，家业/经营策略/资产/产业迁入新增的 **「店铺管理」面板**（导航第 13 项，侧栏点击进入，不占快捷键）；④ 接待面板文案已按店型（布庄=布料/成衣，无点菜）。导航铁律测试更新为 13 项（前 12 顺序不变 + shop）。验收：全量 1134 用例全绿；Playwright 线上 0 错误（开场白唯一、店铺管理可进）。

---## 三、当前进度（E1 + E2 完成）

| 阶段 | 状态 | 说明 |
|---|---|---|
| E1 项目骨架 | ✅ 完成 | 文件迁移（src 203/tests 73/public 155）、路径替换（@/components/tang-manager/→@/components/、@/theme/ancient/→@/theme/）、依赖收敛（next/react/react-dom/zustand/uuid/idb/zod）、tsc 零错误、源项目零修改 |
| E2 测试+构建+Git | ✅ 完成 | tsc 零错误 → 全量测试 73 文件/1000 用例全绿 → build 串行成功（out 静态导出，`/` 直达游戏）→ git init(main) + 首次提交 + deploy.yml 就绪 |
| 部署上线 | ✅ 完成 | 新仓库 1792833687/tang-manager GitHub Pages 已上线：https://1792833687.github.io/tang-manager/（/ 直达唐朝掌柜，无 /watchparty 前缀）；EdgeOne 备用 |

## 四、测试基线

- 源项目：**1567 用例全绿**（119 文件）
- 新项目：91 测试文件；实测 **1137 用例全绿**（2026-08-06 P2 里程碑引导验收：tsc 零错误 → 全量 1137 → build 串行通过 → 已上线）
- vitest.config.ts 已裁剪（移除 memory/dialogue/map 覆盖率阈值），setup.ts 已去 map 夹具
- tests 从 tsconfig 排除（沿用源做法，tsc 只查 src）
- 稳定姿势：pool threads / minWorkers 1 / maxWorkers 2 / testTimeout 30s（已固化 config）
- tsconfig.tests.json 已适配新项目路径（对齐源项目；仅供 IDE/工具链类型检查，tests 98 个类型错误未接 CI——对应 K2 专项治理）

## 五、部署信息

### GitHub Pages（主）
- 源仓库 watchparty（1792833687/watchparty）：gh-pages @ `65fa97e5`（v1.0 + network-first sw.js），线上 https://1792833687.github.io/watchparty/scripts/tang-manager
- **新独立仓库**：1792833687/tang-manager（public）已创建并上线 —— main @ `6526db1e`（本机 github.com 直连被阻断，走 github-api-push.mjs API 推送）；deploy.yml 已验证（Actions #30889723894 success：typecheck→test→build→JamesIves 推 gh-pages）
- **线上地址**：https://1792833687.github.io/tang-manager/（gh-pages @ `0b482aef`，2026-08-05 v1.1 子路径部署修复后上线；`/` 直达唐朝掌柜，`/scripts` 入口页，sw.js network-first v8.0.0，Playwright 真机验证 0 错误）
- **关键修复（上线后 2026-08-04）**：GitHub Pages 默认 Jekyll 构建剔除 _ 开头目录（_next/）→ 线上 JS/CSS 全 404、游戏无法启动；根因 = 部署产物缺 .nojekyll（非提取任务问题，分支文件完整）。修复 = public/.nojekyll + deploy.yml touch out/.nojekyll 双保险 + 重新触发 CI（JamesIves 真实 git push → Pages 新构建 363dd291 绕过 Jekyll）；直接 API 推 .nojekyll 未立即生效（Pages Jekyll 构建缓存），最终由 CI 链路生效
- **v1.1 子路径部署 P0 修复（2026-08-05）**：根因 = 静态导出 HTML 引用根路径 /_next/ 与 /images/，但站点部署在 /tang-manager/ 子路径 → 浏览器全部 404、JS 不加载 → 开始界面进不去/美术缺失/UI 乱（此前 curl 手动拼前缀验证掩盖了此 bug）。修复 = next.config basePath 由 NEXT_PUBLIC_BASE_PATH 驱动 + deploy.yml 构建注入 /tang-manager + loading-screen 图片改 withBase（审计确认其余图片/ANCIENT 资产均走 withBase）；另 SW 升 v8（清旧缓存）+ GameErrorBoundary（防整树白屏）。Playwright 真机验证：0 HTTP 错误、0 JS 错误、游戏可进入

### EdgeOne Makers（备选）
- 项目名 tang-shopkeeper：https://tang-shopkeeper-4tgvwhw2.edgeone.cool/scripts/tang-manager?eo_token=...（token 有时效，过期需重新部署）
- ⚠️ 源仓库根路径是凛冬要塞首页；独立项目部署后 `/` 即唐朝掌柜

### 关键修复（务必保留）
- **sw.js 用 network-first**（在线永远最新，F5 不再命中旧缓存）+ 缓存版本 `tang-v7-0-0`（activate 自动清旧缓存）——已同步到新项目 public/sw.js
- **GitHub 推送脚本**：github-api-push.mjs 带每请求 3 次自动重试；增量部署只推变更文件（生成单文件 gh-filelist 避免全量卡网络）
- 部署可靠路径：build 核对 out/images 完整性 → find 生成 filelist → GIT_FILE_LIST=... 推送 → POST /pages/builds → 线上双验证

## 六、已知问题 / 遗留（v1.0 QA 收录 K1-K12）

| 级别 | 编号 | 问题 |
|---|---|---|
| CONCERNS | K1 | 卦象/段位 UI 展示（数据就绪未实装界面） |
| CONCERNS | K3 | 上官政令预知为静态文案未预生成 Decree |
| CONCERNS | K4 | 沈听澜使绊（shenScheme）仅 store 字段未接采购计价 |
| CONCERNS | K5 | 程掌柜进价-10%（chengDiscountCategory）注释级未应用 |
| CONCERNS | K6 | 阿昭涨薪无 UI 入口 |
| 轻量 | K2 | tests/ 下 ~133 类型错误未入 CI（专项治理） |
| 轻量 | K7 | 负反馈面板无立绘 |
| 轻量 | K8 | 留言簿特殊客人联动占位 |
| 轻量 | K9 | 社交事件无 UI 弹窗（eventLog 记录，待接入） |
| 轻量 | K10 | 平康坊无地图节点（苏大娘/阿萤不渲染地图图标） |
| 轻量 | K11 | 空状态插图部分占位 |
| 轻量 | K12 | 无 |

## 七、开发规范（固化，务必遵守）

1. **效率约束**：开发期 `npm run test:unit:changed`；验收 tsc → changed → 全量一次 → build 串行；vitest 与 build 严禁并行；>60s 无响应报告重试
2. **凛冬要塞零触碰**（源项目）；新项目内：tokens.ts/4 美术组件（loading-screen/npc-portrait/scene-banner/tang-image）为保护文件
3. **古风铁律**：所有文案唐代古风措辞、生僻术语首现注释、禁现代商业词（套餐/VIP/积分等）
4. **纯函数可测**：数值计算必须纯函数 + rng 注入（Math.random 注入避免 flaky）
5. 并发写盘零覆盖：spawn 前 ls mtime 核对保护文件
6. persist 版本迁移：v16（丢弃重建策略），新字段注意 migrate

## 八、关键文件索引（新项目）

| 路径 | 说明 |
|---|---|
| src/stores/tang-manager.ts | 主 store（~5800 行，persist v16） |
| src/app/page.tsx | 唐朝掌柜主页（原 /scripts/tang-manager 升级） |
| src/systems/tang-*.ts | 64 个领域系统纯函数 |
| src/config/tang-*.ts | 35 个配置（古风文案/数值/事件池） |
| src/components/ | 73 个组件 |
| src/infrastructure/ | 14 个（storage/mode/sync/crypto/openrouter） |
| src/theme/tokens.ts | ANCIENT 设计令牌（唯一事实源） |
| public/sw.js | network-first Service Worker（v7.0.0） |
| scripts/validate-game-data.mjs | 数值校验脚本（开局容量/30 天不破产） |
| tests/unit/ | 91 测试文件（1137 用例全绿） |


---

## P2 里程碑引导 + 门面等级图标（2026-08-06）

**目标**：把「首次存款/跑商/排班/雇佣」四个关键操作也纳入新手引导（此前只有 21 条基础引导），并让店铺门面随产业等级可视化成长。

| 项 | 内容 | 关键文件 |
|---|---|---|
| 引导 ID | 新增 4 个：FIRST_DEPOSIT / FIRST_TRADE / FIRST_SCHEDULE / FIRST_HIRE（总数 21→25） | src/config/tang-tutorial-ids.ts |
| 手札文案 | 4 条古风家书（钱庄存贷 / 跑商贱买贵卖 / 伙计轮值 / 雇佣帮手），kind=handbook | src/config/tang-tutorial-content.ts |
| Store 接线 | depositToBank→FIRST_DEPOSIT、assignShift→FIRST_SCHEDULE、hireEmployee→FIRST_HIRE、executeTradeRun→FIRST_TRADE（均走 showTutorial 防重） | src/stores/tang-manager.ts |
| 门面可视化 | 概览条「产业」chip 升级为「门面」：Lv1 街边🛖 → Lv2 坊间🏮 → Lv3 名楼/名坊🏯 → Lv4 名肆/名号🏛️ → Lv5 天下第一👑 | src/components/shop-overview-strip.tsx |
| 测试 | 教程计数断言 21→25（含 ID 全集逐字 + kind 规则 24 条 handbook）；新增里程碑引导 3 用例（4 id 合法/文案完备/禁现代词 + 首次雇佣/排班接线） | tests/unit/systems/tang-tutorial.test.ts、tests/unit/stores/tang-manager-store.test.ts |

**验收**：tsc 零错误 → 全量 **1137 用例全绿**（91 文件）→ build 静态导出成功 → 已推送上线（main @ `f04f9469`，gh-pages @ `e45ee634`）→ Playwright 真机冒烟：入口标题正确、开局全流程（性别/年龄/名字 → 开店方向 → 难度 A/B/C → 开张）可走通、**0 控制台错误**。

**源项目零修改复核**：本轮工具脚本曾误在源项目（游戏开发）执行，已逐字回滚（tang-tutorial-content.ts / tang-tutorial.test.ts 与 tang-manager HEAD 完全一致，store 测试无指纹残留）。
