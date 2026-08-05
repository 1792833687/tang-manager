/**
 * 《我在唐朝当掌柜》产业巅峰挑战系统（v1.2 · 规格书模块四）
 * 纯函数：触发条件判定 / 成功率计算（基准 + 加成，上限封顶）/ 成功与失败结果结算。
 */
import { PEAK_CHALLENGES, PEAK_BONUS_RULES, type PeakChallengeType } from '@/config/tang-peak-challenges';

export interface PeakState {
  type: PeakChallengeType;
  day: number;
  level: number;
  reputation: number;
  score: number;
  medicalKnowledge: number;
  /** 累计坐诊次数（药铺）/ 官服定制次数（布庄）/ 宴席经验（酒楼，按承办次数） */
  progress: number;
  /** 加成单位（医书数 / 技能点 / 经验档） */
  bonusUnits: number;
  /** 已有永久 Buff（用于「称号已得」判定） */
  hasBuff: boolean;
}

/** 触发条件判定（纯函数） */
export function canStartPeakChallenge(state: PeakState): boolean {
  if (state.hasBuff) return false;
  if (state.level < 5 || state.reputation < 900) return false;
  if (state.type === 'imperial_banquet') return state.score >= 4.8;
  if (state.type === 'imperial_robe') return state.progress >= 10;
  return state.medicalKnowledge >= 3 && state.progress >= 50;
}

/** 成功率计算（基准 + 加成，封顶 max；纯函数） */
export function peakSuccessRate(state: PeakState): number {
  const def = PEAK_CHALLENGES[state.type];
  const rule = PEAK_BONUS_RULES[state.type];
  const bonus = rule.base + state.bonusUnits * rule.perUnit;
  return Math.min(def.maxSuccessRate, def.baseSuccessRate + bonus);
}

/** 结算挑战结果（纯函数；rng 可注入） */
export function resolvePeakChallenge(
  state: PeakState,
  rng: () => number = Math.random
): { success: boolean; rate: number } {
  const rate = peakSuccessRate(state);
  const success = rng() < rate;
  return { success, rate };
}

/** 成功奖励 / 失败惩罚数值（纯函数） */
export function peakOutcome(state: PeakState, success: boolean): { title: string; reputationDelta: number; silverDelta: number; buff: string } {
  const def = PEAK_CHALLENGES[state.type];
  if (success) {
    return { title: def.reward.title, reputationDelta: 30, silverDelta: 0, buff: def.reward.permanentBuff };
  }
  return { title: '', reputationDelta: def.penalty.reputationDelta, silverDelta: def.penalty.silverDelta, buff: '' };
}
