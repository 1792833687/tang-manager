/**
 * 阶段推进单测（tang-stage · Step 5a 1.1）
 * 覆盖：1→2（资金/评分/声望/沈听澜登场）、2→3（店铺/总收益/谢七身份/员工满意度）、
 *       3→4（声望/资金/合作线/特殊员工剧情）、缺条件不升级、合成阶段事件。
 */
import { describe, expect, it } from 'vitest';
import { buildStageUpgradeEvent, checkStageUpgrade } from '@/systems/tang-stage';
import type { Employee, TangGameState } from '@/types/tang-manager';

function makeEmployee(satisfaction: number, overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'e1',
    name: '赵铁柱',
    gender: 'male',
    type: 'waiter',
    salary: 6,
    skills: [],
    isSpecial: false,
    satisfaction,
    hireDay: 1,
    backgroundRevealed: false,
    ...overrides,
  };
}

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
    score: 2.0,
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

describe('checkStageUpgrade · 1→2', () => {
  it('资金≥800 + 评分≥4.2 + 声望≥400 + eventLog 含 shen-tinglan → 2', () => {
    const state = makeState({
      silver: 800,
      gold: 800,
      score: 4.2,
      reputation: 400,
      eventLog: ['shen-tinglan'],
    });
    expect(checkStageUpgrade(state)).toBe(2);
  });

  it('缺沈听澜登场 → 仍为 1', () => {
    const state = makeState({ silver: 800, gold: 800, score: 4.2, reputation: 400, eventLog: [] });
    expect(checkStageUpgrade(state)).toBe(1);
  });

  it('评分不足（4.1）→ 仍为 1', () => {
    const state = makeState({ silver: 800, gold: 800, score: 4.1, reputation: 400, eventLog: ['shen-tinglan'] });
    expect(checkStageUpgrade(state)).toBe(1);
  });
});

describe('checkStageUpgrade · 2→3', () => {
  const base2 = {
    silver: 800,
    gold: 800,
    score: 4.2,
    reputation: 400,
    eventLog: ['shen-tinglan'],
  };

  it('店铺≥3 + 总收益≥80000 + 谢七身份揭晓 + ≥2 员工满意度≥80 → 3', () => {
    const state = makeState({
      ...base2,
      shopCount: 3,
      totalNetProfit: 80000,
      xieQiIdentityRevealed: true,
      employees: [makeEmployee(85), makeEmployee(90, { id: 'e2' })],
    });
    expect(checkStageUpgrade(state)).toBe(3);
  });

  it('员工满意度不足（仅 1 人≥80）→ 停留在 2', () => {
    const state = makeState({
      ...base2,
      shopCount: 3,
      totalNetProfit: 80000,
      xieQiIdentityRevealed: true,
      employees: [makeEmployee(85)],
    });
    expect(checkStageUpgrade(state)).toBe(2);
  });

  it('谢七身份未揭晓 → 停留在 2', () => {
    const state = makeState({
      ...base2,
      shopCount: 3,
      totalNetProfit: 80000,
      employees: [makeEmployee(85), makeEmployee(90, { id: 'e2' })],
    });
    expect(checkStageUpgrade(state)).toBe(2);
  });
});

describe('checkStageUpgrade · 3→4', () => {
  const base3 = {
    silver: 150000,
    gold: 150000,
    score: 4.5,
    reputation: 700,
    eventLog: ['shen-tinglan', 'xie-qi-debt'],
    shopCount: 4,
    totalNetProfit: 200000,
    xieQiIdentityRevealed: true,
    employees: [makeEmployee(85), makeEmployee(90, { id: 'e2' })],
  };

  it('声望≥700 + 资金≥150000 + 沈听澜合作线 + 特殊员工剧情 → 4', () => {
    const state = makeState({ ...base3, shenPartner: true, specialEmployeeStoryCompleted: true });
    expect(checkStageUpgrade(state)).toBe(4);
  });

  it('谢七灰色线完成（xieQiFavor≥50）可替代沈听澜合作线 → 4', () => {
    const state = makeState({ ...base3, shenPartner: false, xieQiFavor: 50, specialEmployeeStoryCompleted: true });
    expect(checkStageUpgrade(state)).toBe(4);
  });

  it('特殊员工剧情未触发 → 停留在 3', () => {
    const state = makeState({ ...base3, shenPartner: true, specialEmployeeStoryCompleted: false });
    expect(checkStageUpgrade(state)).toBe(3);
  });
});

describe('buildStageUpgradeEvent', () => {
  it('合成阶段事件含唯一 id、单选项、trigger 兼容类型', () => {
    const ev = buildStageUpgradeEvent(2, 12);
    expect(ev.id).toBe('stage-2-12');
    expect(ev.title).toContain('崭露头角');
    expect(ev.choices).toHaveLength(1);
    expect(ev.choices[0]!.id).toBe('ok');
    expect(ev.trigger.type).toBe('day_range');
  });
});
