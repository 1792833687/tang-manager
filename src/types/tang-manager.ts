/**
 * 《我在唐朝当掌柜》全局类型定义
 * 剧本模块（src/app/scripts/tang-manager/**）专用，独立于「凛冬要塞」既有类型。
 * @module types/tang-manager
 */
import type {
  MapEvent,
  MapLayer,
  MapRoutePlan,
  MapCaravanPrefill,
  NodeProsperity,
  PlayerMarker,
  TradeRoute,
  TradeRunResult,
  TransportArrivalResult,
  TransportingGoods,
} from '@/types/tang-map';
import type { UnlockGreenChannelResult } from '@/systems/tang-trade';
import type { Faction, FactionPerk, FactionUpdateResult, NPCFavor } from '@/types/tang-factions';
import type { JournalEntry } from '@/types/tang-journal';
import type { DialogueMessage, GuestMood, ShopReceptionResult, StoryNarrative } from '@/types/tang-dialogue';
import type { ReminderContext, StaffReminder } from '@/types/tang-reminders';
import type {
  Banquet,
  BanquetType,
  CustomOrder,
  CustomOrderType,
  HerbRecipe,
  HerbResearchJob,
  IndustryOverview,
  Physician,
  TavernDish,
  TavernResearchJob,
  Weaver,
} from '@/types/tang-industry';
import type { DishCategory, HerbRecipeCategory } from '@/types/tang-industry';
import type { PoliticsDecision } from '@/config/tang-politics-decisions';
import type { EventFatigue, EventRecord, NodeStoriesRevealed, NodeStory, PendingConsequence } from '@/types/tang-map-story';
import type { MapRegion } from '@/types/tang-map-story';
import type { AiContentType } from '@/systems/tang-ai-generator';
import type { Clue, ClueCategory } from '@/types/tang-clues';
import type { Caravan, CaravanGoods } from '@/types/tang-caravan';
import type { Decree, AlignResult } from '@/systems/tang-politics';
import type { PoliticalSubFactionId } from '@/config/tang-politics';
import type { NegativeEvent } from '@/systems/tang-negative-feedback';

/** 游戏阶段：身份 → 店型 → 难度 → 经营中 → 破产 / 被查封（5b：抵押物 shop 没收）/ 官场线（5b-5：转政占位） */
export type GamePhase = 'identity' | 'shop-type' | 'difficulty' | 'playing' | 'bankrupt' | 'seized' | 'politics';

/** 店型：酒楼 / 布庄 / 药铺 */
export type ShopType = 'jiulou' | 'buzhuang' | 'yaopu';

/** 双视图模式：日常经营（operations） / 经营看板（dashboard） */
export type TangViewMode = 'operations' | 'dashboard';

/** 难度档位：A 小本经营 / B 正经营生 / C 大买卖 */
export type Difficulty = 'A' | 'B' | 'C';

/** 掌柜性别 */
export type Gender = 'male' | 'female';

/** 掌柜年龄段：少年 / 青年 / 中年 */
export type AgeBand = 'young' | 'adult' | 'middle';

/** 玩家身份（开档时填写） */
export interface PlayerIdentity {
  name: string;
  gender: Gender;
  age: AgeBand;
}

/**
 * 难度参数 — 与 src/config/tang-difficulty.ts 的 DIFFICULTY_PARAMS 一一对应。
 * 字段含义：
 * - label                难度中文名（小本经营 / 正经营生 / 大买卖）
 * - tagline              难度副标语（卡片上的经营格言）
 * - initialGold          初始资金（两）
 * - initialDebt          初始负债（两）
 * - monthlyInterest      每月月息（两）
 * - initialScore         初始店铺评分（1.0-5.0）
 * - initialReputation    初始声望（0-1000）
 * - initialXiaoerFavor   初始小二好感（0-100）
 * - initialXiaoerSatisfaction 初始小二满意度（0-100）
 * - insightChances       特殊能力「通晓人心」可用次数
 * - insightBacklash      「通晓人心」触发反噬的次数（0 表示无反噬）
 * - luckChances          特殊能力「福星高照」可用次数
 * - luckNegative         「福星高照」负面效果描述（无负面 / 轻微负面 / 严格等价）
 * - ledgerErrorRate      手札记账错误率（0-1 小数；A 0%、B 20%、C 40%）
 * - dailyActionCount     每日自由行动次数（Step 5a 1.3：A 2 / B 1 / C 1）
 * - guestCount           每日客人数量（Step 5a 1.3：A 5 / B 5 / C 6）
 * - penaltyChance        基础收益随机惩罚概率（Step 5a 1.3：A 0.03 / B 0.15 / C 0.30）
 * - specialExpenseChance 特殊支出倍率（Step 5a 1.3：「管理不善丢失/赊账跑路」按此调整，
 *                        B 标准 / A 减半 / C 翻倍；值 = 概率倍率）
 */
export interface TangDifficultyParams {
  label: string;
  tagline: string;
  initialGold: number;
  initialDebt: number;
  monthlyInterest: number;
  initialScore: number;
  initialReputation: number;
  initialXiaoerFavor: number;
  initialXiaoerSatisfaction: number;
  insightChances: number;
  insightBacklash: number;
  luckChances: number;
  luckNegative: string;
  ledgerErrorRate: number;
  /** 每日自由行动次数（A 2 / B 1 / C 1） */
  dailyActionCount: number;
  /** 每日客人数量（A 5 / B 5 / C 6） */
  guestCount: number;
  /** 基础收益随机惩罚概率（A 0.03 / B 0.15 / C 0.30） */
  penaltyChance: number;
  /** 特殊支出概率倍率（B 1 标准 / A 0.5 减半 / C 2 翻倍） */
  specialExpenseChance: number;
}

/** 店型配置 — 与 src/config/tang-shop-types.ts 的 SHOP_TYPES 一一对应。 */
export interface TangShopTypeConfig {
  id: ShopType;
  /** 中文名（酒楼 / 布庄 / 药铺） */
  name: string;
  /** 一句话描述（含客单价区间） */
  description: string;
  /** emoji 图标 */
  icon: string;
  /** 边框令牌名（竹青 / 檀木 / 朱砂） */
  borderToken: 'primary' | 'secondary' | 'accent';
  /** 边框/主题色（由令牌解析，便于内联 style 直接引用） */
  color: string;
}

/** 客人类型：普通 / 大单 / 特殊 / 求助 / 观察 */
export type GuestType = 'normal' | 'big_order' | 'special' | 'help' | 'observe';

/** 接待方式：正常接待 / 通晓人心 / 拒绝接待 */
export type HandleMethod = 'normal' | 'mind_read' | 'reject';

/** 账目类目：经营 / 接待 / 事件 / 支出 */
export type LedgerCategory = '经营' | '接待' | '事件' | '支出';

/** 当日访客（Step 2；Step 3 增加反噬/污染/差评师标记） */
export interface Guest {
  id: string;
  name: string;
  type: GuestType;
  /** 需求描述（2.9 配置模板） */
  description: string;
  /** 基础消费（两） */
  baseConsumption: number;
  /** 心声内容：通晓人心成功后填充，否则 null/未探 */
  mentalOS?: string | null;
  /** 已处理标记（接待面板打勾用） */
  handled: boolean;
  /** 好评/差评：normal/mind_read→good，reject→bad（结算评分变动用） */
  review?: 'good' | 'bad' | null;
  /** 本单接待收入（handleGuest 写入；结算「五单消费」汇总用） */
  incomeEarned?: number;
  /** 本单是否触发「20% 声望+1」的夸奖（结算声望变动「有夸奖」判定用） */
  praised?: boolean;
  /** 反噬标记：该身份已触发过通晓人心反噬（消费砍半、OS 固定警示文案） */
  backlashed?: boolean;
  /** 污染标记：通晓人心累计达阈值后随机标记；其 mind_read OS 来自幻觉池且不标注来源 */
  contaminated?: boolean;
  /** 差评师标记：投诉 100% 触发，另有专属处理选项 */
  isBadReviewer?: boolean;
  /** 故事标签（Step 5a 3.2：assignStoryTag 分配；接待叙事/线索嵌入用） */
  storyTag?: string;
  /** 故事阶段（Step 5a 3.2：回头客沿用同标签时递增；0/缺省 = 首见） */
  storyStage?: number;
  // ---- 接待深度升级（TANG-RCP-001）：偏好 / 熟客 / 耐心 / 满意度 ----
  /** 客人偏好（生成 1-2 个，初始全部未揭示；权威揭示标记在 preferences[].revealed） */
  preferences?: GuestPreference[];
  /** 至少一个偏好已揭示（快捷标记，UI 展示用） */
  preferenceRevealed?: boolean;
  /** 来访次数（回头客从 knownGuests 继承 +1；首见默认 1；第三次来访自动揭示偏好） */
  visitCount?: number;
  /** 客等（铜/银/金/玉；按累计消费 totalSpent 升级，留言簿展示用） */
  guestLevel?: GuestLevel;
  /** 累计消费（两；接待收入累加；留言簿 praise 判定用） */
  totalSpent?: number;
  /** 上次光顾日（回头客 lastVisit 更新；knownGuests 同步） */
  lastVisit?: number;
  /** 排队耐心（默认 100；每轮操作 -5，归零拂袖而去 + 差评） */
  patience?: number;
  /** 本客满意度（0-100；接待结果增减；留言簿 praise 判定用） */
  satisfaction?: number;
  /** 收礼次数（赠礼递减：第 1-2 次 +20 / 第 3 次 +10 / 第 4 次起 +5） */
  giftCount?: number;
  /** 消费意愿修正（传染/夸奖/耐心低；默认 1；0 = 当日消费归零） */
  consumptionModifier?: number;
  /** 已处理结果摘要（接待面板底部缩略展示：处理方式 + 结果） */
  handledNote?: string;
  /** 进场事件标记（内容深化 TANG-CONT-C 模块五）：该客为「客人带伤员」，帮忙/婉拒见 applyWoundedGuestOutcome */
  arrivalEvent?: 'wounded';
}

/** 账本条目（上限 50 条） */
export interface LedgerEntry {
  day: number;
  project: string;
  category: LedgerCategory;
  /** 正收入 / 负支出 */
  amount: number;
}

// ============================================================
// 接待深度升级（TANG-RCP-001）：偏好 / 留言簿 / 气氛 / 拼桌 / 婉拒
// ============================================================

/** 客人偏好类型：item 菜品/面料/药性、style 风格、price 价格（药铺） */
export type GuestPreferenceType = 'item' | 'style' | 'price';

/** 客人偏好（模块一；用户 1.1 逐字：type/value/revealed） */
export interface GuestPreference {
  type: GuestPreferenceType;
  /** item=商品名 / style=风格词 / price=价格档（平价|高价） */
  value: string;
  /** 是否已揭示（已揭示才参与 checkPreferenceMatch 检测） */
  revealed: boolean;
}

/** 客等：铜 / 银 / 金 / 玉（按累计消费 totalSpent 升级） */
export type GuestLevel = 'bronze' | 'silver' | 'gold' | 'diamond';

/** 回头客池记录（模块六 7.3；key=guest.name；20% 概率抽一位生成熟客） */
export interface KnownGuestRecord {
  level: GuestLevel;
  totalSpent: number;
  visitCount: number;
  preferences: GuestPreference[];
  lastVisit: number;
  /** 赠礼「下次消费×1.5」在此生效（生成回头客时乘 baseConsumption） */
  consumptionMultiplier?: number;
  satisfaction?: number;
}

/** 宾客留言簿条目（模块四；用户 4.1 逐字：id/guestName/guestLevel/visitCount/content/day/type） */
export interface GuestBookEntry {
  id: string;
  guestName: string;
  guestLevel: GuestLevel;
  visitCount: number;
  content: string;
  day: number;
  type: 'praise' | 'story' | 'event';
}

/** 偏好匹配结果（checkPreferenceMatch；matched=null 表示未揭示任何偏好，不做检测） */
export interface PreferenceMatchResult {
  matched: boolean | null;
  /** 匹配 ×1.3 / 不匹配 ×0.8 / 未检测 ×1 */
  incomeMultiplier: number;
  /** 匹配 +10 / 不匹配 -5 / 未检测 0 */
  satisfactionDelta: number;
  matchedPreference?: GuestPreference;
}

/** 揭示偏好结果（revealPreference；返回更新后的 guest 与揭示的偏好） */
export interface RevealPreferenceResult {
  guest: Guest;
  revealed: GuestPreference | null;
  allRevealed: boolean;
}

/** 推荐商品结果（模块二 recommendItem） */
export interface RecommendResult {
  ok: boolean;
  reason?: string;
  /** 命中偏好 baseConsumption×1.5 / 未命中 ×0.7 / 未揭示 50/50 */
  income: number;
  /** 精力-5 */
  energyConsumed: number;
  satisfactionDelta: number;
  /** 是否命中偏好（未揭示时 50/50 随机） */
  matched: boolean | null;
  content: string;
  handledNote: string;
}

/** 闲聊结果（模块二 chatWithGuest；多概率独立掷骰） */
export interface ChatResult {
  content: string;
  /** 精力额外-5 */
  energyConsumed: number;
  /** 闲聊无直接消费 */
  income: number;
  reputationChange?: number;
  /** 纯聊天 10% 好感+3 */
  favorChange?: number;
  /** 情报线索 40% / NPC传言 25% / 进货渠道 15% */
  info?: { kind: 'intel' | 'rumor' | 'procurement'; text: string };
  /** 偏好揭示 50%（揭示的偏好） */
  revealedPreference?: GuestPreference;
  updatedGuest: Guest;
  satisfactionDelta: number;
  handledNote: string;
}

/** 赠礼结果（模块二 giveGift） */
export interface GiftResult {
  ok: boolean;
  reason?: string;
  /** 好感：第 1-2 次 +20 / 第 3 次 +10 / 第 4 次起 +5 */
  favorDelta: number;
  /** 精力-3 */
  energyConsumed: number;
  income: number;
  content: string;
  handledNote: string;
  /** 下次消费倍率（写 knownGuests.consumptionMultiplier） */
  nextConsumptionMultiplier: number;
  consumedItemId?: string;
}

/** 婉拒四法（模块二 rejectGuestPolitely）：redirect 引荐 / excuse 托辞 / delegate 转交 / refuse 原逻辑拒绝 */
export type PoliteRejectMethod = 'redirect' | 'excuse' | 'delegate' | 'refuse';

/** 婉拒结果（模块二；用户 2.4 逐字） */
export interface PoliteRejectResult {
  ok: boolean;
  income: number;
  energyConsumed: number;
  reputationChange: number;
  xiaoerSatisfactionChange: number;
  scoreChange: number;
  review: 'bad';
  content: string;
  handledNote: string;
  /** redirect：隔壁店好感+5（store 字段或注释占位） */
  neighborFavor?: number;
}

/** 气氛事件（模块三；用户 3.1 逐字：夸奖+10/投诉-15/当场离开-8/解决投诉+5） */
export type AtmosphereEvent = 'praise' | 'complaint' | 'leave' | 'resolve_complaint';

/** 气氛更新结果（updateAtmosphere） */
export interface AtmosphereResult {
  shopAtmosphere: number;
  delta: number;
}

/** 情绪传染结果（checkEmotionContagion；模块三） */
export interface ContagionResult {
  eventType: 'complaint' | 'praise';
  /** 当众投诉 30%：其他客人走掉（当日消费归零） */
  walkOutIds: string[];
  /** 当众夸奖：其他客人消费意愿 +10% */
  boostIds: string[];
}

/** 耐心更新结果（updatePatience；模块三） */
export interface PatienceResult {
  patience: number;
  zeroed: boolean;
  lowPatience: boolean;
  /** 耐心<30 消费意愿 -20% → 0.8 */
  consumptionModifier: number;
}

/** 拼桌并单结果（mergeGuests；模块三；用户 3.4 逐字） */
export interface MergeResult {
  ok: boolean;
  reason?: string;
  /** 每人消费 8 折：income = (A.base + B.base) × 0.8 */
  income: number;
  /** 一次接待两人：精力×1.5 → 7.5 */
  energyConsumed: number;
  /** 双命中偏好（两人偏好均匹配） */
  doubleHit: boolean;
  /** 双命中偏好额外 +10 气氛 */
  atmosphereBonus: number;
  content: string;
}

/** 留言簿触发结果（checkGuestBookTrigger；模块四） */
export interface GuestBookTriggerResult {
  type: 'praise' | 'story' | 'event' | null;
  content: string;
}

/** 当日结算结果（settleDay 产出） */
export interface DaySettlement {
  day: number;
  /** 基础收益（档位随机 × 员工效率系数） */
  baseIncome: number;
  /** 五单消费（已接待客人收入总和） */
  guestIncome: number;
  /** 当日支出合计 */
  expenses: number;
  /** 净收益 = 基础收益 + 五单消费 - 支出 */
  netIncome: number;
  scoreChange: number;
  reputationChange: number;
  xiaoerFavorChange: number;
  /** 当日精力消耗汇总（接待累计 + 自由活动 0） */
  energyConsumed: number;
  /** 本次新解锁成就 id（结算卡展示用；3.5） */
  newlyUnlocked?: string[];
  /** 赌瘾剧情行（gamblingAddictionDays>0 时打烊递减并展示；3.3） */
  gamblingLine?: string | null;
}

/** 货架商品库存状态（Step 5b-1.5 库存压力系统） */
export type ItemStatus = 'normal' | 'near_expiry' | 'expired' | 'out_of_stock';

