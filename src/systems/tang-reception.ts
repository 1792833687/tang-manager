/**
 * 《我在唐朝当掌柜》接待系统（Step 2 需求 2.3；Step 3 3.2 反噬/污染、3.4 投诉标记；
 *  Step 5b-1.5 库存联动：缺货消费减两成 / 品类充足消费上浮 / 连续缺货主顾流失轻量实现）
 * 纯函数：handleGuest 接收 guest/method/必要上下文与可选 rng，返回 HandleGuestResult。
 * 数值规则：
 * - normal：收益 = baseConsumption × (0.8~1.2)；精力-5；20% 声望+1；
 *   投诉：普通客人 10% / 差评师 100% 触发 complaintTriggered——消费减半、评分-0.02
 *   （注：投诉后果在 handleGuest 内直接应用，保证不处理投诉卡时结算口径仍正确；
 *   投诉卡（handleComplaint）只追加「选项级」效果）
 * - mind_read：消耗 1 次通晓人心（由 store 应用次数增减）；精力-10；
 *   从 OS 池（按 guest.type）随机抽一条填 mentalOS；40% 概率收益上浮 10-30%
 *   反噬（3.2）：同一 NPC 身份（guest.name）累计 mind_read 达阈值（B 3/C 2/A 无）时——
 *   本单 OS 固定警示文案、消费砍半、评分-0.05、backlashed=true；
 *   此后同身份 mind_read OS 从 REVERSE_OS_POOL（反讽/假信息）抽取。
 *   污染（3.2）：insightUsedTotal 达阈值（B 30/C 20/A 无）后由 startNewDay 随机标记
 *   1-2 位客人 contaminated=true；其 mind_read OS 从 HALLUCINATION_OS_POOL 抽取且不标注来源。
 * - reject：收益 0；精力 0；30% 评分-0.02；type='help' 额外声望-2
 * - review：normal/mind_read→good，reject→bad
 * - 库存联动（5b-1.5）：stockInfo.missingGood → 消费减两成（×0.8）；
 *   stockInfo.varietyBonus → 消费上浮 5%（×1.05，库房品类>15 种，满意度+10% 以消费上浮体现，注释）；
 *   stockInfo.lostCustomerRisk → 消费再减 15%（连续 3 日缺同商品，主顾流失概率+15% 的轻量近似，注释）
 * 前置条件：mind_read 需 insightRemaining>0；不满足返回 null（store 亦会拦截）。
 */
import { GUEST_OS_POOLS, HALLUCINATION_OS_POOL, REVERSE_OS_POOL } from '@/config/tang-guest-content';
import type { Difficulty, Guest, HandleGuestResult, HandleMethod, ShopItem, ShopType } from '@/types/tang-manager';

/** handleGuest 所需的必要上下文（仅取用到的字段，避免整份 state 耦合） */
export interface ReceptionContext {
  insightRemaining: number;
  /** 难度档位（反噬阈值判定；缺省按 B） */
  difficulty?: Difficulty;
  /** 当前 NPC 身份（guest.name）已累计的通晓人心次数 */
  insightUsedOnNPC?: number;
  /** 「通晓人心」累计使用次数（污染阈值判定；Step 3 预留，污染在 startNewDay 标记） */
  insightUsedTotal?: number;
  /** 库存联动（Step 5b-1.5）：缺货/品类充足/连续缺货 */
  stockInfo?: { missingGood: boolean; varietyBonus: boolean; lostCustomerRisk: boolean };
  /** 反噬阈值覆盖（TANG-ADD-001 先祖之眼传承：翻倍；缺省按难度 BACKLASH_THRESHOLD） */
  backlashThresholdOverride?: number;
}

/** 反噬阈值：同一身份累计 mind_read 达到该次数即触发（A 无反噬） */
export const BACKLASH_THRESHOLD: Record<Difficulty, number> = { A: 0, B: 3, C: 2 };

