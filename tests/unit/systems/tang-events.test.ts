/**
 * 事件系统单测（tang-events / 3.1）
 * 覆盖：债主 day 7-10 触发、eventLog 去重、回头客评分条件、沈听澜声望 300、
 *       谢七负债清零、applyEventEffect 数值与 special。
 */
import { describe, expect, it } from 'vitest';
import { EVENT_DEFINITIONS } from '@/config/tang-events';
import {
  applyEventEffect,
  applyInventoryEventSpecial,
  checkAndTriggerEvents,
  checkInventoryEvents,
  eventCanTrigger,
  eventTriggerMet,
  getEventById,
  INVENTORY_EVENT_DEFINITIONS,
} from '@/systems/tang-events';
import type { GameEvent, TangGameState } from '@/types/tang-manager';

function makeEventState(overrides: Partial<TangGameState> = {}): TangGameState {
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
    events: [...EVENT_DEFINITIONS],
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

const debtor = (): GameEvent => getEventById('debtor')!;

describe('checkAndTriggerEvents · 触发条件', () => {
  it('债主事件仅 day 7-10 触发（day=6 不触发、day=7 触发、day=11 不触发）', () => {
    const day6 = makeEventState({ day: 6 });
    expect(checkAndTriggerEvents(day6).some((e) => e.id === 'debtor')).toBe(false);
    const day7 = makeEventState({ day: 7 });
    expect(checkAndTriggerEvents(day7).some((e) => e.id === 'debtor')).toBe(true);
    const day11 = makeEventState({ day: 11 });
    expect(checkAndTriggerEvents(day11).some((e) => e.id === 'debtor')).toBe(false);
  });

  it('债主事件负债为零不触发（day 7-10 且 legacyDebt=0 → false；minDebt 门槛 QA-B）', () => {
    const day7ZeroDebt = makeEventState({ day: 7, legacyDebt: 0, debt: 0 });
    expect(checkAndTriggerEvents(day7ZeroDebt).some((e) => e.id === 'debtor')).toBe(false);
    expect(eventCanTrigger(debtor(), day7ZeroDebt)).toBe(false);
    // 负债>0 仍触发（minDebt=1）
    const day7WithDebt = makeEventState({ day: 7, legacyDebt: 1, debt: 1 });
    expect(eventCanTrigger(debtor(), day7WithDebt)).toBe(true);
  });

  it('回头客事件评分 ≥2.0 触发（1.9 不触发）', () => {
    expect(eventTriggerMet({ type: 'score', minScore: 2.0 }, makeEventState({ score: 1.9 }))).toBe(false);
    expect(eventTriggerMet({ type: 'score', minScore: 2.0 }, makeEventState({ score: 2.0 }))).toBe(true);
  });

  it('沈听澜事件声望 ≥300 触发（299 不触发）', () => {
    expect(eventTriggerMet({ type: 'reputation', minReputation: 300 }, makeEventState({ reputation: 299 }))).toBe(false);
    expect(eventTriggerMet({ type: 'reputation', minReputation: 300 }, makeEventState({ reputation: 300 }))).toBe(true);
  });

  it('谢七事件负债清零触发（legacyDebt=0 触发、>0 不触发）', () => {
    expect(eventTriggerMet({ type: 'debt_zero' }, makeEventState({ legacyDebt: 0 }))).toBe(true);
    expect(eventTriggerMet({ type: 'debt_zero' }, makeEventState({ legacyDebt: 1 }))).toBe(false);
  });

  it('eventLog 去重：已触发过的事件不再返回', () => {
    const state = makeEventState({ day: 7, eventLog: ['debtor'] });
    expect(checkAndTriggerEvents(state).some((e) => e.id === 'debtor')).toBe(false);
    expect(eventCanTrigger(debtor(), state)).toBe(false);
  });
});

describe('applyEventEffect · 选项效果', () => {
  it('债主 A「pay_monthly_interest」：不写死 5，special 标记由 store 按 monthlyInterest 扣（3.1 注释说明）', () => {
    const ev = debtor();
    const choice = ev.choices.find((c) => c.id === 'pay')!;
    const { changes, special } = applyEventEffect(makeEventState(), choice);
    expect(special).toBe('pay_monthly_interest');
    expect(changes.silver).toBeUndefined(); // 金额由 store 读 state.monthlyInterest 应用
  });

  it('债主 B「defy」：special=xiaoer_gone（小二离开 + 好感归零由 store 处理）', () => {
    const ev = debtor();
    const choice = ev.choices.find((c) => c.id === 'defy')!;
    const { special } = applyEventEffect(makeEventState(), choice);
    expect(special).toBe('xiaoer_gone');
  });

  it('债主 C「ask_shen」：special=shen_debt（标记欠沈听澜人情）', () => {
    const ev = debtor();
    const choice = ev.choices.find((c) => c.id === 'ask_shen')!;
    const { special } = applyEventEffect(makeEventState(), choice);
    expect(special).toBe('shen_debt');
  });

  it('沈听澜 A 好感+10 / B 好感-5（数值增减正确）', () => {
    const ev = getEventById('shen-tinglan')!;
    const a = applyEventEffect(makeEventState({ shenTinglanFavor: 20 }), ev.choices[0]!);
    expect(a.changes.shenTinglanFavor).toBe(30);
    expect(a.special).toBe('shen_partner');
    const b = applyEventEffect(makeEventState({ shenTinglanFavor: 20 }), ev.choices[1]!);
    expect(b.changes.shenTinglanFavor).toBe(15);
  });

  it('谢七 A 好感+5 获赌场情报 / B 好感-10', () => {
    const ev = getEventById('xie-qi-debt')!;
    const a = applyEventEffect(makeEventState({ xieQiFavor: 0 }), ev.choices[0]!);
    expect(a.changes.xieQiFavor).toBe(5);
    const b = applyEventEffect(makeEventState({ xieQiFavor: 10 }), ev.choices[1]!);
    expect(b.changes.xieQiFavor).toBe(0); // 10-10 下限 0
  });

  it('回头客 A 精力-5 special=add_big_order_guest / B 满意度+3 special=add_normal_guest', () => {
    const ev = getEventById('repeat-customer')!;
    const a = applyEventEffect(makeEventState({ energy: 80 }), ev.choices[0]!);
    expect(a.changes.energy).toBe(75);
    expect(a.special).toBe('add_big_order_guest');
    const b = applyEventEffect(makeEventState({ xiaoerSatisfaction: 60 }), ev.choices[1]!);
    expect(b.changes.xiaoerSatisfaction).toBe(63);
    expect(b.special).toBe('add_normal_guest');
  });
});

describe('事件定义完整性', () => {
  it('事件 id 唯一且齐全（债主/回头客/沈听澜/谢七）', () => {
    const ids = EVENT_DEFINITIONS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('debtor');
    expect(ids).toContain('repeat-customer');
    expect(ids).toContain('shen-tinglan');
    expect(ids).toContain('xie-qi-debt');
  });

  it('GameEvent.type 字段齐全（用户规格 3.1）', () => {
    const types = Object.fromEntries(EVENT_DEFINITIONS.map((e) => [e.id, e.type]));
    expect(types.debtor).toBe('debt_collection');
    expect(types['repeat-customer']).toBe('regular_customer');
    expect(types['shen-tinglan']).toBe('shen_tinglan');
    expect(types['xie-qi-debt']).toBe('xie_qi');
  });

  it('债主 B「defy」effect 同时带好感/满意度归零 + special=xiaoer_gone', () => {
    const ev = debtor();
    const choice = ev.choices.find((c) => c.id === 'defy')!;
    expect(choice.effect.xiaoerFavor).toBe(0);
    expect(choice.effect.xiaoerSatisfaction).toBe(0);
    expect(choice.effect.special).toBe('xiaoer_gone');
  });
});

// ============================================================
// Step 5b-1.5：库存事件（邻居借粮 / 官府征用 / 乞丐讨食 / 窃贼光顾）
// ============================================================

function makeStockState(overrides: Partial<TangGameState> = {}): TangGameState {
  return makeEventState({
    shopItems: [
      { id: 's1', name: '羊肉', price: 3, cost: 1.8, stock: 20, category: '食材', volume: 3, expiry: 10 },
      { id: 's2', name: '人参', price: 6, cost: 4, stock: 10, category: '药材', volume: 0.5, expiry: 180 },
    ],
    silver: 100,
    reputation: 10,
    ...overrides,
  });
}

describe('checkInventoryEvents · 库存事件触发', () => {
  it('邻居借粮：食材 >20 且概率通过触发', () => {
    const evs = checkInventoryEvents({ shopItems: makeStockState().shopItems }, () => 0.01);
    expect(evs.some((e) => e.id === 'inv-neighbor-borrow')).toBe(true);
    const noTrigger = checkInventoryEvents({ shopItems: makeStockState().shopItems }, () => 0.9);
    expect(noTrigger.some((e) => e.id === 'inv-neighbor-borrow')).toBe(false);
  });

  it('窃贼：库房总值 >100 才可能触发', () => {
    const low = makeStockState({ shopItems: [{ id: 'a', name: '羊肉', price: 3, cost: 1.8, stock: 1, category: '食材', volume: 3 }] });
    expect(checkInventoryEvents({ shopItems: low.shopItems }, () => 0.01).some((e) => e.id === 'inv-thief')).toBe(false);
  });

  it('官府征用：药材 >30 触发条件', () => {
    const herbs = makeStockState({ shopItems: [{ id: 'h', name: '人参', price: 6, cost: 4, stock: 100, category: '药材', volume: 0.5 }] });
    expect(checkInventoryEvents({ shopItems: herbs.shopItems }, () => 0.01).some((e) => e.id === 'inv-requisition')).toBe(true);
  });

  it('库存事件定义齐全（借粮/征用/乞讨/窃贼）', () => {
    expect(INVENTORY_EVENT_DEFINITIONS.map((e) => e.id)).toEqual(['inv-neighbor-borrow', 'inv-requisition', 'inv-beggar', 'inv-thief']);
  });
});

describe('applyInventoryEventSpecial · 库存事件数值', () => {
  it('借粮：耗 5 食材、声望 +2', () => {
    const r = applyInventoryEventSpecial(makeStockState(), 'inv_borrow');
    expect(r.reputation).toBe(12);
    expect(r.shopItems!.find((it) => it.name === '羊肉')!.stock).toBe(15);
  });

  it('官府征用配合：声望 +5', () => {
    expect(applyInventoryEventSpecial(makeStockState(), 'inv_requisition_accept').reputation).toBe(15);
  });

  it('官府征用请求减免：扣两成价、30% 概率得罪', () => {
    const r = applyInventoryEventSpecial(makeStockState(), 'inv_requisition_reduce', () => 0.1);
    expect(r.silver).toBe(92); // 100 - 8（人参 10×4=40 ×0.2）
    expect(r.reputation).toBe(5); // 得罪 -5
  });

  it('乞丐施舍：耗 2 食材、声望 +3', () => {
    const r = applyInventoryEventSpecial(makeStockState(), 'inv_beggar_alms');
    expect(r.reputation).toBe(13);
    expect(r.shopItems!.find((it) => it.name === '羊肉')!.stock).toBe(18);
  });

  it('窃贼报官：半概率追回（声望+2）；失败损 5% 库房价值', () => {
    const success = applyInventoryEventSpecial(makeStockState(), 'inv_thief_report', () => 0.4);
    expect(success.reputation).toBe(12);
    expect(success.silver).toBeUndefined();
    const fail = applyInventoryEventSpecial(makeStockState(), 'inv_thief_report', () => 0.6);
    expect(fail.silver).toBe(100 - 3.8); // 库房价值 76 × 5%
  });

  it('窃贼自认倒霉：损 5% 库房价值', () => {
    expect(applyInventoryEventSpecial(makeStockState(), 'inv_thief_loss').silver).toBe(100 - 3.8);
  });
});