/** 货架商品 */
export interface ShopItem {
  id: string;
  name: string;
  /** 售价（两） */
  price: number;
  /** 成本（两，约为售价 50-70%） */
  cost: number;
  stock: number;
  category: string;
  /** 买入时的物价指数（Step 5b 5.x：用于囤货利润计算；缺省按当前价） */
  purchasePrice?: number;
  /**
   * 体积（占库容量单位；Step 5b-1.5 库存压力）。
   * 参考：羊肉3/米酒1/酱牛肉3/时蔬1、粗布2/丝绸1/棉布2/锦缎1、人参0.5/当归1/黄连1/枸杞0.5。
   * 缺省按 1（getItemVolume 兜底，见 systems/tang-expiry.ts）。
   */
  volume?: number;
  /**
   * 保质期剩余天数（Step 5b-1.5；每日打烊递减；-1 = 永不过期）。
   * 参考：生鲜 7-14、布匹 90、药材 180；缺省按 -1（getItemExpiry 兜底）。
   */
  expiry?: number;
  /** 库存状态（updateExpiry/removeExpiredGoods/补货下架维护；缺省按 normal） */
  status?: ItemStatus;
  /** 预购预留数量（TANG-TRF-001：大单预购预留；不移库、不可售、照常陈损；可售 = stock - reserved） */
  reserved?: number;
}

/** 单次接待结果（handleGuest 产出，纯函数返回） */
export interface HandleGuestResult {
  guestId: string;
  /** 本单收益（两；结算时统一入账，避免双重计入；投诉时已按后果减半） */
  income: number;
  /** 精力消耗（normal 5 / mind_read 10 / reject 0） */
  energyConsumed: number;
  reputationChange: number;
  /** 即时评分变动（reject 30% 概率 -0.02；反噬 -0.05；投诉 -0.02；结算另行按 review 汇总） */
  scoreChange: number;
  mentalOS?: string | null;
  usedMindRead: boolean;
  review: 'good' | 'bad';
  /** 反噬触发标记（3.2）：本单 mind_read 触发反噬（OS 固定、消费砍半、评分-0.05） */
  backlashTriggered?: boolean;
  /** 污染标记（3.2）：本单 mind_read 的 OS 来自幻觉池（不标注来源） */
  contaminated?: boolean;
  /** 反讽/假信息池标记（3.2）：该身份此前已反噬，本次 mind_read 的 OS 来自 REVERSE_OS_POOL */
  usedReverseOS?: boolean;
  /** 投诉触发标记（3.4）：普通客人 10%、差评师 100%；消费已减半、评分已 -0.02 */
  complaintTriggered?: boolean;
}

/** 事件触发条件（3.1：day_range / score / reputation / debt_zero；5b：credit / 好感触发；
 *  minDebt：day_range 附加「负债>0」门槛（QA-B：债主上门负债为零不触发）） */
export type GameEventTrigger =
  | { type: 'day_range'; minDay: number; maxDay: number; minDebt?: number }
  | { type: 'score'; minScore: number; maxScore?: number }
  | { type: 'reputation'; minReputation: number }
  | { type: 'debt_zero' }
  | { type: 'credit'; maxCredit: number; minDay?: number }
  | { type: 'xie_qi_favor'; minFavor: number }
  | { type: 'shen_favor'; minFavor: number };

/** 事件特殊效果（3.1 / 3.2 / 3.3 中由 resolveEventChoice 或 store 专门处理的效果；
 *  Step 5b-1.5 新增库存事件专属 special：邻居借粮 / 官府征用 / 乞丐讨食 / 窃贼光顾） */
export type GameEventSpecial =
  | 'add_big_order_guest' // 回头客 A：今日额外 +1 大单客人（精力-5）
  | 'add_normal_guest' // 回头客 B：满意度+3、额外 +1 普通客人
  | 'shen_debt' // 债主 C：标记欠沈听澜人情
  | 'xiaoer_gone' // 债主 B：小二离开 + 阿昭好感/满意度归零
  | 'pay_monthly_interest' // 债主 A：扣款 = state.monthlyInterest（非写死）
  | 'shen_partner' // 沈听澜 A：结为伙伴
  // ---- 库存事件（Step 5b-1.5；applyInventoryEventSpecial 处理）----
  | 'inv_borrow' // 邻居借粮 A：耗 5 食材、声望+2（邻里和睦）
  | 'inv_borrow_refuse' // 邻居借粮 B：婉拒，无变化
  | 'inv_requisition_accept' // 官府征用 A：配合，声望+5
  | 'inv_requisition_reduce' // 官府征用 B：请求减免，扣两成价、30% 概率得罪（声望-5）
  | 'inv_beggar_alms' // 乞丐讨食 A：施舍，耗 2 食材、声望+3
  | 'inv_beggar_drive' // 乞丐讨食 B：驱赶，声望-1
  | 'inv_thief_report' // 窃贼光顾 A：报官，半概率追回（无事+声望2）；失败损 5% 库房价值
  | 'inv_thief_loss'; // 窃贼光顾 B：自认倒霉，损 5% 库房价值

/** 事件选项效果（数值增减 + 可选特殊处理） */
export interface GameEventEffect {
  /** 金钱（两）增减——5b 起映射到现银 silver（gold 兼容字段由 store 同步） */
  gold?: number;
  /** 旧债增减（映射到 legacyDebt） */
  debt?: number;
  /** 飞钱增减（5b 多货币） */
  feiqian?: number;
  /** 信用增减（5b 信用系统） */
  credit?: number;
  /** 通胀事件修正（5b：如 丰收-0.10 / 歉收+0.15；月初 updatePriceIndex 消费） */
  inflationModifier?: number;
  /** 钱庄优惠天数（5b：存款利率翻倍限时） */
  depositRateBoostDays?: number;
  score?: number;
  reputation?: number;
  xiaoerFavor?: number;
  xiaoerSatisfaction?: number;
  shenTinglanFavor?: number;
  xieQiFavor?: number;
  energy?: number;
  special?: GameEventSpecial;
}

/** 事件选项 */
export interface GameEventChoice {
  id: string;
  label: string;
  /** 选择后展示的后果文案 */
  consequence: string;
  effect: GameEventEffect;
}

/** 事件类型（用户规格 3.1：按场景归类；random 预留通用随机事件） */
export type GameEventType =
  | 'debt_collection'
  | 'regular_customer'
  | 'shen_tinglan'
  | 'xie_qi'
  | 'random';

/** 事件定义（3.1；EVENT_DEFINITIONS 见 config/tang-events.ts） */
export interface GameEvent {
  /** 事件类型（用户规格 3.1 必填） */
  type: GameEventType;
  id: string;
  title: string;
  description: string;
  trigger: GameEventTrigger;
  choices: GameEventChoice[];
  /** 触发过标记（eventLog 为去重权威；该字段同步维护，仅作展示参考） */
  triggered?: boolean;
}

/** 福星高照结果（3.3 useLuckyStar 产出） */
export interface LuckResult {
  /** 本局赢钱（两；20-300 随机，"赌一把"的赢钱） */
  gain: number;
  /** 负面效果文案（按档位与难度：无负面/轻微/严格等价） */
  penalty: string;
  /** 负面扣钱（两；A 难度恒 0） */
  penaltyAmount: number;
  /** 净赢 = max(0, gain - penaltyAmount)（成就「赌神在世」追踪） */
  netGain: number;
}

// ============================================================
// Step 5a：阶段系统 / 每日自由行动 / 员工管理
// ============================================================

/** 店铺经营阶段（Step 5a 1.1：1 初入商海 → 4 长安翘楚） */
export type GameStage = 1 | 2 | 3 | 4;

/** 阶段门槛配置（1→2、2→3、3→4） */
export interface StageRequirement {
  /** 资金下限（两） */
  minGold: number;
  /** 店铺评分下限（1.0-5.0） */
  minScore: number;
  /** 声望下限（0-1000） */
  minReputation: number;
  /** 要求已触发的事件 id（eventLog.includes 判定；可选） */
  requiredEvent?: string;
  /** 店铺数量下限（可选） */
  minShopCount?: number;
  /** 累计净收益下限（两；可选） */
  minTotalNetProfit?: number;
  /** 要求谢七身份已揭晓（可选） */
  requireXieQiIdentityRevealed?: boolean;
  /** 要求满意≥阈值的员工数（可选） */
  minEmployeesSatisfied?: number;
  /** 员工满意度阈值（与 minEmployeesSatisfied 配合） */
  employeeSatisfactionThreshold?: number;
  /** 要求沈听澜合作线（可选） */
  requireShenPartner?: boolean;
  /** 要求谢七灰色线完成（可选；当前以 xieQiFavor≥该值近似） */
  minXieQiFavor?: number;
  /** 要求特殊员工完整剧情已触发（可选） */
  requireSpecialEmployeeStory?: boolean;
}

/** 员工类型：小二 / 厨师 / 裁缝 / 药师 / 账房 / 护卫 */
export type EmployeeType = 'waiter' | 'chef' | 'tailor' | 'pharmacist' | 'accountant' | 'guard';

/** 技能类别：品质 / 效率 / 成本 / 特殊（各 4 条，共 16） */
export type EmployeeSkillType = 'quality' | 'efficiency' | 'cost' | 'special';

/** 员工技能（2.3；SKILL_POOL 见 config/tang-employee-skills.ts） */
export interface EmployeeSkill {
  id: string;
  name: string;
  type: EmployeeSkillType;
  description: string;
  /** 适用员工类型限制（缺省 = 通用；如 招牌菜秘方 仅厨师） */
  requiresType?: EmployeeType[];
}

/** 招聘候选人（2.2；generateCandidates 产出） */
export interface EmployeeCandidate {
  id: string;
  name: string;
  gender: 'male' | 'female';
  type: EmployeeType;
  /** 月钱（两） */
  salary: number;
  skills: EmployeeSkill[];
  /** 特殊员工标记（10% 概率；表面正常，但隐藏背景/缺陷） */
  isSpecial: boolean;
  /** 隐藏背景（isSpecial 时预设；入职后不可见，背景揭露事件后公开） */
  hiddenBackground?: string;
  /** 隐藏缺陷（isSpecial 时预设；背景揭露后产生负面效果） */
  hiddenFlaw?: string;
}

/** 已入职员工（2.1；不含阿昭） */
export interface Employee extends EmployeeCandidate {
  /** 满意度 0-100（入职初始 60） */
  satisfaction: number;
  /** 入职日（hireDay = 雇佣当天 day+1，次日到岗） */
  hireDay: number;
  /** 背景是否已揭露（特殊员工事件触发后 true，并应用 hiddenFlaw 效果） */
  backgroundRevealed: boolean;
  /** 当日休假标记（arrangeRestDay 置 true；打烊结算自动清空） */
  restToday?: boolean;
  /** 过劳连续工作天数（满意度<30 且当日工作累计；≥3 触发崩溃离职） */
  overworkDays?: number;
  // ---- 团队与社交深度（TANG-SOC-001）：排班 / 交情 / 学艺 ----
  /** 排班（轮值）：morning 早班 / evening 晚班 / full 全天 / rest 休沐；缺省按全天处理 */
  shift?: EmployeeShift;
  /** 连续工作天数（排班系统维护；rest 归零；≥7 无休满意度 -5/日） */
  consecutiveWorkDays?: number;
  /** 上次休沐日（排班系统维护；lastRestDay=day） */
  lastRestDay?: number;
  /** 授业师傅 id（establishMentorship 设置；学徒日 5% 习得导师技能） */
  mentorId?: string;
  /** 学艺完成日（sendForTraining/findMaster 设置；到期 checkTrainingCompletion 结算；学艺中不可排班） */
  trainingCompletionDay?: number;
  /** 内部交情列表（initializeRelations/evolveRelations 维护；targetId 指向另一员工或阿昭） */
  relationships?: EmployeeRelationship[];
  /** 学艺已学成/已解锁的技艺（培训结算标记，避免重复解锁） */
  trainedSkillIds?: string[];
  // ---- 伙计小传（TANG-ADD-001 模块七）----
  /** 小传阶段（0-4；0=入职未生成框架前；1-4 阶段解锁进度；4=全解锁） */
  biographyStage?: number;
  /** 小传条目（generateBiography 生成框架；checkBiographyUnlock 逐阶段解锁） */
  biography?: BiographyEntry[];
}

/** 排班档位：早班 / 晚班 / 全天 / 休沐 */
export type EmployeeShift = 'morning' | 'evening' | 'full' | 'rest';

/** 内部交情（模块二；员工之间或与阿昭的关系）：和睦 / 竞争 / 矛盾 / 师徒 */
export type RelationshipType = 'harmony' | 'rivalry' | 'conflict' | 'mentor';

/** 内部交情记录（模块二；用户规格：targetId/type/level/description） */
export interface EmployeeRelationship {
  /** 关系对象 id（另一员工 id；阿昭用 'a-zhao' 表示） */
  targetId: string;
  /** 关系类型：和睦 / 竞争 / 矛盾 / 师徒 */
  type: RelationshipType;
  /** 关系等级 1-10（≥8 莫逆之交 / 水火不容 / 竞争激烈） */
  level: number;
  /** 关系描述（古风文案） */
  description: string;
}

/** 学艺结果（sendForTraining；束脩/周期/学成效果） */
export interface TrainingResult {
  ok: boolean;
  reason?: string;
  employeeId: string;
  /** 束脩（两）：基础 50 + 每级 30（按技能数） */
  cost: number;
  /** 周期（天）：3-7 */
  durationDays: number;
  /** 完成日（day + durationDays） */
  completionDay: number;
  /** 学成效果倍率（effect×1.5 或解锁新技能） */
  effectMultiplier?: number;
  /** 是否解锁新技能（否则为已有技能强化） */
  unlockedNew?: boolean;
  content: string;
}

/** 拜师结果（findMaster；需地图区域解锁） */
export interface MasterResult {
  ok: boolean;
  reason?: string;
  /** 师傅名（随机） */
  masterName: string;
  /** 束脩（两）：200+ */
  cost: number;
  /** 周期（天）：2-4 */
  durationDays: number;
  /** 成功率（0.95） */
  successRate: number;
  /** 10% 隐藏绝技（宫廷秘方/蜀锦织法/太医院手法） */
  hiddenMasterpiece?: { name: string; description: string; effect: { type: string; value: number } };
  content: string;
}

/** 学艺到期结算结果（checkTrainingCompletion；每日清晨） */
export interface TrainingCompletionResult {
  employeeId: string;
  employeeName: string;
  skillId: string;
  skillName: string;
  /** 学成 true / 失败 false */
  success: boolean;
  /** 学成 effect×1.5；失败 满意度-10 */
  effectMultiplier?: number;
  /** 失败满意度扣减 */
  satisfactionPenalty?: number;
  content: string;
}

/** 交情演化事件（evolveRelations；每日打烊） */
export interface RelationshipEvent {
  /** 事件类型：和睦+1 / 竞争+1 / 矛盾+3 / 莫逆之交 / 水火不容 / 竞争激烈 */
  kind: 'harmony_up' | 'rivalry_up' | 'conflict_up' | 'soulmate' | 'irreconcilable' | 'rivalry_hot';
  employeeId: string;
  targetId: string;
  type: RelationshipType;
  level: number;
  description: string;
}

/** 自由行动选项（1.2；getAvailableActions 产出） */
export interface ActionOption {
  id: string;
  label: string;
  description: string;
  /** 精力消耗（正=消耗；nap 为负=恢复） */
  energyCost: number;
  /** 精力不足/条件不满足时灰显 */
  disabled?: boolean;
  disabledReason?: string;
}

/** 自由行动执行结果（1.2；executeAfternoonAction 产出） */
export interface ActionResult {
  actionId: string;
  label: string;
  /** 结果文案（AI 叙事输入 / 降级展示） */
  narrative: string;
  /** 精力变动（负=消耗，nap 正=恢复） */
  energyDelta: number;
  goldDelta?: number;
  reputationDelta?: number;
  xiaoerFavorDelta?: number;
  /** 阿昭满意度变动（小睡「阿昭挡麻烦」；映射到 xiaoerSatisfaction） */
  xiaoerSatisfactionDelta?: number;
  shenTinglanFavorDelta?: number;
  xieQiFavorDelta?: number;
  /** 阿昭好感变动（拜访阿昭；映射到 xiaoerFavor） */
  azhaoFavorDelta?: number;
  /** 市场招聘：本次生成的候选人（UI 展示雇佣按钮） */
  candidates?: EmployeeCandidate[];
  /** 小睡 30% 错过突发事件标记（占位；已按 -声望1 体现损失） */
  missedEvent?: boolean;
  // ---- 内容深化 TANG-CONT-C 模块二：四行动真实逻辑附加字段 ----
  /** 小睡突发事件类型（贵客错过 / 阿昭挡麻烦 / 无事） */
  napEvent?: 'big_order_missed' | 'azhao_helped' | 'none';
  /** 市井闲逛结果类型（传闻 / 捡漏 / 遇谢七 / 小偷光顾 / 无事） */
  strollKind?: 'rumor' | 'bargain' | 'xieqi' | 'thief' | 'none';
  /** 拜访 NPC 对话（3-5 句，古风） */
  dialogue?: string[];
  /** 拜访/闲逛获得的情报描述（kind=clue 时由 store 落库线索） */
  intel?: { kind: 'clue' | 'faction' | 'industry' | 'rumor'; text: string; clueCategory?: ClueCategory };
  /** 市井捡漏商品（限当日七折） */
  bargain?: { itemName: string; price: number; day: number };
  /** 午后巡查发现的隐患（待玩家逐件处置；store 写入 pendingPatrolHazards） */
  patrolHazards?: PatrolHazard[];
}

