/**
 * 《我在唐朝当掌柜》内部交情系统（TANG-SOC-001 模块二）
 * 交情："交情：伙计之间的私下情谊，有和睦亦有嫌隙，影响店内氛围。"
 * 纯函数：initializeRelations / evolveRelations / getRelationshipEvents / establishMentorship；
 * store 接线应用（每日打烊 evolveRelations）。
 * 规则（用户 6.1 逐字）：
 * - initializeRelations：同类型 60% 竞争 / 30% 和睦 / 10% 矛盾；不同类型 50/30/20；阿昭对全员初始和睦。
 * - evolveRelations：每日打烊；一起全天 → 和睦+1；一人休沐一人全天 → 竞争+1；公开表扬 → 他人竞争+2；
 *   矛盾事件未处理 → 矛盾+3；和睦≥8 莫逆之交（不同时背叛）；矛盾≥8 水火不容（调解或离职）；
 *   竞争≥8 效率+10% 但满意度月-2。
 * - establishMentorship：mentor 技能≥3、apprentice≤2；师徒关系；学徒日 5% 习得导师技能；
 *   导师月满意度+5；师徒不产生矛盾。
 */
import type { Employee, EmployeeRelationship, RelationshipEvent, RelationshipType } from '@/types/tang-manager';

/** 阿昭伪 id（不在 employees 内，用特殊 id 表示） */
export const AZHAO_ID = 'a-zhao';

/** 等级阈值：莫逆之交 / 水火不容 / 竞争激烈 */
export const SOULMATE_LEVEL = 8;
export const IRRECONCILABLE_LEVEL = 8;
export const RIVALRY_HOT_LEVEL = 8;

/** 关系类型中文名 */
export const RELATION_LABEL: Record<RelationshipType, string> = {
  harmony: '和睦',
  rivalry: '竞争',
  conflict: '矛盾',
  mentor: '师徒',
};

/** 关系类型颜色（绿和睦/蓝竞争/红矛盾/金师徒） */
export const RELATION_COLOR: Record<RelationshipType, string> = {
  harmony: '#4A7C59',
  rivalry: '#3B6FB6',
  conflict: '#C0392B',
  mentor: '#D4A843',
};

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/** 关系描述文案池（古风） */
const DESC_POOL: Record<RelationshipType, readonly string[]> = {
  harmony: ['同窗情谊，互帮互助', '一道用饭，谈天说地', '把酒言欢，无话不谈'],
  rivalry: ['暗中较劲，都想压对方一头', '抢功夺彩，面和心不和', '比手艺比勤快，互不服输'],
  conflict: ['针尖对麦芒，见面就掐', '积怨已久，一触即发', '谁都不肯先低头'],
  mentor: ['悉心指点，倾囊相授', '师徒之谊，情同父子'],
};

function descriptionFor(type: RelationshipType, rng: () => number): string {
  return pick(DESC_POOL[type], rng);
}

/** 按概率抽关系类型（同类型 60/30/10；不同类型 50/30/20） */
function rollType(sameType: boolean, rng: () => number): RelationshipType {
  const r = rng();
  if (sameType) {
    if (r < 0.6) return 'rivalry';
    if (r < 0.9) return 'harmony';
    return 'conflict';
  }
  if (r < 0.5) return 'rivalry';
  if (r < 0.8) return 'harmony';
  return 'conflict';
}

/** 建立双向交情（A→B 与 B→A 同步） */
function setPair(
  employees: Employee[],
  aId: string,
  bId: string,
  type: RelationshipType,
  level: number,
  description: string
): Employee[] {
  return employees.map((e) => {
    if (e.id === aId) {
      const rels = (e.relationships ?? []).filter((r) => r.targetId !== bId || r.type === 'mentor');
      return { ...e, relationships: [...rels, { targetId: bId, type, level, description }] };
    }
    if (e.id === bId) {
      const rels = (e.relationships ?? []).filter((r) => r.targetId !== aId || r.type === 'mentor');
      return { ...e, relationships: [...rels, { targetId: aId, type, level, description }] };
    }
    return e;
  });
}

/**
 * 初始化内部交情（新入职或新档）。遍历两两员工 + 阿昭对全员和睦。
 * 返回更新后的员工（含 relationships）。
 */
export function initializeRelations(
  employees: readonly Employee[],
  rng: () => number = Math.random
): Employee[] {
  let next: Employee[] = employees.map((e) => ({ ...e, relationships: e.relationships ?? [] }));
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i]!;
      const b = next[j]!;
      const type = rollType(a.type === b.type, rng);
      const level = 1 + Math.floor(rng() * 3); // 初始 1-3
      const desc = descriptionFor(type, rng);
      next = setPair(next, a.id, b.id, type, level, desc);
    }
    // 阿昭对全员初始和睦
    const emp = next[i]!;
    if (!(emp.relationships ?? []).some((r) => r.targetId === AZHAO_ID)) {
      next = next.map((e) =>
        e.id === emp.id
          ? {
              ...e,
              relationships: [
                ...(e.relationships ?? []),
                { targetId: AZHAO_ID, type: 'harmony', level: 5, description: '阿昭待人亲和，与你交好' },
              ],
            }
          : e
      );
    }
  }
  return next;
}

