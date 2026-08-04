/**
 * 内容深化 TANG-CONT-C 模块二单测（午后自由行动实质化）
 * 覆盖：午后巡查隐患生成/处置（修缮/偷懒/小偷）、延后修缮到期坍塌、
 *       拜访 NPC（对话/好感/情报）、小睡突发事件、市井闲逛五结果、统一分派校验。
 * 验证驱动：纯函数 + rng 注入确定性。
 */
import { describe, expect, it } from 'vitest';
import {
  rollPatrolHazards,
  rollPatrolHazard,
  resolvePatrolHazardChoice,
  checkPostponedPatrol,
  performVisitNpc,
  performNap,
  performStroll,
  performAfternoonActionCore,
  visitableNpcs,
  POSTPONE_DEADLINE_DAYS,
} from '@/systems/tang-afternoon-actions';
import type { AfternoonActionContext } from '@/systems/tang-actions';
import type { Employee, ShopItem } from '@/types/tang-manager';

const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

const employees: Employee[] = [
  {
    id: 'emp1',
    name: '赵三',
    gender: 'male',
    type: 'waiter',
    salary: 20,
    skills: [],
    satisfaction: 60,
    hireDay: 1,
    backgroundRevealed: false,
  },
];

const shopItems: ShopItem[] = [{ id: 'i1', name: '米酒', price: 4, cost: 2, stock: 10, category: '食材', volume: 1, expiry: -1, status: 'normal' }];

function makeCore(overrides: Partial<AfternoonActionContext> = {}): Parameters<typeof performAfternoonActionCore>[0] {
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
    silver: 100,
    xiaoerFavor: 40,
    xiaoerSatisfaction: 60,
    shopItems,
    ...overrides,
  };
}

describe('午后巡查（模块二·1）', () => {
  it('rollPatrolHazards 返回 1-2 个隐患且类型合法；修缮隐患带 repairCost', () => {
    const hazards = rollPatrolHazards(seq(0.5), { day: 1, silver: 0, employees });
    expect(hazards.length).toBeGreaterThanOrEqual(1);
    expect(hazards.length).toBeLessThanOrEqual(2);
    for (const h of hazards) {
      expect(['repair', 'slack', 'thief']).toContain(h.kind);
      expect(h.narrative.length).toBeGreaterThan(0);
    }
    // 固定 0.1 → 修缮（60%）
    const repair = rollPatrolHazard({ day: 1, silver: 0, employees }, seq(0.1));
    expect(repair.kind).toBe('repair');
    expect(repair.repairCost).toBeGreaterThan(0);
  });

  it('修缮隐患：立即修缮扣银两并解决；银两不足由 store 拦截（纯函数仍返回负金）', () => {
    const hazard = rollPatrolHazard({ day: 1, silver: 100, employees }, seq(0.1, 0.5));
    const res = resolvePatrolHazardChoice(hazard, 'fix', { day: 1 });
    expect(res.resolved).toBe(true);
    expect(res.goldDelta).toBe(-(hazard.repairCost ?? 0));
  });

  it('修缮隐患：延后则 postponed=true 且 deadlineDay=day+10', () => {
    const hazard = rollPatrolHazard({ day: 1, silver: 100, employees }, seq(0.1, 0.5));
    const res = resolvePatrolHazardChoice(hazard, 'delay', { day: 1 });
    expect(res.resolved).toBe(false);
    expect(res.postponed).toBe(true);
    expect(res.deadlineDay).toBe(1 + POSTPONE_DEADLINE_DAYS);
  });

  it('员工偷懒：训诫→满意度-8 且清除偷懒；无视→保留偷懒标记', () => {
    const hazard = rollPatrolHazard({ day: 1, silver: 0, employees }, seq(0.7));
    expect(hazard.kind).toBe('slack');
    const admonish = resolvePatrolHazardChoice(hazard, 'admonish', { day: 1 });
    expect(admonish.employeeDelta?.satisfactionChange).toBe(-8);
    expect(admonish.clearSlack).toBe(true);
    const ignore = resolvePatrolHazardChoice(hazard, 'ignore', { day: 1 });
    expect(ignore.addSlack).toBe(true);
    expect(ignore.resolved).toBe(true);
  });

  it('小偷迹象：加固门锁 / 雇护卫分别扣对应银两', () => {
    const hazard = rollPatrolHazard({ day: 1, silver: 0, employees }, seq(0.95));
    expect(hazard.kind).toBe('thief');
    const lock = resolvePatrolHazardChoice(hazard, 'lock', { day: 1 });
    expect(lock.goldDelta).toBe(-(hazard.lockCost ?? 0));
    const guard = resolvePatrolHazardChoice(hazard, 'guard', { day: 1 });
    expect(guard.goldDelta).toBe(-(hazard.guardCost ?? 0));
  });

  it('checkPostponedPatrol：到期未修 → 坍塌损失（扣银两/声望/评分）；未到期保留', () => {
    const overdue = { id: 'h1', kind: 'repair' as const, title: '修缮隐患', narrative: 'x', repairCost: 8, deadlineDay: 5 };
    const pending = { id: 'h2', kind: 'repair' as const, title: '修缮隐患', narrative: 'x', repairCost: 8, deadlineDay: 20 };
    const { remaining, collapsed } = checkPostponedPatrol([overdue, pending], 10, seq(0.5));
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]!.goldDelta).toBeLessThan(0);
    expect(collapsed[0]!.reputationDelta).toBeLessThan(0);
    expect(collapsed[0]!.scoreDelta).toBeLessThan(0);
    expect(remaining.map((h) => h.id)).toEqual(['h2']);
  });
});

