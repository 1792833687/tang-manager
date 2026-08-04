/**
 * 《我在唐朝当掌柜》负债整合（Step 5b 模块六）
 * 纯函数（可测）：
 * - repayLegacyDebt(amount, state)：还旧债（原 debt）；还清 → legacyCleared=true（store 触发谢七登场）
 * - unifiedRepayDebt(amount, target, state, loanId?)：统一还款入口——legacy 还旧债 / bank|usury 按 loanId
 *   或默认取对应类型未还贷款；现银不足不可部分还款。
 *
 * 说明：bank/usury 的具体利息计算复用 tang-bank.repayLoan；本文件负责「选目标 + 现银校验 + 结果契约」。
 */
import type { TangGameState, UnifiedRepayResult } from '@/types/tang-manager';

/** 还旧债（原 debt → legacyDebt）；还清标记 legacyCleared（谢七登场条件复用 xie-qi-debt 事件） */
export function repayLegacyDebt(
  amount: number,
  state: Pick<TangGameState, 'silver' | 'legacyDebt'>
): UnifiedRepayResult {
  if (amount <= 0) {
    return { ok: false, paid: 0, target: 'legacy', reason: '金额须为正' };
  }
  const debt = state.legacyDebt ?? 0;
  if (debt <= 0) {
    return { ok: false, paid: 0, target: 'legacy', reason: '旧债已还清' };
  }
  if ((state.silver ?? 0) < amount) {
    return { ok: false, paid: 0, target: 'legacy', reason: '现银不足，不可部分还款' };
  }
  const paid = Math.min(amount, debt);
  return { ok: true, paid, target: 'legacy', legacyCleared: debt - paid <= 0 };
}

/**
 * 统一还款入口（纯函数）。bank/usury 目标通过 loanId 或默认取未还贷款；
 * 利息按 tang-bank.repayLoan 口径（本金 + 当月利息），amount 参数对贷款仅作「必须 ≥ 应付总额」校验。
 */
export function unifiedRepayDebt(
  amount: number,
  target: 'legacy' | 'bank' | 'usury',
  state: Pick<TangGameState, 'silver' | 'legacyDebt' | 'loans'>,
  loanId?: string
): UnifiedRepayResult {
  if (target === 'legacy') {
    return repayLegacyDebt(amount, state);
  }
  const loans = state.loans ?? [];
  const type = target === 'usury' ? 'usury' : 'mortgage';
  const loan = loanId
    ? loans.find((l) => l.id === loanId && l.status !== 'paid')
    : loans.find((l) => l.type === type && l.status !== 'paid');
  if (!loan) {
    return { ok: false, paid: 0, target, reason: '未找到对应贷款' };
  }
  const interest = Math.round(loan.amount * loan.interestRate * 100) / 100;
  const total = loan.amount + interest;
  if ((state.silver ?? 0) < total || amount < total) {
    return { ok: false, paid: 0, target, reason: '现银不足，不可部分还款' };
  }
  return { ok: true, paid: total, target };
}
