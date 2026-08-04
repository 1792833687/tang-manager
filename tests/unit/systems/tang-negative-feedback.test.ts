/**
 * 负反馈系统单测（内容深化 TANG-CONT-D 模块七）
 * 覆盖：树大招风（触发/选项）、集体涨薪（触发/三选项）、自然灾害（概率/洪水火灾瘟疫）、
 *      人际背叛（挖角三档/沈听澜使绊/阿昭偷钱）、意外损失（赊账跑路概率/钱庄挤兑）。
 */
import { describe, expect, it } from 'vitest';
import {
  applyBetrayalChoice,
  applyCollectiveRaiseChoice,
  applyDisasterChoice,
  applyTreeWindChoice,
  buildPoachEvent,
  buildShenSchemeEvent,
  checkAccidentalLoss,
  checkCollectiveRaise,
  checkNaturalDisaster,
  checkTreeAttractsWind,
  monthOf,
  type NegativeFeedbackState,
} from '@/systems/tang-negative-feedback';
import type { Employee } from '@/types/tang-manager';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

function emp(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'e1',
    name: '老赵',
    gender: 'male',
    type: 'accountant',
    salary: 10,
    skills: [],
    isSpecial: false,
    satisfaction: 60,
    hireDay: 1,
    backgroundRevealed: false,
    ...overrides,
  };
}

function baseState(overrides: Partial<NegativeFeedbackState> = {}): NegativeFeedbackState {
  return {
    day: 30,
    silver: 500,
    score: 3.5,
    reputation: 200,
    shopType: 'jiulou',
    consecutiveProfitDays: 0,
    shenTinglanFavor: 0,
    xiaoerFavor: 50,
    employees: [],
    ...overrides,
  };
}

describe('树大招风（连续盈利 ≥15 天）', () => {
  it('连续盈利 <15 天不触发', () => {
    expect(checkTreeAttractsWind(baseState({ consecutiveProfitDays: 14 }))).toBeNull();
  });

  it('连续盈利 ≥15 天触发（2 选项）', () => {
    const ev = checkTreeAttractsWind(baseState({ consecutiveProfitDays: 15 }));
    expect(ev).not.toBeNull();
    expect(ev!.options.map((o) => o.id)).toEqual(['explain', 'ignore']);
  });

  it('选项 A 去商会解释：精力 -20、银 -20、声望 +5', () => {
    const r = applyTreeWindChoice('explain', baseState());
    expect(r.changes.energy).toBe(80);
    expect(r.changes.silver).toBe(480);
    expect(r.changes.reputation).toBe(205);
  });

  it('选项 B 不予理会：声望 -5（商会关系受损近似）', () => {
    const r = applyTreeWindChoice('ignore', baseState());
    expect(r.changes.reputation).toBe(195);
    expect(r.eventLog[0]).toContain('商会关系 -15');
  });
});

describe('集体涨薪要求（>60 天且连续盈利 ≥30 天概率触发）', () => {
  it('经营天数 ≤60 不触发', () => {
    expect(checkCollectiveRaise(baseState({ day: 60, consecutiveProfitDays: 40 }), () => 0)).toBeNull();
  });

  it('满足条件 + rng<0.15 触发', () => {
    const ev = checkCollectiveRaise(baseState({ day: 90, consecutiveProfitDays: 35 }), () => 0.05);
    expect(ev).not.toBeNull();
    expect(ev!.options.map((o) => o.id)).toEqual(['all_raise', 'partial_raise', 'refuse']);
  });

  it('选项 A 全体涨薪：月钱 ×1.2、满意 +15、salaryMultiplier 增', () => {
    const r = applyCollectiveRaiseChoice('all_raise', baseState({ employees: [emp({ salary: 10, satisfaction: 60 })] }));
    expect(r.changes.employees![0]!.salary).toBe(12);
    expect(r.changes.employees![0]!.satisfaction).toBe(75);
    expect(r.changes.salaryMultiplier).toBe(1.2);
  });

  it('选项 C 拒绝：全员满意 -20；rng<0.3 一名伙计离职', () => {
    const r = applyCollectiveRaiseChoice('refuse', baseState({ employees: [emp({ id: 'a', name: '甲' }), emp({ id: 'b', name: '乙' })] }), seq(0.1, 0));
    expect(r.changes.employees!.length).toBe(1); // 离职一位
    expect(r.changes.employees![0]!.satisfaction).toBe(40); // 60 - 20
  });
});