/** 巡查隐患类型（内容深化 TANG-CONT-C 模块二·1）：修缮 / 员工偷懒 / 小偷迹象 */
export type PatrolHazardKind = 'repair' | 'slack' | 'thief';

/** 午后巡查发现的隐患（待玩家选择处置；延后修缮的隐患带 deadlineDay） */
export interface PatrolHazard {
  id: string;
  kind: PatrolHazardKind;
  title: string;
  narrative: string;
  /** repair：预计修缮花费（两） */
  repairCost?: number;
  /** slack：偷懒员工 */
  employeeId?: string;
  employeeName?: string;
  /** thief：加固门锁 / 雇护卫花费（两） */
  lockCost?: number;
  guardCost?: number;
  /** 延后修缮的期限日（day+10；逾期坍塌） */
  deadlineDay?: number;
}

/** 巡查隐患处置结果（resolvePatrolHazardChoice 产出；store 应用） */
export interface PatrolChoiceResult {
  resolved: boolean;
  hazardId: string;
  narrative: string;
  goldDelta?: number;
  reputationDelta?: number;
  scoreDelta?: number;
  employeeDelta?: { employeeId: string; satisfactionChange: number };
  /** 训诫 → 清除当日偷懒 */
  clearSlack?: boolean;
  /** 无视 → 保留当日偷懒（效率-30% 近似：settleDay 不计入加成） */
  addSlack?: boolean;
  /** 延后修缮标记 */
  postponed?: boolean;
  deadlineDay?: number;
}

/** 员工事件结果（2.5；checkEmployeeEvents 产出，store 应用） */
export interface EmployeeEventResult {
  employeeId: string;
  employeeName: string;
  type:
    | 'raise_request'
    | 'conflict'
    | 'poached'
    | 'background_reveal'
    | 'suggestion'
    // ---- TANG-SOC-001 模块六：社交类员工事件 ----
    | 'apprentice_request' // 拜师请求（费用半价成功率 70%）
    | 'sect_conflict' // 师门恩怨（师徒矛盾需调解）
    | 'poach_threat' // 挖角威胁（匹配开价或打感情牌）
    | 'joint_venture' // 合伙创业（两高满意度想开分店 正面）
    | 'family_trouble' // 家中有难（预支月钱或给假）
    | 'report_colleague'; // 举报同僚（调查真伪）
  title: string;
  description: string;
  /** 满意度变动 */
  satisfactionChange: number;
  /** 金钱变动（涨薪加钱为负） */
  goldChange: number;
  /** 是否离职（被挖角 / 过劳崩溃） */
  quit?: boolean;
  /** 改进建议：次日基础收益加成比例（0.02；settleDay 顺延消费） */
  incomeBonus?: number;
  /** 冲突波及的第二位员工 id（矛盾事件） */
  otherEmployeeId?: string;
  // ---- TANG-SOC-001 模块六：社交事件扩展 ----
  /** 是否已被处理（得当/不当/忽略；store 调用 handleSocialEvent 后置位） */
  handled?: boolean;
  /** 处理得当：涉事满意度 +10、关系改善 */
  handledWell?: boolean;
  /** 处理不当：涉事满意度 -15、可能离职 */
  handledBadly?: boolean;
  /** 忽略：3 天恶化（store 记 lastIgnoredDay） */
  ignored?: boolean;
  /** 事件编号（社交事件用；如 social-apprentice-1） */
  socialEventId?: string;
  /** 拜师事件候选师傅 id */
  mentorCandidateId?: string;
  /** 合伙创业两位员工 id */
  venturePartnerId?: string;
  /** 举报事件被举报员工 id */
  reportedId?: string;
}

/** 投诉处理选项（3.4）：普通不满 2 选项 / 差评师 3 选项 */
export type ComplaintChoice = 'apologize' | 'tough' | 'payoff' | 'report' | 'threaten';

/** 待处理投诉（store 非持久化字段；正常接待触发投诉后由 UI 逐件处理） */
export interface PendingComplaint {
  guestId: string;
  guestName: string;
  isBadReviewer: boolean;
  /** 该单收入（投诉后果「消费减半」已由 handleGuest 应用，故此处为减半后数值） */
  income: number;
}

/** 投诉处理结果（handleComplaint 产出） */
export interface ComplaintResult {
  choice: ComplaintChoice;
  goldDelta: number;
  scoreDelta: number;
  reputationDelta: number;
  outcomeText: string;
  /** 差评师是否被带走/赶走（报官成功或私下威胁） */
  badReviewerRemoved: boolean;
}

/** 破产流程产出（3.6 applyBankruptcy） */
export interface BankruptcyOutcome {
  /** 小二是否离开（阿昭好感≥80 则留下 false，否则 true） */
  xiaoerGone: boolean;
  /** 资金重置（A 20 / B 5 / C 0） */
  resetGold: number;
  /** 声望重置（A 保留 50% / B 清零 / C 清零-50→0） */
  reputation: number;
}

// ============================================================
// Step 5b：货币与金融系统（多货币 / 钱庄 / 信用 / 投资 / 通胀 / 负债整合）
// ============================================================

/** 多货币账户（用户 1.1 逐字：现银 / 飞钱 / 信用） */
export interface CurrencyAccount {
  /** 现银（两） */
  silver: number;
  /** 飞钱（两；1 贯 = 1 两，等值；用途差异：远程调拨/跨店） */
  feiqian: number;
  /** 信用（0-1000） */
  credit: number;
}

/** 信用变动流水（用户 1.1 逐字：day/reason/amount；最近 5 条展示） */
export interface CreditRecord {
  day: number;
  /** 变动原因（中文） */
  reason: string;
  /** 变动量（正=加，负=减） */
  amount: number;
}

/** 钱庄存款（模块二；月息 0.5%，未满 30 天取出不计息） */
export interface BankDeposit {
  id: string;
  amount: number;
  depositDay: number;
  /** 月利率（默认 0.005；钱庄优惠 depositRateBoostDays>0 时翻倍） */
  interestRate: number;
  type: 'deposit';
  /** 已计利息（月初累计；取款 = 本金 + 已计利息） */
  interestAccrued?: number;
}

/** 贷款类型：抵押借贷 / 高利贷 */
export type BankLoanType = 'mortgage' | 'usury';

/** 贷款（模块二：抵押借贷；模块三：高利贷） */
export interface BankLoan {
  id: string;
  amount: number;
  loanDay: number;
  /** 月利率（抵押 0.02 / 高利贷 0.10） */
  interestRate: number;
  /** 抵押物（抵押借贷）；高利贷无抵押（'none'） */
  collateral: 'shop' | 'deed' | 'goods' | 'none';
  status: 'active' | 'overdue' | 'paid';
  type: BankLoanType;
  /** 逾期月数（月初未还款累计；抵押 ≥3 没收，高利贷 1/2/3 逐级恶化） */
  overdueMonths?: number;
}

/** 投资（模块四） */
export interface Investment {
  id: string;
  amount: number;
  investDay: number;
  type: 'guild' | 'shen' | 'underground';
  /** 预期回报率（投资时按区间随机锁定；到期时按风险修正） */
  expectedReturn: number;
  /** 实际回报率（到期结算写入） */
  actualReturn?: number;
  status: 'active' | 'matured' | 'lost';
  /** 道德困境标记（沈听澜 30% 打击分店：客流量减半 + 回报翻倍） */
  dilemmaHit?: boolean;
}

/** 信用档位（模块三：5 档，特权用户规格逐字） */
export interface CreditTier {
  id: 'general' | 'good' | 'excellent' | 'very_high' | 'top';
  /** 档位名（一般/良好/优秀/极高/顶级） */
  name: string;
  min: number;
  max: number;
  /** 档位特权 */
  privileges: string[];
}

// ============================================================
// Step 5b-1.5：库存交互升级（库容压力 / 进货策略 / 商品加工 / 组合商品）
// ============================================================

/** 籴粜契（远期收购契约）：预付三成定金，预购价 = 市价×0.7，到期自动入库 */
export interface ForwardContract {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  /** 预购单价（市价×0.7） */
  unitPrice: number;
  /** 总价 = 预购单价 × 数量 */
  totalPrice: number;
  /** 预付定金（总价三成；不可取消不退） */
  deposit: number;
  /** 到货日（玩家选 day+5~10） */
  deliveryDay: number;
  status: 'pending' | 'delivered' | 'defaulted';
}

/** 市易务挂牌（官府平准特价发卖）：五至八折、限购、仅当日有效 */
export interface MarketListing {
  id: string;
  itemName: string;
  originalPrice: number;
  listedPrice: number;
  /** 折扣（0.5-0.8） */
  discount: number;
  maxQuantity: number;
  /** 当日剩余可购量（购买后递减） */
  remainingToday: number;
  /** 挂牌日（仅当日有效） */
  day: number;
}

/** 加工任务（庖制/染织/炮制；到期自动入库） */
export interface ProcessingJob {
  id: string;
  recipeId: string;
  outputName: string;
  outputQuantity: number;
  /** 完成日（开始日 + 加工天数） */
  completionDay: number;
  status: 'processing' | 'completed';
  /** 产出单价（开工时按原料总价 × 倍率 ÷ 数量预计算；到货入库用） */
  outputPrice?: number;
  /** 产出单位成本（原料总价 ÷ 数量） */
  outputCost?: number;
}

/** 库房扩建进行中（期间容量不增，完工日到后生效） */
export interface WarehouseExpansion {
  targetLevel: number;
  completionDay: number;
}

// ---- 纯函数结果对象（store/UI 共用契约） ----

/** 货币兑换结果（模块一） */
export interface ExchangeResult {
  ok: boolean;
  /** 实际到账（扣除手续费后） */
  actualAmount: number;
  /** 手续费 */
  fee: number;
  reason?: string;
}

/** 跨店调拨结果（模块一：飞钱秒到账 3% 费；现银 1-3 天 + 10% 被劫） */
export interface TransferResult {
  ok: boolean;
  /** 实际到账（扣除手续费后） */
  actualAmount: number;
  fee: number;
  /** 是否使用飞钱（飞钱秒到账） */
  usedFeiqian: boolean;
  /** 到账天数（飞钱 0 / 现银 1-3；现银为占位——尚未实现延迟入账，立即扣除） */
  arrivalDays: number;
  /** 现银 10% 被劫标记 */
  robbed: boolean;
  note?: string;
  reason?: string;
}

/** 存款结果（模块二） */
export interface DepositResult {
  ok: boolean;
  deposit: BankDeposit | null;
  reason?: string;
}

/** 取款结果（模块二：本金 + 已计利息） */
export interface WithdrawResult {
  ok: boolean;
  principal: number;
  interest: number;
  total: number;
  reason?: string;
}

/** 贷款申请结果（模块二/三） */
export interface LoanApplyResult {
  ok: boolean;
  loan: BankLoan | null;
  reason?: string;
}

/** 还款结果（模块二/三） */
export interface LoanRepayResult {
  ok: boolean;
  principal: number;
  interest: number;
  total: number;
  /** 还款后状态（active/paid） */
  status?: string;
  reason?: string;
}

/** 逾期检查产出（模块二/三：月初逐条） */
export interface OverdueEvent {
  loanId: string;
  type: BankLoanType;
  /** 恶化等级（抵押 overdue 1-3 / 高利贷 usury 1-3；3 = 查封/没收） */
  kind: 'overdue_1' | 'overdue_2' | 'overdue_3' | 'usury_1' | 'usury_2' | 'usury_3' | 'seize';
  note: string;
}

/** 投资申请结果（模块四） */
export interface InvestApplyResult {
  ok: boolean;
  investment: Investment | null;
  note?: string;
  reason?: string;
}

/** 投资到期结算结果（模块四：每日打烊 checkInvestmentMaturity） */
export interface InvestmentSettlementResult {
  id: string;
  type: Investment['type'];
  amount: number;
  actualReturn: number;
  /** 盈亏金额（正=赚，负=亏） */
  gain: number;
  note?: string;
  /** 本金全损（地下钱庄 40% 查封） */
  lost?: boolean;
  /** 道德困境标记（沈听澜 30% 打击分店） */
  dilemmaHit?: boolean;
}

/** 统一还款结果（模块六） */
export interface UnifiedRepayResult {
  ok: boolean;
  /** 实际支付（两） */
  paid: number;
  target: 'legacy' | 'bank' | 'usury';
  /** 旧债是否还清（触发谢七登场） */
  legacyCleared?: boolean;
  reason?: string;
}

// ============================================================
// 成瘾性玩法模块（TANG-ADD-001）：五大钩子
// 占候（手札占候）/ 意外之喜（稀有事件）/ 今日要务 / 陆家遗命 /
// 谢七彩头 / 市易务暗标 / 伙计小传 / 商阶 / 局外成长 / 月度总结
// 铁律：古风措辞；纯函数在 systems/tang-*；store 只做接线。
// ============================================================

/** 手札占候：八种卦象效果类型（谦卦 平稳 无效果 → 'none'） */
export type HexagramEffectType =
  | 'none' // 谦卦 平稳 无效果
  | 'income_multiplier' // 泰卦 大吉 收益×1.15
  | 'guest_random' // 震卦 波动 客消±20%
  | 'cost_reduction' // 巽卦 顺风 进货×0.9
  | 'event_double' // 坎卦 坎坷 事件概率×2
  | 'big_order_bonus' // 离卦 火爆 大单+30%
  | 'patience_decay_double' // 艮卦 阻滞 耐心下降×2
  | 'praise_bonus'; // 兑卦 口福 夸奖+20%

/** 卦象效果（type + 数值；value 语义随 type 不同） */
export interface HexagramEffect {
  type: HexagramEffectType;
  value: number;
}

/** 手札占候：八卦定义（卦名/占断/效果/判词；用户规格逐字） */
export interface Hexagram {
  id: string;
  name: string;
  /** 占断标签（大吉/平稳/波动/顺风/坎坷/火爆/阻滞/口福） */
  judgment: string;
  effect: HexagramEffect;
  /** 判词（古风） */
  description: string;
  /** 占断标签配色（hex；大吉金/平稳灰/波动橙/顺风绿/坎坷红/火爆朱砂/阻滞暗红/口福竹青） */
  tagColor: string;
}

/** 卦象效果应用上下文（纯函数输入；store 把当日数值填入，由 applyHexagramEffect 修正） */
export interface HexagramContext {
  /** 结算基础收益（泰卦 ×1.15） */
  baseIncome?: number;
  /** 客单消费（震卦 ±20%） */
  guestIncome?: number;
  /** 采买支出（巽卦 ×0.9） */
  procurementCost?: number;
  /** 事件概率倍率（坎卦 ×2；当前接线到稀有事件判定） */
  eventChance?: number;
  /** 大单收入（离卦 +30%） */
  bigOrderIncome?: number;
  /** 排队耐心衰减倍率（艮卦 ×2） */
  patienceDecay?: number;
  /** 夸奖触发概率加成（兑卦 +20%） */
  praiseChance?: number;
}

/** 意外之喜（稀有事件）条件 */
export interface RareEventCondition {
  /** 声望下限（微服私访 ≥200） */
  minReputation?: number;
  /** 西市商团关系下限（胡商献宝 ≥40） */
  minFactionRelationship?: number;
  /** 经营天数下限（故人之后 ≥30 / 天降祥瑞 ≥60 / 夜半来客 ≥90） */
  minDay?: number;
  /** 谢七登场前置（街头偶遇：xieQiFavor>0 且未触发） */
  requireXieQiAppeared?: boolean;
  /** 负债为 0 前置（夜半来客） */
  requireDebtZero?: boolean;
}

/** 意外之喜（稀有事件）奖励 */
export interface RareEventRewards {
  silver?: number;
  /** 线索 id（故人之后 old_friend_tree / 夜半来客 xuan_gui_mystery） */
  clue?: string;
  /** NPC 好感（街头偶遇 谢七 +20） */
  favor?: number;
  /** 惩罚（街头偶遇 金-10） */
  penaltySilver?: number;
}

/** 意外之喜（稀有事件）：id/title/description/chance/condition/rewards/triggeredKey */
export interface RareEvent {
  id: string;
  title: string;
  description: string;
  /** 触发概率（0-1；打烊独立判定） */
  chance: number;
  condition: RareEventCondition;
  rewards: RareEventRewards;
  /** 去重键（completedRareEvents 记录；谢七登场用 'xie-qi-appeared' 判断未触发） */
  triggeredKey: string;
}

/** 今日要务：完成条件（打烊判定） */
export interface TaskCondition {
  /** 大单接待 ≥1 */
  bigOrderHandled?: boolean;
  /** 今日净利 ≥30 */
  minNetProfit?: number;
  /** 用通晓人心 ≥1 */
  mindReadUsed?: boolean;
  /** 额外 +1 次通晓人心（「用通晓人心」要务的追加奖励） */
  extraMindRead?: boolean;
  /** 卖丝绸 ≥3 */
  silkSold?: number;
  /** 市集捡漏触发（暗标/挂牌采买成功） */
  marketDealTriggered?: boolean;
  /** 闲聊 ≥1 */
  chatUsed?: boolean;
  /** 无投诉 */
  noComplaints?: boolean;
  /** 接待完所有客 */
  allGuestsHandled?: boolean;
  /** 追加奖励：需完成的要务 id 列表（工程定：连做/连锁） */
  requiresTasks?: string[];
}

