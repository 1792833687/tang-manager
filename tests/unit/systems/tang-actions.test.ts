/**
 * 每日自由行动系统单测（tang-actions · Step 5a 1.2）
 * 覆盖：getAvailableActions 可用/灰显条件（已用/精力/C 难度低精力/人手满/无可访NPC/次数用尽）、
 *       getVisitNpcOptions 登场过滤（沈听澜/谢七/债主）、executeAfternoonAction 六行动分支
 *       （巡查/访NPC/招聘/小睡/闲逛/非法id）、dailyActionCountFor 难度次数、executeAfternoonActionOnState 包装。
 * 验证驱动：纯函数 + rng 注入确定性。
 */
import { describe, expect, it } from 'vitest';
import {
  getAvailableActions,
  getVisitNpcOptions,
  executeAfternoonAction,
  executeAfternoonActionOnState,
  dailyActionCountFor,
  type AfternoonActionContext,
} from '@/systems/tang-actions';
import { AFTERNOON_ACTION_DEFS } from '@/config/tang-actions-config';
import { useTangManagerStore } from '@/stores/tang-manager';
import { beforeEach } from 'vitest';
import type { Employee } from '@/types/tang-manager';

/** 固定 rng：返回 0.5（巡逻安全/小睡无事/闲逛捡漏分支） */
const rng = (): number => 0.5;

/** 序列 rng：依次弹出；耗尽后返回 0.5 */
const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

const employees: Employee[] = [
  {
    id: 'emp1',
    name: '赵三',
    gender: 'male',
    type: 'waiter',
    salary: 20,
    isSpecial: false,
    skills: [],
    satisfaction: 60,
    hireDay: 1,
    backgroundRevealed: false,
  },
];

function makeCtx(overrides: Partial<AfternoonActionContext> = {}): AfternoonActionContext {
  return {
    energy: 100,
    difficulty: 'B',
    employees,
    maxEmployees: 4,
    dailyActionsRemaining: 2,
    afternoonActions: [],
    xieQiFavor: 20,
    shenTinglanFavor: 30,
    legacyDebt: 200,
    shopType: 'jiulou',
    day: 5,
    eventLog: [],
    xieQiIdentityRevealed: false,
    ...overrides,
  };
}

describe('getAvailableActions · 可用/灰显条件', () => {
  it('精力与条件充足时返回全部 5 个行动且均可用', () => {
    const options = getAvailableActions(makeCtx());
    expect(options).toHaveLength(AFTERNOON_ACTION_DEFS.length);
    expect(options).toHaveLength(5);
    expect(options.every((o) => !o.disabled)).toBe(true);
    expect(options.map((o) => o.id)).toEqual([
      'afternoon_patrol',
      'visit_npc',
      'market_recruit',
      'nap',
      'street_wander',
    ]);
  });

  it('今日已用过的行动灰显并注明「今日已用过」', () => {
    const options = getAvailableActions(makeCtx({ afternoonActions: ['nap'] }));
    const nap = options.find((o) => o.id === 'nap');
    expect(nap?.disabled).toBe(true);
    expect(nap?.disabledReason).toBe('今日已用过');
    expect(options.filter((o) => !o.disabled)).toHaveLength(4);
  });

  it('C 难度精力 <30 时全部行动灰显', () => {
    const options = getAvailableActions(makeCtx({ difficulty: 'C', energy: 29 }));
    expect(options.every((o) => o.disabled)).toBe(true);
    expect(options[0]?.disabledReason).toBe('精力不足 30，行动不便');
  });

  it('精力不足以支付 energyCost 时灰显（nap 为负消耗不拦截）', () => {
    const options = getAvailableActions(makeCtx({ energy: 9 }));
    const patrol = options.find((o) => o.id === 'afternoon_patrol');
    expect(patrol?.disabled).toBe(true);
    expect(patrol?.disabledReason).toBe('精力不足（需 10）');
    // 小睡 +20 精力：即使 energy 很低也不因 energyCost 灰显
    const nap = options.find((o) => o.id === 'nap');
    expect(nap?.disabled).toBeUndefined();
  });

  it('人手已满时 market_recruit 灰显', () => {
    const fullEmployees = Array.from({ length: 4 }, (_, i) => ({ ...employees[0]!, id: `emp${i + 1}` }));
    const options = getAvailableActions(makeCtx({ employees: fullEmployees, maxEmployees: 4 }));
    const recruit = options.find((o) => o.id === 'market_recruit');
    expect(recruit?.disabled).toBe(true);
    expect(recruit?.disabledReason).toBe('人手已满，无处安顿');
  });

  it('无任何可访 NPC 时 visit_npc 灰显', () => {
    const options = getAvailableActions(
      makeCtx({ shenTinglanFavor: 0, xieQiFavor: 0, legacyDebt: 0, eventLog: [], xieQiIdentityRevealed: false })
    );
    const visit = options.find((o) => o.id === 'visit_npc');
    expect(visit?.disabled).toBe(true);
    expect(visit?.disabledReason).toBe('尚无熟识的故人可访');
  });

  it('剩余次数为 0 时全部灰显（防御）', () => {
    const options = getAvailableActions(makeCtx({ dailyActionsRemaining: 0 }));
    expect(options.every((o) => o.disabled)).toBe(true);
    expect(options[0]?.disabledReason).toBe('今日行动次数已用完');
  });
});

