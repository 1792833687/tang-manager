/**
 * 员工事件系统单测（tang-employee-events · Step 5a 2.5）
 * 覆盖：请求涨薪（满意度阈值/概率）、员工矛盾、被挖角（低满意度概率更高）、
 *       特殊员工背景揭露（入职≥15 天）、改进建议（满意度/技能条件）、applyEmployeeEvents 应用。
 */
import { describe, expect, it } from 'vitest';
import {
  applyEmployeeEvents,
  checkEmployeeEvents,
  daysEmployed,
} from '@/systems/tang-employee-events';
import type { Employee, TangGameState } from '@/types/tang-manager';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'e1',
    name: '赵铁柱',
    gender: 'male',
    type: 'waiter',
    salary: 6,
    skills: [{ id: 'q-waiter', name: '待客如沐春风', type: 'quality', description: 'x', requiresType: ['waiter'] }],
    isSpecial: false,
    satisfaction: 60,
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

describe('请求涨薪（满意度<50，基准 15%）', () => {
  it('满意度<50 且 rng<0.15 → raise_request；apply 后满意度+5、扣 2 两', () => {
    const emp = makeEmployee({ satisfaction: 40 });
    const state = makeState({ employees: [emp] });
    // 第 1 个 rng = 0.1（<0.15）→ 涨薪
    const events = checkEmployeeEvents(state, seq(0.1));
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('raise_request');
    const applied = applyEmployeeEvents([emp], events, 1);
    expect(applied.employees[0]!.satisfaction).toBe(45);
    expect(applied.goldDelta).toBe(-2);
  });

  it('满意度≥50 不触发', () => {
    const state = makeState({ employees: [makeEmployee({ satisfaction: 60 })] });
    // 第 1 个 rng 即使 <0.15 也不会（先判阈值）
    const events = checkEmployeeEvents(state, seq(0.1));
    expect(events.some((e) => e.type === 'raise_request')).toBe(false);
  });
});

describe('员工矛盾（5% 概率，波及另一位员工）', () => {
  it('rng<0.05 → conflict；波及方满意度 -2', () => {
    const a = makeEmployee({ id: 'a', name: '赵铁柱' });
    const b = makeEmployee({ id: 'b', name: '钱满仓' });
    const state = makeState({ employees: [a, b] });
    // a：满意度60 → 涨薪跳过 → 矛盾判 0.04（<0.05）→ conflict；其他员工为 b
    const events = checkEmployeeEvents(state, seq(0.04));
    const conflict = events.find((e) => e.type === 'conflict');
    expect(conflict).toBeTruthy();
    expect(conflict!.otherEmployeeId).toBe('b');
    const applied = applyEmployeeEvents([a, b], events, 1);
    expect(applied.employees.find((e) => e.id === 'a')!.satisfaction).toBe(58);
    expect(applied.employees.find((e) => e.id === 'b')!.satisfaction).toBe(58);
  });
});

describe('被挖角（8%；满意度<40 → 15%）', () => {
  it('满意度<40 且 rng=0.1（<0.15）→ poached 离职', () => {
    const emp = makeEmployee({ satisfaction: 35 });
    const state = makeState({ employees: [emp] });
    // 涨薪 0.5(no) → 矛盾 0.5(no) → 挖角 0.1(<0.15)
    const events = checkEmployeeEvents(state, seq(0.5, 0.5, 0.1));
    const poach = events.find((e) => e.type === 'poached');
    expect(poach).toBeTruthy();
    expect(poach!.quit).toBe(true);
    const applied = applyEmployeeEvents([emp], events, 1);
    expect(applied.employees).toHaveLength(0);
  });

  it('满意度≥40 时 rng=0.1（>0.08）→ 不挖角', () => {
    const emp = makeEmployee({ satisfaction: 50 });
    const state = makeState({ employees: [emp] });
    const events = checkEmployeeEvents(state, seq(0.5, 0.5, 0.1));
    expect(events.some((e) => e.type === 'poached')).toBe(false);
  });
});

describe('特殊员工背景揭露（入职≥15 天，10%）', () => {
  it('isSpecial + 入职≥15 天 + rng<0.1 → background_reveal；backgroundRevealed=true', () => {
    const emp = makeEmployee({
      isSpecial: true,
      hiddenBackground: '曾在赌场当过打手',
      hiddenFlaw: '嗜赌如命，逢赌必去',
      hireDay: 1,
    });
    const state = makeState({ employees: [emp], day: 15 }); // 15-1+1 = 15 天
    expect(daysEmployed(emp, 15)).toBe(15);
    // 满意度60 → 涨薪跳过 → 矛盾 0.5(no) → 挖角 0.5(no) → 背景 0.05(<0.1)
    const events = checkEmployeeEvents(state, seq(0.5, 0.5, 0.05));
    const reveal = events.find((e) => e.type === 'background_reveal');
    expect(reveal).toBeTruthy();
    const applied = applyEmployeeEvents([emp], events, 15);
    expect(applied.employees[0]!.backgroundRevealed).toBe(true);
    expect(applied.specialStoryCompleted).toBe(true);
    expect(applied.goldDelta).toBe(-5); // hiddenFlaw 负面（占位）
  });

  it('入职不足 15 天不触发', () => {
    const emp = makeEmployee({ isSpecial: true, hireDay: 1 });
    const state = makeState({ employees: [emp], day: 14 }); // 14 天
    const events = checkEmployeeEvents(state, seq(0.5, 0.5, 0.5, 0.05));
    expect(events.some((e) => e.type === 'background_reveal')).toBe(false);
  });
});

describe('改进建议（满意度≥70 且技能≥2，8%）', () => {
  it('满足条件 + rng<0.08 → suggestion；incomeBonus=0.02', () => {
    const emp = makeEmployee({
      satisfaction: 80,
      skills: [
        { id: 'q-waiter', name: '待客如沐春风', type: 'quality', description: 'x', requiresType: ['waiter'] },
        { id: 'e-waiter', name: '手脚麻利', type: 'efficiency', description: 'x', requiresType: ['waiter'] },
      ],
    });
    const state = makeState({ employees: [emp] });
    // 满意度80 → 涨薪跳过 → 矛盾 0.5(no) → 挖角 0.5(no) → 背景 跳过(isSpecial=false, 不耗 rng) → 建议 0.05(<0.08)
    const events = checkEmployeeEvents(state, seq(0.5, 0.5, 0.05));
    const sug = events.find((e) => e.type === 'suggestion');
    expect(sug).toBeTruthy();
    expect(sug!.incomeBonus).toBe(0.02);
    const applied = applyEmployeeEvents([emp], events, 1);
    expect(applied.bonusRate).toBeCloseTo(0.02, 5);
  });

  it('技能不足 2 个不触发', () => {
    const emp = makeEmployee({ satisfaction: 80, skills: [empSkill()] });
    const state = makeState({ employees: [emp] });
    const events = checkEmployeeEvents(state, seq(0.5, 0.5, 0.5, 0.05));
    expect(events.some((e) => e.type === 'suggestion')).toBe(false);
  });
});

function empSkill(): Employee['skills'][number] {
  return { id: 'q-waiter', name: '待客如沐春风', type: 'quality', description: 'x', requiresType: ['waiter'] };
}
