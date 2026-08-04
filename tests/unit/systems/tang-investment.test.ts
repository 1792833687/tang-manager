/**
 * 投资系统单测（tang-investment · Step 5b 模块四）
 * 覆盖：三种投资门槛、回报区间、到期结算、风险（查封/打击分店）。
 */
import { describe, expect, it } from 'vitest';
import {
  checkInvestmentMaturity,
  investInGuildFund,
  investInUnderground,
  investWithShen,
} from '@/systems/tang-investment';
import type { Investment } from '@/types/tang-manager';

const rng = (): number => 0.5;
const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function makeInv(overrides: Partial<Investment> = {}): Investment {
  return {
    id: 'i1',
    amount: 200,
    investDay: 1,
    type: 'guild',
    expectedReturn: 0.1,
    status: 'active',
    ...overrides,
  };
}

describe('商会基金（guild）', () => {
  it('需 ≥100 两；现银不足拒绝', () => {
    expect(investInGuildFund(99, { silver: 500, reputation: 0, day: 1 }, rng).ok).toBe(false);
    expect(investInGuildFund(100, { silver: 50, reputation: 0, day: 1 }, rng).ok).toBe(false);
    const r = investInGuildFund(100, { silver: 500, reputation: 0, day: 1 }, rng);
    expect(r.ok).toBe(true);
    expect(r.investment?.type).toBe('guild');
  });

  it('预期回报落在 -10%~+30%；声望≥500 时负向有 20% 概率翻正', () => {
    // rng 序列：0.5(回报 0.1) → ...
    const normal = investInGuildFund(100, { silver: 500, reputation: 100, day: 1 }, seq(0.5));
    expect(normal.investment!.expectedReturn).toBeGreaterThanOrEqual(-0.1);
    expect(normal.investment!.expectedReturn).toBeLessThanOrEqual(0.3);
    // 声望≥500：expected=-0.2（rng 0.25 → -0.1+0.1=0），且 rng()<0.2 时翻正
    const boosted = investInGuildFund(100, { silver: 500, reputation: 600, day: 1 }, seq(0, 0.1));
    expect(boosted.investment!.expectedReturn).toBeGreaterThanOrEqual(0); // 0 → abs → 0
  });
});

describe('沈听澜合作（shen）', () => {
  it('需登场且好感≥40、≥200 两', () => {
    expect(investWithShen(200, { silver: 500, shenTinglanFavor: 39, day: 1 }, rng).ok).toBe(false);
    expect(investWithShen(199, { silver: 500, shenTinglanFavor: 40, day: 1 }, rng).ok).toBe(false);
    const r = investWithShen(200, { silver: 500, shenTinglanFavor: 40, day: 1 }, rng);
    expect(r.ok).toBe(true);
    expect(r.investment?.type).toBe('shen');
  });

  it('回报区间 -5%~+40%；好感≥80 → 下限 +5%', () => {
    const low = investWithShen(200, { silver: 500, shenTinglanFavor: 40, day: 1 }, seq(0));
    expect(low.investment!.expectedReturn).toBe(-0.05);
    const high = investWithShen(200, { silver: 500, shenTinglanFavor: 85, day: 1 }, seq(0));
    expect(high.investment!.expectedReturn).toBe(0.05); // 下限 5%
  });
});

describe('地下钱庄（underground）', () => {
  it('需谢七登场且好感≥30、≥50 两', () => {
    expect(investInUnderground(50, { silver: 500, xieQiFavor: 29, day: 1 }, rng).ok).toBe(false);
    expect(investInUnderground(49, { silver: 500, xieQiFavor: 30, day: 1 }, rng).ok).toBe(false);
    const r = investInUnderground(50, { silver: 500, xieQiFavor: 30, day: 1 }, rng);
    expect(r.ok).toBe(true);
  });

  it('回报区间 -30%~+60%；好感≥70 → 下限 -10%', () => {
    const low = investInUnderground(50, { silver: 500, xieQiFavor: 30, day: 1 }, seq(0));
    expect(low.investment!.expectedReturn).toBe(-0.3);
    const safer = investInUnderground(50, { silver: 500, xieQiFavor: 75, day: 1 }, seq(0));
    expect(safer.investment!.expectedReturn).toBe(-0.1);
  });
});

describe('到期结算（checkInvestmentMaturity）', () => {
  it('未到期不结算；到期返回结算结果', () => {
    const inv = makeInv({ type: 'guild', investDay: 1 });
    expect(checkInvestmentMaturity({ day: 30, investments: [inv] }, rng)).toHaveLength(0);
    const results = checkInvestmentMaturity({ day: 31, investments: [inv] }, rng);
    expect(results).toHaveLength(1);
    expect(results[0]!.gain).toBe(20); // 200 × 0.1
  });

  it('地下钱庄 40% 概率查封：本金全损（rng<0.4）', () => {
    const inv = makeInv({ type: 'underground', investDay: 1 });
    const results = checkInvestmentMaturity({ day: 16, investments: [inv] }, seq(0.1));
    expect(results[0]!.lost).toBe(true);
    expect(results[0]!.gain).toBe(-200);
  });

  it('沈听澜 30% 概率打击分店：回报翻倍 + dilemmaHit（rng<0.3）', () => {
    const inv = makeInv({ type: 'shen', investDay: 1, expectedReturn: 0.1 });
    const results = checkInvestmentMaturity({ day: 46, investments: [inv] }, seq(0.1));
    expect(results[0]!.dilemmaHit).toBe(true);
    expect(results[0]!.gain).toBe(40); // 200 × 0.1 × 2
  });
});
