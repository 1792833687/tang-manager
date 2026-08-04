/**
 * 《我在唐朝当掌柜》钱庄系统（Step 5b 模块一 多货币 + 模块二 钱庄）
 * 纯函数（可测）：
 * - 兑换：exchangeSilverToFeiqian / exchangeFeiqianToSilver（5% 手续费，到账 ×0.95）
 * - 跨店：interShopTransfer（飞钱秒到账 3% 费；现银 1-3 天 + 10% 被劫；shopCount<2 由 store 拦截）
 * - 存款：depositSilver（月息 0.5%，钱庄优惠翻倍；未满 30 天取出不计息）/ accrueDepositInterests（月初计息）
 *   / withdrawDeposit（本金 + 已计利息）
 * - 抵押借贷：mortgageLoan（月息 2%，月初自动扣息；逾期 3 个月没收：shop→seized、deed→失地契、goods→库存清零）
 * - 高利贷：usuryLoan（需谢七登场；月息 10%；逾期 1/2/3 月逐级恶化；还款时好感+5 由 store 应用）
 * - 还款：repayLoan（本金 + 当月利息；现银不足不可部分还款）
 * - 月初检查：checkLoanOverdue（自动扣息 / 逾期标记 / 触发没收事件列表）
 *
 * 铁律：数值裁决前端纯函数；AI 只叙事。
 */
import type {
  BankDeposit,
  BankLoan,
  DepositResult,
  ExchangeResult,
  LoanApplyResult,
  LoanRepayResult,
  OverdueEvent,
  TangGameState,
  TransferResult,
  WithdrawResult,
} from '@/types/tang-manager';

export const EXCHANGE_FEE = 0.05; // 兑换手续费 5%
export const FEIQIAN_TRANSFER_FEE = 0.03; // 飞钱跨店手续费 3%
export const DEPOSIT_RATE = 0.005; // 存款月息 0.5%
export const MORTGAGE_RATE = 0.02; // 抵押借贷月息 2%
export const USURY_RATE = 0.1; // 高利贷月息 10%

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function id(prefix: string, rng: () => number): string {
  return `${prefix}-${Math.floor(rng() * 1e9)}`;
}

// ============================================================
// 模块一：多货币账户
// ============================================================

/** 现银 → 飞钱（5% 手续费；不足返回错误结果） */
export function exchangeSilverToFeiqian(
  amount: number,
  state: Pick<TangGameState, 'silver'>
): ExchangeResult {
  if (amount <= 0) {
    return { ok: false, actualAmount: 0, fee: 0, reason: '金额须为正' };
  }
  if ((state.silver ?? 0) < amount) {
    return { ok: false, actualAmount: 0, fee: 0, reason: '现银不足' };
  }
  const fee = round2(amount * EXCHANGE_FEE);
  return { ok: true, actualAmount: round2(amount - fee), fee };
}

/** 飞钱 → 现银（5% 手续费；不足返回错误结果） */
export function exchangeFeiqianToSilver(
  amount: number,
  state: Pick<TangGameState, 'feiqian'>
): ExchangeResult {
  if (amount <= 0) {
    return { ok: false, actualAmount: 0, fee: 0, reason: '金额须为正' };
  }
  if ((state.feiqian ?? 0) < amount) {
    return { ok: false, actualAmount: 0, fee: 0, reason: '飞钱不足' };
  }
  const fee = round2(amount * EXCHANGE_FEE);
  return { ok: true, actualAmount: round2(amount - fee), fee };
}

/**
 * 跨店调拨（占位说明：现银的 1-3 天延迟入账尚未实现——当前立即扣款，arrivalDays 仅作展示；
 * 10% 被劫随机事件已实现：被劫则全额损失）。
 */
