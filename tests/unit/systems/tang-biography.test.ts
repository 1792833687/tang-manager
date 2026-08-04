/**
 * 伙计小传单测（TANG-ADD-001 模块七）
 * 覆盖：入职框架生成、4 阶段解锁条件、全解锁获专属技能、按员工 type 差异化模板。
 */
import { describe, expect, it } from 'vitest';
import { BIOGRAPHY_TEMPLATES } from '@/config/tang-biography';
import { biographyMasterSkill, checkBiographyUnlock, generateBiography } from '@/systems/tang-biography';
import type { Employee } from '@/types/tang-manager';

function makeEmployee(over: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    name: '阿福',
    gender: 'male',
    type: 'waiter',
    salary: 30,
    skills: [],
    isSpecial: false,
    satisfaction: 60,
    hireDay: 1,
    backgroundRevealed: false,
    ...over,
  };
}

describe('generateBiography · 框架生成', () => {
  it('生成 4 阶段框架（stage 1-4、全部未解锁）', () => {
    const bio = generateBiography('waiter');
    expect(bio).toHaveLength(4);
    expect(bio.map((b) => b.stage)).toEqual([1, 2, 3, 4]);
    expect(bio.every((b) => !b.unlocked)).toBe(true);
  });

  it('按员工 type 差异化模板（waiter/chef 出身文案不同）', () => {
    const waiter = generateBiography('waiter')[0]!;
    const chef = generateBiography('chef')[0]!;
    expect(waiter.content).not.toBe(chef.content);
    expect(BIOGRAPHY_TEMPLATES.waiter).toHaveLength(4);
    expect(BIOGRAPHY_TEMPLATES.chef).toHaveLength(4);
  });

  it('6 类型模板齐全', () => {
    expect(Object.keys(BIOGRAPHY_TEMPLATES)).toEqual(['waiter', 'chef', 'tailor', 'pharmacist', 'accountant', 'guard']);
  });
});

describe('checkBiographyUnlock · 阶段解锁', () => {
  it('入职满 15 日 → 解锁第 1 阶段（出身）', () => {
    const emp = makeEmployee({ hireDay: 1 });
    const res = checkBiographyUnlock(emp, { day: 16, xiaoerFavor: 0, specialEmployeeStoryCompleted: false });
    expect(res.newlyUnlocked.map((b) => b.stage)).toEqual([1]);
    expect(res.employee.biographyStage).toBe(1);
  });

  it('满意度 ≥80 → 解锁第 2 阶段（为何来）；已解锁的第 1 阶段不重复', () => {
    const framework = generateBiography('waiter').map((b, i) => (i === 0 ? { ...b, unlocked: true } : b));
    const emp = makeEmployee({ hireDay: 1, satisfaction: 80, biographyStage: 1, biography: framework });
    const res = checkBiographyUnlock(emp, { day: 30, xiaoerFavor: 0, specialEmployeeStoryCompleted: false });
    expect(res.newlyUnlocked.map((b) => b.stage)).toEqual([2]);
  });

  it('好感 ≥70 → 解锁第 3 阶段（隐藏暴露）', () => {
    const framework = generateBiography('waiter').map((b, i) => (i < 2 ? { ...b, unlocked: true } : b));
    const emp = makeEmployee({ hireDay: 1, satisfaction: 80, biographyStage: 2, biography: framework });
    const res = checkBiographyUnlock(emp, { day: 60, xiaoerFavor: 70, specialEmployeeStoryCompleted: false });
    expect(res.newlyUnlocked.map((b) => b.stage)).toEqual([3]);
  });

  it('专属事件后 → 解锁第 4 阶段（真故事）；4 阶段全解锁获专属技能', () => {
    const framework = generateBiography('waiter').map((b, i) => (i < 3 ? { ...b, unlocked: true } : b));
    const emp = makeEmployee({ hireDay: 1, satisfaction: 80, biographyStage: 3, biography: framework });
    const res = checkBiographyUnlock(emp, { day: 90, xiaoerFavor: 70, specialEmployeeStoryCompleted: true });
    expect(res.newlyUnlocked.map((b) => b.stage)).toEqual([4]);
    expect(res.employee.biographyStage).toBe(4);
    const master = biographyMasterSkill(res.employee);
    expect(master).not.toBeNull();
    expect(master?.name).toBe('知恩图报');
  });

  it('旧档无 biography → 先生成框架再判定', () => {
    const emp = makeEmployee({ hireDay: 1 });
    const res = checkBiographyUnlock(emp, { day: 16, xiaoerFavor: 0, specialEmployeeStoryCompleted: false });
    expect(res.employee.biography).toHaveLength(4);
    expect(res.employee.biography![0]!.unlocked).toBe(true);
  });

  it('已解锁的阶段不重复解锁', () => {
    const emp = makeEmployee({ hireDay: 1, biography: generateBiography('waiter').map((b, i) => (i === 0 ? { ...b, unlocked: true } : b)), biographyStage: 1 });
    const res = checkBiographyUnlock(emp, { day: 16, xiaoerFavor: 0, specialEmployeeStoryCompleted: false });
    expect(res.newlyUnlocked).toHaveLength(0);
  });
});

describe('biographyMasterSkill · 专属技能', () => {
  it('未全解锁 → null', () => {
    const emp = makeEmployee({ biography: generateBiography('waiter').map((b, i) => (i < 3 ? { ...b, unlocked: true } : b)) });
    expect(biographyMasterSkill(emp)).toBeNull();
  });

  it('全解锁 → 按类型专属技能', () => {
    const chef = makeEmployee({ type: 'chef', biography: generateBiography('chef').map((b) => ({ ...b, unlocked: true })) });
    expect(biographyMasterSkill(chef)?.name).toBe('御膳真传');
  });
});
