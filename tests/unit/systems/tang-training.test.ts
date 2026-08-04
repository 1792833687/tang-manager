/**
 * 学艺/拜师系统单测（tang-training · TANG-SOC-001 模块三）
 * 覆盖：束脩（50+每级30）、周期（3-7 天）、学艺中不可排班（冲突由 scheduling 处理，此处验证 completionDay）、
 *       学成 effect×1.5 / 解锁新技能、失败 5%（满意度-10）、拜师（地图区域解锁/费用/绝技）、阿昭成长。
 */
import { describe, expect, it } from 'vitest';
import {
  sendForTraining,
  checkTrainingCompletion,
  findMaster,
  azhaoGrowth,
  TRAINING_BASE_COST,
  TRAINING_COST_PER_SKILL,
  TRAINING_FAIL_RATE,
  TRAINING_EFFECT_MULTIPLIER,
} from '@/systems/tang-training';
import type { Employee } from '@/types/tang-manager';

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

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

describe('sendForTraining 束脩与周期', () => {
  it('束脩 = 50 + 每级 30（按已有技能数）', () => {
    const emp = makeEmployee({ skills: [{ id: 'q-waiter', name: 'a', type: 'quality', description: 'x', requiresType: ['waiter'] }] });
    const res = sendForTraining(emp.id, 'e-waiter', [emp], 500, 1, seq(0.5));
    expect(res!.ok).toBe(true);
    expect(res!.cost).toBe(TRAINING_BASE_COST + 1 * TRAINING_COST_PER_SKILL);
  });

  it('周期 3-7 天（复杂度+技能数+rng）', () => {
    const emp = makeEmployee();
    const res = sendForTraining(emp.id, 'e-waiter', [emp], 500, 1, seq(0.99));
    expect(res!.durationDays).toBeGreaterThanOrEqual(3);
    expect(res!.durationDays).toBeLessThanOrEqual(7);
    expect(res!.completionDay).toBe(1 + res!.durationDays);
  });

  it('银两不足拒绝', () => {
    const emp = makeEmployee();
    const res = sendForTraining(emp.id, 'e-waiter', [emp], 10, 1, seq(0.5));
    expect(res!.ok).toBe(false);
  });

  it('学艺中不可再学（trainingCompletionDay > day）', () => {
    const emp = makeEmployee({ trainingCompletionDay: 8 });
    const res = sendForTraining(emp.id, 'e-waiter', [emp], 500, 1, seq(0.5));
    expect(res!.ok).toBe(false);
  });
});

describe('checkTrainingCompletion 学成/失败', () => {
  it('学成：解锁新技能（skills 追加）', () => {
    const emp = makeEmployee({ trainingCompletionDay: 5, trainedSkillIds: ['e-waiter'] });
    const res = checkTrainingCompletion([emp], 5, seq(0.9)); // rng≥0.05 → 成功
    expect(res.results[0]!.success).toBe(true);
    expect(res.employees[0]!.skills.some((s) => s.id === 'e-waiter')).toBe(true);
  });

  it('学成：已有技能 → effect×1.5（不重复解锁）', () => {
    const emp = makeEmployee({
      trainingCompletionDay: 5,
      trainedSkillIds: ['q-waiter'],
      skills: [{ id: 'q-waiter', name: '待客如沐春风', type: 'quality', description: 'x', requiresType: ['waiter'] }],
    });
    const res = checkTrainingCompletion([emp], 5, seq(0.9));
    expect(res.results[0]!.success).toBe(true);
    expect(res.results[0]!.effectMultiplier).toBe(TRAINING_EFFECT_MULTIPLIER);
    expect(res.employees[0]!.skills).toHaveLength(1); // 不重复
  });

  it('失败 5%：满意度-10', () => {
    const emp = makeEmployee({ trainingCompletionDay: 5, trainedSkillIds: ['e-waiter'], satisfaction: 60 });
    const res = checkTrainingCompletion([emp], 5, seq(0.01)); // rng<0.05 → 失败
    expect(res.results[0]!.success).toBe(false);
    expect(res.employees[0]!.satisfaction).toBe(50);
    expect(res.employees[0]!.trainingCompletionDay).toBeUndefined();
  });
});

describe('findMaster 拜师授业', () => {
  it('需地图对应区域解锁（east_west_market）', () => {
    const res = findMaster('quality', ['yongle'], 'jiulou', seq(0.5));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('东市西市');
  });

  it('已解锁 → 费用 200+、周期 2-4 天、成功率 95%', () => {
    const res = findMaster('quality', ['yongle', 'east_west_market'], 'jiulou', seq(0.5));
    expect(res.ok).toBe(true);
    expect(res.cost).toBeGreaterThanOrEqual(200);
    expect(res.durationDays).toBeGreaterThanOrEqual(2);
    expect(res.durationDays).toBeLessThanOrEqual(4);
    expect(res.successRate).toBe(0.95);
  });

  it('10% 隐藏绝技（宫廷秘方 酒楼售价+30%）', () => {
    // rng 顺序：masterName → cost → duration → hidden（第 4 个 rng<0.1 → 绝技）
    const res = findMaster('quality', ['yongle', 'east_west_market'], 'jiulou', seq(0.5, 0.5, 0.5, 0.05));
    expect(res.ok).toBe(true);
    expect(res.hiddenMasterpiece).toBeTruthy();
    expect(res.hiddenMasterpiece!.name).toBe('宫廷秘方');
    expect(res.hiddenMasterpiece!.effect.value).toBe(0.3);
  });
});

describe('azhaoGrowth 阿昭成长（3.3 逐字占位）', () => {
  it('好感 <60 无成长', () => {
    expect(azhaoGrowth(50).trait).toBeNull();
  });

  it('好感 60 → 心思细腻（反噬-20%）', () => {
    const g = azhaoGrowth(60);
    expect(g.trait).toBe('xinsi');
    expect(g.effects.type).toBe('backlash_reduction');
    expect(g.effects.value).toBe(0.2);
  });

  it('好感 80 → 死心塌地（满意度下限 40）', () => {
    const g = azhaoGrowth(80);
    expect(g.trait).toBe('sixin');
    expect(g.effects.type).toBe('satisfaction_floor');
    expect(g.effects.value).toBe(40);
  });

  it('赎妹妹剧情 → 兄妹同心（效率×1.5）', () => {
    const g = azhaoGrowth(30, { rescuedSister: true });
    expect(g.trait).toBe('xiongmei');
    expect(g.effects.value).toBe(1.5);
  });
});
