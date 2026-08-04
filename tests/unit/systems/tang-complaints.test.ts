/**
 * 投诉与差评师单测（tang-complaints / 3.4）
 * 覆盖：普通不满道歉/强硬效果、差评师赔钱/报官 50%/私下威胁、checkBadReviewer 概率与门槛。
 */
import { describe, expect, it } from 'vitest';
import {
  badReviewerCandidates,
  checkBadReviewer,
  handleComplaint,
} from '@/systems/tang-complaints';
import type { Guest } from '@/types/tang-manager';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    name: '李四',
    type: 'normal',
    description: 'x',
    baseConsumption: 4,
    mentalOS: null,
    handled: true,
    incomeEarned: 4,
    ...overrides,
  };
}

describe('handleComplaint · 普通不满（2 选项）', () => {
  it('道歉并补偿：退该单收入（gold=-income）、评分+0.01', () => {
    const result = handleComplaint({ guestId: 'g1', guestName: '李四', isBadReviewer: false, income: 4 }, 'apologize');
    expect(result.goldDelta).toBe(-4);
    expect(result.scoreDelta).toBe(0.01);
    expect(result.badReviewerRemoved).toBe(false);
  });

  it('强硬处理：保持收益（gold=0）、评分额外-0.03', () => {
    const result = handleComplaint({ guestId: 'g1', guestName: '李四', isBadReviewer: false, income: 4 }, 'tough');
    expect(result.goldDelta).toBe(0);
    expect(result.scoreDelta).toBe(-0.03);
  });
});

describe('handleComplaint · 差评师（3 选项）', () => {
  it('赔钱了事：扣 5-20 两（rng=0 → 5、rng=0.99 → ~20）', () => {
    const low = handleComplaint({ guestId: 'g1', guestName: '王五', isBadReviewer: true, income: 4 }, 'payoff', () => 0);
    const high = handleComplaint({ guestId: 'g1', guestName: '王五', isBadReviewer: true, income: 4 }, 'payoff', () => 0.99);
    expect(low.goldDelta).toBe(-5);
    expect(high.goldDelta).toBeLessThanOrEqual(-19.5);
    expect(high.goldDelta).toBeGreaterThanOrEqual(-20);
  });

  it('拒绝并报官：50% 官府支持带走（rng<0.5 成功）、50% 不支持评分-0.3', () => {
    const supported = handleComplaint({ guestId: 'g1', guestName: '王五', isBadReviewer: true, income: 4 }, 'report', () => 0.2);
    expect(supported.badReviewerRemoved).toBe(true);
    expect(supported.scoreDelta).toBe(0);
    expect(supported.reputationDelta).toBe(3);
    const unsupported = handleComplaint({ guestId: 'g1', guestName: '王五', isBadReviewer: true, income: 4 }, 'report', () => 0.7);
    expect(unsupported.badReviewerRemoved).toBe(false);
    expect(unsupported.scoreDelta).toBe(-0.3);
  });

  it('私下威胁：谢七登场（xieQiFavor>0）可带走差评师，无额外人情成本', () => {
    const result = handleComplaint(
      { guestId: 'g1', guestName: '王五', isBadReviewer: true, income: 4, xieQiFavor: 5 },
      'threaten'
    );
    expect(result.badReviewerRemoved).toBe(true);
    expect(result.goldDelta).toBe(0);
    expect(result.scoreDelta).toBe(0);
  });

  it('私下威胁：谢七未登场（xieQiFavor=0）不可用（防御返回不带走）', () => {
    const result = handleComplaint(
      { guestId: 'g1', guestName: '王五', isBadReviewer: true, income: 4, xieQiFavor: 0 },
      'threaten'
    );
    expect(result.badReviewerRemoved).toBe(false);
  });
});

describe('checkBadReviewer · 差评师出现判定', () => {
  it('A 难度永不出现差评师', () => {
    expect(checkBadReviewer({ difficulty: 'A', score: 5.0 }, () => 0)).toBe(false);
  });

  it('B 难度评分≥3.0 且 5% 概率（rng<0.05 触发）', () => {
    expect(checkBadReviewer({ difficulty: 'B', score: 2.9 }, () => 0)).toBe(false);
    expect(checkBadReviewer({ difficulty: 'B', score: 3.0 }, () => 0.04)).toBe(true);
    expect(checkBadReviewer({ difficulty: 'B', score: 3.0 }, () => 0.05)).toBe(false);
  });

  it('C 难度评分≥2.5 且 5% 概率', () => {
    expect(checkBadReviewer({ difficulty: 'C', score: 2.4 }, () => 0.04)).toBe(false);
    expect(checkBadReviewer({ difficulty: 'C', score: 2.5 }, () => 0.04)).toBe(true);
  });

  it('差评师候选：仅普通/观察客人可被标记', () => {
    const guests = [
      makeGuest({ id: 'n1', type: 'normal' }),
      makeGuest({ id: 'o1', type: 'observe' }),
      makeGuest({ id: 'b1', type: 'big_order' }),
      makeGuest({ id: 's1', type: 'special' }),
      makeGuest({ id: 'h1', type: 'help' }),
    ];
    const candidates = badReviewerCandidates(guests);
    expect(candidates).toEqual(['n1', 'o1']);
  });
});