/** 污染阈值：insightUsedTotal 达到该值后 startNewDay 随机标记污染客人（A 无污染） */
export const POLLUTION_THRESHOLD: Record<Difficulty, number> = { A: Infinity, B: 30, C: 20 };

/** 反噬触发时固定的警示 OS（用户 3.2 原文） */
export const BACKLASH_OS = '（你试图窥探，但对方突然警觉地瞪了你一眼）';

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ============================================================
// Step 5b-1.5：库存联动（缺货 / 品类充足 / 连续缺货）
// ============================================================

/**
 * 客人所需商品（按 storyTag 关键词优先，否则按店型与客人类型映射主销商品）。
 * 映射为工程定值（注释）：缺货判定用——客人想要而货架没有 → 消费减两成。
 */
export function desiredItemForGuest(shopType: ShopType | null | undefined, guest: Guest): string {
  const tag = guest.storyTag ?? '';
  if (tag.includes('酒') || tag.includes('宴')) return shopType === 'buzhuang' ? '锦缎' : shopType === 'yaopu' ? '当归' : '米酒';
  if (tag.includes('衣') || tag.includes('布')) return '丝绸';
  if (tag.includes('药') || tag.includes('病')) return '人参';
  switch (shopType) {
    case 'buzhuang':
      return guest.type === 'big_order' ? '锦缎' : guest.type === 'special' ? '丝绸' : '粗布';
    case 'yaopu':
      return guest.type === 'big_order' ? '人参' : guest.type === 'special' ? '当归' : '黄连';
    case 'jiulou':
    default:
      return guest.type === 'big_order' ? '酱牛肉' : guest.type === 'special' ? '羊肉' : '米酒';
  }
}

/** 某商品是否有库存（TANG-TRF-001：预留 reserved 部分不可售 → 可售 = stock - reserved） */
export function isItemInStock(shopItems: readonly ShopItem[] | undefined, name: string): boolean {
  const item = (shopItems ?? []).find((it) => it.name === name);
  return !!item && (item.stock ?? 0) - (item.reserved ?? 0) > 0;
}

/** 库存联动信息：缺货 / 品类充足（去重品类 > 15 种，含产出商品）/ 连续缺货（≥3 日主顾流失） */
export function computeStockInfo(
  shopItems: readonly ShopItem[] | undefined,
  shopType: ShopType | null | undefined,
  guest: Guest,
  missingGoodStreak: number
): { missingGood: boolean; varietyBonus: boolean; lostCustomerRisk: boolean } {
  const desired = desiredItemForGuest(shopType, guest);
  const missingGood = !isItemInStock(shopItems, desired);
  const varietyCount = new Set((shopItems ?? []).map((it) => it.name)).size;
  const varietyBonus = varietyCount > 15;
  const lostCustomerRisk = (missingGoodStreak ?? 0) >= 3;
  return { missingGood, varietyBonus, lostCustomerRisk };
}

/** 污染标记（3.2 纯函数）：insightUsedTotal 达阈值后随机把 1-2 位客人标记 contaminated */
export function markContaminatedGuests(
  guests: readonly Guest[],
  insightUsedTotal: number,
  difficulty: Difficulty,
  rng: () => number = Math.random
): Guest[] {
  const threshold = POLLUTION_THRESHOLD[difficulty];
  if (insightUsedTotal < threshold || guests.length === 0) {
    return guests.map((g) => ({ ...g }));
  }
  const count = rng() < 0.5 ? 1 : 2;
  const result = guests.map((g) => ({ ...g }));
  // 随机抽取 count 位（可重复则跳过已污染，最多尝试 guests.length 次）
  let marked = 0;
  let guard = 0;
  while (marked < count && guard < result.length) {
    const idx = Math.floor(rng() * result.length);
    guard++;
    const g = result[idx]!;
    if (!g.contaminated) {
      result[idx] = { ...g, contaminated: true };
      marked++;
    }
  }
  return result;
}