export function interShopTransfer(
  amount: number,
  fromShop: string,
  toShop: string,
  useFeiqian: boolean,
  state: Pick<TangGameState, 'silver' | 'feiqian' | 'shopCount'>,
  rng: () => number = Math.random
): TransferResult {
  if (amount <= 0) {
    return {
      ok: false,
      actualAmount: 0,
      fee: 0,
      usedFeiqian: useFeiqian,
      arrivalDays: 0,
      robbed: false,
      reason: '金额须为正',
    };
  }
  if ((state.shopCount ?? 1) < 2) {
    return {
      ok: false,
      actualAmount: 0,
      fee: 0,
      usedFeiqian: useFeiqian,
      arrivalDays: 0,
      robbed: false,
      reason: '尚无分店，无法调拨',
    };
  }
  if (useFeiqian) {
    if ((state.feiqian ?? 0) < amount) {
      return {
        ok: false,
        actualAmount: 0,
        fee: 0,
        usedFeiqian: true,
        arrivalDays: 0,
        robbed: false,
        reason: '飞钱不足',
      };
    }
    const fee = round2(amount * FEIQIAN_TRANSFER_FEE);
    return {
      ok: true,
      actualAmount: round2(amount - fee),
      fee,
      usedFeiqian: true,
      arrivalDays: 0,
      robbed: false,
      note: `飞钱秒到账（${fromShop} → ${toShop}）。`,
    };
  }
  if ((state.silver ?? 0) < amount) {
    return {
      ok: false,
      actualAmount: 0,
      fee: 0,
      usedFeiqian: false,
      arrivalDays: 0,
      robbed: false,
      reason: '现银不足',
    };
  }
  const robbed = rng() < 0.1;
  const arrivalDays = 1 + Math.floor(rng() * 3); // 1-3 天
  return {
    ok: true,
    actualAmount: robbed ? 0 : amount,
    fee: 0,
    usedFeiqian: false,
    arrivalDays,
    robbed,
    note: robbed
      ? '押送现银途中遭劫，血本无归。'
      : `现银 ${arrivalDays} 天到账（占位：当前立即扣款）。`,
  };
}

// ============================================================
// 模块二：钱庄存款 / 贷款
// ============================================================

/** 存款（月息 0.5%；钱庄优惠 depositRateBoostDays>0 时翻倍） */
export function depositSilver(
  amount: number,
  state: Pick<TangGameState, 'silver' | 'day' | 'depositRateBoostDays'>,
  rng: () => number = Math.random
): DepositResult {
  if (amount <= 0) {
    return { ok: false, deposit: null, reason: '金额须为正' };
  }
  if ((state.silver ?? 0) < amount) {
    return { ok: false, deposit: null, reason: '现银不足' };
  }
  const boosted = (state.depositRateBoostDays ?? 0) > 0;
  const rate = boosted ? DEPOSIT_RATE * 2 : DEPOSIT_RATE;
  const deposit: BankDeposit = {
    id: id('dep', rng),
    amount,
    depositDay: state.day ?? 1,
    interestRate: rate,
    type: 'deposit',
    interestAccrued: 0,
  };
  return {
    ok: true,
    deposit,
    reason: boosted ? '钱庄优惠期间，利率翻倍。' : undefined,
  };
}

/** 取款（本金 + 已计利息；未满 30 天不计息） */
export function withdrawDeposit(deposit: BankDeposit, day: number): WithdrawResult {
  const months = Math.floor((day - deposit.depositDay) / 30);
  const interest = months >= 1 ? round2(deposit.amount * deposit.interestRate * months) : 0;
  return {
    ok: true,
    principal: deposit.amount,
    interest,
    total: round2(deposit.amount + interest),
  };
}

/** 月初计息：重算各存款已计利息（幂等） */
export function accrueDepositInterests(
  state: Pick<TangGameState, 'deposits' | 'day'>
): BankDeposit[] {
  const day = state.day ?? 1;
  return (state.deposits ?? []).map((d) => {
    const months = Math.floor((day - d.depositDay) / 30);
    const interest = months >= 1 ? round2(d.amount * d.interestRate * months) : 0;
    return { ...d, interestAccrued: interest };
  });
}

/** 抵押借贷（月息 2%；抵押物 shop/deed/goods） */
export function mortgageLoan(
  amount: number,
  collateral: 'shop' | 'deed' | 'goods',
  state: Pick<TangGameState, 'day'>,
  rng: () => number = Math.random
): LoanApplyResult {
  if (amount <= 0) {
    return { ok: false, loan: null, reason: '金额须为正' };
  }
  const loan: BankLoan = {
    id: id('loan', rng),
    amount,
    loanDay: state.day ?? 1,
    interestRate: MORTGAGE_RATE,
    collateral,
    status: 'active',
    type: 'mortgage',
    overdueMonths: 0,
  };
  return { ok: true, loan };
}

