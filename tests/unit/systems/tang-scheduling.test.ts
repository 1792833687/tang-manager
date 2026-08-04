/**
 * 员工排班系统单测（tang-scheduling · TANG-SOC-001 模块一）
 * 覆盖：四态排班（早/晚/全/休）、冲突（学艺中不可排班）、过劳检查（≥3 标记/≥6 崩溃/≥7 无休-5）、
 *       覆盖（早班缺人/晚班缺人）、自动排班建议（满意度高全天/技能高覆盖高峰/每周休沐）。
 */
import { describe, expect, it } from 'vitest';
import {
  assignShift,
  checkOverwork,
  getShiftCoverage,
  suggestOptimalSchedule,
  applyScheduleSuggestions,
  OVERWORK_DAYS,
  CRASH_DAYS,
  NO_REST_DAYS,
} from '@/systems/tang-scheduling';
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

describe('assignShift 四态排班', () => {
  it('morning/evening/full 正常工作班，consecutiveWorkDays 递增', () => {
    let emp = makeEmployee();
    const r1 = assignShift(emp, 'morning', 1);
    expect(r1!.employee.shift).toBe('morning');
    expect(r1!.employee.consecutiveWorkDays).toBe(1);
    emp = r1!.employee;
    const r2 = assignShift(emp, 'evening', 2);
    expect(r2!.employee.shift).toBe('evening');
    expect(r2!.employee.consecutiveWorkDays).toBe(2);
  });

  it('休沐：满意度 +3、consecutiveWorkDays 归零、lastRestDay 记录', () => {
    const emp = makeEmployee({ satisfaction: 60, consecutiveWorkDays: 3 });
    const res = assignShift(emp, 'rest', 10);
    expect(res!.employee.shift).toBe('rest');
    expect(res!.employee.satisfaction).toBe(63);
    expect(res!.employee.consecutiveWorkDays).toBe(0);
    expect(res!.employee.lastRestDay).toBe(10);
  });

  it('全天连 3 天过劳警告', () => {
    const emp = makeEmployee({ consecutiveWorkDays: 2 });
    const res = assignShift(emp, 'full', 3);
    expect(res!.warning).toContain('过劳');
  });

  it('连 7 天无休满意度 -5/日', () => {
    const emp = makeEmployee({ satisfaction: 60, consecutiveWorkDays: 6 });
    const res = assignShift(emp, 'full', 7);
    expect(res!.employee.satisfaction).toBe(55);
    expect(res!.warning).toContain('无休');
  });

  it('学艺中不可排班（trainingCompletionDay > day）→ null；休沐仍可', () => {
    const emp = makeEmployee({ trainingCompletionDay: 8 });
    expect(assignShift(emp, 'full', 5)).toBeNull();
    const rest = assignShift(emp, 'rest', 5);
    expect(rest!.employee.shift).toBe('rest');
  });
});

describe('checkOverwork 过劳检查', () => {
  it('全天且连续 ≥3 天标记 overworked', () => {
    const emp = makeEmployee({ shift: 'full', consecutiveWorkDays: 3 });
    const res = checkOverwork([emp], 10);
    expect(res.overworked).toHaveLength(1);
  });

  it('全天连续 ≥6 天（过劳满 3 天）崩溃离职', () => {
    const emp = makeEmployee({ shift: 'full', consecutiveWorkDays: CRASH_DAYS });
    const res = checkOverwork([emp], 10);
    expect(res.crashIds).toContain(emp.id);
    expect(res.employees).toHaveLength(0);
  });

  it('连续 ≥7 天无休满意度 -5/日（非全天工作班）', () => {
    const emp = makeEmployee({ shift: 'morning', consecutiveWorkDays: NO_REST_DAYS, satisfaction: 60 });
    const res = checkOverwork([emp], 10);
    expect(res.employees[0]!.satisfaction).toBe(55);
  });

  it('休沐/学艺中不参与过劳', () => {
    const rest = makeEmployee({ id: 'r', name: '休沐', shift: 'rest', consecutiveWorkDays: 10 });
    const training = makeEmployee({ id: 't', name: '学艺', shift: 'full', consecutiveWorkDays: 5, trainingCompletionDay: 12 });
    const res = checkOverwork([rest, training], 10);
    expect(res.overworked).toHaveLength(0);
    expect(res.crashIds).toHaveLength(0);
  });
});

describe('getShiftCoverage 排班覆盖', () => {
  it('早班缺人 → morningShortage=true（上午客人耐心下降加速，注释接入）', () => {
    const emp = makeEmployee({ shift: 'evening' });
    const cov = getShiftCoverage([emp], 1);
    expect(cov.morning).toBe(0);
    expect(cov.morningShortage).toBe(true);
  });

  it('晚班缺人 → eveningShortage=true（下午接待效率 -20%，注释接入）', () => {
    const emp = makeEmployee({ shift: 'morning' });
    const cov = getShiftCoverage([emp], 1);
    expect(cov.evening).toBe(0);
    expect(cov.eveningShortage).toBe(true);
  });

  it('full 两班覆盖；休沐/学艺不计数', () => {
    const full = makeEmployee({ id: 'f', name: '全', shift: 'full' });
    const rest = makeEmployee({ id: 'r', name: '休', shift: 'rest' });
    const training = makeEmployee({ id: 't', name: '学', shift: 'full', trainingCompletionDay: 9 });
    const cov = getShiftCoverage([full, rest, training], 1);
    expect(cov.morning).toBe(1);
    expect(cov.evening).toBe(1);
  });
});

describe('suggestOptimalSchedule 自动排班建议', () => {
  it('满意度高优先全天', () => {
    const emp = makeEmployee({ satisfaction: 85, skills: [
      { id: 'q-waiter', name: 'a', type: 'quality', description: 'x', requiresType: ['waiter'] },
      { id: 'e-waiter', name: 'b', type: 'efficiency', description: 'x', requiresType: ['waiter'] },
    ] });
    const sug = suggestOptimalSchedule([emp], 1);
    expect(sug[0]!.suggestedShift).toBe('full');
  });

  it('每人每周至少休沐 1 天：lastRestDay 距今 ≥6 天强制休沐', () => {
    const emp = makeEmployee({ lastRestDay: 1 });
    const sug = suggestOptimalSchedule([emp], 10);
    expect(sug[0]!.suggestedShift).toBe('rest');
  });

  it('学艺中建议休沐', () => {
    const emp = makeEmployee({ trainingCompletionDay: 12 });
    const sug = suggestOptimalSchedule([emp], 5);
    expect(sug[0]!.suggestedShift).toBe('rest');
  });

  it('applyScheduleSuggestions 应用到员工数组', () => {
    const emp = makeEmployee({ satisfaction: 85, skills: [
      { id: 'q-waiter', name: 'a', type: 'quality', description: 'x', requiresType: ['waiter'] },
      { id: 'e-waiter', name: 'b', type: 'efficiency', description: 'x', requiresType: ['waiter'] },
    ] });
    const suggestions = suggestOptimalSchedule([emp], 1);
    const applied = applyScheduleSuggestions([emp], suggestions, 1);
    expect(applied.applied).toBe(1);
    expect(applied.employees[0]!.shift).toBe('full');
  });
});
