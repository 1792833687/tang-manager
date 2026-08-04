/**
 * 结算系统单测（tang-settlement）
 * 覆盖：基础收益档位与员工效率系数、净收益公式、评分变动（good/bad 汇总、10天+0.05）、
 *       声望变动（好评/有身份光顾）、小二好感、成就检测（第一桶金/回头客）、账本条目。
 */
import { describe, expect, it } from 'vitest';
import {
  satisfactionCoefficient,
  scoreBracketBase,
  settleDay,
  applyOverwork,
} from '@/systems/tang-settlement';
import type { Employee, Guest, TangGameState } from '@/types/tang-manager';

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

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    name: '李四',
    type: 'normal',
    description: 'x',
    baseConsumption: 4,
    mentalOS: null,
    handled: true,
    review: 'good',
    incomeEarned: 4,
    ...overrides,
  };
}

/** 固定 rng：返回 0.5（基础收益取区间中点；支出 2 项采购，无概率项） */
const rng = (): number => 0.5;

/** 序列 rng：依次弹出；耗尽后返回 0.5 */
const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

describe('评分档位与员工效率系数', () => {
  it('档位区间映射正确', () => {
    expect(scoreBracketBase(1.5)).toEqual([5, 10]);
    expect(scoreBracketBase(2.5)).toEqual([10, 20]);
    expect(scoreBracketBase(3.5)).toEqual([20, 35]);
    expect(scoreBracketBase(4.2)).toEqual([35, 55]);
    expect(scoreBracketBase(4.8)).toEqual([55, 80]);
  });

  it('评分 <1.0（C 难度初始 0.8）按最低档 [5,10]', () => {
    expect(scoreBracketBase(0.8)).toEqual([5, 10]);
  });

  it('员工效率系数：≥80→1.2 / 60-79→1.0 / 40-59→0.8 / <40→0.5', () => {
    expect(satisfactionCoefficient(80)).toBe(1.2);
    expect(satisfactionCoefficient(60)).toBe(1.0);
    expect(satisfactionCoefficient(40)).toBe(0.8);
    expect(satisfactionCoefficient(39)).toBe(0.5);
  });
});

describe('settleDay · 基础收益与净收益', () => {
  it('基础收益 = 档位中点 × 效率系数（评分2.0→[10,20]中点15，满意度60→1.0）', () => {
    const state = makeState({ score: 2.0, xiaoerSatisfaction: 60 });
    const { settlement } = settleDay(state, rng);
    expect(settlement.baseIncome).toBeCloseTo(15, 5);
  });

  it('满意度 ≥80 效率 1.2（评分1.0→[5,10]中点7.5 × 1.2 = 9）', () => {
    const state = makeState({ score: 1.0, xiaoerSatisfaction: 90 });
    const { settlement } = settleDay(state, rng);
    expect(settlement.baseIncome).toBeCloseTo(9, 5);
  });

  it('净收益 = 基础收益 + 客单消费 - 支出（rng 序列：无惩罚、1 项采购）', () => {
    const guests = [makeGuest({ incomeEarned: 4 }), makeGuest({ id: 'g2', incomeEarned: 5 })];
    const state = makeState({ score: 2.0, xiaoerSatisfaction: 60, guests });
    // 序列：0.5(基础15) → 0.9(惩罚否) → 0(1项采购) → 0.5(采购5.5) → 0.9/0.9(无概率项)
    const { settlement } = settleDay(state, seq(0.5, 0.9, 0, 0.5, 0.9, 0.9));
    expect(settlement.baseIncome).toBeCloseTo(15, 5);
    expect(settlement.guestIncome).toBeCloseTo(9, 5);
    expect(settlement.expenses).toBeCloseTo(5.5, 5);
    expect(settlement.netIncome).toBeCloseTo(15 + 9 - 5.5, 5);
  });
});

