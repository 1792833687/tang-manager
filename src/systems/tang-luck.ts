/**
 * 《我在唐朝当掌柜》福星高照（Step 3 3.3）
 * 纯函数：
 * - useLuckyStar(gameState, rng?)：gain 随机 20-300 两（"赌一把"的赢钱）；
 *   按赢钱档位（<50 无负面 / 50-200 轻微 / >200 严重）给 penalty；
 *   负面强度按难度：A 无负面（恒 0）、B 轻微、C 严格等价。
 * - checkGamblingAddiction(state)：福星累计使用次数 ≥ 阈值（B 5 / C 3 / A 无）→ 赌瘾。
 *   说明：difficulty 的 luckChances 仅 1-2 次，公式 luckChances-luckRemaining 无法达 B5/C3，
 *   故使用 store 新增的 luckUsedTotal（终身计数）作为判定输入。
 * - 文案：按用户规格 3.3 逐字；金额按档位与难度映射。
 */
import { getDifficultyParams } from '@/config/tang-difficulty';
import type { Difficulty, LuckResult, TangGameState } from '@/types/tang-manager';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 赢钱档位：<50 无负面 / 50-200 轻微 / >200 严重 */
export type LuckTier = 'small' | 'mild' | 'big';

export function luckTierOf(gain: number): LuckTier {
  if (gain < 50) return 'small';
  if (gain <= 200) return 'mild';
  return 'big';
}

/** 负面文案（用户 3.3） */
export const LUCK_PENALTY_TEXT: Record<LuckTier, string> = {
  small: '无负面',
  mild: '轻微负面',
  big: '严重负面',
};

/**
 * 负面扣钱（难度与档位映射）：A 恒 0；B 轻微；C 严格等价（赢得越多亏得越多）。
 * C >200 档按 gain 比例 0.5-0.8 计算（严格等价：赢一大笔也要赔一大笔）。
 */
export function luckPenaltyAmount(
  tier: LuckTier,
  difficulty: Difficulty,
  gain: number,
  rng: () => number
): number {
  if (difficulty === 'A') return 0;
  if (difficulty === 'B') {
    if (tier === 'small') return 0;
    if (tier === 'mild') return round1(3 + rng() * 7); // 3-10
    return round1(15 + rng() * 25); // 15-40
  }
  // C 严格等价
  if (tier === 'small') return 0;
  if (tier === 'mild') return round1(8 + rng() * 12); // 8-20
  return round1(gain * (0.5 + rng() * 0.3)); // 赢 50%-80% 被赔出去
}

/** 福星高照：gain 20-300；按档位与难度返回 penalty 文案/金额与净赢 */
export function useLuckyStar(
  gameState: Pick<TangGameState, 'difficulty'>,
  rng: () => number = Math.random
): LuckResult {
  const gain = round1(20 + rng() * 280); // 20-300
  const tier = luckTierOf(gain);
  const difficulty = gameState.difficulty;
  const penaltyAmount = luckPenaltyAmount(tier, difficulty, gain, rng);
  const netGain = Math.max(0, round1(gain - penaltyAmount));
  return { gain, penalty: LUCK_PENALTY_TEXT[tier], penaltyAmount, netGain };
}

/** 赌瘾阈值：已用福星次数达到该值触发（A 无赌瘾） */
export const GAMBLING_THRESHOLD: Record<Difficulty, number> = { A: Infinity, B: 5, C: 3 };

/** 是否触发赌瘾（3.3）：福星累计使用次数 ≥ 阈值（A 恒 false） */
export function checkGamblingAddiction(
  state: Pick<TangGameState, 'difficulty' | 'luckUsedTotal'>
): boolean {
  const threshold = GAMBLING_THRESHOLD[state.difficulty];
  return (state.luckUsedTotal ?? 0) >= threshold;
}

/** 赌瘾持续天数（store 设 gamblingAddictionDays=7） */
export const GAMBLING_ADDICTION_DAYS = 7;

/** 赌瘾剧情行文案（打烊展示） */
export function gamblingLineOf(remainingDays: number): string {
  return `你鬼使神差地又摸向赌场方向——好在只是逛了一圈（赌瘾还剩 ${Math.max(0, remainingDays)} 日）`;
}

/** 参考：福星「已用次数」（按 team-lead 公式；因 luckChances 过小，赌瘾判定改用 luckUsedTotal） */
export function luckUsedCount(state: Pick<TangGameState, 'difficulty' | 'luckRemaining'>): number {
  const p = getDifficultyParams(state.difficulty);
  return Math.max(0, p.luckChances - state.luckRemaining);
}