/** 查找两人之间非师徒交情（A→B 方向） */
function findRel(employee: Employee, targetId: string): EmployeeRelationship | undefined {
  return (employee.relationships ?? []).find((r) => r.targetId === targetId && r.type !== 'mentor');
}

/**
 * 每日打烊演化交情。返回 { employees, events }。
 * @param praisedId 当日公开表扬的员工 id（他人竞争+2）
 * @param unresolvedPairs 未处理的矛盾事件对（矛盾+3）
 */
export function evolveRelations(
  employees: readonly Employee[],
  opts: { praisedId?: string; unresolvedPairs?: ReadonlyArray<readonly [string, string]> } = {},
  rng: () => number = Math.random
): { employees: Employee[]; events: RelationshipEvent[] } {
  let next: Employee[] = employees.map((e) => ({ ...e, relationships: e.relationships ?? [] }));
  const events: RelationshipEvent[] = [];

  const bump = (emp: Employee, targetId: string, type: RelationshipType, delta: number): Employee => {
    const rel = findRel(emp, targetId);
    if (!rel) return emp;
    const level = Math.min(10, Math.max(1, rel.level + delta));
    return {
      ...emp,
      relationships: (emp.relationships ?? []).map((r) =>
        r.targetId === targetId && r.type !== 'mentor' ? { ...r, level } : r
      ),
    };
  };

  const pushEvent = (employeeId: string, targetId: string, type: RelationshipType, level: number, description: string, kind: RelationshipEvent['kind']) => {
    events.push({ kind, employeeId, targetId, type, level, description });
  };

  // 两两演化（非师徒）
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i]!;
      const b = next[j]!;
      const relA = findRel(a, b.id);
      if (!relA) continue;
      // 师徒不产生矛盾（mentor 关系存在时不演化为矛盾）
      const isMentorPair = (a.relationships ?? []).some((r) => r.targetId === b.id && r.type === 'mentor')
        || (b.relationships ?? []).some((r) => r.targetId === a.id && r.type === 'mentor');
      let delta = 0;
      let kind: RelationshipEvent['kind'] | null = null;

      // 一起全天 → 和睦+1；一人休沐一人全天 → 竞争+1
      if ((a.shift === 'full' || a.shift === undefined) && (b.shift === 'full' || b.shift === undefined)) {
        if (relA.type === 'harmony') {
          delta = 1;
          kind = 'harmony_up';
        }
      } else if (a.shift === 'rest' && b.shift === 'full') {
        if (relA.type === 'rivalry' && !isMentorPair) {
          delta = 1;
          kind = 'rivalry_up';
        }
      } else if (b.shift === 'rest' && a.shift === 'full') {
        if (relA.type === 'rivalry' && !isMentorPair) {
          delta = 1;
          kind = 'rivalry_up';
        }
      }
      // 公开表扬 → 他人竞争+2
      if (opts.praisedId && (opts.praisedId === a.id || opts.praisedId === b.id)) {
        if (relA.type === 'rivalry' && !isMentorPair) {
          delta += 2;
          kind = 'rivalry_up';
        }
      }
      // 矛盾事件未处理 → 矛盾+3
      if (opts.unresolvedPairs?.some(([x, y]) => (x === a.id && y === b.id) || (x === b.id && y === a.id))) {
        if (relA.type === 'conflict' && !isMentorPair) {
          delta += 3;
          kind = 'conflict_up';
        }
      }
      if (delta !== 0 && kind) {
        next = setPair(next, a.id, b.id, relA.type, Math.min(10, relA.level + delta), relA.description);
        const newLevel = Math.min(10, relA.level + delta);
        pushEvent(a.id, b.id, relA.type, newLevel, relA.description, kind);
        // 双向事件只需记一次（以 A→B 为准）
      }
    }
  }

  // 阈值检测：和睦≥8 莫逆之交 / 矛盾≥8 水火不容 / 竞争≥8 竞争激烈
  next = next.map((emp) => {
    const rels = (emp.relationships ?? []).map((r) => {
      if (r.type === 'harmony' && r.level >= SOULMATE_LEVEL) {
        const desc = `莫逆之交：${emp.name}与${r.targetId}引为知己，绝不相负`;
        if (!events.some((ev) => ev.employeeId === emp.id && ev.targetId === r.targetId && ev.kind === 'soulmate')) {
          pushEvent(emp.id, r.targetId, r.type, r.level, desc, 'soulmate');
        }
        return { ...r, description: desc };
      }
      if (r.type === 'conflict' && r.level >= IRRECONCILABLE_LEVEL) {
        const desc = `水火不容：${emp.name}与${r.targetId}势同水火，恐要有人离开`;
        if (!events.some((ev) => ev.employeeId === emp.id && ev.targetId === r.targetId && ev.kind === 'irreconcilable')) {
          pushEvent(emp.id, r.targetId, r.type, r.level, desc, 'irreconcilable');
        }
        return { ...r, description: desc };
      }
      if (r.type === 'rivalry' && r.level >= RIVALRY_HOT_LEVEL) {
        const desc = `竞争激烈：${emp.name}与${r.targetId}暗中较劲，效率反升`;
        if (!events.some((ev) => ev.employeeId === emp.id && ev.targetId === r.targetId && ev.kind === 'rivalry_hot')) {
          pushEvent(emp.id, r.targetId, r.type, r.level, desc, 'rivalry_hot');
        }
        return { ...r, description: desc };
      }
      return r;
    });
    return { ...emp, relationships: rels };
  });

  return { employees: next, events };
}