describe('settleDay · 评分变动', () => {
  it('每单 good +0.01 / bad -0.02（3 好 1 差 = +0.01）', () => {
    const guests = [
      makeGuest({ review: 'good' }),
      makeGuest({ id: 'g2', review: 'good' }),
      makeGuest({ id: 'g3', review: 'good' }),
      makeGuest({ id: 'g4', review: 'bad' }),
    ];
    const state = makeState({ score: 2.0, guests });
    const { scoreChange } = settleDay(state, rng);
    expect(scoreChange).toBeCloseTo(0.01, 5);
  });

  it('每满 10 天额外 +0.05（day=10）', () => {
    const guests = [makeGuest({ review: 'good' })];
    const day10 = settleDay(makeState({ score: 2.0, day: 10, guests }), rng);
    expect(day10.scoreChange).toBeCloseTo(0.06, 5); // 0.01 + 0.05
    const day9 = settleDay(makeState({ score: 2.0, day: 9, guests }), rng);
    expect(day9.scoreChange).toBeCloseTo(0.01, 5);
  });

  it('评分封顶 5.0 后回写实际变动', () => {
    const guests = [makeGuest({ review: 'good' }), makeGuest({ id: 'g2', review: 'good' })];
    const state = makeState({ score: 4.99, guests });
    const { scoreChange, settlement } = settleDay(state, rng);
    expect(scoreChange).toBeCloseTo(0.01, 5); // 4.99 → 5.0
    expect(settlement.scoreChange).toBeCloseTo(0.01, 5);
  });
});

describe('settleDay · 声望变动', () => {
  it('好评≥3 触发夸奖 +2', () => {
    const guests = [
      makeGuest({ review: 'good' }),
      makeGuest({ id: 'g2', review: 'good' }),
      makeGuest({ id: 'g3', review: 'good' }),
    ];
    const { reputationChange } = settleDay(makeState({ guests }), rng);
    expect(reputationChange).toBe(2);
  });

  it('当日有 20% 夸奖（praised 标记）触发 +2', () => {
    const guests = [makeGuest({ praised: true, review: 'good' })];
    const { reputationChange } = settleDay(makeState({ guests }), rng);
    expect(reputationChange).toBe(2);
  });

  it('有身份光顾（big_order/special 已接待）额外 +5', () => {
    const guests = [makeGuest({ type: 'big_order', praised: true, review: 'good' })];
    const { reputationChange } = settleDay(makeState({ guests }), rng);
    expect(reputationChange).toBe(2 + 5);
  });
});

describe('settleDay · 小二好感与精力', () => {
  it('净收益>0 → 好感+1；净收益<0 → -1', () => {
    const profit = makeState({ guests: [makeGuest({ incomeEarned: 200 })] });
    expect(settleDay(profit, rng).xiaoerFavorChange).toBe(1);
    // 无客人且基础收益被高支出吞噬 → 净收益为负
    const loss = makeState({ score: 1.0, xiaoerSatisfaction: 30, guests: [] });
    expect(settleDay(loss, rng).xiaoerFavorChange).toBe(-1);
  });

  it('精力消耗汇总 = dailyEnergyConsumed（自由活动 0）', () => {
    const { settlement } = settleDay(makeState({ dailyEnergyConsumed: 15 }), rng);
    expect(settlement.energyConsumed).toBe(15);
  });
});

describe('settleDay · 成就检测与账本', () => {
  it('netIncome≥100 解锁「第一桶金」', () => {
    const guests = [makeGuest({ incomeEarned: 100 })];
    const { newlyUnlocked } = settleDay(makeState({ score: 4.5, xiaoerSatisfaction: 90, guests }), rng);
    expect(newlyUnlocked).toContain('first-bucket');
  });

  it('评分≥4.0 解锁「回头客」（已解锁不重复返回）', () => {
    const withUnlock = settleDay(makeState({ score: 4.0, unlockedAchievements: ['regular-customer'] }), rng);
    expect(withUnlock.newlyUnlocked).not.toContain('regular-customer');
    const fresh = settleDay(makeState({ score: 4.0 }), rng);
    expect(fresh.newlyUnlocked).toContain('regular-customer');
  });

  it('账本条目：基础营收(经营)+ 客单消费(接待)+ 支出项(支出，负数)', () => {
    const guests = [makeGuest({ incomeEarned: 4 })];
    // 序列：0.5(基础15) → 0.9(惩罚否) → 0(1项采购) → 0.5(采购5.5) → 0.9/0.9(无概率项)
    const { ledgerEntries } = settleDay(makeState({ guests }), seq(0.5, 0.9, 0, 0.5, 0.9, 0.9));
    expect(ledgerEntries).toHaveLength(3); // 经营 + 接待 + 支出
    const categories = ledgerEntries.map((e) => e.category);
    expect(categories).toContain('经营');
    expect(categories).toContain('接待');
    expect(categories).toContain('支出');
    const expense = ledgerEntries.find((e) => e.category === '支出')!;
    expect(expense.amount).toBeLessThan(0);
  });
});

