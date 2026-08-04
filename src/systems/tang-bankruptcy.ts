/**
 * 《我在唐朝当掌柜》破产保护（Step 3 3.6）
 * 纯函数：
 * - checkBankruptcy(state)：silver ≤ 0 即触发。
 *   简化说明：未实现「无法支付月息/货款」的复合判定；silver≤0 即视为无力经营。
 * - applyBankruptcy(state)：返回破产重置产出（小二去留/资金重置/声望重置）。
 * - dailyHustle(rng?)：破产「每日小买卖」收益 +1-3 两；15% 概率「得罪过的人找麻烦」额外 -1 两（占位）。
 */
import { getDifficultyParams } from '@/config/tang-difficulty';
import type { BankruptcyOutcome, Difficulty, TangGameState } from '@/types/tang-manager';

/** 破产资金重置（两）：A 20 / B 5 / C 0 */
export const BANKRUPTCY_RESET_GOLD: Record<Difficulty, number> = { A: 20, B: 5, C: 0 };

/** 破产判定（3.6）：silver ≤ 0 即触发（简化，见文件头注释） */
export function checkBankruptcy(state: Pick<TangGameState, 'silver'>): boolean {
  return (state.silver ?? 0) <= 0;
}

/** 破产流程产出：小二去留（阿昭好感≥80 留下）、资金重置、声望重置 */
export function applyBankruptcy(
  state: Pick<TangGameState, 'difficulty' | 'xiaoerFavor' | 'reputation'>
): BankruptcyOutcome {
  const xiaoerGone = state.xiaoerFavor >= 80 ? false : true;
  const resetGold = BANKRUPTCY_RESET_GOLD[state.difficulty];
  let reputation: number;
  if (state.difficulty === 'A') {
    reputation = Math.round(state.reputation * 0.5); // A 保留 50%
  } else if (state.difficulty === 'B') {
    reputation = 0; // B 清零
  } else {
    reputation = Math.max(0, state.reputation - 50); // C 清零-50（下限 0）
  }
  return { xiaoerGone, resetGold, reputation };
}

/** 破产每日小买卖（3.6）：+1-3 两；15% 概率「得罪过的人找麻烦」额外 -1 两（占位） */
export function dailyHustle(rng: () => number = Math.random): {
  goldDelta: number;
  trouble: boolean;
  note?: string;
} {
  const earn = 1 + Math.floor(rng() * 3); // 1-3 两
  const trouble = rng() < 0.15;
  return {
    goldDelta: trouble ? earn - 1 : earn,
    trouble,
    note: trouble ? '你摆摊时有人找麻烦，赔了些零钱。' : undefined,
  };
}

/** 破产坚持天数（复用 day：破产开始日记录在 bankruptcyStartDay） */
export function bankruptcyDaysSurvived(
  state: Pick<TangGameState, 'day' | 'bankruptcyStartDay'>
): number {
  return Math.max(0, state.day - (state.bankruptcyStartDay ?? state.day));
}

/** 破产重启（3.6）：score=1.0、gold=难度初始、shopItems 重载 INITIAL_GOODS 由 store 执行；
 *  本函数只产出纯数值部分（gold/score/debt 口径）。 */
export function bankruptcyRestartValues(
  difficulty: Difficulty
): { score: number; gold: number; debt: number } {
  const p = getDifficultyParams(difficulty);
  // 「租新铺面重新开始」= 全新鲜开（负债回到难度初始，与 initByDifficulty 口径一致）
  return { score: 1.0, gold: p.initialGold, debt: p.initialDebt };
}
