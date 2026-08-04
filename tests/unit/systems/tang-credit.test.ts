/**
 * 信用系统单测（tang-credit · Step 5b 模块三）
 * 覆盖：gain 各 action、cost 各 action、锁定、5 档 tier、门槛校验、破产判定、锁释放。
 */
import { describe, expect, it } from 'vitest';
import {
  calculateCreditCost,
  calculateCreditGain,
  calculateCreditLock,
  checkCreditBankruptcy,
  checkCreditEligibility,
  getCreditTier,
  releaseCreditLock,
} from '@/systems/tang-credit';

const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

describe('calculateCreditGain · 增益', () => {
  it('完成任务 +10~30（rng=0 → 10；rng=0.99 → 30）', () => {
    expect(calculateCreditGain('task_complete', {}, seq(0))).toBe(10);
    expect(calculateCreditGain('task_complete', {}, seq(0.99))).toBe(30);
  });

  it('声望每 +100 → +5（声望 350 → 15；声望 100 → 5）', () => {
    expect(calculateCreditGain('reputation_gain', { reputation: 350, shenTinglanFavor: 0 })).toBe(15);
    expect(calculateCreditGain('reputation_gain', { reputation: 100, shenTinglanFavor: 0 })).toBe(5);
  });

  it('沈听澜好感每 +10 → +2（好感 25 → 4；好感 10 → 2）', () => {
    expect(calculateCreditGain('shen_favor', { reputation: 0, shenTinglanFavor: 25 })).toBe(4);
    expect(calculateCreditGain('shen_favor', { reputation: 0, shenTinglanFavor: 10 })).toBe(2);
  });

  it('按时还贷 +15 / 商会 +20 / 官单完成 +50', () => {
    expect(calculateCreditGain('loan_repaid', {})).toBe(15);
    expect(calculateCreditGain('guild_join', {})).toBe(20);
    expect(calculateCreditGain('official_order', {})).toBe(50);
  });
});

describe('calculateCreditCost / Lock · 消耗与锁定', () => {
  it('消耗：延迟缴税 -20 / 逾期 -50 / 投诉 -30 / 破产 -100', () => {
    expect(calculateCreditCost('tax_defer')).toBe(20);
    expect(calculateCreditCost('overdue')).toBe(50);
    expect(calculateCreditCost('complaint')).toBe(30);
    expect(calculateCreditCost('bankruptcy')).toBe(100);
  });

  it('锁定：赊购锁 50 / 官单锁 100（其余 0）', () => {
    expect(calculateCreditLock('credit_purchase')).toBe(50);
    expect(calculateCreditLock('official_order')).toBe(100);
    expect(calculateCreditLock('loan_repaid')).toBe(0);
  });
});

describe('门槛校验（checkCreditEligibility）', () => {
  it('赊购需信用≥500、官单需≥700、延迟缴税需≥300', () => {
    expect(checkCreditEligibility('credit_purchase', { credit: 500 }).ok).toBe(true);
    expect(checkCreditEligibility('credit_purchase', { credit: 499 }).ok).toBe(false);
    expect(checkCreditEligibility('official_order', { credit: 700 }).ok).toBe(true);
    expect(checkCreditEligibility('official_order', { credit: 699 }).ok).toBe(false);
    expect(checkCreditEligibility('tax_defer', { credit: 300 }).ok).toBe(true);
    expect(checkCreditEligibility('tax_defer', { credit: 299 }).ok).toBe(false);
  });
});

describe('信用档位（getCreditTier）', () => {
  it('5 档边界：0-199 一般 / 200-499 良好 / 500-699 优秀 / 700-899 极高 / 900-1000 顶级', () => {
    expect(getCreditTier(0).name).toBe('一般');
    expect(getCreditTier(199).name).toBe('一般');
    expect(getCreditTier(200).name).toBe('良好');
    expect(getCreditTier(499).name).toBe('良好');
    expect(getCreditTier(500).name).toBe('优秀');
    expect(getCreditTier(699).name).toBe('优秀');
    expect(getCreditTier(700).name).toBe('极高');
    expect(getCreditTier(899).name).toBe('极高');
    expect(getCreditTier(900).name).toBe('顶级');
    expect(getCreditTier(1000).name).toBe('顶级');
  });

  it('越界防御：负值归一般、>1000 归顶级', () => {
    expect(getCreditTier(-5).name).toBe('一般');
    expect(getCreditTier(1200).name).toBe('顶级');
  });
});

describe('信用破产与锁释放', () => {
  it('checkCreditBankruptcy：credit<0 触发（0 不触发）', () => {
    expect(checkCreditBankruptcy(-1)).toBe(true);
    expect(checkCreditBankruptcy(0)).toBe(false);
    expect(checkCreditBankruptcy(50)).toBe(false);
  });

  it('releaseCreditLock：有锁释放并标记，无锁仅清零', () => {
    expect(releaseCreditLock({ creditLocked: 50 })).toEqual({ creditLocked: 0, released: true });
    expect(releaseCreditLock({ creditLocked: 0 })).toEqual({ creditLocked: 0, released: false });
  });
});