// ============================================================
// Step 5a 2.6：员工影响 / 1.3：难度微调
// ============================================================

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'e1',
    name: '赵铁柱',
    gender: 'male',
    type: 'waiter',
    salary: 6,
    skills: [],
    isSpecial: false,
    satisfaction: 60,
    hireDay: 1,
    backgroundRevealed: false,
    ...overrides,
  };
}

describe('settleDay · 员工影响（2.6）', () => {
  it('在职员工平均满意度≥80 → 基础收益系数 +0.1（评分1.0×效率1.0 + 0.1 = 1.1 → 7.5×1.1=8.25 → round1=8.3）', () => {
    const employees = [makeEmployee({ satisfaction: 90 }), makeEmployee({ id: 'e2', satisfaction: 85 })];
    const state = makeState({ score: 1.0, xiaoerSatisfaction: 60, employees });
    // 0.5(基础7.5) → 0.5(惩罚否,B=0.15) → 支出序列
    const { settlement } = settleDay(state, seq(0.5, 0.9, 0, 0.5, 0.9, 0.9));
    expect(settlement.baseIncome).toBeCloseTo(8.3, 5);
  });

  it('对应店型技师 → 出品品质加成 +0.2~0.5（随机；有品质技能再 +0.1）', () => {
    const chef = makeEmployee({
      type: 'chef',
      skills: [{ id: 'q-chef', name: '招牌菜秘方', type: 'quality', description: 'x', requiresType: ['chef'] }],
    });
    const state = makeState({ score: 1.0, xiaoerSatisfaction: 60, employees: [chef] });
    // 0.5(基础7.5) → 0.5(品质 rng → 0.35+0.1=0.45 → 7.5×1.45=10.875→10.9) → 0.9(惩罚否) → 支出
    const { settlement } = settleDay(state, seq(0.5, 0.5, 0.9, 0, 0.5, 0.9, 0.9));
    expect(settlement.baseIncome).toBeCloseTo(10.9, 5);
  });

  it('有账房 → 随机支出概率 -30%（管理不善丢失 0.1→0.07；rng=0.09 本会触发但账房挡住）', () => {
    const accountant = makeEmployee({ type: 'accountant' });
    const state = makeState({ employees: [accountant] });
    // 0.5(基础15) → 0.9(惩罚否) → 0.5(2项采购) → 0.5/0.5(金额) → 0.09(丢失: 0.09<0.07? 否) → 0.5(跑路)
    const { ledgerEntries } = settleDay(state, seq(0.5, 0.9, 0.5, 0.5, 0.5, 0.09, 0.5));
    expect(ledgerEntries.some((e) => e.project === '管理不善丢失')).toBe(false);
    // 对照组：无账房时 0.09 < 0.1 → 触发丢失
    const noAccountant = settleDay(makeState(), seq(0.5, 0.9, 0.5, 0.5, 0.5, 0.09, 0.5));
    expect(noAccountant.ledgerEntries.some((e) => e.project === '管理不善丢失')).toBe(true);
  });

  it('有护卫 → 管理不善丢失概率 -50%（0.1→0.05；rng=0.07 无护卫会触发、有护卫挡住）', () => {
    const guard = makeEmployee({ type: 'guard' });
    const state = makeState({ employees: [guard] });
    const { ledgerEntries } = settleDay(state, seq(0.5, 0.9, 0.5, 0.5, 0.5, 0.07, 0.5));
    expect(ledgerEntries.some((e) => e.project === '管理不善丢失')).toBe(false);
    // 对照组：无护卫时 0.07 < 0.1 → 触发丢失
    const noGuard = settleDay(makeState(), seq(0.5, 0.9, 0.5, 0.5, 0.5, 0.07, 0.5));
    expect(noGuard.ledgerEntries.some((e) => e.project === '管理不善丢失')).toBe(true);
  });

  it('过劳（满意度<30 且工作）→ 满意度 -5；连续 3 天离职', () => {
    const emp = makeEmployee({ satisfaction: 25, overworkDays: 1 });
    const state = makeState({ employees: [emp] });
    const result = settleDay(state, rng);
    expect(result.suggestions.employees![0]!.satisfaction).toBe(20);
    expect(result.suggestions.employees![0]!.overworkDays).toBe(2);
    expect(result.suggestions.eventLog).toBeUndefined(); // 未到 3 天不离职
    // 第 3 天：overworkDays=2 → 3 → 离职
    const emp2 = makeEmployee({ satisfaction: 25, overworkDays: 2 });
    const result2 = settleDay(makeState({ employees: [emp2] }), rng);
    expect(result2.suggestions.employees).toHaveLength(0);
    expect(result2.suggestions.eventLog![0]).toContain('emp-overwork-quit');
  });

  it('休假员工不参与平均满意度/技师判定、不扣满意', () => {
    const rest = makeEmployee({ id: 'e1', satisfaction: 90, restToday: true });
    const state = makeState({ score: 1.0, xiaoerSatisfaction: 60, employees: [rest] });
    const { settlement, suggestions } = settleDay(state, seq(0.5, 0.9, 0, 0.5, 0.9, 0.9));
    // 休假不参与 → 无 +0.1；且结算后 restToday 清空
    expect(settlement.baseIncome).toBeCloseTo(7.5, 5);
    expect(suggestions.employees![0]!.restToday).toBe(false);
    expect(suggestions.employees![0]!.satisfaction).toBe(90);
  });
});