/** 今日要务：奖励 */
export interface TaskReward {
  reputation?: number;
  satisfaction?: number;
  mindReadBonus?: number;
  score?: number;
  silver?: number;
  clue?: string;
  atmosphere?: number;
  energy?: number;
}

/** 今日要务（模块三）：id/title/description/condition/reward/stampText */
export interface DailyTask {
  id: string;
  title: string;
  description: string;
  condition: TaskCondition;
  reward: TaskReward;
  /** 完成盖「了」红印文案 */
  stampText: string;
}

// ============================================================
// TANG-TRF-001：动态客流 + 大单预购 + 周级要务
// ============================================================

/** 接待策略（每日预设）：亲力亲为 / 择要接待 / 全托伙计（用户 1.2 逐字） */
export type ReceptionStrategy = 'all' | 'priority' | 'delegate';

/** 经营策略（内容深化 TANG-CONT-B 模块六·1）：薄利多销 / 奇货可居 / 稳健经营 */
export type BusinessStrategy = 'thin' | 'rare' | 'steady';

/** 预购订单来源：普通大单随机变预购 / 沈听澜 / 谢七 / 势力（用户 2.1 逐字） */
export type PreOrderSource = 'random' | 'shen' | 'xie' | 'faction';

/** 预购订单状态：待应（下订未接下）/ 已接下 / 货已备齐 / 已交货 / 逾期（用户 2.1 逐字） */
export type PreOrderStatus = 'pending' | 'accepted' | 'ready' | 'delivered' | 'overdue';

/** 违约惩罚类型：basic 普通（退定金+客流失）/ severe 势力（加扣声望与关系）（用户 2.3 逐字） */
export type PreOrderPenaltyType = 'basic' | 'severe';

/** 预购订单条目（用户 2.1 逐字：itemId/itemName/quantity/reserved） */
export interface PreOrderItem {
  itemId: string;
  itemName: string;
  quantity: number;
  /** 已预留数量（reserveGoodsForOrder 累加；reserved ≥ quantity 即备齐） */
  reserved: number;
}

/** 大单预购订单（用户 2.1 逐字：id/guestName/guestIdentity/source/items/deposit/finalPayment/totalValue/deadline/acceptedDay/status/penaltyType/narrative） */
export interface PreOrder {
  id: string;
  guestName: string;
  /** 客人身份/来头（叙事用；取 guest.storyTag 或需求描述） */
  guestIdentity: string;
  source: PreOrderSource;
  items: PreOrderItem[];
  /** 定金（接单时入账；违约退还；总价三成） */
  deposit: number;
  /** 尾款（交货时入账） */
  finalPayment: number;
  /** 总价 = 零售价 × 溢价 1.1~1.3 */
  totalValue: number;
  /** 交货期限（第 N 日；逾期违约） */
  deadline: number;
  /** 下订日（生成当日） */
  acceptedDay: number;
  status: PreOrderStatus;
  penaltyType: PreOrderPenaltyType;
  /** 叙事（offer 接单 / delivered 交货 / overdue 逾期） */
  narrative: string;
  /** 工程扩展：势力来源订单记录触发势力 id（交货关系+10 / 逾期势力-30 用） */
  factionId?: string;
}

/** 周级要务（TANG-TRF-001 模块三：每周一刷新，周日打烊结算奖励） */
export interface WeeklyTask {
  id: string;
  title: string;
  description: string;
  /** 目标值（进度 ≥ target 完成） */
  target: number;
  reward: TaskReward;
  /** 完成盖「周」红印文案 */
  stampText: string;
}

/** 陆家遗命：触发/完成条件 */
export interface LegacyQuestCondition {
  /** 现银 ≥ 该值（赎回西市分号 5000） */
  minSilver?: number;
  /** 声望 ≥ 该值（赎回西市分号 400） */
  minReputation?: number;
  /** 西市商团关系 ≥ 该值（寻找波斯故人 60） */
  minFactionRelationship?: number;
  /** 需持有线索 id（寻找波斯故人 persian_jade） */
  requiredClue?: string;
  /** 需访问地图节点 id（城外旧契 sang_yuan） */
  requiredNode?: string;
  /** 经营天数 ≥（三年之约 90） */
  minDay?: number;
  /** 破产次数 = 0（三年之约） */
  requireNoBankruptcy?: boolean;
  /** 前置遗命 id（completedLegacyQuests 含该 id 才解锁） */
  requiresQuest?: string;
}

/** 陆家遗命：奖励 */
export interface LegacyQuestReward {
  silver?: number;
  reputation?: number;
  /** 解锁西市店（赎回西市分号） */
  unlockShop?: boolean;
  /** 解锁祖传招牌（赎回西市分号） */
  unlockSign?: boolean;
  /** 特殊路线（寻找波斯故人） */
  specialRoute?: boolean;
  /** 稀有货（寻找波斯故人） */
  rareGoods?: boolean;
  /** 丝绸自产（城外旧契） */
  silkSelfProduce?: boolean;
  /** 沈听澜自动邀（三年之约） */
  shenInvite?: boolean;
}

/** 陆家遗命（模块四）：id/title/goal/reward/nextQuest/narrative */
export interface LegacyQuest {
  id: string;
  title: string;
  goal: string;
  condition: LegacyQuestCondition;
  reward: LegacyQuestReward;
  nextQuest?: string;
  /** 手札翻开叙事（完成时展示） */
  narrative: string;
}

/** 谢七彩头：赌约条件（打烊结算） */
export interface BetCondition {
  /** 今日净利 > 该值（净利之赌 50） */
  minNetProfit?: number;
  /** 今日触发反噬 ≥1（反噬之赌） */
  backlashToday?: boolean;
  /** 今日拒客 ≥1（拒客之赌） */
  rejectedToday?: boolean;
  /** 今日有特殊客（贵客之赌） */
  specialGuestToday?: boolean;
}

/** 谢七彩头：赌约胜负 */
export interface BetOutcome {
  /** 赢：谢七好感 +10 */
  favorGain: number;
  /** 赢：双倍赌注（= stake × 2） */
  silverWin: number;
}

/** 谢七彩头（模块五）：id/title/proposal/stake/condition/win/loseMessage */
export interface TangBet {
  id: string;
  title: string;
  proposal: string;
  /** 赌注（两） */
  stake: number;
  condition: BetCondition;
  win: BetOutcome;
  loseMessage: string;
  /** 输：额外惩罚文案/情报（贵客之赌 西市情报） */
  bonusOnLose?: string;
}

/** 市易务暗标：可能结果（抽奖概率） */
export interface BlindAuctionOutcome {
  label: string;
  /** 中标后按概率抽奖（和为 1） */
  chance: number;
  /** 收益（两；可为负 = 亏） */
  silver?: number;
  /** 稀有配方 id（废弃仓库 5%） */
  recipe?: string;
}

/** 市易务暗标（模块六）：id/category/description/startPrice/possibleOutcomes */
export interface BlindAuction {
  id: string;
  category: string;
  description: string;
  startPrice: number;
  possibleOutcomes: BlindAuctionOutcome[];
}

/** 伙计小传：传记条目（4 阶段） */
export interface BiographyEntry {
  stage: number;
  title: string;
  content: string;
  unlockCondition: string;
  unlocked: boolean;
}

/** 商阶（模块八）：id/name/threshold/type/description */
export interface MerchantRank {
  id: string;
  name: string;
  threshold: number;
  /** 门槛类型：day 经营天数 / score 评分 / shop 分店 / asset 资产 / composite 复合 / ending 结局 */
  type: 'day' | 'score' | 'shop' | 'asset' | 'composite' | 'ending';
  description: string;
}

/** 局外成长：传承选项（模块九） */
export interface AncestralBlessingOption {
  id: string;
  name: string;
  /** 传承点数消耗 */
  cost: number;
  description: string;
}

/** 月度总结（模块十）：手札录条目数据 */
export interface MonthlyReview {
  day: number;
  /** 第几个月（day/30 向上取整） */
  month: number;
  netProfit: number;
  prevNetProfit: number;
  bestGood: string;
  memorableGuest: string;
  biggestMistake: string;
  employeeChanges: string;
  /** AI 生成或模板文案 */
  content: string;
}

/** 局外成长存档（独立 localStorage 'tang-legacy-growth'，与主存档隔离） */
export interface LegacyGrowthSave {
  /** 已获得传承点数（按结局评定） */
  blessingPoints: number;
  /** 已选择传承 id（每局只可选一次） */
  chosenBlessings: string[];
  /** 历史结局记录（endingId → 次数） */
  endings: Record<string, number>;
  /** 当前生效传承（本次开局已选） */
  activeBlessings: string[];
}

// ============================================================
// 迷雾系统（TANG-MIST-001 模块一）：区域 / 势力 / 人物三类迷雾
// 揭示阈值（用户 1.1 逐字）：势力 领袖≥40 / 关系线≥60 / 特权≥80 /
//   隐藏目的=线索墙该势力线索≥3 条；NPC 背景≥40 / 心结≥60 / 真实态度≥80 /
//   完整隐藏故事=专属事件后。纯函数在 systems/tang-fog.ts；store 只做接线。
// ============================================================

/** 区域迷雾（用户 1.1 逐字：nodeId/revealed/hint/revealCondition） */
export interface RegionFog {
  /** 地图点位 id（MAP_NODES） */
  nodeId: string;
  /** 是否已揭示（L1 开局揭示；L2/L3 核心点初始揭示，其余探访后揭示） */
  revealed: boolean;
  /** 坊间传言（未揭示时灰色问号下方展示的传闻文案） */
  hint: string;
  /** 揭示条件（未揭示时 hover/遮罩提示） */
  revealCondition: string;
}

/** 势力迷雾（用户 1.1 逐字：factionId/leaderRevealed/relationsRevealed/perksRevealed/hiddenAgendaRevealed/hiddenAgenda） */
export interface FactionFog {
  factionId: string;
  /** 领袖已揭示（关系 ≥40） */
  leaderRevealed: boolean;
  /** 关系线已揭示（关系 ≥60） */
  relationsRevealed: boolean;
  /** 特权已揭示（关系 ≥80） */
  perksRevealed: boolean;
  /** 隐藏目的已揭示（线索墙该势力线索 ≥3 条） */
  hiddenAgendaRevealed: boolean;
  /** 隐藏目的文案（FACTION_HIDDEN_AGENDAS） */
  hiddenAgenda: string;
}

/** NPC 迷雾（用户 1.1 逐字：npcId/backgroundRevealed/heartRevealed/trueAttitudeRevealed/fullStoryRevealed/trueAttitude/hiddenStory） */
export interface NPCFog {
  npcId: string;
  /** 背景已揭示（好感 ≥40） */
  backgroundRevealed: boolean;
  /** 心结已揭示（好感 ≥60） */
  heartRevealed: boolean;
  /** 真实态度已揭示（好感 ≥80） */
  trueAttitudeRevealed: boolean;
  /** 完整隐藏故事已揭示（NPC 专属事件后；M2 接线） */
  fullStoryRevealed: boolean;
  /** 真实态度文案（M2 填充前为空串） */
  trueAttitude: string;
  /** 隐藏故事文案（M2 填充前为空串） */
  hiddenStory: string;
}

/** 迷雾系统状态（用户 1.1 逐字：regions/factions/npcs） */
export interface FogState {
  /** 区域迷雾（key=地图点位 id） */
  regions: Record<string, RegionFog>;
  /** 势力迷雾（key=势力 id，含无势力卡的 court 朝廷派系） */
  factions: Record<string, FactionFog>;
  /** NPC 迷雾（key=NPC id；M1 仅结构，M2 填充数据） */
  npcs: Record<string, NPCFog>;
}

// ============================================================
// 长安故人 · 六位新 NPC（TANG-MIST-002 模块三）
// 用户 3.1 逐字字段；纯数据在 config/tang-npcs.ts；登场/好感/拜访逻辑在 systems/tang-npc-system.ts。
// ============================================================

/** NPC 性别 */
export type GameNPCGender = '男' | '女';

/** NPC 登场状态：locked 未登场 / available 条件已满足可登场（阿萤待赎） / active 已登场可拜访 */
export type GameNPCStatus = 'locked' | 'available' | 'active';

/** 长安故人 NPC（用户 3.1 逐字：id/name/gender/age/identity/location/favor/status/portrait/personality/speakingStyle/background(≥40 揭)/heartSecret(≥60)/trueAttitude(≥80)/hiddenStory(专属事件后)/function） */
export interface GameNPC {
  id: string;
  /** 姓名 */
  name: string;
  /** 性别（男/女） */
  gender: GameNPCGender;
  /** 年龄（古风描述，如「五十许」） */
  age: string;
  /** 身份（逐字） */
  identity: string;
  /** 常驻地点（古风） */
  location: string;
  /** 好感（0-100；更新走 updateNPCFavor） */
  favor: number;
  /** 登场状态 */
  status: GameNPCStatus;
  /** 立绘路径（public/images/npcs/portraits/） */
  portrait: string;
  /** 性格（逐字） */
  personality: string;
  /** 说话风格（逐字） */
  speakingStyle: string;
  /** 背景（好感 ≥ 40 揭示） */
  background: string;
  /** 心结（好感 ≥ 60 揭示） */
  heartSecret: string;
  /** 真实态度（好感 ≥ 80 揭示） */
  trueAttitude: string;
  /** 隐藏故事（NPC 专属事件后揭示） */
  hiddenStory: string;
  /** 功能说明（逐字） */
  function: string;
}

/** 迷雾揭示信息类型（势力四项 + NPC 四项；供揭示函数与 store action 共用） */
export type FogInfoType =
  | 'leader'
  | 'relations'
  | 'perks'
  | 'hiddenAgenda'
  | 'background'
  | 'heart'
  | 'trueAttitude'
  | 'fullStory';

/** 迷雾揭示结果（checkFogReveals / reveal*Info 产出；store 返回给 UI 展示/浮层） */
export interface FogRevealResult {
  kind: 'faction' | 'npc';
  id: string;
  infoType: FogInfoType;
  /** 揭示文案（古风；如「已探明首领」） */
  label: string;
}

/** 掌柜游戏状态（Step 1 数值字段 + Step 2 经营字段 + Step 3 世界激活字段） */
/** AI 对话上下文（规格书 5.3）：情绪追踪 + 最近 10 条历史 */
export interface DialogueContext {
  guestId: string;
  history: { role: 'guest' | 'player'; content: string }[];
  guestInfo: { identity: string; personality: string; mood: string; preferences: string[] };
  shopType: string;
  emotion: number;
}

