/**
 * 《我在唐朝当掌柜》酒楼·宴席承办系统（产业系统 模块一 1.2）
 * 独立于布庄/药铺产业逻辑：订单来源（客人预订/商会介绍）→ 筹备（6-8 道菜 + 酒水 + 雅间布置）
 * → 举办当日自动结算（收入-食材成本-布置成本=净利）→ 声望 + 宾客引荐。
 * 宴席类型：寿宴/婚宴/洗尘宴/饯行宴/商会宴。纯函数：rng 可注入。
 */
import {
  BANQUET_DECOR,
  BANQUET_SATISFACTION,
  BANQUET_TYPES,
  industryLevel,
} from '@/config/tang-industry-content';
import type { Banquet, BanquetResult, BanquetType } from '@/types/tang-industry';

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** 宴席类型定义（纯函数） */
export function banquetTypeDef(type: BanquetType) {
  return BANQUET_TYPES.find((b) => b.type === type) ?? BANQUET_TYPES[0]!;
}

/** 生成宴席订单（纯函数）：人数/预算/举办日/类型 */
export function generateBanquetOrder(
  type: BanquetType | undefined,
  day: number,
  tavernLevel: number,
  rng: () => number = Math.random
): Banquet {
  const def = type ? banquetTypeDef(type) : pick(BANQUET_TYPES, rng);
  const [gLo, gHi] = def.scale;
  const [pLo, pHi] = def.perHead;
  const guestCount = Math.min(randInt(gLo, gHi, rng), maxBanquetGuests(tavernLevel));
  const perHead = pLo + rng() * (pHi - pLo);
  return {
    id: `bq-${Date.now().toString(36)}-${Math.floor(rng() * 1000)}`,
    type: def.type,
    guestCount,
    budget: Math.round(guestCount * perHead),
    holdDay: day + randInt(3, 7, rng),
    prepProgress: 0,
    decor: 'normal',
    dishIds: [],
    wineAmount: 0,
    status: 'preparing',
  };
}

/** 宴席规模上限（按酒楼等级；纯函数） */
export function maxBanquetGuests(tavernLevel: number): number {
  if (tavernLevel >= 4) return 100;
  if (tavernLevel >= 3) return 50;
  if (tavernLevel >= 2) return 20;
  return 10;
}

/** 筹备：选菜 + 酒水 + 布置 → 更新进度（纯函数） */
export function prepareBanquet(
  order: Banquet,
  dishIds: string[],
  wineAmount: number,
  decor: Banquet['decor'],
  requiredDishCount: number
): Banquet {
  const dishOk = dishIds.length >= requiredDishCount;
  const wineOk = wineAmount >= Math.ceil(order.guestCount / 4);
  return {
    ...order,
    dishIds,
    wineAmount,
    decor,
    prepProgress: dishOk && wineOk ? 100 : Math.min(90, Math.round((dishIds.length / requiredDishCount) * 60 + (wineOk ? 30 : 10))),
  };
}

/** 满意度档位（纯函数）：布置 + 菜品覆盖 → 档位 */
export function banquetSatisfaction(order: Banquet, dishCount: number): keyof typeof BANQUET_SATISFACTION {
  const decorSat = BANQUET_DECOR[order.decor].satisfaction;
  if (decorSat >= 20 && dishCount >= 7) return 'delighted';
  if (decorSat === 0 && dishCount < 6) return 'disappointed';
  return 'normal';
}

/** 宴席结算（纯函数）：收入 × 满意度倍率 - 布置成本 - 酒水成本 = 净利；声望 + 引荐 */
export function settleBanquet(
  order: Banquet,
  dishCount: number,
  tavernLevel: number,
  rng: () => number = Math.random
): { order: Banquet; result: BanquetResult } {
  const def = banquetTypeDef(order.type);
  const sat = banquetSatisfaction(order, dishCount);
  const decorCost = BANQUET_DECOR[order.decor].cost;
  const wineCost = order.wineAmount * 0.5;
  const income = Math.round(order.budget * BANQUET_SATISFACTION[sat]);
  const cost = decorCost + wineCost;
  const netProfit = Math.max(0, income - cost);
  const repMul = tavernLevel >= 5 ? 2 : 1;
  const reputationGain = def.reputation * repMul;
  const referral = rng() < 0.25;
  const held: Banquet = { ...order, status: 'held', result: { income, cost, netProfit, reputationGain, referral } };
  return { order: held, result: held.result! };
}

/** 升级条件（1.3）：评分 + 累计宴席数（与 recipes 共用 checkTavernLevelUp 的计数口径） */
export function tavernBanquetCountForLevelUp(level: number, score: number, banquetCount: number): boolean {
  const next = industryLevel('tavern', level + 1);
  if (next.level <= level) return false;
  return score >= next.require.score && banquetCount >= next.require.count;
}
