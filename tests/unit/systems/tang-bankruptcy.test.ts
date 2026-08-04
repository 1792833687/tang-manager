/**
 * 破产保护单测（tang-bankruptcy / 3.6）
 * 覆盖：gold≤0 触发、资金/声望重置分档、阿昭好感≥80 留下、坚持天数、每日小买卖、重启数值。
 */
import { describe, expect, it } from 'vitest';
import {
  applyBankruptcy,
  bankruptcyDaysSurvived,
  bankruptcyRestartValues,
  checkBankruptcy,
  dailyHustle,
} from '@/systems/tang-bankruptcy';
import type { TangGameState } from '@/types/tang-manager';

function makeState(overrides: Partial<TangGameState> = {}): TangGameState {
  return {
    phase: 'playing',
    player: null,
    shopType: 'jiulou',
    difficulty: 'B',
    silver: 50,
    gold: 50,
    legacyDebt: 200,
    debt: 200,
    monthlyInterest: 5,
    score: 1.0,
    reputation: 10,
    xiaoerFavor: 30,
    xiaoerSatisfaction: 60,
    energy: 100,
    day: 1,
    insightRemaining: 3,
    luckRemaining: 1,
    guests: [],
    currentGuestIndex: 0,
    ledger: [],
    todaySettlement: null,
    shopItems: [],
    unlockedAchievements: [],
    insightUsedTotal: 0,
    dailyEnergyConsumed: 0,
    events: [],
    pendingEvents: [],
    eventLog: [],
    insightUsedOnNPC: {},
    totalNetProfit: 0,
    maxGamblingWin: 0,
    hasGoneBroke: false,
    xiaoerGone: false,
    shenDebt: false,
    shenPartner: false,
    xieQiFavor: 0,
    shenTinglanFavor: 0,
    gamblingAddictionDays: 0,
    luckUsedTotal: 0,
    bankruptcyStartDay: 0,
    pendingComplaint: null,
    aiNarrationEnabled: true,
    aiModel: 'openai/gpt-4o-mini',
    stage: 1,
    employees: [],
    maxEmployees: 4,
    dailyActionsRemaining: 1,
    afternoonActions: [],
    shopCount: 1,
    xieQiIdentityRevealed: false,
    specialEmployeeStoryCompleted: false,
    employeeBonusRate: 0,
    ...overrides,
  };
}

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

describe('checkBankruptcy', () => {
  it('silver ≤ 0 即触发破产（0 触发、1 不触发、负数触发）', () => {
    expect(checkBankruptcy({ silver: 0 })).toBe(true);
    expect(checkBankruptcy({ silver: -3 })).toBe(true);
    expect(checkBankruptcy({ silver: 1 })).toBe(false);
  });
});

describe('applyBankruptcy · 分档重置', () => {
  it('资金重置：A 20 / B 5 / C 0', () => {
    expect(applyBankruptcy(makeState({ difficulty: 'A' })).resetGold).toBe(20);
    expect(applyBankruptcy(makeState({ difficulty: 'B' })).resetGold).toBe(5);
    expect(applyBankruptcy(makeState({ difficulty: 'C' })).resetGold).toBe(0);
  });

  it('声望重置：A 保留 50%、B 清零、C 清零-50（下限 0）', () => {
    expect(applyBankruptcy(makeState({ difficulty: 'A', reputation: 80 })).reputation).toBe(40);
    expect(applyBankruptcy(makeState({ difficulty: 'B', reputation: 300 })).reputation).toBe(0);
    expect(applyBankruptcy(makeState({ difficulty: 'C', reputation: 20 })).reputation).toBe(0);
  });

  it('阿昭好感 ≥80 留下（xiaoerGone=false）、<80 离开（xiaoerGone=true）', () => {
    expect(applyBankruptcy(makeState({ xiaoerFavor: 80 })).xiaoerGone).toBe(false);
    expect(applyBankruptcy(makeState({ xiaoerFavor: 79 })).xiaoerGone).toBe(true);
  });
});

describe('破产坚持天数与每日小买卖', () => {
  it('已坚持天数 = day - bankruptcyStartDay（复用 day）', () => {
    expect(bankruptcyDaysSurvived(makeState({ day: 10, bankruptcyStartDay: 2 }))).toBe(8);
    expect(bankruptcyDaysSurvived(makeState({ day: 3, bankruptcyStartDay: 3 }))).toBe(0);
  });

  it('每日小买卖 +1-3 两（rng=0 → 1、rng=0.99 → 3）；无麻烦', () => {
    const low = dailyHustle(seq(0, 0.9));
    expect(low.goldDelta).toBe(1);
    expect(low.trouble).toBe(false);
    const high = dailyHustle(seq(0.99, 0.9));
    expect(high.goldDelta).toBe(3);
  });

  it('15% 概率「得罪过的人找麻烦」额外 -1 两（rng<0.15）', () => {
    const troubled = dailyHustle(seq(0.5, 0.1));
    expect(troubled.trouble).toBe(true);
    expect(troubled.goldDelta).toBe(1); // earn=2, -1 = 1
    const safe = dailyHustle(seq(0.5, 0.2));
    expect(safe.trouble).toBe(false);
    expect(safe.goldDelta).toBe(2);
  });
});

describe('破产重启数值', () => {
  it('重启：score=1.0、gold=难度初始、debt=难度初始（全新开始；gold/debt 为函数自身返回名，store 映射到 silver/legacyDebt）', () => {
    const b = bankruptcyRestartValues('B');
    expect(b.score).toBe(1.0);
    expect(b.gold).toBe(50);
    expect(b.debt).toBe(200);
    const a = bankruptcyRestartValues('A');
    expect(a.gold).toBe(80);
    expect(a.debt).toBe(100);
  });
});
