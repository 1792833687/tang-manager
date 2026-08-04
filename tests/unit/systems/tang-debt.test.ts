/**
 * 负债整合单测（tang-debt · Step 5b 模块六）
 * 覆盖：旧债还款/还清标记、现银不足不可部分还款、bank/usury 目标路由。
 */
import { describe, expect, it } from 'vitest';
import { repayLegacyDebt, unifiedRepayDebt } from '@/systems/tang-debt';
import type { BankLoan } from '@/types/tang-manager';

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

describe('repayLegacyDebt', () => {
  it('按 min(amount, debt) 还旧债；不足 200 不标记还清', () => {
    const r = repayLegacyDebt(50, { silver: 100, legacyDebt: 200 });
    expect(r.ok).toBe(true);
    expect(r.paid).toBe(50);
    expect(r.legacyCleared).toBe(false);
  });

  it('还清旧债 → legacyCleared=true（store 据此触发谢七登场）', () => {
    const r = repayLegacyDebt(200, { silver: 300, legacyDebt: 200 });
    expect(r.ok).toBe(true);
    expect(r.paid).toBe(200);
    expect(r.legacyCleared).toBe(true);
  });

  it('现银不足不可部分还款', () => {
    const r = repayLegacyDebt(100, { silver: 50, legacyDebt: 200 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('现银不足');
  });
});

describe('unifiedRepayDebt', () => {
  it('legacy 路由到旧债还款', () => {
    const r = unifiedRepayDebt(60, 'legacy', { silver: 100, legacyDebt: 100, loans: [] });
    expect(r.ok).toBe(true);
    expect(r.paid).toBe(60);
  });

  it('bank 按 loanId 还款（本金 + 当月利息）', () => {
    const loan = makeLoan();
    const r = unifiedRepayDebt(204, 'bank', { silver: 300, legacyDebt: 0, loans: [loan] }, 'l1');
    expect(r.ok).toBe(true);
    expect(r.paid).toBe(204);
  });

  it('usury 默认取未还高利贷；银两不足拒绝', () => {
    const usury = makeLoan({ id: 'u1', type: 'usury', interestRate: 0.1, collateral: 'none' });
    const fail = unifiedRepayDebt(220, 'usury', { silver: 200, legacyDebt: 0, loans: [usury] });
    expect(fail.ok).toBe(false);
    const ok = unifiedRepayDebt(220, 'usury', { silver: 300, legacyDebt: 0, loans: [usury] });
    expect(ok.ok).toBe(true);
    expect(ok.paid).toBe(220); // 200 + 20
  });
});