describe('拜访 NPC（模块二·2）', () => {
  it('visitableNpcs 含阿昭；沈听澜/谢七未登场时不可拜访', () => {
    const npcs = visitableNpcs({ shenTinglanFavor: 0, xieQiFavor: 0, xiaoerFavor: 40, legacyDebt: 200, eventLog: [], xieQiIdentityRevealed: false, shopType: 'jiulou' });
    const shen = npcs.find((n) => n.npcId === 'shen-tinglan');
    const azhao = npcs.find((n) => n.npcId === 'a-zhao');
    expect(shen?.unavailableReason).toBe('尚未登场');
    expect(azhao?.unavailableReason).toBeUndefined(); // 阿昭常驻可访
  });

  it('拜访沈听澜：好感 +3~8、返回 3-5 句对话', () => {
    const v = performVisitNpc(
      { shenTinglanFavor: 30, xieQiFavor: 20, xiaoerFavor: 40, legacyDebt: 200, eventLog: ['shen-tinglan'], xieQiIdentityRevealed: false, shopType: 'jiulou' },
      'shen-tinglan',
      seq(0.9)
    );
    expect(v.ok).toBe(true);
    expect(v.favorDelta).toBeGreaterThanOrEqual(3);
    expect(v.favorDelta).toBeLessThanOrEqual(8);
    expect(v.dialogue.length).toBeGreaterThanOrEqual(3);
    expect(v.dialogue.length).toBeLessThanOrEqual(5);
    expect(v.intel).toBeUndefined(); // rng 0.9 ≥ 0.2 不触发情报
  });

  it('拜访 20% 获得额外情报（clue 描述）；未登场 NPC 拒绝', () => {
    const v = performVisitNpc(
      { shenTinglanFavor: 0, xieQiFavor: 20, xiaoerFavor: 40, legacyDebt: 200, eventLog: [], xieQiIdentityRevealed: false, shopType: 'jiulou' },
      'shen-tinglan',
      seq(0.1, 0.1)
    );
    expect(v.ok).toBe(false);
    const a = performVisitNpc(
      { shenTinglanFavor: 30, xieQiFavor: 20, xiaoerFavor: 40, legacyDebt: 200, eventLog: ['shen-tinglan'], xieQiIdentityRevealed: false, shopType: 'jiulou' },
      'a-zhao',
      seq(0.1, 0.1, 0.1)
    );
    expect(a.ok).toBe(true);
    expect(a.intel?.kind).toBe('clue');
  });
});

