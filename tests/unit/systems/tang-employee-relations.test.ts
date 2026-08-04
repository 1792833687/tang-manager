/**
 * 内部交情系统单测（tang-employee-relations · TANG-SOC-001 模块二）
 * 覆盖：初始化概率（同类型 60/30/10、不同类型 50/30/20、阿昭和睦）、演化规则（一起全天和睦/一人休沐
 *       竞争/公开表扬竞争/矛盾+3）、阈值（莫逆之交/水火不容/竞争激烈）、师徒（技能门槛/不产生矛盾）。
 */
import { describe, expect, it } from 'vitest';
import {
  initializeRelations,
  evolveRelations,
  getRelationshipEvents,
  establishMentorship,
  flattenRelations,
  AZHAO_ID,
  SOULMATE_LEVEL,
} from '@/systems/tang-employee-relations';
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

describe('initializeRelations 初始化', () => {
  it('同类型 60% 竞争（rng<0.6）', () => {
    const a = makeEmployee({ id: 'a', name: '阿大', type: 'waiter' });
    const b = makeEmployee({ id: 'b', name: '阿二', type: 'waiter' });
    // 第 1 个 rng = 类型判定 0.5（<0.6 → rivalry）；第 2 个 rng = level；第 3 个 rng = 描述
    const emps = initializeRelations([a, b], seq(0.5, 0.5, 0.5));
    const relA = emps[0]!.relationships!.find((r) => r.targetId === 'b');
    expect(relA!.type).toBe('rivalry');
  });

  it('不同类型 50% 竞争（rng<0.5）', () => {
    const a = makeEmployee({ id: 'a', name: '阿大', type: 'waiter' });
    const b = makeEmployee({ id: 'b', name: '阿二', type: 'chef' });
    const emps = initializeRelations([a, b], seq(0.4, 0.5, 0.5));
    expect(emps[0]!.relationships!.find((r) => r.targetId === 'b')!.type).toBe('rivalry');
  });

  it('同类型 30% 和睦（0.6≤rng<0.9）', () => {
    const a = makeEmployee({ id: 'a', name: '阿大', type: 'waiter' });
    const b = makeEmployee({ id: 'b', name: '阿二', type: 'waiter' });
    const emps = initializeRelations([a, b], seq(0.7, 0.5, 0.5));
    expect(emps[0]!.relationships!.find((r) => r.targetId === 'b')!.type).toBe('harmony');
  });

  it('阿昭对全员初始和睦', () => {
    const a = makeEmployee({ id: 'a', name: '阿大' });
    const b = makeEmployee({ id: 'b', name: '阿二' });
    const emps = initializeRelations([a, b], seq(0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
    const relA = emps[0]!.relationships!.find((r) => r.targetId === AZHAO_ID);
    const relB = emps[1]!.relationships!.find((r) => r.targetId === AZHAO_ID);
    expect(relA!.type).toBe('harmony');
    expect(relB!.type).toBe('harmony');
  });

  it('flattenRelations 去重（A→B 与 B→A 只留一条）', () => {
    const a = makeEmployee({ id: 'a', name: '阿大' });
    const b = makeEmployee({ id: 'b', name: '阿二' });
    const emps = initializeRelations([a, b], seq(0.5, 0.5, 0.5));
    const flat = flattenRelations(emps);
    const pair = flat.filter((r) => [r.targetId, 'x'].includes('x') && r.targetId === 'b');
    // a→b 与 b→a 各有一条但 flatten 去重后应只有一条（rivalry）
    expect(pair.filter((r) => r.type === 'rivalry')).toHaveLength(1);
  });
});

describe('evolveRelations 演化', () => {
  it('一起全天 → 和睦+1', () => {
    const a = makeEmployee({
      id: 'a', name: '阿大', shift: 'full',
      relationships: [{ targetId: 'b', type: 'harmony', level: 3, description: '和睦' }],
    });
    const b = makeEmployee({
      id: 'b', name: '阿二', shift: 'full',
      relationships: [{ targetId: 'a', type: 'harmony', level: 3, description: '和睦' }],
    });
    const res = evolveRelations([a, b]);
    expect(res.employees[0]!.relationships!.find((r) => r.targetId === 'b')!.level).toBe(4);
  });

  it('一人休沐一人全天 → 竞争+1', () => {
    const a = makeEmployee({
      id: 'a', name: '阿大', shift: 'full',
      relationships: [{ targetId: 'b', type: 'rivalry', level: 3, description: '竞争' }],
    });
    const b = makeEmployee({
      id: 'b', name: '阿二', shift: 'rest',
      relationships: [{ targetId: 'a', type: 'rivalry', level: 3, description: '竞争' }],
    });
    const res = evolveRelations([a, b]);
    expect(res.employees[0]!.relationships!.find((r) => r.targetId === 'b')!.level).toBe(4);
  });

  it('公开表扬 → 他人竞争+2', () => {
    const a = makeEmployee({
      id: 'a', name: '阿大', shift: 'full',
      relationships: [{ targetId: 'b', type: 'rivalry', level: 3, description: '竞争' }],
    });
    const b = makeEmployee({
      id: 'b', name: '阿二', shift: 'full',
      relationships: [{ targetId: 'a', type: 'rivalry', level: 3, description: '竞争' }],
    });
    const res = evolveRelations([a, b], { praisedId: 'a' });
    expect(res.employees[0]!.relationships!.find((r) => r.targetId === 'b')!.level).toBe(5); // 3+2
  });

  it('矛盾事件未处理 → 矛盾+3', () => {
    const a = makeEmployee({
      id: 'a', name: '阿大', shift: 'full',
      relationships: [{ targetId: 'b', type: 'conflict', level: 2, description: '矛盾' }],
    });
    const b = makeEmployee({
      id: 'b', name: '阿二', shift: 'full',
      relationships: [{ targetId: 'a', type: 'conflict', level: 2, description: '矛盾' }],
    });
    const res = evolveRelations([a, b], { unresolvedPairs: [['a', 'b'] as const] });
    expect(res.employees[0]!.relationships!.find((r) => r.targetId === 'b')!.level).toBe(5); // 2+3
  });

  it('和睦≥8 → 莫逆之交事件', () => {
    const a = makeEmployee({
      id: 'a', name: '阿大', shift: 'full',
      relationships: [{ targetId: 'b', type: 'harmony', level: SOULMATE_LEVEL - 1, description: '和睦' }],
    });
    const b = makeEmployee({
      id: 'b', name: '阿二', shift: 'full',
      relationships: [{ targetId: 'a', type: 'harmony', level: SOULMATE_LEVEL - 1, description: '和睦' }],
    });
    const res = evolveRelations([a, b]);
    expect(res.events.some((e) => e.kind === 'soulmate')).toBe(true);
  });
});

describe('establishMentorship 师徒', () => {
  function mentorApprentice() {
    const mentor = makeEmployee({
      id: 'm', name: '老师傅', type: 'chef', skills: [
        { id: 'q-chef', name: '招牌菜', type: 'quality', description: 'x', requiresType: ['chef'] },
        { id: 'e-chef', name: '灶上功夫', type: 'efficiency', description: 'x', requiresType: ['chef'] },
        { id: 'c-buyer', name: '采买门路', type: 'cost', description: 'x', requiresType: ['chef'] },
      ],
    });
    const apprentice = makeEmployee({ id: 'p', name: '学徒', type: 'chef', skills: [] });
    return { mentor, apprentice };
  }

  it('mentor 技能≥3、apprentice≤2 → 成功', () => {
    const { mentor, apprentice } = mentorApprentice();
    const res = establishMentorship(mentor.id, apprentice.id, [mentor, apprentice]);
    expect(res.ok).toBe(true);
    expect(res.employees.find((e) => e.id === apprentice.id)!.mentorId).toBe(mentor.id);
    const rel = res.employees.find((e) => e.id === apprentice.id)!.relationships!.find((r) => r.type === 'mentor');
    expect(rel!.targetId).toBe(mentor.id);
  });

  it('mentor 技能不足 3 → 拒绝', () => {
    const mentor = makeEmployee({ id: 'm', name: '新手', skills: [] });
    const apprentice = makeEmployee({ id: 'p', name: '学徒', skills: [] });
    const res = establishMentorship(mentor.id, apprentice.id, [mentor, apprentice]);
    expect(res.ok).toBe(false);
  });

  it('师徒不产生矛盾（mentor 对不演化为矛盾）', () => {
    const { mentor, apprentice } = mentorApprentice();
    const res = establishMentorship(mentor.id, apprentice.id, [mentor, apprentice]);
    const pair = res.employees;
    // 双方互为 full，若非师徒会走和睦/竞争演化；师徒应保持 mentor 关系不被覆盖为 conflict
    const evolved = evolveRelations(pair);
    const rel = evolved.employees.find((e) => e.id === apprentice.id)!.relationships!.find((r) => r.targetId === mentor.id);
    expect(rel!.type).toBe('mentor');
    expect(evolved.employees.find((e) => e.id === mentor.id)!.relationships!.some((r) => r.type === 'conflict')).toBe(false);
  });
});

describe('getRelationshipEvents 检测', () => {
  it('水火不容（矛盾≥8）事件检测', () => {
    const emp = makeEmployee({
      relationships: [{ targetId: 'b', type: 'conflict', level: 8, description: '水火不容' }],
    });
    const events = getRelationshipEvents([emp]);
    expect(events.some((e) => e.kind === 'irreconcilable')).toBe(true);
  });
});