/** 检测关系触发事件（读 relations；不修改） */
export function getRelationshipEvents(employees: readonly Employee[]): RelationshipEvent[] {
  const events: RelationshipEvent[] = [];
  for (const emp of employees) {
    for (const r of emp.relationships ?? []) {
      if (r.type === 'harmony' && r.level >= SOULMATE_LEVEL) {
        events.push({ kind: 'soulmate', employeeId: emp.id, targetId: r.targetId, type: r.type, level: r.level, description: `莫逆之交：${emp.name}与${r.targetId}` });
      }
      if (r.type === 'conflict' && r.level >= IRRECONCILABLE_LEVEL) {
        events.push({ kind: 'irreconcilable', employeeId: emp.id, targetId: r.targetId, type: r.type, level: r.level, description: `水火不容：${emp.name}与${r.targetId}` });
      }
      if (r.type === 'rivalry' && r.level >= RIVALRY_HOT_LEVEL) {
        events.push({ kind: 'rivalry_hot', employeeId: emp.id, targetId: r.targetId, type: r.type, level: r.level, description: `竞争激烈：${emp.name}与${r.targetId}` });
      }
    }
  }
  return events;
}

/**
 * 确立师徒关系。mentor 技能≥3、apprentice≤2；设置 apprentice.mentorId；
 * 建立 mentor 关系；返回更新后员工 + 是否成功。
 */
export function establishMentorship(
  mentorId: string,
  apprenticeId: string,
  employees: readonly Employee[]
): { employees: Employee[]; ok: boolean; reason?: string } {
  const mentor = employees.find((e) => e.id === mentorId);
  const apprentice = employees.find((e) => e.id === apprenticeId);
  if (!mentor || !apprentice) return { employees: [...employees], ok: false, reason: '伙计不在店内' };
  if (mentorId === apprenticeId) return { employees: [...employees], ok: false, reason: '不能拜自己为师' };
  if ((mentor.skills?.length ?? 0) < 3) return { employees: [...employees], ok: false, reason: '师傅技艺未精（技能≥3）' };
  if ((apprentice.skills?.length ?? 0) > 2) return { employees: [...employees], ok: false, reason: '学徒已有技艺（技能≤2）' };
  if (apprentice.mentorId) return { employees: [...employees], ok: false, reason: '已有师门' };

  const mentorRel: EmployeeRelationship = {
    targetId: apprenticeId,
    type: 'mentor',
    level: 3,
    description: `收${apprentice.name}为徒，悉心教导`,
  };
  const apprenticeRel: EmployeeRelationship = {
    targetId: mentorId,
    type: 'mentor',
    level: 3,
    description: `拜${mentor.name}为师，执弟子礼`,
  };
  const next = employees.map((e) => {
    if (e.id === mentorId) {
      return { ...e, relationships: [...(e.relationships ?? []).filter((r) => !(r.targetId === apprenticeId && r.type === 'mentor')), mentorRel] };
    }
    if (e.id === apprenticeId) {
      return { ...e, mentorId, relationships: [...(e.relationships ?? []).filter((r) => !(r.targetId === mentorId && r.type === 'mentor')), apprenticeRel] };
    }
    return e;
  });
  return { employees: next, ok: true };
}

/**
 * 学徒日 5% 习得导师技能（每日打烊由 store 调用；命中返回学得技能，否则 null）。
 * 导师月满意度+5 由 store 月初结算时应用（此处返回导师奖励标记）。
 */
export function apprenticeDailyLearn(
  apprentice: Employee,
  mentor: Employee,
  rng: () => number = Math.random
): { learnedSkill?: Employee['skills'][number]; mentorSatisfactionBonus?: number } {
  const result: { learnedSkill?: Employee['skills'][number]; mentorSatisfactionBonus?: number } = {};
  if (rng() < 0.05 && mentor.skills.length > 0) {
    const candidates = mentor.skills.filter((s) => !apprentice.skills.some((as) => as.id === s.id));
    if (candidates.length > 0) {
      result.learnedSkill = candidates[Math.floor(rng() * candidates.length)]!;
    }
  }
  return result;
}

/** 扁平化交情视图（store employeeRelations 用） */
export function flattenRelations(employees: readonly Employee[]): EmployeeRelationship[] {
  const seen = new Set<string>();
  const flat: EmployeeRelationship[] = [];
  for (const emp of employees) {
    for (const r of emp.relationships ?? []) {
      const key = [emp.id, r.targetId].sort().join('|') + ':' + r.type;
      if (seen.has(key)) continue;
      seen.add(key);
      flat.push({ ...r });
    }
  }
  return flat;
}