describe('小睡片刻（模块二·3）', () => {
  it('无突发事件时精力 +20（由 store 应用）叙事平安', () => {
    const n = performNap(seq(0.9));
    expect(n.napEvent).toBe('none');
    expect(n.xiaoerSatisfactionDelta).toBe(0);
    expect(n.narrative).toContain('安稳');
  });

  it('30% 触发阿昭挡麻烦：阿昭满意度-2', () => {
    const n = performNap(seq(0.2, 0.5));
    expect(n.napEvent).toBe('azhao_helped');
    expect(n.xiaoerSatisfactionDelta).toBe(-2);
  });

  it('30% 触发贵客错过（损失大单机会叙事）', () => {
    const n = performNap(seq(0.2, 0.1));
    expect(n.napEvent).toBe('big_order_missed');
    expect(n.narrative).toContain('大单');
  });
});

describe('市井闲逛（模块二·4）', () => {
  it('40% 坊间传闻：intel kind=rumor（clue 描述）', () => {
    const s = performStroll({ day: 5, shopType: 'jiulou', xieQiFavor: 20, shopItems }, seq(0.3, 0.1));
    expect(s.strollKind).toBe('rumor');
    expect(s.intel?.kind).toBe('rumor');
    expect(s.goldDelta).toBe(0);
  });

  it('25% 捡漏：商品市价七折限当日', () => {
    const s = performStroll({ day: 5, shopType: 'jiulou', xieQiFavor: 20, shopItems }, seq(0.5, 0));
    expect(s.strollKind).toBe('bargain');
    expect(s.bargain).toBeDefined();
    expect(s.bargain!.day).toBe(5);
    expect(s.bargain!.price).toBeLessThanOrEqual(4 * 0.7 + 1e-9); // 米酒 4 × 0.7
  });

  it('15% 遇谢七：好感+1（已登场）；10% 小偷光顾：损失 5-20 两；10% 无事', () => {
    const xie = performStroll({ day: 5, shopType: 'jiulou', xieQiFavor: 20, shopItems }, seq(0.7));
    expect(xie.strollKind).toBe('xieqi');
    expect(xie.xieQiFavorDelta).toBe(1);
    const thief = performStroll({ day: 5, shopType: 'jiulou', xieQiFavor: 20, shopItems }, seq(0.85, 0.5));
    expect(thief.strollKind).toBe('thief');
    expect(thief.goldDelta).toBeLessThan(0);
    expect(thief.goldDelta).toBeGreaterThanOrEqual(-20);
    const none = performStroll({ day: 5, shopType: 'jiulou', xieQiFavor: 20, shopItems }, seq(0.95));
    expect(none.strollKind).toBe('none');
  });
});

describe('统一分派（performAfternoonActionCore）', () => {
  it('精力不足/已用过/次数不足返回 null', () => {
    expect(performAfternoonActionCore(makeCore({ energy: 5 }), 'afternoon_patrol', {}, seq(0.1))).toBeNull();
    expect(performAfternoonActionCore(makeCore({ afternoonActions: ['nap'] }), 'nap', {}, seq(0.1))).toBeNull();
    expect(performAfternoonActionCore(makeCore({ dailyActionsRemaining: 0 }), 'nap', {}, seq(0.1))).toBeNull();
  });

  it('午后巡查返回 patrolHazards 且消耗 10 精力；小睡恢复 +20', () => {
    const patrol = performAfternoonActionCore(makeCore(), 'afternoon_patrol', {}, seq(0.1));
    expect(patrol).not.toBeNull();
    expect(patrol!.energyDelta).toBe(-10);
    expect(patrol!.patrolHazards!.length).toBeGreaterThanOrEqual(1);
    const nap = performAfternoonActionCore(makeCore(), 'nap', {}, seq(0.9));
    expect(nap!.energyDelta).toBe(20);
  });

  it('市场招聘兼容 legacy：返回候选人', () => {
    const rec = performAfternoonActionCore(makeCore(), 'market_recruit', {}, seq(0.5, 0.1, 0.2));
    expect(rec).not.toBeNull();
    expect(rec!.candidates).toBeDefined();
  });
});
