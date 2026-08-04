/** 布庄·织造合作单测（产业系统 模块二 2.1） */
import { describe, expect, it } from 'vitest';
import { checkClothierLevelUp, consignmentGoods, consignmentPremium, generateWeaver, maxWeavers, sellConsignment, weaverSatisfactionChange } from '@/systems/tang-clothier-cooperative';

function rngSeq(seq: number[]): () => number { let i = 0; return () => seq[i++ % seq.length]!; }

describe('generateWeaver', () => {
  it('技艺越高抽成越高', () => {
    const w1 = generateWeaver(rngSeq([0, 0]));
    const w5 = generateWeaver(rngSeq([0.99, 0.99]));
    expect(w5.skill).toBeGreaterThan(w1.skill);
    expect(w5.commission).toBeGreaterThan(w1.commission);
  });
});

describe('consignmentGoods / sellConsignment', () => {
  it('寄卖品品质由织工技艺决定、售价高于普通', () => {
    const w = generateWeaver(rngSeq([0.99, 0.99]));
    const goods = consignmentGoods(w, 10, rngSeq([0, 0]));
    expect(goods.length).toBeGreaterThanOrEqual(2);
    expect(goods[0]!.quality).toBe(w.skill);
    expect(goods[0]!.price).toBeGreaterThan(10);
  });
  it('售出分账：店铺所得 = 价 × (1-抽成)', () => {
    const w = generateWeaver(rngSeq([0, 0]));
    const goods = consignmentGoods(w, 10, rngSeq([0, 0]));
    const wWithGoods = { ...w, currentGoods: goods };
    const res = sellConsignment(wWithGoods, goods[0]!.id, 1);
    expect(res.shopIncome).toBeCloseTo(goods[0]!.price - Math.round(goods[0]!.price * w.commission * 100) / 100, 1);
    expect(res.weaver.currentGoods[0]!.sold).toBe(true);
  });
});

describe('weaverSatisfactionChange / 等级', () => {
  it('长期无销售满意度下降；鼓励上升', () => {
    expect(weaverSatisfactionChange({ commission: 0.3, satisfaction: 60 } as never, 6, false)).toBeLessThan(0);
    expect(weaverSatisfactionChange({ commission: 0.3, satisfaction: 60 } as never, 0, true)).toBe(10);
  });
  it('合作上限按等级；Lv4 寄卖溢价 +20%', () => {
    expect(maxWeavers(1)).toBe(1);
    expect(maxWeavers(2)).toBe(2);
    expect(maxWeavers(3)).toBe(3);
    expect(consignmentPremium(4, 100)).toBe(120);
  });
  it('升级条件：评分 + 定制订单数', () => {
    expect(checkClothierLevelUp(1, 1.6, 2)).toBe(true);
    expect(checkClothierLevelUp(1, 1.4, 2)).toBe(false);
  });
});
