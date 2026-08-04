/**
 * 《我在唐朝当掌柜》投资系统（Step 5b 模块四）
 * 纯函数（可测）：
 * - investInGuildFund(amount, state, rng?)：商会基金，≥100 两，30 天，月回报 -10%~+30%，
 *   声望≥500 → 正向概率 +20%
 * - investWithShen(amount, state, rng?)：沈听澜合作，需登场且好感≥40，≥200 两，45 天，
 *   -5%~+40%，好感≥80 下限 +5%；30% 概率打击分店（客流量减半 + 回报翻倍，道德困境）
 * - investInUnderground(amount, state, rng?)：地下钱庄，需谢七登场且好感≥30，≥50 两，15 天，
 *   -30%~+60%，好感≥70 下限 -10%；40% 概率查封（本金全损 + 信用-50 + 谢七好感-20 + 官府盘查事件）
 * - checkInvestmentMaturity(state, rng?)：每日打烊调用，到期自动结算，返回结算结果列表
 *
 * 铁律：数值裁决前端纯函数；actualReturn 到期写入；风险（查封/打击）由 rng 在到期时裁决。
 */
import type { InvestApplyResult, Investment, InvestmentSettlementResult, TangGameState } from '@/types/tang-manager';

export const GUILD_MIN = 100;
export const GUILD_PERIOD = 30;
export const SHEN_MIN = 200;
export const SHEN_PERIOD = 45;
export const UNDERGROUND_MIN = 50;
export const UNDERGROUND_PERIOD = 15;