export interface TangGameState {
  /** 当前阶段 */
  phase: GamePhase;
  /** 双视图模式（默认 operations；dashboard=经营看板只显示面板，operations=日常经营核心循环）
   *  可选字段：旧存档/测试夹具未含该字段时按 operations 兜底（见 store buildInitialState）。 */
  viewMode?: TangViewMode;
  /** 接待对话历史（当前客人；AI 上下文；模块六） */
  dialogueHistory: DialogueMessage[];
  /** 客人心情（guestId → mood；模块二） */
  guestMood: Record<string, GuestMood>;
  /** 事件/接待故事弹窗叙事（模块四；瞬时 UI 状态不持久化） */
  storyNarrative: StoryNarrative | null;
  /** 客人到店描述弹窗（瞬时；三店通用；AI 叙事或模板） */
  guestArrival: { guestId: string; content: string; source: 'ai' | 'template' } | null;
  /** 店员主动提醒（店员互动提升 模块五；当前活跃列表，最多 2 条） */
  staffReminders: StaffReminder[];
  /** 店员连续忽略计数（staffId → 次数；3 次触发满意度 -5） */
  staffIgnoreCounts: Record<string, number>;
  /** 每日清晨员工问候（模块四 4.1） */
  dailyStaffGreeting: { staffId: string; staffName: string; content: string } | null;
  /** 每日打烊员工报告（模块四 4.2） */
  dailyStaffReport: { staffId: string; staffName: string; content: string; band: 'positive' | 'neutral' | 'negative' } | null;
  // ---- 店铺特色产业系统（产业系统 模块五） ----
  /** 酒楼：已研发菜品 */
  tavernDishes: TavernDish[];
  /** 酒楼：进行中的宴席 */
  tavernBanquets: Banquet[];
  /** 酒楼：产业等级 1-5 */
  tavernLevel: number;
  /** 酒楼：进行中的菜品研发 */
  tavernResearchJobs: TavernResearchJob[];
  /** 酒楼：累计宴席承办数（升级条件） */
  tavernBanquetCount: number;
  /** 酒楼：研发经验层数（失败累计，成功率 +5%/层） */
  tavernResearchExp: number;
  /** 布庄：合作织工 */
  weavers: Weaver[];
  /** 布庄：定制订单 */
  customOrders: CustomOrder[];
  /** 布庄：产业等级 1-5 */
  clothierLevel: number;
  /** 布庄：累计定制订单完成数（升级条件） */
  customOrderCount: number;
  /** 药铺：坐堂郎中 */
  physicians: Physician[];
  /** 药铺：已研发药方 */
  herbRecipes: HerbRecipe[];
  /** 药铺：进行中的药方研发 */
  herbResearchJobs: HerbResearchJob[];
  /** 药铺：产业等级 1-5 */
  herbalistLevel: number;
  /** 药铺：累计治愈病人数（升级条件） */
  curedPatientCount: number;
  /** 药铺：今日问诊病人数（郎中坐堂） */
  todayPatients: number;
  /** 产业升级贺词（me 面板展示；瞬时） */
  lastIndustryBlessing: string | null;
  // ---- 地图与事件深化（模块七） ----
  /** 事件历史记录 */
  eventHistory: EventRecord[];
  /** 待触发连锁事件 */
  pendingConsequences: PendingConsequence[];
  /** 节点故事揭示记录 */
  nodeStoriesRevealed: NodeStoriesRevealed;
  /** 事件疲劳度状态 */
  eventFatigue: EventFatigue;
  // ---- AI 全量接入（v1.1 模块五） ----
  /** 各内容类型 AI 开关 */
  aiContentToggles: Record<string, boolean>;
  /** AI 生成日志（调试模式展示最近请求/成功率） */
  aiGenerationLog: Array<{ type: string; ok: boolean; latencyMs: number; source: 'ai' | 'template'; day: number }>;
  // ---- 行为触发追踪（地图与事件深化 模块四 4.1 接线） ----
  /** 最近一次使用通晓人心的天数（0=从未；能力生疏判定） */
  lastMindReadDay: number;
  /** 连续无陈损天数（库房管理有方判定） */
  noExpiryStreak: number;
  /** 连续全亲自接待天数（过度劳累判定；settleDay 维护） */
  consecutiveFullReceptionDays: number;
  // ---- 官场线·转政最小闭环（P1-2026-08-05） ----
  /** 已办政务数（0-5） */
  politicsStep: number;
  /** 五道政务是否尽办（→ 权倾朝野） */
  politicsDone: boolean;
  /** 当前待办政务 */
  currentPoliticsDecision: PoliticsDecision | null;
  // ---- 体验优化（2026-08-05）：打烊结算弹窗 / 消息代办 / 店铺资产 ----
  /** 打烊结算弹窗（瞬时 UI，不持久化） */
  settlementPopupOpen: boolean;
  /** 消息/代办（NPC 找玩家的待办事项） */
  messages: GameMessage[];
  /** 已购店铺资产 id */
  shopAssets: string[];
  /** 玩家身份（identity 阶段填写后写入） */
  player: PlayerIdentity | null;
  /** 店型（shop-type 阶段选择后写入） */
  shopType: ShopType | null;
  /** 难度档位（初始为 B） */
  difficulty: Difficulty;
  /** 现银（两）——Step 5b 多货币主币（原 gold 物理改名） */
  silver: number;
  /** 现银兼容别名（读取 silver；store 保持同步，旧 UI/测试引用不炸） */
  gold: number;
  /** 飞钱（两；1 贯 = 1 两，等值；远程调拨/跨店专用） */
  feiqian: number;
  /** 信用值（0-1000；默认 A=100 / B=50 / C=0） */
  credit: number;
  /** 信用锁定（临时锁定，还款后释放；赊购锁 50 / 官单锁 100） */
  creditLocked: number;
  /** 信用破产恢复剩余天数（credit<0 触发：供应商现金交易/官府盘查翻倍/30 天恢复） */
  creditBankruptDays: number;
  /** 信用变动流水（最近记录，UI 展示最近 5 条） */
  creditHistory: CreditRecord[];
  /** 旧债（两）——原 debt 物理改名（Step 5b 负债整合 legacyDebt） */
  legacyDebt: number;
  /** 旧债兼容别名（读取 legacyDebt；store 保持同步） */
  debt: number;
  /** 钱庄存款列表（月息 0.5%） */
  deposits: BankDeposit[];
  /** 贷款列表（抵押借贷 + 高利贷） */
  loans: BankLoan[];
  /** 投资列表（商会基金 / 沈听澜 / 地下钱庄） */
  investments: Investment[];
  /** 物价指数（0.8~1.5，默认 1.0；每月初 updatePriceIndex） */
  priceIndex: number;
  /** 上次物价更新日（updatePriceIndex 写入） */
  lastPriceUpdate: number;
  /** 库存上限（单位；初始 100，超出每日 1 两/10 单位仓储费） */
  maxStorage: number;
  /** 事件驱动的通胀修正（丰收-0.10/歉收+0.15/漕运/铸钱/钱荒；月初 updatePriceIndex 消费后清零） */
  inflationModifier?: number;
  /** 钱庄优惠剩余天数（存款利率翻倍限时；每日递减） */
  depositRateBoostDays?: number;
  /** 月息（两/月） */
  monthlyInterest: number;
  /** 店铺评分（1.0-5.0） */
  score: number;
  /** 声望（0-1000） */
  reputation: number;
  /** 小二好感（0-100） */
  xiaoerFavor: number;
  /** 小二满意度（0-100） */
  xiaoerSatisfaction: number;
  /** 精力（0-100） */
  energy: number;
  /** 经营天数 */
  day: number;
  /** 「通晓人心」剩余次数（难度档位初始化） */
  insightRemaining: number;
  /** 「福星高照」剩余次数（难度档位初始化） */
  luckRemaining: number;
  /** 今日客人（startNewDay 生成 5 位） */
  guests: Guest[];
  /** 当前接待指针（0..guests.length） */
  currentGuestIndex: number;
  /** 账本（上限 50 条，超出裁掉最旧） */
  ledger: LedgerEntry[];
  /** 最近一次结算（settleDay 产出；次日 startNewDay 重置为 null） */
  todaySettlement: DaySettlement | null;
  /** 货架商品（initByDifficulty 按店型加载 INITIAL_GOODS） */
  shopItems: ShopItem[];
  /** 已解锁成就 id */
  unlockedAchievements: string[];
  /** 「通晓人心」累计使用次数（2.3 要求追踪，反噬 Step 3 用） */
  insightUsedTotal: number;
  /** 当日接待精力消耗累计（settleDay 汇总用；startNewDay 重置） */
  dailyEnergyConsumed: number;
  /** 事件定义表（3.1；init 时从 EVENT_DEFINITIONS 载入） */
  events: GameEvent[];
  /** 待处理事件队列（startNewDay 填充；UI 逐件处理，队列空则正常经营） */
  pendingEvents: GameEvent[];
  /** 已触发事件 id 列表（去重权威，eventLog.includes(id) 判定） */
  eventLog: string[];
  /** 各 NPC 身份（key=guest.name）累计使用通晓人心次数（反噬判定；同名客人跨天累计） */
  insightUsedOnNPC: Record<string, number>;
  /** 累计净收益（成就「招财进宝」；settleDay 累加） */
  totalNetProfit: number;
  /** 单次福星高照最大净赢（成就「赌神在世」；useLuckyStar 更新） */
  maxGamblingWin: number;
  /** 是否经历过破产（成就「东山再起」；破产时置 true） */
  hasGoneBroke: boolean;
  /** 小二是否已离开（债主事件选项 B / 破产） */
  xiaoerGone: boolean;
  /** 是否欠沈听澜人情（债主事件选项 C） */
  shenDebt: boolean;
  /** 是否与沈听澜结为伙伴（沈听澜事件选项 A） */
  shenPartner: boolean;
  /** 谢七好感（0-100） */
  xieQiFavor: number;
  /** 沈听澜好感（0-100） */
  shenTinglanFavor: number;
  /** 赌瘾剩余天数（福星高照触发；打烊 settleDay 递减） */
  gamblingAddictionDays: number;
  /** 福星高照累计使用次数（赌瘾阈值 B5/C3；因 difficulty 的 luckChances 仅 1-2 次，
   *  公式 luckChances-luckRemaining 无法达阈值，故用终身计数） */
  luckUsedTotal: number;
  /** 破产开始日（破产面板「已坚持天数」= day - bankruptcyStartDay） */
  bankruptcyStartDay: number;
    /** 待处理投诉（正常接待触发后填充；非持久化瞬时字段） */
  pendingComplaint: PendingComplaint | null;
  /** 手札叙事（AI）开关（4.4；默认 true；关闭/离线/失败 → 降级模板） */
  aiNarrationEnabled: boolean;
  /** 手札叙事模型（4.4；默认 openai/gpt-4o-mini） */
  aiModel: string;
  /** 店铺经营阶段（5a 1.1；默认 1；settleDay 后 checkStageUpgrade 推进） */
  stage: GameStage;
  /** 已入职员工（5a 2；不含阿昭；阿昭状态用 xiaoerFavor/xiaoerSatisfaction） */
  employees: Employee[];
  /** 员工上限（初始 4；shopCount 每 +1 → +2） */
  maxEmployees: number;
  /** 今日剩余自由行动次数（1.2；startNewDay 按难度重置） */
  dailyActionsRemaining: number;
  /** 今日已执行自由行动 id（1.2；startNewDay 重置为 []，防重复） */
  afternoonActions: string[];
  // ---- 内容深化 TANG-CONT-C 模块二/五：午后自由行动 + 接待随机事件状态 ----
  /** 午后巡查：待玩家处置的隐患（处置一件移除一件） */
  pendingPatrolHazards?: PatrolHazard[];
  /** 午后巡查：延后修缮的隐患（deadlineDay 到期未修 → 坍塌损失） */
  postponedPatrolHazards?: PatrolHazard[];
  /** 市井闲逛捡漏（限当日七折；buyStrollBargain 消费后清空） */
  strollBargain?: { itemName: string; price: number; day: number } | null;
  /** 打烊离场「带新客来」→ 次日额外客人（startNewDay 消费后清零） */
  nextDayExtraGuests?: number;
  /** 当日偷懒未训诫的员工（效率-30% 近似：settleDay 不计入加成；startNewDay 清零） */
  slackingEmployeeIds?: string[];
  /** 店铺数量（1.1；初始 1；与沈听澜结为伙伴时 +1） */
  shopCount: number;
  /** 谢七身份是否已揭晓（1.1；谢七登场事件选择后置 true） */
  xieQiIdentityRevealed: boolean;
  /** 特殊员工完整剧情是否已触发（1.1；背景揭露事件后置 true） */
  specialEmployeeStoryCompleted: boolean;
  /** 员工改进建议收益加成（2.5；checkEmployeeEvents 后设置，次日 settleDay 消费并清零） */
  employeeBonusRate: number;
  /** 最近一次投资到期结算结果（瞬时展示用；投资到期弹窗消费后 dismissInvestmentResults 清空；不持久化） */
  lastInvestmentResults?: InvestmentSettlementResult[];
  /** 库房等级（Step 5b-1.5；1→5 级，每级 +50 容量，初始 1） */
  warehouseLevel?: number;
  /** 每日仓储费（两；超出 freeStorageLimit 部分每 10 单位 1 两，含时令修正；UI 展示用） */
  storageCostPerDay?: number;
  /** 免费库容上限（Step 5b-1.5；初始 50，超出部分收费） */
  freeStorageLimit?: number;
  /** 籴粜契列表（Step 5b-1.5 进货策略） */
  forwardContracts?: ForwardContract[];
  /** 市易务挂牌（Step 5b-1.5；每日清晨刷新，仅当日有效） */
  marketListings?: MarketListing[];
  /** 加工队列（Step 5b-1.5 商品加工） */
  processingQueue?: ProcessingJob[];
  /** 库房扩建进行中（targetLevel/completionDay；期间容量不增） */
  warehouseExpansion?: WarehouseExpansion | null;
  /** 库存操作旁白（瞬时展示用；不持久化；shelf-panel 底部展示） */
  inventoryNarratives?: string[];
  /** 连续缺货日数（Step 5b-1.5 接待联动；主顾流失轻量实现） */
  missingGoodStreak?: number;
  // ---- Step 5b-2 商业地图系统（TANG-S5B2-001）----
  /** 已解锁地图层（初始 ['yongle']；L2 声望≥200 或分店≥2；L3 声望≥700 且阶段≥3） */
  unlockedLayers: MapLayer[];
  /** 已访问点位 id（点击点位即记录） */
  visitedNodes: string[];
  /** 动态地图事件（每日清晨生成 1-2 个；打烊过期清理） */
  mapEvents: MapEvent[];
  /** 商路（静态配置 TRADE_ROUTES 快照；持久化便于追踪） */
  tradeRoutes: TradeRoute[];
  /** 已解锁绿色通道 routeId（自动通道由 getEffectiveGreenChannels 内联判定） */
  greenChannels: string[];
  /** 在途货物（跑商物流；到达日 checkTransportArrivals 结算） */
  transportingGoods: TransportingGoods[];
  /** 点位每日物价系数（0.8-1.5；startNewDay ±5% 微调） */
  nodePriceModifiers: Record<string, number>;
  // ---- TANG-MIST-003 M3：地图功能增强（节点繁荣度 / 标记 / 今日交易 / 路线规划）----
  /** 节点繁荣度运行时表（key=点位 id；开局全 50/stable；每日清晨结算） */
  nodeProsperity?: Record<string, NodeProsperity>;
  /** 玩家自定义标记（最多 5 个） */
  playerMarkers?: PlayerMarker[];
  /** 今日玩家有交易的节点 id（采买/卖出/镖队到达；次日清晨繁荣度结算消费后重置） */
  todayTradedNodes?: string[];
  /** 路线规划结果（null=无） */
  mapRoutePlan?: MapRoutePlan | null;
  /** 镖队路线预填（路线规划「组建镖队走此路线」→ 镖队面板；caravan-panel 消费后清空） */
  mapCaravanPrefill?: MapCaravanPrefill | null;
  /** 标记节点新动态提示（瞬时不持久化；map-panel 展示后消费） */
  mapMarkerNotices?: string[];
  /** 面板跳转请求（page.tsx 消费后清空；瞬时不持久化） */
  requestedNavPanel?: string | null;
  // ---- 接待深度升级（TANG-RCP-001）----
  /** 店铺气氛（0-100，默认 50；夸奖+10/投诉-15/当场离开-8/解决投诉+5；高气氛消费+10% 低气氛-15%） */
  shopAtmosphere?: number;
  /** 宾客留言簿（praise/story/event 条目；按日期排序、翻页展示） */
  guestBook?: GuestBookEntry[];
  /** 回头客池（key=guest.name；20% 概率抽一位生成熟客，继承偏好/等级/次数/总消费，lastVisit 更新） */
  knownGuests?: Record<string, KnownGuestRecord>;
  // ---- 团队与社交深度（TANG-SOC-001）：名声关系网 / 内部交情 ----
  /** 长安五大势力关系（东市商会/西市商团/京兆府/地下势力/平康坊风月场；relationship 0-100） */
  factions?: Faction[];
  /** NPC 好感列表（沈听澜/谢七/赵员外/京兆府尹；favor 0-100 + 已解锁特权） */
  npcFavors?: NPCFavor[];
  /** 内部交情扁平视图（store 维护：全员 relationships 汇总，面板/测试便捷读取） */
  employeeRelations?: EmployeeRelationship[];
  /** 京兆府尹好感（0-100；名声关系网 NPC 联动；5.3） */
  fuyinFavor?: number;
  /** 赵员外好感（0-100；名声关系网 NPC 联动；5.3） */
  zhaoYuanwaiFavor?: number;
  /** 阿昭成长标记（3.3 阿昭成长：心思细腻/死心塌地/兄妹同心——配置/注释占位） */
  azhaoTrait?: 'xinsi' | 'sixin' | 'xiongmei' | null;
  /** 名声关系网面板开关（TANG-SOC-001；overlay 渲染，非 NavPanelKey，page.tsx 零触碰） */
  factionPanelOpen?: boolean;
  // ---- Step 5b-5：叙事与后期系统（手札录 / 蛛丝马迹 / 巍明楼 / 镖队 / 多结局）----
  /** 手札录条目（自动记录经营历程/人物往来/重大抉择；按日期倒序展示） */
  journal?: JournalEntry[];
  /** 蛛丝马迹线索墙（六线情报；同类别 ≥3 条自动关联） */
  clues?: Clue[];
  // ---- 迷雾系统（TANG-MIST-001 模块一）：区域 / 势力 / 人物三类迷雾 ----
  /** 迷雾状态（初始由 buildInitialFogState 构建；每日打烊 checkFogReveals 批量揭示） */
  fogOfWar: FogState;
  // ---- 长安故人 · 六位新 NPC（TANG-MIST-002 模块三）----
  /** 六位新 NPC 运行时状态（key=NPC id；初始全部 locked） */
  gameNPCs: Record<string, GameNPC>;
  /** NPC 拜访冷却（key=NPC id → 上次拜访日；3 天冷却） */
  npcVisitCooldowns?: Record<string, number>;
  /** NPC 交谈计数（key=NPC id；陆伯家族往事 5-8 次逐段解锁） */
  npcConvoCounts?: Record<string, number>;
  /** 苏大娘上次买情报日（3 天冷却） */
  suDaniangLastIntelDay?: number;
  /** 阿萤暗示事件已触发（阿昭好感 ≥60 时置 true） */
  ayingHinted?: boolean;
  /** 阿萤赎身被拒（婉拒后不可再赎；阿昭好感归零+离职） */
  ayingRefused?: boolean;
  /** 阿萤在店天数（赎身后每天打烊 +1；≥60 且阿昭 ≥90 解锁兄妹同心） */
  ayingInShopDays?: number;
  /** 陆伯家族往事集齐（隐藏结局「沉冤得雪」条件标记） */
  luBoStoryRevealed?: boolean;
  /** 陆伯往事交谈目标次数（登场时 5-8 随机取定；测试可注入） */
  luBoConvoTarget?: number;
  /** 程掌柜合作开启（好感 ≥50：官单利润共享） */
  chengCooperation?: boolean;
  /** 程掌柜进货折扣品类（好感 ≥70：某类进价 -10%，接入采购计价，注释） */
  chengDiscountCategory?: string | null;
  /** 萨迪隐藏商路开启（好感 ≥50） */
  sadiHiddenRoute?: boolean;
  /** 萨迪赠玉佩（好感 ≥80：特殊商品） */
  sadiJadeGift?: boolean;
  /** 上官引荐朝臣（好感 ≥80：派系斗争助力，注释） */
  shangguanCourtIntro?: boolean;
  /** 兄妹同心已解锁（阿昭 ≥90 且阿萤在店 ≥60 日：阿昭效率 ×1.5，注释） */
  xiongmeiUnlocked?: boolean;
  /** 旧债清零日（陆伯登场用；checkNPCUnlocks 惰性维护；null=从未清零） */
  legacyDebtClearedDay?: number | null;
  /** 地图定位请求（NPC 详情「在地图上查看」写入；长安舆图挂载时自动聚焦该节点并清空） */
  mapLocateNodeId?: string | null;
  /** 巍明楼政令列表（每月初新增 1 条，持续 30 天） */
  decrees?: Decree[];
  /** 朝廷子派系站队（conservative 保守派 / reformist 开明派 / eunuch 宦官派；null 未站队） */
  politicalFaction?: PoliticalSubFactionId | null;
  /** 朝廷支持值（0-100；权倾朝野结局与转政门槛用） */
  politicalAlignment?: number;
  /** 镖队列表（商队物流；组建/路线/装载/在途推进） */
  caravans?: Caravan[];
  /** 已触发结局 id（非空时 EndingOverlay 全屏弹窗；null 未触发） */
  endingTriggered?: string | null;
  /** 手札录面板开关（overlay 渲染，NavItemKey 'journal'） */
  journalPanelOpen?: boolean;
  /** 巍明楼面板开关（overlay 渲染，NavItemKey 'politics'） */
  politicsPanelOpen?: boolean;
  /** 镖队面板开关（overlay 渲染，NavItemKey 'caravan'） */
  caravanPanelOpen?: boolean;
  // ---- Step 5b-5：多结局支撑字段 ----
  /** 皇商中标次数（皇商之路结局 ≥3） */
  imperialBidCount?: number;
  /** 是否朝廷合作（皇商之路结局） */
  courtCooperation?: boolean;
  /** 是否主动卖店（归隐田园结局） */
  soldShops?: boolean;
  /** 徒弟是否独立开店（商界教父结局） */
  apprenticeOpenedShop?: boolean;
  /** 退居天数（商界教父结局 ≥30） */
  retiredDays?: number;
  /** 是否从商转政（权倾朝野结局；phase='politics' 时置 true） */
  politicalLine?: boolean;
  /** 政治终局（权倾朝野结局） */
  politicalEndgame?: boolean;
  /** 是否已加入朝廷派系（执棋者结局要求未加入） */
  joinedCourt?: boolean;
  // ---- 成瘾性玩法模块（TANG-ADD-001）：手札占候 / 意外之喜 / 今日要务 ----
  /** 今日卦象（startNewDay 清晨抽取；null=未抽） */
  todayHexagram?: Hexagram | null;
  /** 今日要务（清晨抽 2 个；打烊 checkTaskCompletion 判定） */
  todayTasks?: DailyTask[];
  /** 今日要务已完成的 id（打烊盖「了」红印后记录） */
  todayTasksCompleted?: string[];
  /** 市井消息（2026-08-06 新增系统；每日清晨生成 1-2 条，保留最近 10 条） */
  streetNews?: string[];
  /** AI 对话上下文表（规格书 5.4） */
  dialogueContexts?: Record<string, DialogueContext>;
  /** 药铺坐诊：医疗知识等级 0-3（规格书 2.2） */
  medicalKnowledge?: number;
  /** 已购医书 id 列表（规格书 2.2） */
  ownedMedicalBooks?: string[];
  /** 今日要务「用通晓人心」额外奖励的次数（打烊奖励发放用） */
  todayTaskMindReadBonus?: number;
  /** 已触发稀有事件 id（意外之喜去重） */
  completedRareEvents?: string[];
  /** 手札占候翻开卡待展示标记（overlay 开关；瞬时不持久化） */
  hexagramCardOpen?: boolean;
  // ---- 陆家遗命 / 谢七彩头 / 市易务暗标 ----
  /** 当前遗命（null=无） */
  activeLegacyQuest?: LegacyQuest | null;
  /** 已完成遗命 id（推进解锁） */
  completedLegacyQuests?: string[];
  /** 遗命完成手札翻开叙事待展示（瞬时不持久化） */
  legacyQuestRevealOpen?: boolean;
  /** 当前赌约（null=无；谢七登场+30% 概率出现） */
  activeBet?: TangBet | null;
  /** 玩家是否已接下当前赌约（acceptBet 置 true） */
  betAccepted?: boolean;
  /** 当前暗标（每月初一清晨挂出；null=无） */
  currentBlindAuction?: BlindAuction | null;
  /** 玩家对暗标的出价（两；null=未出价） */
  blindAuctionBid?: number | null;
  /** 暗标是否已开标（resolveAuction 置 true；下月重置） */
  blindAuctionResolved?: boolean;
  // ---- 商阶 / 月度总结 ----
  /** 当前商阶 id（evaluateRank 打烊评定；null=初始白丁） */
  rank?: string | null;
  /** 商阶晋升进度（0-1；复合门槛完成度，展示用） */
  rankProgress?: number;
  /** 月度总结列表（每月初一打烊生成；手札录展示） */
  monthlyReviews?: MonthlyReview[];
  /** 商阶晋升贺词待展示（瞬时不持久化） */
  rankPromotionOpen?: boolean;
  // ---- 今日追踪（TANG-ADD-001：今日要务 / 赌约 / 暗标判定输入；startNewDay 重置）----
  todayNetProfit?: number;
  todayMindReadUsed?: number;
  todaySilkSold?: number;
  /** 市集捡漏触发（暗标/挂牌采买成功置 true） */
  todayMarketDealTriggered?: boolean;
  todayChatUsed?: number;
  todayComplaints?: number;
  todayGuestsHandled?: number;
  todayRejectedGuests?: number;
  todayMindReadBackfired?: number;
  /** 先祖之眼（传承）：通晓人心反噬阈值翻倍（store 接线传 backlashThresholdOverride） */
  ancestralEyeActive?: boolean;
  // ---- TANG-TRF-001：动态客流 + 大单预购 + 周级要务 ----
  /** 接待策略（每日预设；亲力亲为 all / 择要接待 priority / 全托伙计 delegate；默认 all） */
  receptionStrategy?: ReceptionStrategy;
  /** 经营策略（内容深化 TANG-CONT-B 模块六·1；薄利多销 thin / 奇货可居 rare / 稳健 steady；
   *  默认 steady；薄利 基础收益×0.8 客人数+30%、奇货 ×1.3 客人数-30%，见 systems/tang-business-strategy） */
  businessStrategy?: BusinessStrategy;
  /** 大单预购订单列表（下订→接单→备货→交货→结算） */
  preOrders?: PreOrder[];
  /** 本周要务（每周一 startNewDay 刷新；周日打烊结算奖励） */
  weeklyTasks?: WeeklyTask[];
  /** 周级要务进度（id → 本周累计值；接待/预购/结算/通晓人心接线累加） */
  weeklyTaskProgress?: Record<string, number>;
  // ---- v1.0 功能解锁（TANG-POLISH-001 模块二）----
  /** 已解锁功能记录（featureId → true；默认全 false；每日清晨/打烊 checkFeatureUnlock 更新） */
  unlockedFeatures?: Record<string, boolean>;
  // ---- 内容深化 TANG-CONT-D 模块四：西市赌坊 ----
  /** 赌坊弹窗开关（overlay 渲染；map-panel 打开/关闭） */
  gamblingPanelOpen?: boolean;
  /** 赌坊当前预估赔率（1.5~3；打开面板刷新） */
  gamblingOdds?: number;
  /** 被赌坊老板盯上：下次赌坊赢利抽水 10%（福星高照等价交换在赌坊场景） */
  gamblingSuspicion?: boolean;
  // ---- 内容深化 TANG-CONT-D 模块七：负反馈系统 ----
  /** 连续盈利天数（settleDay 维护：净利>0 递增，否则归零；树大招风/集体涨薪判定） */
  consecutiveProfitDays?: number;
  /** 待玩家处置的负反馈事件（checkNegativeFeedback 打烊入队；resolveNegativeEvent 出队） */
  pendingNegativeEvents?: NegativeEvent[];
  /** 当前灾害类型（瘟疫：客流减半 7 天；store startNewDay/settleDay 应用） */
  disasterType?: 'flood' | 'fire' | 'plague';
  /** 灾害影响截止日（瘟疫客流减半 7 天） */
  disasterUntil?: number;
  /** 沈听澜使绊截止日（某类进货价 +15% 15 天；0=无） */
  shenSchemeUntil?: number;
  /** 沈听澜使绊目标品类（进货价 +15%） */
  shenSchemeCategory?: string;
  /** 钱庄挤兑剩余天数（当月存款不可取；下月恢复但损半月利息） */
  bankRunDays?: number;
  /** 月钱倍率（集体涨薪全体选项：×1.2；每月支出增近似） */
  salaryMultiplier?: number;
  /** 阿昭连续未涨月钱月数（阿昭偷钱判定 ≥2 个月） */
  azhaoNoRaiseMonths?: number;
  // ---- 内容深化 TANG-CONT-D 模块八：负债拓展 ----
  /** 商业债务（赊账进货）总额（两） */
  tradeCredit?: number;
  /** 赊账最早到期日（30 天无息；逾期月息 5% 可叠加） */
  creditDueDay?: number;
  /** 循环借贷 offer（还清抵押贷款后钱庄提供：额度×1.5、利率+1%；null=无） */
  revolvingLoanOffer?: { amount: number; interestRate: number } | null;
  /** 人情债类型（沈听澜帮忙后 shenDebt=true 时标记 'favor'） */
  shenDebtType?: 'favor' | null;
  /** 人情债关键时机弹窗开关（shenDebt=true 打烊概率触发） */
  shenDebtMomentOpen?: boolean;
  /** 被栽赃弹窗开关（评分≥3.0 打烊概率触发） */
  framedOpen?: boolean;
  /** 赌坊谢七「手气好」台子（打开面板判定；本次胜率临时 +10%） */
  gamblingLuckyTable?: boolean;
  /** 赌坊谢七互动叙事（打开面板展示） */
  gamblingEncounterMsg?: string;
  // ---- 新手引导（TANG-TUT-001 模块一）：家传手札引导状态 ----
  /** 引导已读标记（guideId → true；默认全 false；21 个 id 见 tang-tutorial-ids） */
  tutorialFlags?: Record<string, boolean>;
  /** 当前待展示引导（guideId；null=无；UI 消费后 markTutorialRead 关闭） */
  currentTutorial?: string | null;
}

