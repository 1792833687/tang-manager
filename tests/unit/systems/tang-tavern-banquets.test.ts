/** 酒楼·宴席承办单测（产业系统 模块一 1.2） */
import { describe, expect, it } from 'vitest';
import { banquetSatisfaction, generateBanquetOrder, maxBanquetGuests, prepareBanquet, settleBanquet } from '@/systems/tang-tavern-banquets';

function rngSeq(seq: number[]): () => number { let i = 0; return () => seq[i++ % seq.length]!; }

describe('generateBanquetOrder / 规模上限', () => {
  it('生成宴席：人数受酒楼等级上限约束', () => {
    const o1 = generateBanquetOrder('shou_yan', 1, 1, rngSeq([0, 0, 0]));
    expect(o1.guestCount).toBeLessThanOrEqual(10);
    const o4 = generateBanquetOrder('shou_yan', 1, 4, rngSeq([0.99, 0.99, 0.99]));
    expect(o4.guestCount).toBeLessThanOrEqual(100);
  });
  it('规模上限：Lv1 10 / Lv2 20 / Lv3 50 / Lv4 100', () => {
    expect(maxBanquetGuests(1)).toBe(10);
    expect(maxBanquetGuests(2)).toBe(20);
    expect(maxBanquetGuests(3)).toBe(50);
    expect(maxBanquetGuests(4)).toBe(100);
  });
});

describe('prepareBanquet', () => {
  it('菜数足够 + 酒水足够 → 筹备 100%', () => {
    const o = generateBanquetOrder('xi_chen', 1, 2, rngSeq([0, 0, 0]));
    const p = prepareBanquet(o, ['a', 'b', 'c', 'd', 'e', 'f'], 10, 'refined', 6);
    expect(p.prepProgress).toBe(100);
  });
});

describe('settleBanquet', () => {
  it('举办结算：净利 = 收入 - 布置 - 酒水；声望按等级', () => {
    const o = generateBanquetOrder('shou_yan', 1, 2, rngSeq([0, 0, 0]));
    const prep = prepareBanquet(o, ['a', 'b', 'c', 'd', 'e', 'f', 'g'], 10, 'luxury', 7);
    const { result } = settleBanquet(prep, 7, 2, rngSeq([0.5]));
    expect(result.netProfit).toBeGreaterThanOrEqual(0);
    expect(result.reputationGain).toBeGreaterThanOrEqual(3);
    expect(result.income).toBeGreaterThan(0);
  });
  it('Lv5 声望奖励翻倍', () => {
    const o = generateBanquetOrder('shou_yan', 1, 5, rngSeq([0, 0, 0]));
    const prep = prepareBanquet(o, ['a', 'b', 'c', 'd', 'e', 'f', 'g'], 10, 'normal', 7);
    const r1 = settleBanquet(prep, 7, 5, rngSeq([0.5]));
    const o2 = generateBanquetOrder('shou_yan', 1, 1, rngSeq([0, 0, 0]));
    const prep2 = prepareBanquet(o2, ['a', 'b', 'c', 'd', 'e', 'f', 'g'], 10, 'normal', 7);
    const r2 = settleBanquet(prep2, 7, 1, rngSeq([0.5]));
    expect(r1.result.reputationGain).toBe(r2.result.reputationGain * 2);
  });
});

describe('banquetSatisfaction', () => {
  it('豪华布置 + 7 道菜 → 宾主尽欢', () => {
    const o = { ...generateBanquetOrder('hun_yan', 1, 3, rngSeq([0, 0, 0])), decor: 'luxury' as const };
    expect(banquetSatisfaction(o, 7)).toBe('delighted');
  });
});