export function handleGuest(
  guest: Guest,
  method: HandleMethod,
  state: ReceptionContext,
  rng: () => number = Math.random
): HandleGuestResult | null {
  // 防御：通晓人心次数不足时拒绝执行（store action 同样拦截，双保险）
  if (method === 'mind_read' && state.insightRemaining <= 0) {
    return null;
  }

  if (method === 'reject') {
    return {
      guestId: guest.id,
      income: 0,
      energyConsumed: 0,
      reputationChange: guest.type === 'help' ? -2 : 0,
      scoreChange: rng() < 0.3 ? -0.02 : 0,
      mentalOS: null,
      usedMindRead: false,
      review: 'bad',
    };
  }

  // normal / mind_read 共用基础收益：baseConsumption × (0.8~1.2)
  const baseIncome = guest.baseConsumption * (0.8 + rng() * 0.4);
  const usedMindRead = method === 'mind_read';
  const difficulty = state.difficulty ?? 'B';

  let income = baseIncome;
  let mentalOS: string | null = null;
  let scoreChange = 0;
  let backlashTriggered = false;
  let contaminated = false;
  let usedReverseOS = false;
  let complaintTriggered = false;

  // Step 5b-1.5 库存联动（5b-1.5）：缺货消费减两成、品类充足上浮 5%、连续缺货再减 15%
  const stockInfo = state.stockInfo;
  if (stockInfo) {
    if (stockInfo.missingGood) income *= 0.8;
    if (stockInfo.varietyBonus) income *= 1.05;
    if (stockInfo.lostCustomerRisk) income *= 0.85;
    income = round1(income);
  }

  if (usedMindRead) {
    const threshold = state.backlashThresholdOverride ?? BACKLASH_THRESHOLD[difficulty];
    const prevCount = state.insightUsedOnNPC ?? 0;
    // 1. 反噬判定：本单正好跨过阈值 → 固定警示 OS、消费砍半、评分-0.05
    backlashTriggered = threshold > 0 && prevCount + 1 === threshold;
    // 该身份此前已反噬（累计已达阈值）→ 之后 OS 从反讽/假信息池抽取
    usedReverseOS = threshold > 0 && prevCount >= threshold;

    if (guest.contaminated) {
      // 2. 污染：OS 从幻觉池抽取，不标注来源
      contaminated = true;
      mentalOS = pick(HALLUCINATION_OS_POOL, rng);
    } else if (backlashTriggered) {
      mentalOS = BACKLASH_OS;
      income = round1(baseIncome / 2); // 消费砍半
      scoreChange = -0.05;
    } else if (usedReverseOS) {
      mentalOS = pick(REVERSE_OS_POOL, rng);
    } else {
      mentalOS = pick(GUEST_OS_POOLS[guest.type], rng);
    }

    // 40% 概率收益上浮 10-30%（在 normal 收益基础上；反噬/污染不额外上浮，保持可预期）
    if (!backlashTriggered && rng() < 0.4) {
      income = baseIncome * (1.1 + rng() * 0.2);
    }
  } else {
    // 3. 投诉触发（normal 分支）：普通 10%、差评师 100%；消费减半、评分-0.02
    complaintTriggered = guest.isBadReviewer ? true : rng() < 0.1;
    if (complaintTriggered) {
      income = round1(baseIncome / 2);
      scoreChange = -0.02;
    }
  }

  // normal 20% 声望+1（mind_read 不触发本条）
  const reputationChange = !usedMindRead && rng() < 0.2 ? 1 : 0;

  return {
    guestId: guest.id,
    income: round1(income),
    energyConsumed: usedMindRead ? 10 : 5,
    reputationChange,
    scoreChange,
    mentalOS,
    usedMindRead,
    review: 'good',
    backlashTriggered: backlashTriggered || undefined,
    contaminated: contaminated || undefined,
    usedReverseOS: usedReverseOS || undefined,
    complaintTriggered: complaintTriggered || undefined,
  };
}