/** 高利贷（需谢七登场 xieQiFavor>0；月息 10%） */
export function usuryLoan(
  amount: number,
  state: Pick<TangGameState, 'day' | 'xieQiFavor'>,
  rng: () => number = Math.random
): LoanApplyResult {
  if ((state.xieQiFavor ?? 0) <= 0) {
    return { ok: false, loan: null, reason: '需谢七登场（好感>0）' };
  }
  if (amount <= 0) {
    return { ok: false, loan: null, reason: '金额须为正' };
  }
  const loan: BankLoan = {
    id: id('usury', rng),
    amount,
    loanDay: state.day ?? 1,
    interestRate: USURY_RATE,
    collateral: 'none',
    status: 'active',
    type: 'usury',
    overdueMonths: 0,
  };
  return { ok: true, loan };
}

/** 还款（本金 + 当月利息；现银不足不可部分还款） */
export function repayLoan(loan: BankLoan, silverAvailable: number): LoanRepayResult {
  const interest = round2(loan.amount * loan.interestRate);
  const total = round2(loan.amount + interest);
  if (silverAvailable < total) {
    return { ok: false, principal: loan.amount, interest, total, reason: '现银不足，不可部分还款' };
  }
  return { ok: true, principal: loan.amount, interest, total, status: 'paid' };
}

/** 月初检查贷款（纯函数）：自动扣息（银两足）/ 逾期标记 / 触发没收/追债事件 */
export interface OverdueCheckResult {
  events: OverdueEvent[];
  /** 更新后的贷款列表（扣息归零或逾期递增） */
  loans: BankLoan[];
  /** 月初自动扣息总额（store 从 silver 扣除） */
  interestPaid: number;
}

export function checkLoanOverdue(state: Pick<TangGameState, 'loans' | 'silver'>): OverdueCheckResult {
  const events: OverdueEvent[] = [];
  let interestPaid = 0;
  // 逐笔按「剩余可用银两」判定，避免多笔利息叠加超出 silver；paid 关闭的贷款跳过，overdue 继续逐月递增
  let available = state.silver ?? 0;
  const loans = (state.loans ?? []).map((loan): BankLoan => {
    if (loan.status === 'paid') {
      return loan;
    }
    const interest = round2(loan.amount * loan.interestRate);
    if (available >= interest) {
      // 月初自动扣息（store 应用 interestPaid 扣款）
      available -= interest;
      interestPaid += interest;
      return { ...loan, overdueMonths: 0 };
    }
    const overdue = (loan.overdueMonths ?? 0) + 1;
    const next: BankLoan = { ...loan, status: 'overdue', overdueMonths: overdue };
    if (loan.type === 'mortgage') {
      if (overdue >= 3) {
        events.push({
          loanId: loan.id,
          type: 'mortgage',
          kind: 'seize',
          note: '抵押逾期三月，钱庄上门没收抵押物。',
        });
        return { ...next, status: 'paid' as const }; // 没收后结清，不再处理
      }
      events.push({
        loanId: loan.id,
        type: 'mortgage',
        kind: `overdue_${overdue}` as OverdueEvent['kind'],
        note: `抵押逾期 ${overdue} 月，钱庄派人催讨。`,
      });
    } else {
      if (overdue >= 3) {
        events.push({ loanId: loan.id, type: 'usury', kind: 'usury_3', note: '高利贷逾期三月，官府查封铺面。' });
        return { ...next, status: 'paid' as const }; // 查封后结清，不再处理
      }
      if (overdue === 2) {
        events.push({ loanId: loan.id, type: 'usury', kind: 'usury_2', note: '高利贷逾期二月，赌场设局逼债。' });
      } else {
        events.push({ loanId: loan.id, type: 'usury', kind: 'usury_1', note: '高利贷逾期一月，谢七不悦。' });
      }
    }
    return next;
  });
  return { events, loans, interestPaid: round2(interestPaid) };
}
