/**
 * 《我在唐朝当掌柜》布庄·定制订单系统（产业系统 模块二 2.2）
 * 独立于酒楼/药铺产业逻辑：客人提出定制（接待/织工介绍）→ 量体+选料+选款+选纹样 →
 * 指派裁缝 → 工期 1-7 天 → 交货判定（完全匹配/基本/瑕疵/严重不符）。
 * 定制类型：嫁衣/官服/寿衣/常服/批量工服。纯函数：rng 可注入。
 */
import { CUSTOM_ORDER_RULES, CUSTOM_ORDER_TYPES, industryLevel } from '@/config/tang-industry-content';
import type { CustomOrder, CustomOrderResult, CustomOrderType } from '@/types/tang-industry';

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** 定制类型定义 */
export function customOrderTypeDef(type: CustomOrderType) {
  return CUSTOM_ORDER_TYPES.find((t) => t.type === type) ?? CUSTOM_ORDER_TYPES[3]!;
}

/** 生成定制订单（纯函数） */
export function generateCustomOrder(
  type: CustomOrderType | undefined,
  guestName: string,
  fabric: string,
  style: string,
  rng: () => number = Math.random
): CustomOrder {
  const def = type ? customOrderTypeDef(type) : pick(CUSTOM_ORDER_TYPES, rng);
  const [rLo, rHi] = def.reward;
  const [dLo, dHi] = def.days;
  return {
    id: `co-${Date.now().toString(36)}-${Math.floor(rng() * 1000)}`,
    type: def.type,
    guestName,
    fabric,
    style,
    pattern: rng() < 0.5 ? '吉祥纹' : '素纹',
    totalDays: randInt(dLo, dHi, rng),
    remainingDays: randInt(dLo, dHi, rng),
    requirement: def.requirement,
    reward: Math.round((rLo + rng() * (rHi - rLo)) * 10) / 10,
    status: 'making',
  };
}

/** 交货判定（纯函数）：匹配度 0-1 → 等级 */
export function gradeCustomOrder(match: number): CustomOrderResult['grade'] {
  if (match >= 0.9) return 'perfect';
  if (match >= 0.6) return 'basic';
  if (match >= 0.3) return 'flawed';
  return 'reject';
}

/** 交货结算（纯函数）：按等级算收入与满意度 */
export function deliverCustomOrder(order: CustomOrder, match: number, rng: () => number = Math.random): { order: CustomOrder; result: CustomOrderResult } {
  const grade = gradeCustomOrder(match);
  const rule = CUSTOM_ORDER_RULES[grade];
  const income = Math.round(order.reward * rule.incomeMul * 10) / 10;
  const note =
    grade === 'perfect' ? '完全合意，客人穿上新衣引来围观' :
    grade === 'basic' ? '基本合意' :
    grade === 'flawed' ? '有瑕疵，扣款两成' : '严重不符，客人拒收';
  const result: CustomOrderResult = { grade, income, satisfactionDelta: rule.satisfaction, note };
  const done: CustomOrder = { ...order, status: grade === 'reject' ? 'rejected' : 'delivered', result };
  return { order: done, result };
}

/** 升级条件（2.3）：评分 + 累计定制订单数 */
export function checkClothierLevelUp(level: number, score: number, customOrderCount: number): boolean {
  const next = industryLevel('clothier', level + 1);
  if (next.level <= level) return false;
  return score >= next.require.score && customOrderCount >= next.require.count;
}

/** Lv5 定制订单利润 +30%（纯函数） */
export function customOrderProfitBonus(clothierLevel: number, base: number): number {
  return Math.round(base * (clothierLevel >= 5 ? 1.3 : 1) * 10) / 10;
}

/** 官服定制仅在 Lv3 解锁（纯函数） */
export function officialUnlocked(clothierLevel: number): boolean {
  return clothierLevel >= 3;
}