describe('settleDay · 难度微调（1.3）', () => {
  it('C 难度 penaltyChance=0.3：rng<0.3 → 基础收益 ×(0.5~0.8) 打折', () => {
    const state = makeState({ difficulty: 'C', score: 2.0, xiaoerSatisfaction: 60 });
    // 0.5(基础15) → 0.1(触发惩罚) → 0.5(折扣 0.5+0.5*0.3=0.65 → 15×0.65=9.75 → round1=9.8) → 支出序列
    const { settlement } = settleDay(state, seq(0.5, 0.1, 0.5, 0, 0.5, 0.9, 0.9));
    expect(settlement.baseIncome).toBeCloseTo(9.8, 5);
  });

  it('A 难度 penaltyChance=0.03：rng=0.1（≥0.03）不打折', () => {
    const state = makeState({ difficulty: 'A', score: 2.0, xiaoerSatisfaction: 60 });
    const { settlement } = settleDay(state, seq(0.5, 0.1, 0, 0.5, 0.9, 0.9));
    expect(settlement.baseIncome).toBeCloseTo(15, 5);
  });

  it('C 难度特殊支出翻倍：跑路概率 0.05→0.1；rng=0.09 本不触发（B）→ C 触发', () => {
    const state = makeState({ difficulty: 'C' });
    // 0.5(基础15) → 0.9(惩罚否) → 0(1项采购) → 0.5(5.5) → 0.9(丢失 0.9<0.2? 否) → 0.09(跑路 0.09<0.1 → 触发)
    const { settlement } = settleDay(state, seq(0.5, 0.9, 0, 0.5, 0.9, 0.09));
    // 跑路金额 3-10（rng 0.5 → 6.5）+ 采购 5.5 → 支出 12.0
    expect(settlement.expenses).toBeCloseTo(12, 5);
  });

  it('员工建议加成（2.5）顺延：employeeBonusRate>0 → 基础收益 ×(1+rate)', () => {
    const state = makeState({ score: 2.0, xiaoerSatisfaction: 60, employeeBonusRate: 0.02 });
    const { settlement } = settleDay(state, seq(0.5, 0.9, 0, 0.5, 0.9, 0.9));
    expect(settlement.baseIncome).toBeCloseTo(15 * 1.02, 5);
  });
});

describe('applyOverwork · 边界', () => {
  it('满意度≥30 不累计过劳', () => {
    const emp = makeEmployee({ satisfaction: 40 });
    const { employees } = applyOverwork([emp]);
    expect(employees[0]!.overworkDays).toBeUndefined();
    expect(employees[0]!.satisfaction).toBe(40);
  });
});
