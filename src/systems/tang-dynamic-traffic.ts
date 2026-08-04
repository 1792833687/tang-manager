/**
 * 《我在唐朝当掌柜》动态客流系统（TANG-TRF-001 模块一）
 * - calculateDailyGuestCount：客人数随评分/声望浮动（用户 1.1 逐字：基础 2 + floor(score×1.5)
 *   + floor(reputation/150) + randomInt(-1,2)；最低 2 上限 20）
 * - calculateGuestTypeWeights：评分四档类型权重表（用户 1.1 逐字：
 *   <2.0: 65/10/10/10/5；2.0-3.5: 50/15/15/10/10；3.5-4.5: 35/20/20/10/15；≥4.5: 25/25/25/10/15
 *   —— normal/big_order/special/help/observe）
 * - generateDailyGuestsWithWeights：替代 generateDailyGuests 的加权生成（保留旧函数兼容）；
 *   回头客 20% 逻辑保留（与 generateDailyGuests 一致）
 * - applyReceptionStrategy：接待策略三档（用户 1.2 逐字：亲力亲为/择要接待/全托伙计）
 * 铁律：纯函数；不直接调用 store。
 */
import { INITIAL_GOODS } from '@/config/tang-initial-goods';
import { generateSingleGuest, distributeTypesByWeights } from '@/systems/tang-guest-generator';
import { revealPreference } from '@/systems/tang-guest-preference';
import type { Difficulty, Guest, GuestType, KnownGuestRecord, ReceptionStrategy, ShopItem, ShopType } from '@/types/tang-manager';

/** 客流计算输入（只取用到的字段） */
export interface TrafficState {
  score: number;
  reputation: number;
  /** 客人数系数（内容深化 TANG-CONT-B：薄利多销 1.3 / 奇货可居 0.7 / 稳健 1；缺省 1） */
  guestCountFactor?: number;
  /** 额外客人数（内容深化 TANG-CONT-C：离场「带新客来」次日 +N；缺省 0） */
  extraGuestCount?: number;
}

/** 动态客流生成输入 */
export interface TrafficGuestState {
  shopType: ShopType;
  difficulty: Difficulty;
  score: number;
  reputation: number;
  /** 回头客池（20% 概率抽一位熟客） */
  knownGuests?: Record<string, KnownGuestRecord>;
  /** 当日（lastVisit 写入用） */
  day?: number;
  /** 客人数系数（经营策略接线；缺省 1） */
  guestCountFactor?: number;
  /** 熟客光顾概率（成就奖励接线：回头客 +5% → 0.2 + 0.05；缺省 0.2） */
  regularCustomerChance?: number;
  /** 额外客人数（内容深化 TANG-CONT-C：离场「带新客来」次日 +N；缺省 0） */
  extraGuestCount?: number;
}

/** 客人数浮动 randomInt(-1,2)（0..3 偏移 -1 → -1/0/1/2） */
export function randomTrafficDelta(rng: () => number): number {
  return Math.floor(rng() * 4) - 1;
}

/**
 * 客人数公式（用户 1.1 逐字）：
 * 基础 2 + floor(score×1.5) + floor(reputation/150) + randomInt(-1,2)；最低 2 上限 20。
 * 经营策略（内容深化 TANG-CONT-B 模块六·1）：×guestCountFactor 后四舍五入再截断 2-20。
 */
export function calculateDailyGuestCount(state: TrafficState, rng: () => number = Math.random): number {
  const base = 2 + Math.floor(state.score * 1.5) + Math.floor(state.reputation / 150) + randomTrafficDelta(rng);
  const factor = state.guestCountFactor ?? 1;
  const extra = state.extraGuestCount ?? 0;
  const count = Math.round(base * factor) + extra;
  return Math.min(20, Math.max(2, count));
}

/**
 * 评分四档类型权重表（用户 1.1 逐字）。
 * 边界：2.0-3.5 档取 [2.0, 3.5)；3.5-4.5 档取 [3.5, 4.5)；≥4.5 归最高档（工程定边界，注释）。
 */
export function calculateGuestTypeWeights(state: TrafficState): Record<GuestType, number> {
  const score = state.score;
  if (score < 2.0) {
    return { normal: 65, big_order: 10, special: 10, help: 10, observe: 5 };
  }
  if (score < 3.5) {
    return { normal: 50, big_order: 15, special: 15, help: 10, observe: 10 };
  }
  if (score < 4.5) {
    return { normal: 35, big_order: 20, special: 20, help: 10, observe: 15 };
  }
  return { normal: 25, big_order: 25, special: 25, help: 10, observe: 15 };
}

/**
 * 按权重表把 count 位客人摊到各类型（复用 distributeTypesByWeights 取整补齐逻辑）。
 */
