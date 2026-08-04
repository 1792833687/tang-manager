/**
 * 钱庄系统单测（tang-bank · Step 5b 模块一 多货币 + 模块二 钱庄）
 * 覆盖：兑换手续费/不足错误、存款计息 30 天、取款、抵押借贷、还款、逾期没收、高利贷。
 */
import { describe, expect, it } from 'vitest';
import {
  accrueDepositInterests,
  checkLoanOverdue,
  depositSilver,
  exchangeFeiqianToSilver,
  exchangeSilverToFeiqian,
  mortgageLoan,
  repayLoan,
  usuryLoan,
  withdrawDeposit,
} from '@/systems/tang-bank';
import type { BankDeposit, BankLoan } from '@/types/tang-manager';

const rng = (): number => 0.5;

function makeDeposit(overrides: Partial<BankDeposit> = {}): BankDeposit {
  return {
    id: 'd1',
    amount: 100,
    depositDay: 1,
    interestRate: 0.005,
    type: 'deposit',
    interestAccrued: 0,
    ...overrides,
  };
}

function makeLoan(overrides: Partial<BankLoan> = {}): BankLoan {
  return {
    id: 'l1',
    amount: 200,
    loanDay: 1,
    interestRate: 0.02,
    collateral: 'shop',
    status: 'active',
    type: 'mortgage',
    overdueMonths: 0,
    ...overrides,
  };
}

