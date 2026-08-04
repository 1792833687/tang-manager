/**
 * 布庄量身定制接待单测（模块一 1.2 / 模块七）
 * 覆盖：偏好维度推断、匹配维度数、成交率区间、追加操作加成、成交/未成交路径。
 */
import { describe, expect, it } from 'vitest';
import {
  clothierCloseRange,
  clothierExtraCloseBonus,
  clothierMatchCount,
  clothierPreferenceDimension,
  clothierSwapPenalty,
  handleClothierReception,
} from '@/systems/tang-reception-clothier';
import type { Guest } from '@/types/tang-manager';
import type { ClothierPlan } from '@/systems/tang-reception-clothier';

function rngSeq(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length]!;
}

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g2',
    name: '王娘子',
    type: 'normal',
    description: '女儿下月出嫁，要置办嫁妆——从里到外都得是新衣裳。',
    baseConsumption: 10,
    handled: false,
    ...overrides,
  };
}

describe('clothierPreferenceDimension（偏好维度）', () => {
  it('关键词映射：结实→plain / 体面→luxury / 时兴→fashion', () => {
    expect(clothierPreferenceDimension({ ...makeGuest(), description: '要结实的粗布' })).toBe('plain');
    expect(clothierPreferenceDimension({ ...makeGuest(), description: '要体面的绸衫' })).toBe('luxury');
    expect(clothierPreferenceDimension({ ...makeGuest(), description: '赶时髦的窄袖' })).toBe('fashion');
  });
  it('类型兜底：big_order→luxury / special→fashion / 其余 plain', () => {
    expect(clothierPreferenceDimension({ ...makeGuest(), type: 'big_order', description: '随便看看' })).toBe('luxury');
    expect(clothierPreferenceDimension({ ...makeGuest(), type: 'special', description: '随便看看' })).toBe('fashion');
    expect(clothierPreferenceDimension({ ...makeGuest(), type: 'normal', description: '随便看看' })).toBe('plain');
  });
});

describe('clothierMatchCount / closeRange / extraBonus', () => {
  it('双匹配=2 / 单匹配=1 / 零匹配=0', () => {
    expect(clothierMatchCount('brocade', 'luxury', 'luxury')).toBe(2);
    expect(clothierMatchCount('silk', 'plain', 'luxury')).toBe(1);
    expect(clothierMatchCount('coarse', 'plain', 'luxury')).toBe(0);
  });
  it('成交率区间：2→70-90% / 1→45-65% / 0→20-35%', () => {
    expect(clothierCloseRange(2)).toEqual([0.7, 0.9]);
    expect(clothierCloseRange(1)).toEqual([0.45, 0.65]);
    expect(clothierCloseRange(0)[0]).toBeLessThanOrEqual(0.35);
  });
  it('追加操作加成：量体 +20% / 样衣 +15% / 换料 +10%', () => {
    expect(clothierExtraCloseBonus('measure')).toBe(0.2);
    expect(clothierExtraCloseBonus('sample')).toBe(0.15);
    expect(clothierExtraCloseBonus('swap_fabric')).toBe(0.1);
    expect(clothierExtraCloseBonus(undefined)).toBe(0);
  });
});

describe('handleClothierReception（成交/未成交）', () => {
  it('双匹配 + rng=0 → 成交，收入 = 基础消费 × 面料×款式系数', () => {
    const plan: ClothierPlan = { shop: 'buzhuang', fabricId: 'brocade', styleId: 'luxury' };
    const res = handleClothierReception(makeGuest(), plan, { baseConsumption: 10, guestType: 'normal' }, rngSeq([0, 0]));
    expect(res.ok).toBe(true);
    expect(res.review).toBe('good');
    // brocade 1.5 × luxury 1.3 = 1.95；基础 (0.9 + 0*0.2)=0.9 → 10×0.9×1.95
    expect(res.income).toBe(17.6);
  });
  it('零匹配 + rng 高 → 未成交，review bad，收益 0', () => {
    const plan: ClothierPlan = { shop: 'buzhuang', fabricId: 'coarse', styleId: 'plain' };
    const res = handleClothierReception({ ...makeGuest(), description: '要体面的绸衫' }, plan, { baseConsumption: 10, guestType: 'normal' }, rngSeq([0.99, 0.99]));
    expect(res.ok).toBe(false);
    expect(res.review).toBe('bad');
    expect(res.income).toBe(0);
  });
  it('量体：精力 -3、满意度 +10', () => {
    const plan: ClothierPlan = { shop: 'buzhuang', fabricId: 'silk', styleId: 'fashion', extraOp: 'measure' };
    const res = handleClothierReception(makeGuest(), plan, { baseConsumption: 10, guestType: 'normal' }, rngSeq([0, 0]));
    expect(res.energyConsumed).toBe(3);
    expect(res.satisfactionDelta).toBeGreaterThanOrEqual(10);
  });
  it('换料：利润折扣按面料 swapProfitPenalty', () => {
    expect(clothierSwapPenalty('silk')).toBe(0.12);
    const plan: ClothierPlan = { shop: 'buzhuang', fabricId: 'silk', styleId: 'fashion', extraOp: 'swap_fabric' };
    const res = handleClothierReception(makeGuest(), plan, { baseConsumption: 10, guestType: 'normal' }, rngSeq([0, 0]));
    expect(res.income).toBeLessThan(10 * 0.9 * 1.2 * 1.15);
  });
});
