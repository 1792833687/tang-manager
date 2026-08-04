/**
 * 负债拓展单测（内容深化 TANG-CONT-D 模块八）
 * 覆盖：循环借贷（额度×1.5/利率+1%/去重）、赊账进货（信用门槛/上限/到期日/逾期月息）、
 *      人情债（三选项 + 拒绝）、被栽赃（触发/三选项）。
 */
import { describe, expect, it } from 'vitest';
import {
  accrueTradeCreditInterest,
  canTakeTradeCredit,
  checkFramed,
  checkShenDebtMoment,
  offerRevolvingLoan,
  resolveFramed,
  resolveShenDebt,
  takeTradeCredit,
} from '@/systems/tang-debt-extension';
import type { BankLoan } from '@/types/tang-manager';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

function paidMortgage(overrides: Partial<BankLoan> = {}): BankLoan {
  return {
    id: 'loan-1',
    amount: 200,
    loanDay: 1,
    interestRate: 0.02,
    collateral: 'shop',
    status: 'paid',
    type: 'mortgage',
    overdueMonths: 0,
    ...overrides,
  };
}

describe('循环借贷（还清抵押贷款后）', () => {
  it('还清抵押贷款 → offer 额度 ×1.5、利率 2%+1%=3%', () => {
    const offer = offerRevolvingLoan({ lastPaidMortgage: paidMortgage(), revolvingLoanOffered: false });
    expect(offer.offered).toBe(true);
    expect(offer.amount).toBe(300); // 200 × 1.5
    expect(offer.interestRate).toBe(0.03);
    expect(offer.message).toContain('300');
  });

  it('无已还清抵押贷款或已提供过 offer → 不再 offer', () => {
    expect(offerRevolvingLoan({ lastPaidMortgage: null, revolvingLoanOffered: false }).offered).toBe(false);
    expect(offerRevolvingLoan({ lastPaidMortgage: { ...paidMortgage(), type: 'usury' }, revolvingLoanOffered: false }).offered).toBe(false);
    expect(offerRevolvingLoan({ lastPaidMortgage: paidMortgage(), revolvingLoanOffered: true }).offered).toBe(false);
  });
});

describe('商业债务（赊账进货）', () => {
  it('信用 <300 不可赊；信用≥300 上限 = 信用×2', () => {
    expect(canTakeTradeCredit({ credit: 299, tradeCredit: 0 }).ok).toBe(false);
    const gate = canTakeTradeCredit({ credit: 500, tradeCredit: 0 });
    expect(gate.ok).toBe(true);
    expect(gate.limit).toBe(1000); // 500 × 2
  });

  it('赊账总额 >信用×3 无法再赊', () => {
    const gate = canTakeTradeCredit({ credit: 500, tradeCredit: 1500 });
    expect(gate.ok).toBe(false);
    expect(gate.reason).toContain('信用×3');
  });

  it('takeTradeCredit：到期日 = day+30；超单笔上限拒绝', () => {
    const r = takeTradeCredit(300, { credit: 500, tradeCredit: 0, creditDueDay: 0, day: 40 });
    expect(r.ok).toBe(true);
    expect(r.tradeCredit).toBe(300);
    expect(r.creditDueDay).toBe(70); // 40 + 30
    const over = takeTradeCredit(2000, { credit: 500, tradeCredit: 0, creditDueDay: 0, day: 40 });
    expect(over.ok).toBe(false);
  });

  it('accrueTradeCreditInterest：逾期月息 5% 可叠加', () => {
    const res = accrueTradeCreditInterest({ credit: 500, tradeCredit: 100, creditDueDay: 10, day: 100 });
    // 逾期 = floor((100-10)/30)+1 = 4 月 → 100×5%×4 = 20
    expect(res.overdueMonths).toBe(4);
    expect(res.interest).toBe(20);
    expect(res.tradeCredit).toBe(120);
    // 未逾期不计息
    expect(accrueTradeCreditInterest({ credit: 500, tradeCredit: 100, creditDueDay: 200, day: 100 }).interest).toBe(0);
  });
});