describe('兑换（模块一）', () => {
  it('现银→飞钱：5% 手续费，到账 = 金额 ×0.95', () => {
    const r = exchangeSilverToFeiqian(100, { silver: 100 });
    expect(r.ok).toBe(true);
    expect(r.fee).toBe(5);
    expect(r.actualAmount).toBe(95);
  });

  it('现银不足 → 错误结果（不进账）', () => {
    const r = exchangeSilverToFeiqian(100, { silver: 99 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('现银不足');
  });

  it('飞钱→现银：5% 手续费；飞钱不足 → 错误结果', () => {
    const ok = exchangeFeiqianToSilver(200, { feiqian: 200 });
    expect(ok.ok).toBe(true);
    expect(ok.actualAmount).toBe(190);
    const fail = exchangeFeiqianToSilver(200, { feiqian: 50 });
    expect(fail.ok).toBe(false);
    expect(fail.reason).toContain('飞钱不足');
  });
});

describe('存款与取款（模块二）', () => {
  it('存款创建存款单；现银不足 → 错误', () => {
    const r = depositSilver(80, { silver: 100, day: 1, depositRateBoostDays: 0 }, rng);
    expect(r.ok).toBe(true);
    expect(r.deposit?.amount).toBe(80);
    expect(r.deposit?.interestRate).toBe(0.005);
    expect(depositSilver(80, { silver: 50, day: 1, depositRateBoostDays: 0 }, rng).ok).toBe(false);
  });

  it('钱庄优惠期间利率翻倍（0.005 → 0.01）', () => {
    const r = depositSilver(100, { silver: 100, day: 1, depositRateBoostDays: 7 }, rng);
    expect(r.deposit?.interestRate).toBe(0.01);
  });

  it('未满 30 天取出不计息；满 1 个月计息 0.5%', () => {
    const d = makeDeposit({ depositDay: 1 });
    // day 30：floor(29/30)=0 → 无息
    expect(withdrawDeposit(d, 30).interest).toBe(0);
    expect(withdrawDeposit(d, 30).total).toBe(100);
    // day 31：floor(30/30)=1 → 1 个月息 0.5
    const m1 = withdrawDeposit(d, 31);
    expect(m1.interest).toBe(0.5);
    expect(m1.total).toBe(100.5);
    // day 61：floor(60/30)=2 → 2 个月息 1.0
    expect(withdrawDeposit(d, 61).interest).toBe(1);
  });

  it('月初计息 accrueDepositInterests 幂等重算', () => {
    const deposits = [makeDeposit({ depositDay: 1 })];
    const acc1 = accrueDepositInterests({ deposits, day: 61 });
    expect(acc1[0]!.interestAccrued).toBe(1);
    const acc2 = accrueDepositInterests({ deposits: acc1, day: 61 });
    expect(acc2[0]!.interestAccrued).toBe(1); // 不重复累计
  });
});

describe('抵押借贷与还款（模块二）', () => {
  it('抵押借贷：月息 2%、抵押物记录、状态 active', () => {
    const r = mortgageLoan(300, 'shop', { day: 5 }, rng);
    expect(r.ok).toBe(true);
    expect(r.loan?.amount).toBe(300);
    expect(r.loan?.interestRate).toBe(0.02);
    expect(r.loan?.collateral).toBe('shop');
    expect(r.loan?.status).toBe('active');
  });

  it('还款 = 本金 + 当月利息；现银不足不可部分还款', () => {
    const loan = makeLoan({ amount: 200, interestRate: 0.02 });
    const fail = repayLoan(loan, 203);
    expect(fail.ok).toBe(false);
    expect(fail.total).toBe(204); // 200 + 4
    const ok = repayLoan(loan, 204);
    expect(ok.ok).toBe(true);
    expect(ok.status).toBe('paid');
  });

  it('月初检查：银两足 → 自动扣息、overdueMonths 归零', () => {
    const loans = [makeLoan({ amount: 200, interestRate: 0.02, overdueMonths: 1 })];
    const r = checkLoanOverdue({ loans, silver: 100 });
    expect(r.interestPaid).toBe(4);
    expect(r.loans[0]!.overdueMonths).toBe(0);
    expect(r.events).toHaveLength(0);
  });

  it('月初检查：银两不足 → 逾期递增；第 3 个月触发没收（seize）', () => {
    let loans = [makeLoan()];
    // 第 1、2 个月
    loans = checkLoanOverdue({ loans, silver: 0 }).loans;
    expect(loans[0]!.overdueMonths).toBe(1);
    const e2 = checkLoanOverdue({ loans, silver: 0 });
    expect(e2.loans[0]!.overdueMonths).toBe(2);
    expect(e2.events[0]!.kind).toBe('overdue_2');
    // 第 3 个月 → 没收
    const e3 = checkLoanOverdue({ loans: e2.loans, silver: 0 });
    expect(e3.events[0]!.kind).toBe('seize');
    expect(e3.loans[0]!.overdueMonths).toBe(3);
  });

  it('多笔利息不会叠加超出可用银两（逐笔按剩余银两判定）', () => {
    const loans = [
      makeLoan({ id: 'a', amount: 200, interestRate: 0.02 }),
      makeLoan({ id: 'b', amount: 200, interestRate: 0.02 }),
    ];
    // 银两只够付一笔利息（4+4=8 > 6）
    const r = checkLoanOverdue({ loans, silver: 6 });
    expect(r.interestPaid).toBe(4); // 只扣一笔
    expect(r.events).toHaveLength(1);
  });
});

describe('高利贷（模块二/三）', () => {
  it('需谢七登场（xieQiFavor>0）；月息 10%', () => {
    expect(usuryLoan(100, { day: 1, xieQiFavor: 0 }, rng).ok).toBe(false);
    const r = usuryLoan(100, { day: 1, xieQiFavor: 30 }, rng);
    expect(r.ok).toBe(true);
    expect(r.loan?.interestRate).toBe(0.1);
    expect(r.loan?.type).toBe('usury');
  });

  it('高利贷逾期逐级恶化：1 月 usury_1 / 2 月 usury_2 / 3 月 usury_3', () => {
    let loans = [makeLoan({ type: 'usury', interestRate: 0.1, collateral: 'none' })];
    const e1 = checkLoanOverdue({ loans, silver: 0 });
    expect(e1.events[0]!.kind).toBe('usury_1');
    const e2 = checkLoanOverdue({ loans: e1.loans, silver: 0 });
    expect(e2.events[0]!.kind).toBe('usury_2');
    const e3 = checkLoanOverdue({ loans: e2.loans, silver: 0 });
    expect(e3.events[0]!.kind).toBe('usury_3');
  });
});
