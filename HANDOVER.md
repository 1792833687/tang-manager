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
- **新手引导**：21 引导点、三形式（手札弹窗/阿昭气泡/描金微光）、重读手札重置
- **八种结局**：一代商圣/皇商之路/归隐田园/商界教父/家道中落/权倾朝野/无人问津/执棋者（隐藏）
- **UI 打磨**：12 面板切面切换、功能解锁 12 项、统一 modal-container 弹窗、action-feedback 浮动反馈、按钮点击/悬停反馈、formatMoney 金额取整、通知系统（3 条排队）

## 三、当前进度（E1 + E2 完成）

| 阶段 | 状态 | 说明 |
|---|---|---|
| E1 项目骨架 | ✅ 完成 | 文件迁移（src 203/tests 73/public 155）、路径替换（@/components/tang-manager/→@/components/、@/theme/ancient/→@/theme/）、依赖收敛（next/react/react-dom/zustand/uuid/idb/zod）、tsc 零错误、源项目零修改 |
| E2 测试+构建+Git | ✅ 完成 | tsc 零错误 → 全量测试 73 文件/1000 用例全绿 → build 串行成功（out 静态导出，`/` 直达游戏）→ git init(main) + 首次提交 + deploy.yml 就绪 |
| 部署上线 | ✅ 完成 | 新仓库 1792833687/tang-manager GitHub Pages 已上线：https://1792833687.github.io/tang-manager/（/ 直达唐朝掌柜，无 /watchparty 前缀）；EdgeOne 备用 |

## 四、测试基线

- 源项目：**1567 用例全绿**（119 文件）
- 新项目：73 测试文件复制到位（store-instantiation.test.ts 已剔除——引凛冬 store 非 tang 属）；实测 **1000 用例全绿**（源 1567 为全量含凛冬，tang 独立部分即 1000，2026-08-04 验收通过）
- vitest.config.ts 已裁剪（移除 memory/dialogue/map 覆盖率阈值），setup.ts 已去 map 夹具
- tests 从 tsconfig 排除（沿用源做法，tsc 只查 src）
- 稳定姿势：pool threads / minWorkers 1 / maxWorkers 2 / testTimeout 30s（已固化 config）
- tsconfig.tests.json 已适配新项目路径（对齐源项目；仅供 IDE/工具链类型检查，tests 98 个类型错误未接 CI——对应 K2 专项治理）

## 五、部署信息

### GitHub Pages（主）
- 源仓库 watchparty（1792833687/watchparty）：gh-pages @ `65fa97e5`（v1.0 + network-first sw.js），线上 https://1792833687.github.io/watchparty/scripts/tang-manager
- **新独立仓库**：1792833687/tang-manager（public）已创建并上线 —— main @ `6526db1e`（本机 github.com 直连被阻断，走 github-api-push.mjs API 推送）；deploy.yml 已验证（Actions #30889723894 success：typecheck→test→build→JamesIves 推 gh-pages）
- **线上地址**：https://1792833687.github.io/tang-manager/（gh-pages @ `9504d0f`，2026-08-04 上线；`/` 直达唐朝掌柜，`/scripts` 入口页，sw.js network-first v7.0.0，图片/资源 200 验证通过）
- **关键修复（上线后 2026-08-04）**：GitHub Pages 默认 Jekyll 构建剔除 _ 开头目录（_next/）→ 线上 JS/CSS 全部 404、游戏无法启动；已加 public/.nojekyll + deploy.yml 	ouch out/.nojekyll 双保险，gh-pages 分支同步补 .nojekyll 并重建

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
| tests/unit/ | 73 测试文件（1000 用例全绿） |
