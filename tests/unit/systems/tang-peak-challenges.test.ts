/**
 * 产业巅峰挑战（v1.2 规格书模块四）验收测试
 * 覆盖：触发条件 / 成功率计算（基准+加成封顶）/ 成功与失败结果。
 */
import { describe, expect, it } from 'vitest';
import { canStartPeakChallenge, peakSuccessRate, resolvePeakChallenge, peakOutcome } from '@/systems/tang-peak-challenges';
import { PEAK_CHALLENGES } from '@/config/tang-peak-challenges';
import type { PeakState } from '@/systems/tang-peak-challenges';

function state(partial: Partial<PeakState>): PeakState {
  return { type: 'imperial_banquet', day: 1, level: 5, reputation: 900, score: 4.8, medicalKnowledge: 3, progress: 50, bonusUnits: 0, hasBuff: false, ...partial };
}

describe('canStartPeakChallenge 触发条件', () => {
  it('Lv5 + 声望900 + 条件满足 → 可触发', () => {
    expect(canStartPeakChallenge(state({ type: 'imperial_banquet', score: 4.8 }))).toBe(true);
  });
  it('Lv<5 / 声望<900 / 条件不满足 → 不可触发', () => {
    expect(canStartPeakChallenge(state({ level: 4 }))).toBe(false);
    expect(canStartPeakChallenge(state({ reputation: 800 }))).toBe(false);
    expect(canStartPeakChallenge(state({ type: 'imperial_banquet', score: 4.5 }))).toBe(false);
    expect(canStartPeakChallenge(state({ type: 'imperial_robe', progress: 5 }))).toBe(false);
    expect(canStartPeakChallenge(state({ type: 'resurrection', medicalKnowledge: 2 }))).toBe(false);
  });
  it('已有 Buff → 不可重复触发', () => {
    expect(canStartPeakChallenge(state({ hasBuff: true }))).toBe(false);
  });
});

describe('peakSuccessRate 成功率', () => {
  it('基准率 + 加成，封顶 max（酒楼 30%→80%）', () => {
    expect(peakSuccessRate(state({ type: 'imperial_banquet', bonusUnits: 0 }))).toBeCloseTo(0.35);
    expect(peakSuccessRate(state({ type: 'imperial_banquet', bonusUnits: 10 }))).toBeCloseTo(0.8);
  });
  it('药铺：每本医书 +10% + 坐诊经验，封顶 70%', () => {
    expect(peakSuccessRate(state({ type: 'resurrection', bonusUnits: 2 }))).toBeCloseTo(0.44);
    expect(peakSuccessRate(state({ type: 'resurrection', bonusUnits: 20 }))).toBeCloseTo(0.7);
  });
});

describe('resolvePeakChallenge / peakOutcome', () => {
  it('成功 → 称号 + 永久 Buff + 声望+30', () => {
    const r = resolvePeakChallenge(state({ type: 'imperial_banquet' }), () => 0.01);
    expect(r.success).toBe(true);
    const o = peakOutcome(state({ type: 'imperial_banquet' }), true);
    expect(o.title).toBe('天下第一楼');
    expect(o.buff).toBe('banquet_income_1.3');
    expect(o.reputationDelta).toBe(30);
  });
  it('失败 → 惩罚（声望/赔偿）', () => {
    const o = peakOutcome(state({ type: 'imperial_robe' }), false);
    expect(o.reputationDelta).toBe(-80);
    expect(o.silverDelta).toBe(-500);
    const o2 = peakOutcome(state({ type: 'resurrection' }), false);
    expect(o2.reputationDelta).toBe(-100);
  });
  it('三产业挑战定义齐全（规格书 4.2）', () => {
    expect(PEAK_CHALLENGES.imperial_banquet.reward.title).toBe('天下第一楼');
    expect(PEAK_CHALLENGES.imperial_robe.reward.title).toBe('御用织造');
    expect(PEAK_CHALLENGES.resurrection.reward.title).toBe('再世华佗');
  });
});
