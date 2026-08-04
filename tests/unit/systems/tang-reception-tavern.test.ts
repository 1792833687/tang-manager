/**
 * 酒楼宴席接待单测（模块一 1.1 / 模块七）
 * 覆盖：搭配评分（荤素均衡/招牌/酒水）、档位阈值、收益倍率区间、
 *       完整接待流程（赠菜/请评菜/口碑/研发线索）、库存可用菜品。
 */
import { describe, expect, it } from 'vitest';
import {
  availableTavernDishes,
  handleTavernReception,
  scoreTavernCombo,
  tavernComboTier,
  tavernIncomeMultiplier,
} from '@/systems/tang-reception-tavern';
import { TAVERN_DISHES } from '@/config/tang-reception-content';
import type { Guest, ShopItem } from '@/types/tang-manager';
import type { TavernPlan } from '@/systems/tang-reception-tavern';

function rngSeq(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length]!;
}

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    name: '张员外',
    type: 'normal',
    description: '老夫今日做寿，要一桌体面的席面。',
    baseConsumption: 8,
    handled: false,
    ...overrides,
  };
}

describe('scoreTavernCombo（搭配评分）', () => {
  it('荤素均衡 +2 / 有招牌菜 +3 / 有酒水 +1', () => {
    const ids = ['hot_veg', 'soup_lamb', 'wine_rice', 'cold_beef'];
    // 荤（soup_lamb/cold_beef）+ 素（hot_veg）+ 招牌（cold_beef）+ 酒水（wine_rice）
    expect(scoreTavernCombo(ids)).toBe(2 + 3 + 1);
  });
  it('仅有酒水得 1 分', () => {
    expect(scoreTavernCombo(['wine_rice'])).toBe(1);
  });
  it('空菜单 0 分', () => {
    expect(scoreTavernCombo([])).toBe(0);
  });
});

describe('tavernComboTier（档位阈值）', () => {
  it('≥5 delight / 3-4 normal / <3 disappoint', () => {
    expect(tavernComboTier(5)).toBe('delight');
    expect(tavernComboTier(4)).toBe('normal');
    expect(tavernComboTier(3)).toBe('normal');
    expect(tavernComboTier(2)).toBe('disappoint');
  });
});

describe('tavernIncomeMultiplier（收益倍率）', () => {
  it('delight 上浮 10-30%', () => {
    expect(tavernIncomeMultiplier('delight', rngSeq([0]))).toBe(1.1);
    expect(tavernIncomeMultiplier('delight', rngSeq([1]))).toBe(1.3);
  });
  it('disappoint 下降 10-20%', () => {
    expect(tavernIncomeMultiplier('disappoint', rngSeq([0]))).toBe(0.9);
    expect(tavernIncomeMultiplier('disappoint', rngSeq([1]))).toBe(0.8);
  });
  it('normal 无变动', () => {
    expect(tavernIncomeMultiplier('normal', rngSeq([0]))).toBe(1);
  });
});

describe('handleTavernReception（完整流程）', () => {
  it('满意档：收入上浮、review good、精力 -5', () => {
    const plan: TavernPlan = { shop: 'jiulou', dishIds: ['hot_veg', 'soup_lamb', 'wine_rice', 'cold_beef'] };
    const res = handleTavernReception(makeGuest(), plan, { baseConsumption: 8, guestType: 'normal' }, rngSeq([0.5, 0.5, 0.5]));
    expect(res.ok).toBe(true);
    expect(res.review).toBe('good');
    expect(res.incomeMultiplier).toBeGreaterThanOrEqual(1.1);
    expect(res.energyConsumed).toBe(5);
    expect(res.narrative.length).toBeGreaterThan(0);
    expect(res.summary.length).toBeGreaterThan(0);
  });
  it('赠菜：好感 +15、消耗标记、口碑传播（rng<0.2）', () => {
    const plan: TavernPlan = { shop: 'jiulou', dishIds: ['hot_veg', 'soup_lamb', 'cold_beef'], giftDishId: 'cold_beef' };
    const res = handleTavernReception(makeGuest(), plan, { baseConsumption: 8, guestType: 'normal' }, rngSeq([0.5, 0, 0, 0]));
    expect(res.favorDelta).toBe(15);
    expect(res.flags?.giftDishConsumed).toBe(true);
    expect(res.flags?.wordOfMouth).toBe(true);
  });
  it('请评菜：精力 +5（合计 10），研发线索概率', () => {
    const plan: TavernPlan = { shop: 'jiulou', dishIds: ['hot_veg', 'soup_lamb', 'cold_beef'], judgeRequested: true };
    const res = handleTavernReception(makeGuest(), plan, { baseConsumption: 8, guestType: 'normal' }, rngSeq([0.5, 0, 0]));
    expect(res.energyConsumed).toBe(10);
    expect(res.flags?.recipeClue).toBeTruthy();
  });
  it('不满档：review bad、收入下降', () => {
    const plan: TavernPlan = { shop: 'jiulou', dishIds: ['hot_veg'] };
    const res = handleTavernReception(makeGuest(), plan, { baseConsumption: 8, guestType: 'normal' }, rngSeq([0.5, 0]));
    expect(res.ok).toBe(false);
    expect(res.review).toBe('bad');
    expect(res.incomeMultiplier).toBeLessThanOrEqual(0.9);
  });
});

describe('availableTavernDishes（库存联动）', () => {
  it('食材缺货的菜不可选', () => {
    const items: ShopItem[] = [
      { id: 's1', name: '时蔬', price: 1, cost: 0.5, stock: 0, category: '食材' },
      { id: 's2', name: '羊肉', price: 3, cost: 2, stock: 5, category: '食材' },
      { id: 's3', name: '米酒', price: 2, cost: 1, stock: 5, category: '食材' },
      { id: 's4', name: '酱牛肉', price: 4, cost: 3, stock: 5, category: '食材' },
    ];
    const avail = availableTavernDishes(items);
    expect(avail.some((d) => d.ingredient === '时蔬')).toBe(false);
    expect(avail.some((d) => d.ingredient === '羊肉')).toBe(true);
    expect(avail.length).toBeLessThan(TAVERN_DISHES.length);
  });
});
