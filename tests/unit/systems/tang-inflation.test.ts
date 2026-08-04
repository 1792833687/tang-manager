/**
 * 通货膨胀模拟单测（tang-inflation · Step 5b 模块五）
 * 覆盖：updatePriceIndex 浮动与 clamp、applyPriceIndex、仓储费、囤货风险。
 */
import { describe, expect, it } from 'vitest';
import {
  applyPriceIndex,
  calculateStorageCost,
  storageRiskEvent,
  updatePriceIndex,
} from '@/systems/tang-inflation';
import type { ShopItem } from '@/types/tang-manager';

const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function makeItem(overrides: Partial<ShopItem> = {}): ShopItem {
  return {
    id: 'it1',
    name: '锦缎',
    price: 10,
    cost: 5,
    stock: 0,
    category: '布匹',
    ...overrides,
  };
}

describe('updatePriceIndex', () => {
  it('基础 ±5%：rng=0.5 → 无浮动；rng=1 → +5%', () => {
    expect(updatePriceIndex({ priceIndex: 1, inflationModifier: 0 }, seq(0.5)).priceIndex).toBe(1);
    // drift = (1 - 0.5) × 0.1 = 0.05；0.5 < 0.15 不触发随机年景
    expect(updatePriceIndex({ priceIndex: 1, inflationModifier: 0 }, seq(1, 0.9)).priceIndex).toBe(1.05);
  });

  it('事件修正（inflationModifier）：歉收 +15%', () => {
    const r = updatePriceIndex({ priceIndex: 1, inflationModifier: 0.15 }, seq(0.5));
    expect(r.priceIndex).toBe(1.15);
    expect(r.modifier).toBe(0.15);
  });

  it('clamp 0.8~1.5（上界封顶、下界封底）', () => {
    expect(updatePriceIndex({ priceIndex: 1.49, inflationModifier: 0 }, seq(1)).priceIndex).toBe(1.5);
    expect(updatePriceIndex({ priceIndex: 0.79, inflationModifier: 0 }, seq(0)).priceIndex).toBe(0.8);
    expect(updatePriceIndex({ priceIndex: 1.4, inflationModifier: 0.15 }, seq(0.5)).priceIndex).toBe(1.5);
  });

  it('无 modifier 时 15% 概率触发随机年景事件（eventNote 非空）', () => {
    const r = updatePriceIndex({ priceIndex: 1, inflationModifier: 0 }, seq(0.5, 0.05, 0));
    expect(r.eventNote).toBeDefined();
  });
});

describe('applyPriceIndex', () => {
  it('baseAmount × priceIndex（进货/收益统一折算）', () => {
    expect(applyPriceIndex(100, 1.2)).toBe(120);
    expect(applyPriceIndex(100, 1)).toBe(100);
    expect(applyPriceIndex(50, 0.8)).toBe(40);
  });
});

describe('仓储费', () => {
  it('maxStorage 100 单位；超出每日 1 两/10 单位', () => {
    const items = [
      makeItem({ stock: 60 }),
      makeItem({ id: 'it2', stock: 50 }),
    ];
    // 总 110 超出 10 → 1 两
    expect(calculateStorageCost({ shopItems: items, maxStorage: 100 })).toBe(1);
    // 总 100 → 0
    expect(calculateStorageCost({ shopItems: [makeItem({ stock: 100 })], maxStorage: 100 })).toBe(0);
    // 超出 5 → ceil(5/10)=1
    expect(calculateStorageCost({ shopItems: [makeItem({ stock: 105 })], maxStorage: 100 })).toBe(1);
    // 超出 25 → ceil(25/10)=3
    expect(calculateStorageCost({ shopItems: [makeItem({ stock: 125 })], maxStorage: 100 })).toBe(3);
  });
});

describe('囤货风险（轻量实现占位）', () => {
  it('5% 概率火灾/盗窃损失 5% 库存（rng<0.05）', () => {
    const items = [makeItem({ stock: 100 })];
    const r = storageRiskEvent({ shopItems: items }, seq(0.01));
    expect(r.loss).toBe(5);
    expect(r.note).not.toBe('');
    const safe = storageRiskEvent({ shopItems: items }, seq(0.5));
    expect(safe.loss).toBe(0);
  });
});