export function distributeTrafficTypes(
  weights: Record<GuestType, number>,
  count: number,
  rng: () => number = Math.random
): GuestType[] {
  return distributeTypesByWeights(weights, count, rng);
}

/**
 * 生成今日客人（替代 generateDailyGuests；保留旧函数兼容——startNewDay 切到本函数）。
 * 客人数 = calculateDailyGuestCount；类型 = calculateGuestTypeWeights；
 * 回头客 20% 逻辑与 generateDailyGuests 一致（继承偏好/等级/次数/总消费，第三次来访自动揭示偏好）。
 */
export function generateDailyGuestsWithWeights(
  state: TrafficGuestState,
  rng: () => number = Math.random
): Guest[] {
  const count = calculateDailyGuestCount(state, rng);
  const weights = calculateGuestTypeWeights(state);
  const types = distributeTrafficTypes(weights, count, rng);
  const guests = types.map((type) => generateSingleGuest(state.shopType, state.difficulty, type, rng));
  // 回头客 20% 概率含一位熟客（与 generateDailyGuests 相同逻辑；成就「回头客」→ +5%）
  const regularChance = state.regularCustomerChance ?? 0.2;
  const pool = state.knownGuests ? Object.keys(state.knownGuests) : [];
  if (pool.length > 0 && rng() < regularChance) {
    const name = pool[Math.min(Math.floor(rng() * pool.length), pool.length - 1)]!;
    const rec = state.knownGuests![name]!;
    const slot = Math.min(Math.floor(rng() * guests.length), guests.length - 1);
    const base = generateSingleGuest(state.shopType, state.difficulty, guests[slot]!.type, rng);
    const visitCount = rec.visitCount + 1;
    let preferences = (rec.preferences ?? []).map((p) => ({ ...p }));
    // 第三次来访自动揭示偏好（7.3；regular_visit 100% 揭示一个）
    let revealedAny = preferences.some((p) => p.revealed);
    if (visitCount >= 3 && !revealedAny && preferences.length > 0) {
      const r = revealPreference({ ...base, preferences }, 'regular_visit', rng);
      preferences = r.guest.preferences ?? preferences;
      revealedAny = preferences.some((p) => p.revealed);
    }
    guests[slot] = {
      ...base,
      name,
      visitCount,
      guestLevel: rec.level,
      totalSpent: rec.totalSpent,
      lastVisit: state.day ?? 0,
      preferences,
      preferenceRevealed: revealedAny,
      patience: 100,
      satisfaction: rec.satisfaction ?? 60,
      baseConsumption: Math.max(1, Math.round(base.baseConsumption * (rec.consumptionMultiplier ?? 1) * 10) / 10),
    };
  }
  return guests;
}

/** 接待策略应用结果：personal 掌柜亲接 / delegated 伙计代劳 */
export interface ReceptionStrategyResult {
  mode: 'personal' | 'delegated';
  /** delegated 时的收益（baseConsumption × 0.7~0.8；不走偏好匹配） */
  delegatedIncome?: number;
}

/**
 * 接待策略三档（用户 1.2 逐字）：
 * - all 亲力亲为：一律亲接（当前默认行为）
 * - priority 择要接待：只亲接大单/特殊，其余指派伙计代劳
 * - delegate 全托伙计：一律指派伙计代劳（收益 ×0.7~0.8、无精力消耗、不走偏好匹配）
 */
export function applyReceptionStrategy(
  guest: Guest,
  strategy: ReceptionStrategy,
  rng: () => number = Math.random
): ReceptionStrategyResult {
  if (strategy === 'delegate') {
    return { mode: 'delegated', delegatedIncome: Math.round(guest.baseConsumption * (0.7 + rng() * 0.1) * 100) / 100 };
  }
  if (strategy === 'priority') {
    if (guest.type === 'big_order' || guest.type === 'special') {
      return { mode: 'personal' };
    }
    return { mode: 'delegated', delegatedIncome: Math.round(guest.baseConsumption * (0.7 + rng() * 0.1) * 100) / 100 };
  }
  return { mode: 'personal' };
}

/** 预购商品池候选（供 tang-preorder 复用：优先在库商品，不足兜底店型初始货） */
export function preorderItemPool(shopItems: readonly ShopItem[] | undefined, shopType: ShopType | null | undefined): ShopItem[] {
  const items = shopItems ?? [];
  if (items.length > 0) {
    return items.map((it) => ({ ...it }));
  }
  const fallback = INITIAL_GOODS[shopType ?? 'jiulou'] ?? INITIAL_GOODS.jiulou;
  return fallback.map((it) => ({ ...it }));
}