/** 掌柜 Store（zustand）行为接口 */
/** 消息/代办条目（NPC 找玩家的待办事项；2026-08-05 体验优化） */
export interface GameMessage {
  id: string;
  /** 来源（阿昭/苏大娘/谢七/债主/沈听澜/账房等） */
  from: string;
  type: 'errand' | 'reminder' | 'info';
  content: string;
  /** 是否有可执行动作（点击跳转/采纳） */
  actionable?: boolean;
  createdDay: number;
}
export interface TangManagerStore extends TangGameState {
  setPhase: (phase: GamePhase) => void;
  /** 切换双视图（operations 日常经营 / dashboard 经营看板） */
  setViewMode: (mode: TangViewMode) => void;
  setPlayerIdentity: (identity: PlayerIdentity) => void;
  setShopType: (shopType: ShopType) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  /** 以难度参数初始化全部数值并进入 playing 阶段（唯一事实源 DIFFICULTY_PARAMS） */
  initByDifficulty: (difficulty: Difficulty) => void;
  /** 现银增减（silver + gold 兼容字段同步） */
  updateSilver: (amount: number) => void;
  /** 飞钱增减 */
  updateFeiqian: (amount: number) => void;
  /** 信用增减（含 creditHistory 记录；5b 模块三） */
  updateCredit: (amount: number, reason: string) => void;
  /** 货币兑换（现银↔飞钱；5% 手续费；不足返回错误结果） */
  exchangeCurrency: (type: 'silver_to_feiqian' | 'feiqian_to_silver', amount: number) => ExchangeResult | null;
  /** 跨店调拨（飞钱秒到账 3% 费；现银 1-3 天 + 10% 被劫；shopCount<2 拦截） */
  interShopTransfer: (amount: number, useFeiqian: boolean) => TransferResult | null;
  /** 钱庄存款（月息 0.5%，钱庄优惠翻倍） */
  depositToBank: (amount: number) => DepositResult | null;
  /** 钱庄取款（本金 + 已计利息；未满 30 天不计息） */
  withdrawFromBank: (depositId: string) => WithdrawResult | null;
  /** 抵押借贷（月息 2%；抵押物 shop/deed/goods） */
  takeMortgageLoan: (amount: number, collateral: 'shop' | 'deed' | 'goods') => LoanApplyResult | null;
  /** 高利贷（需谢七登场 xieQiFavor>0；月息 10%） */
  takeUsuryLoan: (amount: number) => LoanApplyResult | null;
  /** 还款（本金 + 当月利息；抵押/高利贷通用） */
  repayLoan: (loanId: string) => LoanRepayResult | null;
  /** 投资（guild 商会基金 / shen 沈听澜 / underground 地下钱庄） */
  invest: (type: 'guild' | 'shen' | 'underground', amount: number) => InvestApplyResult | null;
  /** 每日打烊检查投资到期并结算（返回结算结果列表） */
  checkInvestments: () => InvestmentSettlementResult[];
  /** 关闭投资到期弹窗（清空 lastInvestmentResults） */
  dismissInvestmentResults: () => void;
  /** 更新货架商品字段（Step 5b-1.5 扩展：stock 归零时自动维护 status=out_of_stock） */
  updateShopItem: (itemId: string, changes: Partial<ShopItem>) => void;
  /** 加入货架商品（Step 5b-1.5：同名商品合并加库存，否则新增；加工/组合产出入口） */
  addShopItem: (item: ShopItem) => void;
  /** 下架货架商品（按 id 移除；库存耗尽或主动下架） */
  removeShopItem: (itemId: string) => void;
  /** 库房扩建（1→5 级：每级 +50 容量、费 等级×200 两、耗时 等级×3 天；期间容量不增） */
  expandWarehouse: () => { ok: boolean; reason?: string; completionDay?: number } | null;
  /** 订立籴粜契（预付三成定金、预购价=市价×0.7、deliveryDay 在 day+5~10、不可取消退定金） */
  createForwardContract: (
    itemId: string,
    quantity: number,
    deliveryDay: number
  ) => { ok: boolean; reason?: string; contract?: ForwardContract } | null;
  /** 采买市易务挂牌（扣现银、入库、扣 remainingToday；次品风险按难度） */
  purchaseListing: (
    listingId: string,
    quantity: number
  ) => { ok: boolean; reason?: string; actualGoodQuantity?: number; cost?: number; loss?: number } | null;
  /** 开始加工（庖制/染织/炮制：扣原料与加工费、虚耗品耗银两、入加工队列） */
  startProcessing: (
    recipeId: string
  ) => { ok: boolean; reason?: string; job?: ProcessingJob } | null;
  /** 备料组合（食盒/锦匣/药囊：原料足才可，消耗原料生成组合商品） */
  createAssemble: (
    assembleId: string
  ) => { ok: boolean; reason?: string; item?: ShopItem } | null;
  /** 调价（货架商品售价调整；下限 0.1 两） */
  adjustPrice: (itemId: string, newPrice: number) => void;
  /** 清除库存旁白（shelf-panel 展示后调用） */
  dismissInventoryNarratives: () => void;
  /** 声望增减（0-1000 夹取） */
  updateReputation: (amount: number) => void;
  /** 评分增减（1.0-5.0 夹取） */
  updateScore: (amount: number) => void;
  /** 小二好感增减（0-100 夹取） */
  updateXiaoerFavor: (amount: number) => void;
  /** 小二满意度增减（0-100 夹取） */
  updateXiaoerSatisfaction: (amount: number) => void;
  /** 精力增减（0-100 夹取） */
  updateEnergy: (amount: number) => void;
  advanceDay: () => void;
  resetGame: () => void;
  /** 进入下一天：day+1、生成新客、重置接待指针/每日精力/精力回满/清空今日结算 */
  startNewDay: () => void;
  /** 接待当前客人（未处理才处理）；返回本单结果供 UI 展示，无法处理返回 null。
   *  rng 可选：测试注入固定随机序列（TANG-TRF-002：避免 20% 预购分支在真实 Math.random 下 flaky）；缺省 Math.random。 */
  handleCurrentGuest: (method: HandleMethod, rng?: () => number) => HandleGuestResult | null;
  /** 追加对话消息（dialogueHistory；模块六） */
  appendDialogue: (role: "guest" | "player" | "system" | "staff", content: string) => void;
  /** 清空当前对话历史（换客/打烊时） */
  clearDialogue: () => void;
  /** 记录客人心情 */
  setGuestMood: (guestId: string, mood: GuestMood) => void;
  /** 对话式接待完成：应用店型流程结果（模块一/二；经 buildReceptionPatch 落账） */
  completeDialogueReception: (result: ShopReceptionResult, rng?: () => number) => void;
  /** 弹出故事弹窗（模块四） */
  showStoryNarrative: (narrative: StoryNarrative) => void;
  /** 关闭故事弹窗 */
  dismissStoryNarrative: () => void;
  /** 展示客人到店描述（AI 叙事或模板） */
  showGuestArrival: (guestId: string, content: string, source: 'ai' | 'template') => void;
  /** 关闭到店描述弹窗 */
  dismissGuestArrival: () => void;
  /** 生成当前阶段店员提醒（店员互动提升 模块五） */
  generateReminders: (phase: string, context: ReminderContext) => void;
  /** 采纳/忽略提醒（采纳→效果+满意度+2；忽略×3→满意度-5） */
  applyReminder: (reminderId: string, accepted: boolean) => void;
  /** 关闭单条提醒 */
  dismissReminder: (reminderId: string) => void;
  /** 清空全部提醒 */
  clearReminders: () => void;
  /** 关闭清晨问候横幅 */
  setDailyStaffGreeting: (g: { staffId: string; staffName: string; content: string } | null) => void;
  /** 关闭打烊报告横幅 */
  setDailyStaffReport: (r: { staffId: string; staffName: string; content: string; band: 'positive' | 'neutral' | 'negative' } | null) => void;
  // ---- 店铺特色产业系统 actions（产业系统 模块五） ----
  /** 酒楼：开始新菜研发（指派厨师可提高成功率） */
  tavernStartResearch: (category: DishCategory, chefId?: string) => { ok: boolean; reason?: string; job?: TavernResearchJob };
  /** 酒楼：结算一条研发（到期待调用；大成功/成功/失败） */
  tavernSettleResearch: (jobId: string) => void;
  /** 酒楼：设为/取消招牌菜（上限内） */
  tavernSetSignature: (dishId: string) => void;
  /** 酒楼：接宴席订单 */
  tavernAcceptBanquet: (type?: BanquetType) => void;
  /** 酒楼：筹备宴席（选菜+酒水+布置） */
  tavernPrepareBanquet: (banquetId: string, dishIds: string[], wineAmount: number, decor: Banquet['decor']) => void;
  /** 酒楼：举办宴席结算 */
  tavernHoldBanquet: (banquetId: string) => void;
  /** 布庄：寻访并聘请织工（上限内） */
  clothierHireWeaver: () => { ok: boolean; reason?: string; weaver?: Weaver };
  /** 布庄：售出织工寄卖商品（分账） */
  clothierSellConsignment: (weaverId: string, goodsId: string) => void;
  /** 布庄：接定制订单 */
  clothierAcceptCustomOrder: (type?: CustomOrderType, guestName?: string, fabric?: string, style?: string) => void;
  /** 布庄：交货判定（match 0-1） */
  clothierDeliverCustomOrder: (orderId: string, match: number) => void;
  /** 药铺：寻访并聘请坐堂郎中（上限内） */
  herbalistHirePhysician: () => { ok: boolean; reason?: string; physician?: Physician };
  /** 药铺：郎中坐堂一日（自动问诊 + 开方） */
  herbalistPhysicianDaily: () => void;
  /** 药铺：开始药方研发 */
  herbalistStartResearch: (category: HerbRecipeCategory, symptom: string) => { ok: boolean; reason?: string; job?: HerbResearchJob };
  /** 药铺：结算一条药方研发 */
  herbalistSettleResearch: (jobId: string) => void;
  /** 药铺：设为独家秘方（品质 ≥4） */
  herbalistSetPatent: (recipeId: string) => void;
  /** 产业每日结算（清晨调用：研发到期/宴席举办/郎中问诊/织工补货） */
  industryTick: (day: number) => void;
  /** 产业升级（按条件） */
  industryUpgrade: (kind: 'tavern' | 'clothier' | 'herbalist') => void;
  /** 产业总览（me 面板经营之道） */
  industryOverview: () => IndustryOverview | null;
  /** 购置分店（P1-2026-08-05 方案 A：第一家 800 两，逐店递增；shopCount+1、maxEmployees+2） */
  purchaseBranch: () => { ok: boolean; reason?: string };
  /** 处理一道政务（转政闭环：应用效果 + 步进；5 道尽办 → 权倾朝野） */
  resolvePoliticsDecision: (choiceId: string) => void;
  /** 关闭打烊结算弹窗 */
  dismissSettlementPopup: () => void;
  /** 添加消息/代办 */
  addMessage: (msg: GameMessage) => void;
  /** 关闭单条消息 */
  dismissMessage: (messageId: string) => void;
  /** 购置店铺资产（扣银 + 应用效果） */
  purchaseShopAsset: (assetId: string) => { ok: boolean; reason?: string };
  // ---- 地图与事件深化 actions（模块七） ----
  /** 记录事件选择（eventHistory） */
  recordEvent: (eventId: string, choiceId: string, narrative: string) => void;
  /** 按事件选择登记连锁（pendingConsequences） */
  addPendingConsequence: (sourceEventId: string, choiceId: string) => void;
  /** 每日检查到期连锁并触发（startNewDay 调用；弹窗展示） */
  checkPendingConsequences: () => void;
  /** 揭示节点故事（首次必触发/重复 30%/特殊时机） */
  revealNodeStory: (nodeId: string, nodeName: string, season?: string) => NodeStory | null;
  /** 触发区域特色事件（入 pendingEvents；按疲劳度） */
  triggerRegionEvent: (region: MapRegion) => void;
  /** 每日清晨按行为/库存/人际条件接入事件（模块四 4.1） */
  checkBehaviorEvents: (day: number) => void;
  /** 每日清晨概率触发区域特色事件（模块三/四） */
  maybeRegionEvent: (day: number) => void;
  /** 切换某内容类型的 AI 开关（模块五 5.6） */
  setAiContentToggle: (type: string, enabled: boolean) => void;
  /** 记录一条 AI 生成日志（模块五 5.6） */
  recordAiLog: (entry: { type: string; ok: boolean; latencyMs: number; source: 'ai' | 'template' }) => void;
  /** 清空 AI 日志 */
  clearAiLog: () => void;
  /** 结算当日（不推天数）：应用全部变更后自动 startNewDay；返回结算结果供 UI 展示 */
  settleDay: () => DaySettlement | null;
  /** 追加账本条目（上限 50） */
  addLedgerEntry: (entry: LedgerEntry) => void;
  /** 解锁成就（防重复） */
  unlockAchievement: (id: string) => void;
  /** 触发事件（3.1）：写入 eventLog 并入队 pendingEvents（防重复） */
  triggerEvent: (eventId: string) => void;
  /** 处理事件选项（3.1）：执行 effect + special 处理 + 出队 pendingEvents */
  resolveEventChoice: (eventId: string, choiceId: string) => void;
  /** 事件去重登记（3.1） */
  addToEventLog: (eventId: string) => void;
  /** 小二离开状态（3.1/3.6） */
  setXiaoerGone: (value: boolean) => void;
  /** 沈听澜好感增减（3.1） */
  updateShenFavor: (amount: number) => void;
  /** 谢七好感增减（3.1） */
  updateXieQiFavor: (amount: number) => void;
  /** 福星高照（3.3）：消耗 1 次 luckRemaining 并返回结果卡数据；次数不足返回 null */
  playLuckyStar: () => LuckResult | null;
  /** 处理待处理投诉（3.4）；无待处理投诉返回 null */
  resolveComplaint: (choice: ComplaintChoice) => ComplaintResult | null;
  /** 强制清除待处理投诉（UI 防御） */
  dismissComplaint: () => void;
  /** 统一还款（5b 模块六）：legacy 还旧债 / bank 按 loanId 还抵押 / usury 优先还高利贷；现银不足不可部分还款 */
  repayDebt: (amount: number, target?: 'legacy' | 'bank' | 'usury', loanId?: string) => UnifiedRepayResult | null;
  /** 破产流程（3.6）：gold≤0 触发；应用破产重置并进入 bankrupt 阶段 */
  enterBankruptcy: () => void;
  /** 破产每日小买卖（3.6）：+1-3 两、day+1（15% 概率 -1 两占位） */
  bankruptcyDailyHustle: () => void;
  /** 破产坚持满 10 天重启（3.6）：score=1.0、gold=难度初始、重载 INITIAL_GOODS、回 playing */
  restartAfterBankruptcy: () => void;
  /** 手札叙事（AI）开关（4.4） */
  setAiNarrationEnabled: (value: boolean) => void;
  /** 手札叙事模型（4.4） */
  setAiModel: (model: string) => void;
  /** 雇佣候选人（5a 2.4）：次日到岗（hireDay=day+1）、满意度 60；满员返回 false */
  hireEmployee: (candidate: EmployeeCandidate) => boolean;
  /** 解雇员工（5a 2.4）：满意度归零离店，其他员工满意度 -2；不存在返回 false */
  fireEmployee: (id: string) => boolean;
  /** 涨薪（5a 2.4）：满意度 +5~10、月钱 +1~3 */
  raiseSalary: (id: string) => boolean;
  /** 给阿昭加月钱（K6：满意 +10、好感 +5、花 5 两） */
  azhaoRaiseSalary: () => boolean;
  /** 安排休假（5a 2.4）：满意度 +3、当日不工作（不贡献技能/满意度/不过劳） */
  arrangeRestDay: (id: string) => boolean;
  /** 揭露员工背景（5a 2.4/2.5）：backgroundRevealed=true，应用 hiddenFlaw 负面效果（占位） */
  revealEmployeeBackground: (id: string) => boolean;
  /** 表扬（5a 5 UI 配套）：满意度 +5 */
  praiseEmployee: (id: string) => boolean;
  /** 训诫（5a 5 UI 配套）：满意度 -8 */
  reprimandEmployee: (id: string) => boolean;
  // ---- 内容深化 TANG-CONT-C 模块二：午后自由行动统一入口 ----
  /** 执行午后自由行动（统一入口；四行动真实逻辑 + 市场招聘兼容；不可执行返回 null） */
  performAfternoonAction: (actionId: string, opts?: { npcId?: string }, rng?: () => number) => ActionResult | null;
  /** 处置午后巡查隐患（fix/delay/admonish/ignore/lock/guard；不存在返回 null） */
  resolvePatrolHazard: (hazardId: string, choice: string) => PatrolChoiceResult | null;
  /** 购入市井闲逛捡漏商品（限当日七折；扣现银入货架；已购/过期返回 false） */
  buyStrollBargain: () => boolean;
  // ---- Step 5b-2 商业地图系统（TANG-S5B2-001）----
  /** 解锁地图层（校验 MAP_LAYER_UNLOCK_RULES；成功置 unlockedLayers，返回是否成功） */
  unlockMapLayer: (layer: MapLayer) => boolean;
  /** 记录点位访问（防重复；visitedNodes 去重） */
  visitNode: (nodeId: string) => void;
  /** 每日清晨生成 1-2 个地图事件（复用 generateMapEvents；返回新增事件） */
  generateDailyMapEvents: () => MapEvent[];
  /** 处理地图事件（respond 应用效果并置 resolved；ignore 保持 active） */
  handleMapEvent: (eventId: string, action: 'respond' | 'ignore') => { ok: boolean; reason?: string } | null;
  /** 执行跑商（扣现银与运费、入在途队列；返回结算预估） */
  executeTradeRun: (buyNodeId: string, sellNodeId: string, itemCategory: string, quantity: number) => TradeRunResult | null;
  /** 解锁绿色通道（东市线沈听澜≥60 / 西市线谢七≥50 / 官道声望≥500） */
  unlockGreenChannel: (routeId: string) => UnlockGreenChannelResult | null;
  /** 每日清晨结算到达货物（售得入账；被劫损失） */
  checkTransportArrivals: () => TransportArrivalResult[];
  // ---- 接待深度升级（TANG-RCP-001）----
  /** 揭示某位客人偏好（默认揭示第一条未揭示偏好；返回揭示结果与更新后的 guest） */
  revealGuestPreference: (guestId: string) => RevealPreferenceResult | null;
  /** 推荐库房商品（命中偏好 消费×1.5+满意+15 / 未命中 ×0.7-10「被宰」；精力-5；本单即接待完成） */
  recommendItem: (guestId: string, itemId: string) => RecommendResult | null;
  /** 闲聊（情报线索/NPC传言/进货渠道/偏好揭示/纯聊天；精力-5；本单即接待完成） */
  chatWithGuest: (guestId: string) => ChatResult | null;
  /** 赠礼（消耗库房商品；好感+20 递减；下次消费×1.5；精力-3；本单即接待完成） */
  giveGift: (guestId: string, itemId: string) => GiftResult | null;
  /** 拼桌并单（同类型+耐心>50；一次接待两人、每人消费 8 折、精力×1.5；双命中偏好 +10 气氛） */
  mergeGuests: (guestAId: string, guestBId: string) => MergeResult | null;
  /** 婉拒四法（redirect 引荐 / excuse 托辞 / delegate 转交阿昭 / refuse 原逻辑拒绝；本单即接待完成） */
  rejectPolitely: (guestId: string, method: PoliteRejectMethod) => PoliteRejectResult | null;
  /** 气氛增减（clamp 0-100；UI「解决投诉」等调用） */
  updateAtmosphere: (amount: number) => void;
  /** 追加宾客留言簿条目（防重复：同客同日同类型只记一条） */
  addGuestBookEntry: (entry: GuestBookEntry) => void;
  // ---- 团队与社交深度（TANG-SOC-001）：排班 / 交情 / 学艺 / 名声门路 ----
  /** 排班（轮值）：assignShift 纯函数 + 应用；冲突（学艺中）拒绝；返回更新后的员工或 null */
  assignShift: (employeeId: string, shift: EmployeeShift) => Employee | null;
  /** 自动排班（suggestOptimalSchedule 结果应用到 employees） */
  autoSchedule: () => Employee[];
  /** 送伙计学艺（sendForTraining；扣束脩、置 trainingCompletionDay；学艺中不可排班） */
  sendForTraining: (employeeId: string, skillId: string) => TrainingResult | null;
  /** 拜师（findMaster：需地图区域解锁、费 200+、周期 2-4 天、成功率 95%、10% 隐藏绝技） */
  findMaster: (skillType: EmployeeSkillType) => MasterResult | null;
  /** 每日清晨结算学艺到期（checkTrainingCompletion；学成/失败列表） */
  checkTrainingCompletion: () => TrainingCompletionResult[];
  /** 每日打烊演化内部交情（evolveRelations；和睦/竞争/矛盾增减） */
  evolveRelations: () => RelationshipEvent[];
  /** 确立师徒关系（establishMentorship；mentor 技能≥3、apprentice≤2） */
  establishMentorship: (mentorId: string, apprenticeId: string) => boolean;
  /** 更新势力关系（updateFactionRelationship；clamp 0-100、记录原因、跨阈值提示解锁） */
  updateFactionRelationship: (factionId: string, delta: number, reason: string) => FactionUpdateResult | null;
  /** 获取势力已解锁特权（getFactionPerks） */
  getFactionPerks: (factionId: string) => FactionPerk[];
  /** 打开/关闭名声关系网 overlay（门路第 9 项） */
  setFactionPanelOpen: (open: boolean) => void;
  // ---- Step 5b-5：叙事与后期系统（手札录 / 蛛丝马迹 / 巍明楼 / 镖队 / 多结局）----
  /** 追加手札条目（recordEvent/recordNPCDialogue/recordMilestone/recordChoice 纯函数生成后写入） */
  addJournalEntry: (entry: JournalEntry) => void;
  /** 追加线索（generateClue 纯函数生成后写入；防重复按 id） */
  addClue: (clue: Clue) => void;
  /** 手动连接两条线索（互写 connected；防重复） */
  connectClues: (clueIdA: string, clueIdB: string) => void;
  /** 解析线索（置 resolved=true） */
  resolveClue: (clueId: string) => void;
  /** 每月初生成 1 条政令（generateImperialDecree；返回新政令或 null） */
  generateDecree: () => Decree | null;
  /** 支持派系（alignWithFaction；+20 对立 -10 + 三子派特殊效果） */
  alignWithFaction: (factionId: string) => AlignResult | null;
  /** 组建镖队（createCaravan + setupCaravanRoute；返回是否成功） */
  setupCaravan: (input: { name: string; leader: string; members: string[]; guards: number; from: string; to: string }) => boolean;
  /** 设定镖队路线（返回是否成功） */
  setupCaravanRoute: (caravanId: string, from: string, to: string) => boolean;
  /** 装货发车（loadCaravan；库房减、镖队增、置 in_transit） */
  loadCaravan: (caravanId: string, goods: CaravanGoods[]) => boolean;
  /** 每日打烊检测结局（checkEndingConditions；命中则 triggerEnding） */
  checkEndingConditions: () => string | null;
  /** 触发结局（设置 endingTriggered；forceEnd 结局暂停、可继续结局弹窗） */
  triggerEnding: (endingId: string) => void;
  /** 继续经营（可继续结局关闭弹窗，清空 endingTriggered） */
  continueEnding: () => void;
  /** 打开/关闭手札录 overlay（第 10 项） */
  setJournalPanelOpen: (open: boolean) => void;
  /** 打开/关闭巍明楼 overlay（第 12 项；条件解锁） */
  setPoliticsPanelOpen: (open: boolean) => void;
  /** 打开/关闭镖队 overlay（第 11 项；条件解锁） */
  setCaravanPanelOpen: (open: boolean) => void;
  /** 每日推进在途镖队（checkCaravanDaily；startNewDay 内部调用，对外暴露便于测试） */
  checkCaravanDaily: () => void;
  /** 季度派系斗争（factionPowerStruggle；胜出特权翻倍 / 失利 -20） */
  runFactionPowerStruggle: () => void;
  /** 接受官职（转政：phase='politics' + politicalLine=true + 记录抉择） */
  acceptImperialOffice: () => void;
  /** 婉拒官职（仅记录抉择） */
  declineImperialOffice: () => void;
  // ---- 成瘾性玩法模块（TANG-ADD-001）：五大钩子 actions ----
  /** 清晨抽取今日卦象（手札占候；写入 todayHexagram） */
  drawDailyHexagram: () => Hexagram;
  /** 关闭手札占候翻开卡（hexagramCardOpen=false） */
  dismissHexagramCard: () => void;
  /** 清晨生成今日要务（排除昨日已完成；写入 todayTasks） */
  generateDailyTasks: () => DailyTask[];
  /** 清晨生成市井消息（2026-08-06 新增系统） */
  generateStreetNews: () => string[];
  /** 创建 AI 对话上下文（规格书 5.4） */
  createDialogueContext: (guestId: string, guestInfo: DialogueContext['guestInfo']) => void;
  /** 更新情绪（规格书 5.4） */
  updateDialogueEmotion: (guestId: string, delta: number) => void;
  /** 清空对话上下文（规格书 5.4） */
  clearDialogueContext: (guestId: string) => void;
  /** 购买医书（规格书 5.4/2.2） */
  purchaseMedicalBook: (bookId: string) => { ok: boolean; reason?: string };
  /** 亲自坐诊（规格书 2.1：消耗 10 精力） */
  performDiagnosis: (guestId: string) => { ok: boolean; reason?: string };
  /** 宴席菜单结算（规格书 3.3：按评分档位入账/声望） */
  settleBanquetMenu: (input: { banquetType: string; budget: number; score: number }) => { silverDelta: number; reputationDelta: number };
  /** 面料定制结算（规格书 4.3：按匹配档位入账/声望） */
  settleFabricOrder: (input: { match: number; tier: 'satisfied' | 'normal' | 'refund' }) => { silverDelta: number; reputationDelta: number };
  /** 追加对话历史（上下文管理） */
  appendDialogueHistory: (guestId: string, entry: { role: 'guest' | 'player'; content: string }) => void;
  /** 打烊判定今日要务完成并发放奖励（盖「了」红印；返回新完成 id） */
  checkDailyTasks: () => string[];
  /** 清晨检测遗命触发（条件+前置完成；写入 activeLegacyQuest） */
  triggerLegacyQuest: () => LegacyQuest | null;
  /** 打烊检测遗命完成（达成→手札翻开 narrative+奖励+解锁下一个） */
  checkLegacyQuestCompletion: () => LegacyQuest | null;
  /** 打烊检测稀有事件（checkRareEvents；返回触发列表） */
  checkRareEvents: () => RareEvent[];
  /** 清晨检测谢七赌约（谢七登场+30% 概率；写入 activeBet） */
  checkBetOffer: () => TangBet | null;
  /** 玩家接下当前赌约（betAccepted=true） */
  acceptBet: () => void;
  /** 玩家拒绝当前赌约（清空 activeBet） */
  declineBet: () => void;
  /** 打烊结算赌约（赢：好感+10+双倍赌注；输：拿走+bonusOnLose；未接无影响） */
  resolveBet: () => { bet: TangBet; outcome: 'win' | 'lose' | 'declined'; silverDelta: number; favorDelta: number; message: string } | null;
  /** 每月初一清晨挂出暗标（写入 currentBlindAuction） */
  checkBlindAuction: () => BlindAuction | null;
  /** 玩家对暗标出价（≥起拍；扣款；50% 概率中标，起价越高越高中标封顶 90%） */
  placeBid: (amount: number) => { ok: boolean; reason?: string; won?: boolean } | null;
  /** 开标展示（市易务差人送箱/恭喜/遗憾；按概率抽奖结算） */
  resolveAuction: () => { auction: BlindAuction; won: boolean; outcome: BlindAuctionOutcome | null; silverDelta: number; message: string } | null;
  /** 清晨检测伙计小传解锁（checkBiographyUnlock；返回本次解锁条目） */
  checkBiographies: () => BiographyEntry[];
  /** 打烊评定商阶（evaluateRank；晋升→手札贺词+rank 更新） */
  evaluateRank: () => MerchantRank | null;
  /** 应用局外成长传承（applyAncestralBlessing；独立 localStorage 存储） */
  applyAncestralBlessing: (blessingId: string) => { ok: boolean; reason?: string } | null;
  /** 生成月度总结（每月初一打烊；AI 或模板；写入 monthlyReviews） */
  generateMonthlyReview: () => MonthlyReview | null;
  // ---- TANG-TRF-001：动态客流 + 大单预购 + 周级要务 actions ----
  /** 设定今日接待策略（亲力亲为/择要接待/全托伙计；当日生效） */
  setReceptionStrategy: (strategy: ReceptionStrategy) => void;
  /** 设定经营策略（内容深化 TANG-CONT-B：薄利多销/奇货可居/稳健经营；当日生效） */
  setBusinessStrategy: (strategy: BusinessStrategy) => void;
  /** 变卖一家分店（内容深化 TANG-CONT-B：估值入现银、店铺数-1、超员员工离职；祖传老店不可变卖） */
  sellShop: () => { ok: boolean; reason?: string; valuation?: number; laidOffNames?: string[] };
  /** 接下预购订单（pending → accepted；定金入账） */
  acceptPreOrder: (orderId: string) => { ok: boolean; reason?: string; order?: PreOrder } | null;
  /** 为预购订单预留库房货品（标记 reserved；货齐置 ready） */
  reserveGoods: (orderId: string) => { ok: boolean; reason?: string; order?: PreOrder } | null;
  /** 交货（reserved≥required 才可；移库、尾款入账、声望/关系奖励、新客入回头客池） */
  deliverOrder: (orderId: string) => { ok: boolean; reason?: string; order?: PreOrder } | null;
  /** 每日清晨检查逾期预购（违约惩罚分级 + 解除预留 + 记账） */
  checkOverdueOrders: () => PreOrder[];
  /** 周级要务进度累加（接待/预购/结算/通晓人心接线） */
  updateWeeklyTaskProgress: (key: string, delta: number) => void;
  /** 周日打烊结算本周要务并发放奖励（周一 startNewDay 刷新） */
  settleWeeklyTasks: () => string[];
  // ---- v1.0 功能解锁（TANG-POLISH-001 模块二）----
  /** 每日解锁检查：返回本次新解锁 featureId（清晨/打烊各调一次；已解锁不重复） */
  checkFeatureUnlock: () => string[];
  // ---- 内容深化 TANG-CONT-D 模块四：西市赌坊 ----
  /** 打开赌坊弹窗（刷新预估赔率；需赌坊节点已解锁） */
  openGamblingPanel: () => void;
  /** 关闭赌坊弹窗 */
  closeGamblingPanel: () => void;
  /** 赌坊下注（1-100 两；useLuckyStar 胜率 45%→65% 但被老板盯上概率翻倍；结果进 eventLog） */
  placeGamblingBet: (amount: number, useLuckyStar: boolean, rng?: () => number) => import('@/systems/tang-gambling').GamblingResult | null;
  // ---- 内容深化 TANG-CONT-D 模块七：负反馈系统 ----
  /** 每日打烊检查负反馈（树大招风/集体涨薪/灾害/背叛/意外损失；入队 pendingNegativeEvents + eventLog） */
  checkNegativeFeedback: (rng?: () => number) => NegativeEvent[];
  /** 处理负反馈事件选项（应用纯函数结果并出队） */
  resolveNegativeEvent: (eventId: string, optionId: string, rng?: () => number) => import('@/systems/tang-negative-feedback').NegativeChoiceResult | null;
  /** 强制清除某负反馈事件（UI 防御） */
  dismissNegativeEvent: (eventId: string) => void;
  // ---- 内容深化 TANG-CONT-D 模块八：负债拓展 ----
  /** 接受循环借贷 offer（新贷款入账；额度×1.5、利率+1%） */
  acceptRevolvingLoan: () => { ok: boolean; reason?: string; loan?: BankLoan } | null;
  /** 拒绝循环借贷 offer（不影响钱庄关系） */
  declineRevolvingLoan: () => void;
  /** 赊账进货（信用≥300、上限=信用×2、30 天无息；扣信用锁定；不入现银） */
  takeTradeCreditPurchase: (amount: number) => { ok: boolean; reason?: string; tradeCredit?: number; creditDueDay?: number } | null;
  /** 处理沈听澜人情债（让出一笔生意/中断谢七合作/站队；拒绝 沈-30+声望-50） */
  resolveShenDebtMoment: (choiceId: 'concede' | 'break_xie' | 'align' | 'refuse') => { ok: boolean; message: string } | null;
  /** 处理被栽赃事件（A 找证据 / B 花钱摆平 / C 死不认账） */
  resolveFramedMoment: (choiceId: 'evidence' | 'payoff' | 'deny', rng?: () => number) => { ok: boolean; message: string } | null;
  /** 每日打烊检查被栽赃（评分≥3.0 约 3%/日；触发置 framedOpen=true） */
  checkFramedMoment: (rng?: () => number) => void;
  /** 每日打烊检查沈听澜人情债时机（shenDebt=true 概率触发；置 shenDebtMomentOpen=true） */
  checkShenDebtMoment: (rng?: () => number) => void;
  // ---- 迷雾系统（TANG-MIST-001 模块一）actions ----
  /** 每日打烊批量揭示（势力 leader/relations/perks/hiddenAgenda + NPC background/heart/trueAttitude）；
   *  按好感度/线索数判定；返回本次新揭示列表（UI 浮层/手札用） */
  checkFogReveals: () => FogRevealResult[];
  /** 区域揭示（午后探访/闲聊情报/快速移动 20% 调用）；不存在或已揭示返回 ok=false */
  revealRegion: (nodeId: string) => { ok: boolean; nodeName?: string; hint?: string } | null;
  /** 势力单点揭示（任务/情报强制揭示；幂等） */
  revealFactionInfo: (factionId: string, infoType: 'leader' | 'relations' | 'perks' | 'hiddenAgenda') => void;
  /** NPC 单点揭示（专属事件后完整故事；幂等） */
  revealNPCInfo: (npcId: string, infoType: 'background' | 'heart' | 'trueAttitude' | 'fullStory') => void;
  /** 午后「探访未知区域」（消耗 10 精力 + 1 次行动；揭示 1-2 个未探明 L2/L3 点位；rng 可注入） */
  exploreUnknownRegion: (rng?: () => number) => { ok: boolean; reason?: string; revealedIds?: string[]; narrative?: string } | null;
  // ---- 长安故人 · 六位新 NPC（TANG-MIST-002 模块三）actions ----
  /** 每日打烊检查六位 NPC 登场条件（声望/评分/地图解锁/负债/阿昭好感等）；返回本次新登场 id */
  checkNPCUnlocks: () => string[];
  /** 好感增减（clamp 0-100；跨阈值触发专属功能解锁 + 迷雾揭示） */
  updateNPCFavor: (npcId: string, amount: number) => void;
  /** 拜访 NPC（长安故人六位；3 天冷却 + 1 次午后行动 + 15 精力；好感 +3~8、20% 额外情报；
   *  陆伯交谈计数 / 上官政令预知 / 萨迪商路玉佩在此接线；rng 可注入） */
  visitNpc: (npcId: string, rng?: () => number) => ActionResult | null;
  /** 苏大娘买情报（3 天冷却；5 两 + 5 精力；得 1-3 条情报） */
  buyInformation: (npcId: string, rng?: () => number) => { ok: boolean; reason?: string; narrative?: string; intelCount?: number } | null;
  /** 阿萤赎身（阿昭好感 ≥80 明确后；支付 100 两 → 登场帮店） */
  redeemAying: () => { ok: boolean; reason?: string; narrative?: string } | null;
  /** 婉拒阿萤赎身（阿昭好感归零 + 离职 + 带走一半熟客） */
  refuseAying: () => { ok: boolean; reason?: string; narrative?: string } | null;
  /** 苏大娘每月主动送情报（好感 ≥60；月终打烊概率触发；打烊钩子） */
  maybeFreeIntelFromSuDaniang: (rng?: () => number) => string | null;
  /** 地图定位请求（NPC 详情「在地图上查看」→ 长安舆图自动聚焦；null 清空） */
  setMapLocateNode: (nodeId: string | null) => void;
  // ---- TANG-MIST-003 M3：地图功能增强 actions（节点繁荣度 / 标记 / 快速移动 / 路线规划）----
  /** 记录今日玩家在节点有交易（采买/卖出/镖队到达；次日清晨繁荣度结算消费后重置） */
  noteNodeTrade: (nodeId: string) => void;
  /** 每日清晨节点繁荣度结算（幂等——消费今日交易清单） */
  updateNodeProsperityDaily: () => void;
  /** 放置自定义标记（已探访节点；最多 5 个；默认名=节点名，可输入） */
  placeMarker: (nodeId: string, label?: string) => { ok: boolean; reason?: string };
  /** 撤去自定义标记 */
  removeMarker: (markerId: string) => void;
  /** 快速移动（10 精力瞬间到达；路径经过未探访节点 20% 自动揭示；rng 可注入） */
  quickTravelTo: (nodeId: string, rng?: () => number) => { ok: boolean; reason?: string; revealedNodeIds?: string[]; interaction?: string } | null;
  /** 路线规划（最短=天数最少 / 最安全=风险最低优先绿通）；写入 mapRoutePlan */
  setRoutePlan: (from: string, to: string, mode: 'shortest' | 'safest') => { ok: boolean; reason?: string; plan?: MapRoutePlan };
  /** 清除路线规划 */
  clearRoutePlan: () => void;
  /** 预填镖队路线并跳转镖队面板（复用 setupCaravanRoute；routeIdHint 为多跳规划的首段商路） */
  prefillCaravanRoute: (from: string, to: string, routeIdHint?: string) => void;
  /** 消费镖队预填（caravan-panel 挂载后调用；幂等） */
  consumeMapCaravanPrefill: () => void;
  /** 面板跳转请求（page.tsx 消费后清空；reception 回经营视图，其余进看板） */
  requestNavPanel: (key: string | null) => void;
  /** 消费标记节点新动态提示（map-panel 挂载后展示并清空） */
  consumeMapMarkerNotices: () => void;
  // ---- 新手引导（TANG-TUT-001 模块一）：家传手札引导 actions ----
  /** 标记引导已读（tutorialFlags[id]=true；若为当前引导同时关闭 currentTutorial） */
  markTutorialRead: (guideId: string) => void;
  /** 重置全部引导（tutorialFlags 清空 + currentTutorial=null；调试/重开用） */
  resetAllTutorials: () => void;
  /** 弹出引导（currentTutorial=guideId；已读或未知 id 忽略） */
  showTutorial: (guideId: string) => void;
  /** 关闭当前引导（currentTutorial=null；不标记已读） */
  dismissTutorial: () => void;
}

