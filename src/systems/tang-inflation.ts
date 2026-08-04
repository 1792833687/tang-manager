/**
 * 《我在唐朝当掌柜》通货膨胀模拟（Step 5b 模块五）
 * 纯函数（可测）：
 * - updatePriceIndex(state, rng?)：每月初调用；基础 ±5% + 事件修正（state.inflationModifier 或随机年景）；
 *   clamp 0.8~1.5
 * - applyPriceIndex(baseAmount, priceIndex)：baseAmount × priceIndex
 * - calculateStorageCost(state)：maxStorage 初始 100 单位，超出每日 1 两/10 单位仓储费
 * - storageRiskEvent(state, rng?)：囤货风险（保质期/火灾/盗窃——轻量实现：5% 概率损失 5% 库存）
 *
 * 事件修正说明（预留）：粮食丰收-10% / 歉收+15% / 漕运畅通-5% / 堵塞+10% / 铸钱-8% / 钱荒+12%。
 * 两种驱动方式并存：
 * 1) 叙事事件（config/tang-events.ts 年景/时令事件）写入 state.inflationModifier，月初被本函数消费；
 * 2) 无 modifier 时 15% 概率随机年景事件（自包含，注释预留）。
 *
 * 结算接入：基础收益 ×priceIndex、进货成本 ×priceIndex、涨薪阈值随 priceIndex（store/settlement 注释）。
 */
import type { TangGameState } from '@/types/tang-manager';

export const PRICE_INDEX_MIN = 0.8;
export const PRICE_INDEX_MAX = 1.5;
export const DEFAULT_PRICE_INDEX = 1.0;

/** 随机年景事件池（updatePriceIndex 无 modifier 时 15% 触发） */
const EVENT_POOL: ReadonlyArray<{ note: string; delta: number }> = [
  { note: '今年风调雨顺，粮食丰收，粮价回落。', delta: -0.1 },
  { note: '今岁天旱，粮食歉收，市面粮价飞涨。', delta: 0.15 },
  { note: '漕运畅通，南货北调，物价平稳回落。', delta: -0.05 },
  { note: '漕运堵塞，商路不畅，物价节节攀升。', delta: 0.1 },
  { note: '官府开炉铸钱，市面钱多物稀。', delta: -0.08 },
  { note: '坊间钱荒，铜钱难求，物价虚高。', delta: 0.12 },
];

export interface PriceIndexUpdateResult {
  priceIndex: number;
  /** 基础浮动（±5%） */
  drift: number;
  /** 事件修正（modifier 或随机年景） */
  modifier: number;
  /** 随机年景事件文案（modifier 来自事件时为空） */
  eventNote?: string;
}

/** 每月初更新物价指数（纯函数；clamp 0.8~1.5） */
export function updatePriceIndex(
  state: Pick<TangGameState, 'priceIndex' | 'inflationModifier'>,
  rng: () => number = Math.random
): PriceIndexUpdateResult {
  const base = state.priceIndex ?? DEFAULT_PRICE_INDEX;
  const drift = (rng() - 0.5) * 0.1; // 基础 ±5%
  let modifier = state.inflationModifier ?? 0;
  let eventNote: string | undefined;
  if (modifier === 0 && rng() < 0.15) {
    // 随机年景事件（注释预留：事件驱动部分两种来源并存）
    const ev = EVENT_POOL[Math.floor(rng() * EVENT_POOL.length)]!;
    modifier = ev.delta;
    eventNote = ev.note;
  }
  const next = Math.min(PRICE_INDEX_MAX, Math.max(PRICE_INDEX_MIN, base + drift + modifier));
  return {
    priceIndex: Math.round(next * 100) / 100,
    drift: Math.round(drift * 1000) / 1000,
    modifier,
    eventNote,
  };
}

/** 物价折算：baseAmount × priceIndex（进货/收益统一入口） */
export function applyPriceIndex(baseAmount: number, priceIndex: number): number {
  return Math.round(baseAmount * (priceIndex ?? DEFAULT_PRICE_INDEX) * 100) / 100;
}

/**
 * @deprecated（TANG-S5B15-002 统一仓储费口径）：本函数为「超出 maxStorage 每日 1 两/10 单位」的旧日扣逻辑，
 * 已由 tang-expiry.calculateStorageCost（免费上限 + 时令修正 + 月初一次性扣整月）取代，且 tang-settlement 不再调用本函数。
 * 保留导出仅供历史/外部引用兼容，禁止新增调用。
 */
export function calculateStorageCost(state: Pick<TangGameState, 'shopItems' | 'maxStorage'>): number {
  const total = (state.shopItems ?? []).reduce((sum, it) => sum + (it.stock ?? 0), 0);
  const limit = state.maxStorage ?? 100;
  if (total <= limit) {
    return 0;
  }
  return Math.ceil((total - limit) / 10);
}

/** 囤货风险（轻量实现占位：5% 概率火灾/盗窃损失 5% 库存；保质期风险注释预留） */
export function storageRiskEvent(
  state: Pick<TangGameState, 'shopItems'>,
  rng: () => number = Math.random
): { note: string; loss: number } {
  const total = (state.shopItems ?? []).reduce((sum, it) => sum + (it.stock ?? 0), 0);
  if (total <= 0) {
    return { note: '', loss: 0 };
  }
  if (rng() < 0.05) {
    const loss = Math.max(1, Math.floor(total * 0.05));
    return { note: '夜里库房进了贼，丢了些货。', loss };
  }
  return { note: '', loss: 0 };
}
