/**
 * 《我在唐朝当掌柜》信用系统（Step 5b 模块三）
 * 纯函数（可测）：
 * - calculateCreditGain(action, state, rng?)：信用增益（完成任务/声望/好感/还贷/商会/官单）
 * - calculateCreditCost(action)：信用消耗（延迟缴税/逾期/投诉/破产）
 * - calculateCreditLock(action)：信用锁定（赊购 50 / 官单 100；还款后释放）
 * - checkCreditEligibility(action, state)：门槛校验（赊购≥500 / 官单≥700 / 延迟缴税≥300）
 * - getCreditTier(credit)：5 档（0-199 一般 / 200-499 良好 / 500-699 优秀 / 700-899 极高 / 900-1000 顶级）
 * - checkCreditBankruptcy(credit)：credit<0 → 供应商现金交易/官府盘查翻倍/30 天恢复
 *   （store 用 creditBankruptDays 追踪恢复天数，注释说明）
 * - releaseCreditLock(state)：还款后释放锁定
 *
 * 铁律：信用只由本系统裁决；AI 不参与数值。
 */
import type { CreditTier, TangGameState } from '@/types/tang-manager';

/** 信用变动动作枚举（用户规格 3.x 逐条） */
export type CreditAction =
  | 'task_complete' // 完成任务 +10~30
  | 'reputation_gain' // 声望每+100 → +5
  | 'shen_favor' // 沈听澜好感每+10 → +2
  | 'loan_repaid' // 按时还贷 +15
  | 'guild_join' // 加入商会 +20
  | 'official_order' // 官单完成 +50
  | 'credit_purchase' // 赊购（信用≥500，锁 50）
  | 'tax_defer' // 延迟缴税（≥300，-20）
  | 'overdue' // 逾期 -50
  | 'complaint' // 投诉 -30
  | 'bankruptcy'; // 破产 -100

/** 信用 5 档（用户规格：0-199 一般 / 200-499 良好 / 500-699 优秀 / 700-899 极高 / 900-1000 顶级） */
export const CREDIT_TIERS: readonly CreditTier[] = [
  { id: 'general', name: '一般', min: 0, max: 199, privileges: ['无特殊特权，现银交易为主'] },
  { id: 'good', name: '良好', min: 200, max: 499, privileges: ['可小额赊购（额度 50 两）'] },
  { id: 'excellent', name: '优秀', min: 500, max: 699, privileges: ['可赊购进货（锁定信用 50）', '商会往来便利'] },
  { id: 'very_high', name: '极高', min: 700, max: 899, privileges: ['可承接官单（锁定信用 100）', '账期灵活'] },
  { id: 'top', name: '顶级', min: 900, max: 1000, privileges: ['官单优先承接', '跨店调拨免手续费', '钱庄利率优惠'] },
];

/** 按信用值取档位（越界防御：<0 归一般，>1000 归顶级） */
export function getCreditTier(credit: number): CreditTier {
  for (const t of CREDIT_TIERS) {
    if (credit >= t.min && credit <= t.max) {
      return t;
    }
  }
  return credit < CREDIT_TIERS[0]!.min ? CREDIT_TIERS[0]! : CREDIT_TIERS[CREDIT_TIERS.length - 1]!;
}

/** 信用增益（纯函数；rng 仅任务完成区间用） */
export function calculateCreditGain(
  action: CreditAction,
  state: Pick<TangGameState, 'reputation' | 'shenTinglanFavor'>,
  rng: () => number = Math.random
): number {
  switch (action) {
    case 'task_complete':
      return 10 + Math.floor(rng() * 21); // 10~30
    case 'reputation_gain':
      return Math.floor((state.reputation ?? 0) / 100) * 5; // 声望每+100→+5
    case 'shen_favor':
      return Math.floor((state.shenTinglanFavor ?? 0) / 10) * 2; // 沈听澜好感每+10→+2
    case 'loan_repaid':
      return 15;
    case 'guild_join':
      return 20;
    case 'official_order':
      return 50;
    default:
      return 0;
  }
}

/** 信用消耗（返回正数扣减；锁定类动作返回 0，见 calculateCreditLock） */
export function calculateCreditCost(action: CreditAction): number {
  switch (action) {
    case 'tax_defer':
      return 20;
    case 'overdue':
      return 50;
    case 'complaint':
      return 30;
    case 'bankruptcy':
      return 100;
    default:
      return 0;
  }
}

/** 信用锁定额（赊购锁 50 / 官单锁 100；还款后 releaseCreditLock 释放） */
export function calculateCreditLock(action: CreditAction): number {
  if (action === 'credit_purchase') return 50;
  if (action === 'official_order') return 100;
  return 0;
}

/** 门槛校验（赊购≥500 / 官单≥700 / 延迟缴税≥300） */
export function checkCreditEligibility(
  action: CreditAction,
  state: Pick<TangGameState, 'credit'>
): { ok: boolean; reason?: string } {
  const credit = state.credit ?? 0;
  if (action === 'credit_purchase') {
    return credit >= 500 ? { ok: true } : { ok: false, reason: '信用不足 500，无法赊购' };
  }
  if (action === 'official_order') {
    return credit >= 700 ? { ok: true } : { ok: false, reason: '信用不足 700，无法承接官单' };
  }
  if (action === 'tax_defer') {
    return credit >= 300 ? { ok: true } : { ok: false, reason: '信用不足 300，无法延迟缴税' };
  }
  return { ok: true };
}

/** 信用破产判定：credit<0（供应商现金交易/官府盘查翻倍/30 天恢复由 store 以 creditBankruptDays 追踪） */
export function checkCreditBankruptcy(credit: number): boolean {
  return credit < 0;
}

/** 释放信用锁定（还款后调用） */
export function releaseCreditLock(state: Pick<TangGameState, 'creditLocked'>): {
  creditLocked: number;
  released: boolean;
} {
  const locked = state.creditLocked ?? 0;
  return { creditLocked: 0, released: locked > 0 };
}