// ============================================================
// AI 叙事着色（Step 4）— 纯展示，不参与任何数值/规则裁决
// ============================================================

/** 叙事类型：结算 / 事件 / 成就 / 接待 */
export type NarrationType = 'settlement' | 'event' | 'achievement' | 'reception';

/** 结算叙事数据（AI 只读，不可回写） */
export interface NarrationSettlementData {
  /** 净收益（两） */
  netIncome: number;
  /** 当日已处理客人亮点文案（≤3 条） */
  guestHighlights: string[];
  scoreChange: number;
  reputationChange: number;
}

/** 事件叙事数据（AI 只读，不可回写） */
export interface NarrationEventData {
  title: string;
  description: string;
  /** 玩家所选选项 label */
  choiceLabel: string;
  /** 选择后果文案 */
  consequence: string;
}

/** 成就叙事数据（AI 只读，不可回写） */
export interface NarrationAchievementData {
  name: string;
  description: string;
}

/** 接待叙事数据（5a 3.4：AI 只读，不可回写；基于客人身份与故事标签展开，不含数值） */
export interface NarrationReceptionData {
  /** 客人姓名 */
  guestName: string;
  /** 客人类型中文标签（#大单/#特殊/…） */
  guestTypeLabel: string;
  /** 故事标签（无则缺省） */
  storyTag?: string;
  /** 标签场景描写模板（降级模板用） */
  sceneHint?: string;
  /** 主线线索关键词（3.3：沈氏商号/锦衣公子/东市新贵→沈听澜；赌场/混子→谢七；催债/利钱→债主） */
  clue?: string;
}

/**
 * AI 叙事上下文（Step 4 4.1）
 * 铁律：AI 只做叙事着色——全部数值由前端系统算完才喂给 AI；AI 输出仅展示，不解析、不回写游戏状态。
 */
export interface NarrationContext {
  type: NarrationType;
  shopName: string;
  /** 店型中文名（酒楼 / 布庄 / 药铺） */
  shopType: string;
  playerName: string;
  day: number;
  settlement?: NarrationSettlementData;
  event?: NarrationEventData;
  achievement?: NarrationAchievementData;
  reception?: NarrationReceptionData;
}
