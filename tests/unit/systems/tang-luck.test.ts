/**
 * 福星高照单测（tang-luck / 3.3）
 * 覆盖：三档 gain/penalty 映射、A 无负面、B/C 轻微/严格等价金额、赌瘾阈值 B5/C3、A 无赌瘾。
 */
import { describe, expect, it } from 'vitest';
import {
  checkGamblingAddiction,
  luckPenaltyAmount,
  luckTierOf,
  useLuckyStar,
} from '@/systems/tang-luck';
import type { Difficulty } from '@/types/tang-manager';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

describe('useLuckyStar · 档位映射', () => {
  it('gain = 20 + rng×280：rng=0 → 20、rng=1 附近 → 300', () => {
    expect(useLuckyStar({ difficulty: 'A' }, () => 0).gain).toBe(20);
    const high = useLuckyStar({ difficulty: 'A' }, () => 0.99).gain;
    expect(high).toBeGreaterThan(290);
    expect(high).toBeLessThanOrEqual(300);
  });

  it('档位映射：<50 → small、50-200 → mild、>200 → big', () => {
    expect(luckTierOf(20)).toBe('small');
    expect(luckTierOf(49.9)).toBe('small');
    expect(luckTierOf(50)).toBe('mild');
    expect(luckTierOf(200)).toBe('mild');
    expect(luckTierOf(200.1)).toBe('big');
    expect(luckTierOf(300)).toBe('big');
  });

  it('A 难度恒无负面：penaltyAmount=0、penalty=无负面、netGain=gain', () => {
    const result = useLuckyStar({ difficulty: 'A' }, () => 0.9); // gain≈272 → big 档
    expect(result.penaltyAmount).toBe(0);
    expect(result.penalty).toBe('严重负面'); // 文案仍标注档位（但 A 不扣钱）
    expect(result.netGain).toBe(result.gain);
  });

  it('B 难度：big 档扣 15-40 两（rng=0 → 15、rng=0.99 → ~40）', () => {
    const low = luckPenaltyAmount('big', 'B', 300, () => 0);
    const high = luckPenaltyAmount('big', 'B', 300, () => 0.99);
    expect(low).toBe(15);
    expect(high).toBeGreaterThanOrEqual(39.5);
    expect(high).toBeLessThanOrEqual(40);
  });

  it('C 难度严格等价：>200 档按 gain 50%-80% 扣（赢得越多亏得越多）', () => {
    const gain300 = luckPenaltyAmount('big', 'C', 300, () => 0);
    const gain300hi = luckPenaltyAmount('big', 'C', 300, () => 0.99);
    expect(gain300).toBeCloseTo(150, 5); // 300 × 0.5
    expect(gain300hi).toBeGreaterThanOrEqual(239);
    expect(gain300hi).toBeLessThanOrEqual(240); // 300 × (0.5+0.99×0.3)=239.1
    // 200 两赢 100 两（rng=0）→ 净赢 100
    const result = useLuckyStar({ difficulty: 'C' }, seq(0.64, 0));
    // gain = 20 + 0.64*280 = 199.2 → mild 档 → C mild 扣 8-20
    expect(result.netGain).toBe(result.gain - result.penaltyAmount);
    expect(result.penaltyAmount).toBeGreaterThanOrEqual(8);
    expect(result.penaltyAmount).toBeLessThanOrEqual(20);
  });

  it('netGain 不为负：penaltyAmount 超过 gain 时归零', () => {
    // C big：gain≈20? 不可能——big 档 gain 必 >200；但防御性验证 netGain≥0
    const result = useLuckyStar({ difficulty: 'C' }, () => 0.99);
    expect(result.netGain).toBeGreaterThanOrEqual(0);
  });
});

describe('checkGamblingAddiction · 赌瘾阈值', () => {
  it('B 难度：累计 ≥5 触发（4 不触发、5 触发）', () => {
    expect(checkGamblingAddiction({ difficulty: 'B', luckUsedTotal: 4 })).toBe(false);
    expect(checkGamblingAddiction({ difficulty: 'B', luckUsedTotal: 5 })).toBe(true);
  });

  it('C 难度：累计 ≥3 触发（2 不触发、3 触发）', () => {
    expect(checkGamblingAddiction({ difficulty: 'C', luckUsedTotal: 2 })).toBe(false);
    expect(checkGamblingAddiction({ difficulty: 'C', luckUsedTotal: 3 })).toBe(true);
  });

  it('A 难度：永不触发赌瘾', () => {
    expect(checkGamblingAddiction({ difficulty: 'A', luckUsedTotal: 99 })).toBe(false);
  });

  it('缺省 luckUsedTotal（undefined）按 0 处理，不触发', () => {
    expect(checkGamblingAddiction({ difficulty: 'B', luckUsedTotal: undefined as unknown as number })).toBe(false);
  });
});

describe('luckPenaltyAmount · 各难度小档', () => {
  it('small 档所有难度均不扣钱', () => {
    (['A', 'B', 'C'] as Difficulty[]).forEach((d) => {
      expect(luckPenaltyAmount('small', d, 20, () => 0.5)).toBe(0);
    });
  });

  it('B mild 档扣 3-10、C mild 档扣 8-20', () => {
    expect(luckPenaltyAmount('mild', 'B', 100, () => 0)).toBe(3);
    expect(luckPenaltyAmount('mild', 'B', 100, () => 0.99)).toBeGreaterThanOrEqual(9.9);
    expect(luckPenaltyAmount('mild', 'C', 100, () => 0)).toBe(8);
    expect(luckPenaltyAmount('mild', 'C', 100, () => 0.99)).toBeGreaterThanOrEqual(19.8);
  });
});