describe('getVisitNpcOptions · 登场过滤', () => {
  it('好感/事件均无时三人皆不可访', () => {
    const opts = getVisitNpcOptions(makeCtx({ shenTinglanFavor: 0, xieQiFavor: 0, legacyDebt: 0, eventLog: [] }));
    expect(opts.every((n) => n.unavailableReason)).toBe(true);
  });

  it('沈听澜：好感>0 或 eventLog 含登场事件即可访', () => {
    expect(getVisitNpcOptions(makeCtx({ shenTinglanFavor: 5 }))[0]?.unavailableReason).toBeUndefined();
    expect(
      getVisitNpcOptions(makeCtx({ shenTinglanFavor: 0, eventLog: ['shen-tinglan'] }))[0]?.unavailableReason
    ).toBeUndefined();
  });

  it('谢七：好感>0 / 身份揭晓 / 事件即可访；债主需 legacyDebt>0', () => {
    expect(getVisitNpcOptions(makeCtx())[1]?.unavailableReason).toBeUndefined(); // xieQiFavor=20
    expect(getVisitNpcOptions(makeCtx({ xieQiFavor: 0, xieQiIdentityRevealed: true }))[1]?.unavailableReason).toBeUndefined();
    expect(getVisitNpcOptions(makeCtx({ xieQiFavor: 0, eventLog: ['xie-qi-debt'] }))[1]?.unavailableReason).toBeUndefined();
    expect(getVisitNpcOptions(makeCtx({ xieQiFavor: 0 }))[1]?.unavailableReason).toBe('尚未登场');
    // 债主
    expect(getVisitNpcOptions(makeCtx())[2]?.unavailableReason).toBeUndefined(); // legacyDebt=200
    expect(getVisitNpcOptions(makeCtx({ legacyDebt: 0 }))[2]?.unavailableReason).toBe('已无负债，无需周旋');
  });
});

describe('executeAfternoonAction · 前置拦截', () => {
  it('未知 actionId 返回 null', () => {
    expect(executeAfternoonAction(makeCtx(), 'not_exist', undefined, rng)).toBeNull();
  });

  it('次数用尽 / 已用过 / C 难度低精力 / 精力不足 均返回 null', () => {
    expect(executeAfternoonAction(makeCtx({ dailyActionsRemaining: 0 }), 'nap', undefined, rng)).toBeNull();
    expect(executeAfternoonAction(makeCtx({ afternoonActions: ['nap'] }), 'nap', undefined, rng)).toBeNull();
    expect(executeAfternoonAction(makeCtx({ difficulty: 'C', energy: 29 }), 'nap', undefined, rng)).toBeNull();
    expect(executeAfternoonAction(makeCtx({ energy: 9 }), 'afternoon_patrol', undefined, rng)).toBeNull();
  });

  it('小睡（nap）energyCost=-20 → energyDelta=-20（恢复语义由调用方按负号处理）；rng<0.3 错过事件 -声望1', () => {
    const ok = executeAfternoonAction(makeCtx(), 'nap', undefined, seq(0.5))!;
    expect(ok.energyDelta).toBe(-20);
    expect(ok.missedEvent).toBe(false);
    const missed = executeAfternoonAction(makeCtx(), 'nap', undefined, seq(0.1))!;
    expect(missed.missedEvent).toBe(true);
    expect(missed.reputationDelta).toBe(-1);
  });
});