describe('人情债（沈听澜）', () => {
  it('shenDebt=true 时触发时机；false 不触发', () => {
    expect(checkShenDebtMoment({ day: 50, silver: 500, reputation: 200, shenTinglanFavor: 50, xieQiFavor: 0, shenDebt: false }).triggered).toBe(false);
    expect(checkShenDebtMoment({ day: 50, silver: 500, reputation: 200, shenTinglanFavor: 50, xieQiFavor: 0, shenDebt: true }).triggered).toBe(true);
  });

  it('让出一笔生意：人情了结、沈 +10、银 -50', () => {
    const r = resolveShenDebt('concede', { day: 50, silver: 500, reputation: 200, shenTinglanFavor: 50, xieQiFavor: 0, shenDebt: true });
    expect(r.changes.shenDebt).toBe(false);
    expect(r.changes.shenTinglanFavor).toBe(60);
    expect(r.changes.silver).toBe(450);
  });

  it('中断谢七合作：谢七好感 -30', () => {
    const r = resolveShenDebt('break_xie', { day: 50, silver: 500, reputation: 200, shenTinglanFavor: 50, xieQiFavor: 60, shenDebt: true });
    expect(r.changes.shenDebt).toBe(false);
    expect(r.changes.xieQiFavor).toBe(30);
  });

  it('拒绝：人情未了、沈 -30 + 声望 -50', () => {
    const r = resolveShenDebt('refuse', { day: 50, silver: 500, reputation: 200, shenTinglanFavor: 50, xieQiFavor: 0, shenDebt: true });
    expect(r.changes.shenDebt).toBe(true);
    expect(r.changes.shenTinglanFavor).toBe(20);
    expect(r.changes.reputation).toBe(150);
  });
});

describe('被栽赃（评分 ≥3.0 概率触发）', () => {
  it('评分 <3.0 不触发；评分≥3.0 + rng<3% 触发', () => {
    expect(checkFramed({ day: 30, score: 2.5, silver: 500, reputation: 200, energy: 100, hasClue: true }, () => 0.01).triggered).toBe(false);
    expect(checkFramed({ day: 30, score: 3.5, silver: 500, reputation: 200, energy: 100, hasClue: true }, () => 0.99).triggered).toBe(false);
    expect(checkFramed({ day: 30, score: 3.5, silver: 500, reputation: 200, energy: 100, hasClue: true }, () => 0.01).triggered).toBe(true);
  });

  it('A 找证据：需线索、精力 -20、70% 成功', () => {
    const ok = resolveFramed('evidence', { day: 30, score: 3.5, silver: 500, reputation: 200, energy: 100, hasClue: true, fuyinFavor: 20 }, seq(0.1));
    expect(ok.ok).toBe(true);
    expect(ok.changes.energy).toBe(80);
    expect(ok.changes.reputation).toBe(210);
    // 无线索 → 失败
    const noClue = resolveFramed('evidence', { day: 30, score: 3.5, silver: 500, reputation: 200, energy: 100, hasClue: false, fuyinFavor: 20 }, seq(0.1));
    expect(noClue.ok).toBe(false);
  });

  it('B 花钱摆平：银 -200、京兆 +10', () => {
    const r = resolveFramed('payoff', { day: 30, score: 3.5, silver: 500, reputation: 200, energy: 100, hasClue: false, fuyinFavor: 20 });
    expect(r.changes.silver).toBe(300);
    expect(r.changes.fuyinFavor).toBe(30);
  });

  it('C 死不认账：京兆 -20；rng<0.5 强制执行扣款', () => {
    const forced = resolveFramed('deny', { day: 30, score: 3.5, silver: 500, reputation: 200, energy: 100, hasClue: false, fuyinFavor: 20 }, seq(0.1, 0.1));
    expect(forced.changes.fuyinFavor).toBe(0);
    expect(forced.changes.silver).toBeLessThan(500); // 被扣款
  });
});