describe('自然灾害（约 2%/月；夏季/冬季翻倍）', () => {
  it('rng≥概率不触发', () => {
    expect(checkNaturalDisaster(baseState({ day: 15 }), () => 0.99)).toBeNull();
  });

  it('洪水：食材全陈损、布匹损 20%', () => {
    const ev = checkNaturalDisaster(baseState({ day: 150 }), seq(0.01, 0.1, 0.1)); // 夏季 month5（day150 → month5）
    expect(ev).not.toBeNull();
    expect(ev!.payload?.disasterType).toBe('flood');
    const r = applyDisasterChoice('cope', baseState({ day: 150, shopItems: [
      { id: 's1', name: '羊肉', price: 10, cost: 5, stock: 10, category: '食材' },
      { id: 's2', name: '粗布', price: 8, cost: 4, stock: 10, category: '布匹' },
    ] }), seq(0.5));
    const s1 = r.changes.shopItems!.find((i) => i.id === 's1')!;
    const s2 = r.changes.shopItems!.find((i) => i.id === 's2')!;
    expect(s1.stock).toBe(0);
    expect(s2.stock).toBe(8); // 10 - 20%
    expect(r.ledger!.length).toBeGreaterThan(0);
  });

  it('瘟疫：disasterUntil = day+7（客流减半由 store 应用）', () => {
    const ev = checkNaturalDisaster(baseState({ day: 60 }), seq(0.01, 0.8, 0.8)); // roll≥0.75 → plague
    expect(ev!.payload?.disasterType).toBe('plague');
    const r = applyDisasterChoice('cope', baseState({ day: 60, disasterType: 'plague' }), seq(0.5));
    expect(r.changes.disasterUntil).toBe(67);
    expect(r.changes.disasterType).toBe('plague');
  });
});

describe('人际背叛', () => {
  it('挖角·忠诚拒（满意 ≥80）', () => {
    const ev = buildPoachEvent(emp({ satisfaction: 85 }), 10);
    expect(ev.options.map((o) => o.id)).toEqual(['thank']);
    const r = applyBetrayalChoice(ev.id, 'thank', baseState({ employees: [emp({ satisfaction: 85 })], targetEmployeeId: 'e1', targetEmployeeName: '老赵' }));
    expect(r.changes.employees![0]!.satisfaction).toBe(90);
  });

  it('挖角·匹配开价（满意 40-79）：匹配留人 / 不匹配离职', () => {
    const ev = buildPoachEvent(emp({ satisfaction: 60 }), 10);
    const stay = applyBetrayalChoice(ev.id, 'match', baseState({ employees: [emp({ satisfaction: 60 })], targetEmployeeId: 'e1', targetEmployeeName: '老赵' }));
    expect(stay.changes.employees!.length).toBe(1);
    expect(stay.changes.employees![0]!.satisfaction).toBe(70);
    const leave = applyBetrayalChoice(ev.id, 'no_match', baseState({ employees: [emp({ satisfaction: 60 })], targetEmployeeId: 'e1', targetEmployeeName: '老赵' }));
    expect(leave.changes.employees!.length).toBe(0);
  });

  it('沈听澜使绊：好感≥60 且评分超过他店铺才触发；有线索可对质', () => {
    const ev = buildShenSchemeEvent(baseState({ shenTinglanFavor: 70, score: 4.5, clueIds: ['c1'] }));
    expect(ev).not.toBeNull();
    expect(ev!.options.map((o) => o.id)).toContain('confront');
    expect(buildShenSchemeEvent(baseState({ shenTinglanFavor: 50, score: 4.5 }))).toBeNull();
    const r = applyBetrayalChoice(ev!.id, 'confront', baseState({ shenTinglanFavor: 70, score: 4.5 }));
    expect(r.changes.shenTinglanFavor).toBe(55);
    expect(r.changes.shenSchemeUntil).toBe(0);
  });
});

describe('意外损失', () => {
  it('赊账跑路概率随赊账总额递增（每 100 两 +5% 基础）', () => {
    // tradeCredit=300 → 基础 5% + 3×5% = 20%；rng=0.1 触发
    const ev = checkAccidentalLoss(baseState({ tradeCredit: 300 }), seq(0.1));
    expect(ev).not.toBeNull();
    expect(ev!.id).toBe('neg-credit-runaway');
  });

  it('钱庄挤兑：有存款且 rng<1% 触发；选项置 bankRunDays=30', () => {
    const ev = checkAccidentalLoss(baseState({ deposits: [{ amount: 100 }] }), seq(0.005));
    // 无赊账 → 赊账跑路直接跳过；rng=0.005 < 0.01 → 挤兑触发
    expect(ev).not.toBeNull();
    expect(ev!.id).toBe('neg-bank-run');
  });
});

describe('monthOf · 月度（季节判定）', () => {
  it('day/30 向上取整', () => {
    expect(monthOf(1)).toBe(1);
    expect(monthOf(30)).toBe(1);
    expect(monthOf(31)).toBe(2);
    expect(monthOf(150)).toBe(5);
  });
});