describe('executeAfternoonAction · 行动分支', () => {
  it('午后巡查：rng>=0.3 平安 +声望1；rng<0.3 发现隐患 -2 两', () => {
    const safe = executeAfternoonAction(makeCtx(), 'afternoon_patrol', undefined, seq(0.5))!;
    expect(safe.reputationDelta).toBe(1);
    expect(safe.goldDelta).toBe(0);
    expect(safe.energyDelta).toBe(10);
    const trouble = executeAfternoonAction(makeCtx(), 'afternoon_patrol', undefined, seq(0.1))!;
    expect(trouble.goldDelta).toBe(-2);
    expect(trouble.reputationDelta).toBe(0);
  });

  it('拜访 NPC：沈听澜/谢七好感 +2~5；债主仅叙事无数值；NPC 未登场返回占位叙事', () => {
    const shen = executeAfternoonAction(makeCtx(), 'visit_npc', 'shen-tinglan', seq(0.5))!;
    expect(shen.shenTinglanFavorDelta).toBe(4); // floor(0.5*4)+2 = 4
    const xie = executeAfternoonAction(makeCtx(), 'visit_npc', 'xie-qi', seq(0.0))!;
    expect(xie.xieQiFavorDelta).toBe(2); // floor(0*4)+2 = 2
    const zhao = executeAfternoonAction(makeCtx(), 'visit_npc', 'zhao-yuanwai', rng)!;
    expect(zhao.shenTinglanFavorDelta).toBeUndefined();
    expect(zhao.narrative).toContain('债主');
    // 未登场 NPC → 占位叙事（不可执行但返回叙事）
    const hidden = executeAfternoonAction(
      makeCtx({ shenTinglanFavor: 0, xieQiFavor: 0, legacyDebt: 0, eventLog: [] }),
      'visit_npc',
      'shen-tinglan',
      rng
    )!;
    expect(hidden.narrative).toContain('作罢');
  });

  it('市场招聘：生成 2~3 名候选（rng<0.5 → 2 人；否则 3 人）', () => {
    const two = executeAfternoonAction(makeCtx(), 'market_recruit', undefined, seq(0.4))!;
    expect(two.candidates).toHaveLength(2);
    const three = executeAfternoonAction(makeCtx(), 'market_recruit', undefined, seq(0.9))!;
    expect(three.candidates).toHaveLength(3);
    expect(three.energyDelta).toBe(10);
  });

  it('市井闲逛：三分支（传闻/捡漏省2两/谢七线索）', () => {
    const rumor = executeAfternoonAction(makeCtx(), 'street_wander', undefined, seq(0.2))!;
    expect(rumor.goldDelta).toBeUndefined();
    const bargain = executeAfternoonAction(makeCtx(), 'street_wander', undefined, seq(0.5))!;
    expect(bargain.goldDelta).toBe(2);
    const xieqi = executeAfternoonAction(makeCtx(), 'street_wander', undefined, seq(0.9))!;
    expect(xieqi.xieQiFavorDelta).toBe(1); // xieQiFavor=20 > 0
    const noFavor = executeAfternoonAction(makeCtx({ xieQiFavor: 0 }), 'street_wander', undefined, seq(0.9))!;
    expect(noFavor.xieQiFavorDelta).toBe(0);
  });
});

describe('dailyActionCountFor · 难度每日行动次数', () => {
  it('A 2 / B 1 / C 1', () => {
    expect(dailyActionCountFor('A')).toBe(2);
    expect(dailyActionCountFor('B')).toBe(1);
    expect(dailyActionCountFor('C')).toBe(1);
  });
});

describe('executeAfternoonActionOnState · TangGameState 包装', () => {
  beforeEach(() => {
    useTangManagerStore.getState().resetGame();
    useTangManagerStore.getState().initByDifficulty('B');
    useTangManagerStore.setState({ energy: 100, xieQiFavor: 20, shenTinglanFavor: 30, legacyDebt: 200 });
  });

  it('透传完整 state 并返回与 executeAfternoonAction 一致结果', () => {
    const state = useTangManagerStore.getState();
    const wrapped = executeAfternoonActionOnState(state, 'visit_npc', 'shen-tinglan', seq(0.5))!;
    const direct = executeAfternoonAction(
      {
        energy: 100,
        difficulty: 'B',
        employees: state.employees,
        maxEmployees: state.maxEmployees,
        dailyActionsRemaining: state.dailyActionsRemaining,
        afternoonActions: state.afternoonActions,
        xieQiFavor: 20,
        shenTinglanFavor: 30,
        legacyDebt: 200,
        shopType: state.shopType,
        day: state.day,
        eventLog: state.eventLog,
        xieQiIdentityRevealed: state.xieQiIdentityRevealed,
      },
      'visit_npc',
      'shen-tinglan',
      seq(0.5)
    )!;
    expect(wrapped.actionId).toBe('visit_npc');
    expect(wrapped.shenTinglanFavorDelta).toBe(direct.shenTinglanFavorDelta);
    expect(wrapped.energyDelta).toBe(direct.energyDelta);
  });

  it('非法 actionId 也返回 null', () => {
    expect(executeAfternoonActionOnState(useTangManagerStore.getState(), 'nope', undefined, rng)).toBeNull();
  });
});