const PERIOD: Record<Investment['type'], number> = {
  guild: GUILD_PERIOD,
  shen: SHEN_PERIOD,
  underground: UNDERGROUND_PERIOD,
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function investId(prefix: string, rng: () => number): string {
  return `${prefix}-${Math.floor(rng() * 1e9)}`;
}

/** 商会基金（≥100 两，30 天，-10%~+30%；声望≥500 → 正向概率 +20%） */
export function investInGuildFund(
  amount: number,
  state: Pick<TangGameState, 'silver' | 'reputation' | 'day'>,
  rng: () => number = Math.random
): InvestApplyResult {
  if (amount < GUILD_MIN) {
    return { ok: false, investment: null, reason: '商会基金需至少 100 两' };
  }
  if ((state.silver ?? 0) < amount) {
    return { ok: false, investment: null, reason: '现银不足' };
  }
  let expected = -0.1 + rng() * 0.4; // -10%~+30%
  // 声望≥500：把负向结果 20% 概率翻正（正向概率 +20% 近似实现，注释说明）
  if ((state.reputation ?? 0) >= 500 && expected < 0 && rng() < 0.2) {
    expected = Math.abs(expected);
  }
  return {
    ok: true,
    investment: {
      id: investId('inv-guild', rng),
      amount,
      investDay: state.day ?? 1,
      type: 'guild',
      expectedReturn: round3(expected),
      status: 'active',
    },
    note: '商会基金：30 天到期，预期回报 -10%~+30%',
  };
}

/** 沈听澜合作投资（需登场且好感≥40，≥200 两，45 天，-5%~+40%；好感≥80 下限 +5%） */
export function investWithShen(
  amount: number,
  state: Pick<TangGameState, 'silver' | 'shenTinglanFavor' | 'day'>,
  rng: () => number = Math.random
): InvestApplyResult {
  if ((state.shenTinglanFavor ?? 0) < 40) {
    return { ok: false, investment: null, reason: '需沈听澜登场且好感≥40' };
  }
  if (amount < SHEN_MIN) {
    return { ok: false, investment: null, reason: '沈听澜合作投资需至少 200 两' };
  }
  if ((state.silver ?? 0) < amount) {
    return { ok: false, investment: null, reason: '现银不足' };
  }
  const min = (state.shenTinglanFavor ?? 0) >= 80 ? 0.05 : -0.05; // 好感≥80 → 下限 +5%
  const expected = min + rng() * (0.4 - min);
  return {
    ok: true,
    investment: {
      id: investId('inv-shen', rng),
      amount,
      investDay: state.day ?? 1,
      type: 'shen',
      expectedReturn: round3(expected),
      status: 'active',
    },
    note: '与沈听澜合作：45 天到期，预期回报 -5%~+40%',
  };
}

/** 地下钱庄（需谢七登场且好感≥30，≥50 两，15 天，-30%~+60%；好感≥70 下限 -10%） */
export function investInUnderground(
  amount: number,
  state: Pick<TangGameState, 'silver' | 'xieQiFavor' | 'day'>,
  rng: () => number = Math.random
): InvestApplyResult {
  if ((state.xieQiFavor ?? 0) < 30) {
    return { ok: false, investment: null, reason: '需谢七登场且好感≥30' };
  }
  if (amount < UNDERGROUND_MIN) {
    return { ok: false, investment: null, reason: '地下钱庄需至少 50 两' };
  }
  if ((state.silver ?? 0) < amount) {
    return { ok: false, investment: null, reason: '现银不足' };
  }
  const min = (state.xieQiFavor ?? 0) >= 70 ? -0.1 : -0.3; // 好感≥70 → 下限 -10%
  const expected = min + rng() * (0.6 - min);
  return {
    ok: true,
    investment: {
      id: investId('inv-underground', rng),
      amount,
      investDay: state.day ?? 1,
      type: 'underground',
      expectedReturn: round3(expected),
      status: 'active',
    },
    note: '地下钱庄：15 天到期，预期回报 -30%~+60%，风险极高',
  };
}

/** 到期结算（每日打烊调用；返回已到期投资的结算结果列表） */
export function checkInvestmentMaturity(
  state: Pick<TangGameState, 'day' | 'investments'>,
  rng: () => number = Math.random
): InvestmentSettlementResult[] {
  const day = state.day ?? 1;
  const results: InvestmentSettlementResult[] = [];
  for (const inv of (state.investments ?? []).filter((i) => i.status === 'active')) {
    if (day - inv.investDay < PERIOD[inv.type]) {
      continue;
    }
    if (inv.type === 'underground') {
      // 40% 查封：本金全损（信用-50 / 谢七好感-20 / 官府盘查由 store 应用）
      if (rng() < 0.4) {
        results.push({
          id: inv.id,
          type: inv.type,
          amount: inv.amount,
          actualReturn: -1,
          gain: -inv.amount,
          lost: true,
          note: '地下钱庄被官府查封，本金全数打了水漂，还惹了一身麻烦。',
        });
      } else {
        const gain = Math.round(inv.amount * inv.expectedReturn);
        results.push({
          id: inv.id,
          type: inv.type,
          amount: inv.amount,
          actualReturn: inv.expectedReturn,
          gain,
          note: '地下钱庄如期分账，银子来得快去得也快。',
        });
      }
    } else if (inv.type === 'shen') {
      // 30% 打击分店：客流量减半 + 回报翻倍（道德困境）
      const dilemma = rng() < 0.3;
      const eff = dilemma ? inv.expectedReturn * 2 : inv.expectedReturn;
      const gain = Math.round(inv.amount * eff);
      results.push({
        id: inv.id,
        type: inv.type,
        amount: inv.amount,
        actualReturn: eff,
        gain,
        dilemmaHit: dilemma,
        note: dilemma
          ? '分店遭人挤兑，客流减半；好在沈氏分红翻倍（道德困境）。'
          : '沈氏商号分红到账，银两分毫不差。',
      });
    } else {
      const gain = Math.round(inv.amount * inv.expectedReturn);
      results.push({
        id: inv.id,
        type: inv.type,
        amount: inv.amount,
        actualReturn: inv.expectedReturn,
        gain,
        note: '商会基金结算分红，账房核了又核。',
      });
    }
  }
  return results;
}
