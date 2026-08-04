/**
 * 《我在唐朝当掌柜》员工排班系统（TANG-SOC-001 模块一）
 * 轮值："轮值：唐代店铺已分早市晚市，伙计分班轮值，早班辰时到岗，晚班酉时方归。"
 * 纯函数：assignShift / checkOverwork / getShiftCoverage / suggestOptimalSchedule；
 * store 接线应用，UI（scheduling-subpanel）展示。
 * 规则：
 * - assignShift：冲突检查（学艺中 trainingCompletionDay>day 不可排班）；全天连 3 天过劳警告；
 *   连 7 天无休满意度 -5/日；休沐 +3；返回更新后员工。
 * - checkOverwork：全天且连续 ≥3 天标记 overworked；持续 3 天崩溃事件（罢工/离职）；返回过劳列表。
 * - getShiftCoverage：早班/晚班在岗数；早班缺人 → 上午客人耐心下降加速（注释接入）；
 *   晚班缺人 → 下午接待效率 -20%（注释接入）。
 * - suggestOptimalSchedule：满意度高优先全天、技能高覆盖高峰、每人每周至少休沐 1 天。
 */
import type { Employee, EmployeeShift, TangGameState } from '@/types/tang-manager';

/** 过劳阈值：全天连续工作天数 ≥3 标记过劳 */
export const OVERWORK_DAYS = 3;
/** 崩溃阈值：连续过劳满 3 天（即全天连续 ≥6 天）触发罢工/离职 */
export const CRASH_DAYS = 6;
/** 无休阈值：连续工作 ≥7 天满意度 -5/日 */
export const NO_REST_DAYS = 7;
/** 休沐满意度加成 */
export const REST_SATISFACTION = 3;
/** 无休满意度惩罚 */
export const NO_REST_PENALTY = 5;

/** 排班档位中文名 */
export const SHIFT_LABEL: Record<EmployeeShift, string> = {
  morning: '早班',
  evening: '晚班',
  full: '全天',
  rest: '休沐',
};

/** 排班覆盖：morning 覆盖早市 / evening 覆盖晚市 / full 两班 / rest 无 */
function covers(shift: EmployeeShift | undefined, period: 'morning' | 'evening'): boolean {
  if (shift === 'rest' || shift === undefined) return false;
  if (shift === 'full') return true;
  return shift === period;
}

/** 员工是否学艺中（trainingCompletionDay > day 视为学艺中，不可排班） */
export function isTraining(employee: Employee, day: number): boolean {
  return (employee.trainingCompletionDay ?? 0) > day;
}

/**
 * 排班（轮值）。返回更新后的员工；冲突（学艺中不可排班）返回 null。
 * - 休沐：满意度 +3、consecutiveWorkDays 归零、lastRestDay=day。
 * - 工作班：consecutiveWorkDays +1；连 7 天无休满意度 -5/日；全天连 3 天过劳警告（标记在返回字段旁）。
 */
export function assignShift(
  employee: Employee,
  shift: EmployeeShift,
  day: number
): { employee: Employee; warning?: string } | null {
  if (isTraining(employee, day) && shift !== 'rest') {
    return null; // 学艺中不可排班（只能休沐）
  }
  if (shift === 'rest') {
    return {
      employee: {
        ...employee,
        shift: 'rest',
        restToday: true,
        consecutiveWorkDays: 0,
        lastRestDay: day,
        satisfaction: Math.min(100, employee.satisfaction + REST_SATISFACTION),
      },
    };
  }
  const consecutiveWorkDays = (employee.consecutiveWorkDays ?? 0) + 1;
  let satisfaction = employee.satisfaction;
  const warnings: string[] = [];
  if (consecutiveWorkDays >= NO_REST_DAYS) {
    satisfaction = Math.max(0, satisfaction - NO_REST_PENALTY);
    warnings.push(`${employee.name}已连干${consecutiveWorkDays}日，无休可歇，心生倦怠（满意度-${NO_REST_PENALTY}）。`);
  }
  if (shift === 'full' && consecutiveWorkDays >= OVERWORK_DAYS) {
    warnings.push(`${employee.name}已连续${consecutiveWorkDays}日全天当值，恐要过劳。`);
  }
  return {
    employee: {
      ...employee,
      shift,
      restToday: false,
      consecutiveWorkDays,
      satisfaction,
    },
    warning: warnings.length > 0 ? warnings.join('') : undefined,
  };
}

/** 过劳员工视图（checkOverwork 产出） */
export interface OverworkResult {
  overworked: Employee[];
  /** 崩溃事件（连续过劳满 3 天；罢工/离职） */
  crashIds: string[];
  /** 因无休满意度 -5/日 的已扣分员工（每日调用时应用） */
  penalizedIds: string[];
}

/**
 * 过劳检查（每日打烊调用）。返回过劳列表 + 崩溃离职名单。
 * - 全天且连续 ≥3 天 → overworked。
 * - 全天连续 ≥6 天（过劳满 3 天）→ 崩溃事件（罢工/离职，由 store 移除）。
 * - 连续 ≥7 天无休 → 满意度 -5/日（apply 在返回的 employees 上）。
 */
export function checkOverwork(employees: readonly Employee[], day: number): OverworkResult & { employees: Employee[] } {
  const overworked: Employee[] = [];
  const crashIds: string[] = [];
  const penalizedIds: string[] = [];
  const next = employees.map((e) => {
    if (isTraining(e, day) || e.shift === 'rest' || e.restToday) {
      return { ...e };
    }
    const days = e.consecutiveWorkDays ?? 0;
    // 全天且连续 ≥3 天标记过劳
    if (e.shift === 'full' && days >= OVERWORK_DAYS) {
      overworked.push(e);
    }
    // 全天连续 ≥6 天（过劳满 3 天）崩溃离职（罢工/离职）
    if (e.shift === 'full' && days >= CRASH_DAYS) {
      crashIds.push(e.id);
      return { ...e };
    }
    // 连续 ≥7 天无休（任何工作班）满意度 -5/日
    if (days >= NO_REST_DAYS) {
      penalizedIds.push(e.id);
      return { ...e, satisfaction: Math.max(0, e.satisfaction - NO_REST_PENALTY) };
    }
    return { ...e };
  });
  return { overworked, crashIds, penalizedIds, employees: next.filter((e) => !crashIds.includes(e.id)) };
}

/** 排班覆盖结果 */
export interface ShiftCoverage {
  morning: number;
  evening: number;
  /** 早班缺人（在岗数 <1）→ 上午客人耐心下降加速（注释接入） */
  morningShortage: boolean;
  /** 晚班缺人（在岗数 <1）→ 下午接待效率 -20%（注释接入） */
  eveningShortage: boolean;
}

/**
 * 排班覆盖：统计早班/晚班在岗人数（排除学艺中/休沐/休假）。
 * 早班缺人 → 上午客人耐心下降加速；晚班缺人 → 下午接待效率 -20%（轻量接入，注释说明）。
 */
export function getShiftCoverage(employees: readonly Employee[], day: number): ShiftCoverage {
  const active = employees.filter((e) => !isTraining(e, day) && e.shift !== 'rest' && !e.restToday);
  const morning = active.filter((e) => covers(e.shift, 'morning')).length;
  const evening = active.filter((e) => covers(e.shift, 'evening')).length;
  return {
    morning,
    evening,
    morningShortage: morning < 1,
    eveningShortage: evening < 1,
  };
}

/** 排班建议项 */
export interface ScheduleSuggestion {
  employeeId: string;
  employeeName: string;
  suggestedShift: EmployeeShift;
  reason: string;
}

/**
 * 自动排班建议：满意度高优先全天、技能高覆盖高峰、每人每周至少休沐 1 天。
 * 返回建议表（autoSchedule 应用到 employees）。
 */
export function suggestOptimalSchedule(
  employees: readonly Employee[],
  day: number,
  weekDay: number = day % 7
): ScheduleSuggestion[] {
  const suggestions: ScheduleSuggestion[] = [];
  // 排班班次池：按需轮流休沐（每 7 天至少 1 天休沐；lastRestDay 距今 ≥6 天强制休沐）
  employees.forEach((e, idx) => {
    if (isTraining(e, day)) {
      suggestions.push({
        employeeId: e.id,
        employeeName: e.name,
        suggestedShift: 'rest',
        reason: '学艺中，不可当值',
      });
      return;
    }
    // 新员工（无 lastRestDay）视为刚休沐过（sinceRest=0），避免入职即强制休沐
    const sinceRest = e.lastRestDay === undefined ? 0 : day - e.lastRestDay;
    if (sinceRest >= 6) {
      suggestions.push({
        employeeId: e.id,
        employeeName: e.name,
        suggestedShift: 'rest',
        reason: '已多日未休沐，该歇一歇',
      });
      return;
    }
    // 技能数（覆盖高峰）+ 满意度（高者全天）
    const skillCount = e.skills?.length ?? 0;
    if (e.satisfaction >= 70 && skillCount >= 2) {
      suggestions.push({
        employeeId: e.id,
        employeeName: e.name,
        suggestedShift: 'full',
        reason: '满意度高、手艺精，安排全天',
      });
      return;
    }
    if (skillCount >= 1) {
      // 隔日轮班覆盖高峰（按索引奇偶分早/晚，注释：轮值交替）
      suggestions.push({
        employeeId: e.id,
        employeeName: e.name,
        suggestedShift: idx % 2 === 0 ? 'morning' : 'evening',
        reason: '轮值交替，早班晚班错开',
      });
      return;
    }
    suggestions.push({
      employeeId: e.id,
      employeeName: e.name,
      suggestedShift: weekDay % 2 === 0 ? 'morning' : 'evening',
      reason: '按需排班',
    });
  });
  return suggestions;
}

/**
 * 应用排班建议（autoSchedule 接线）：逐个 assignShift，跳过冲突（学艺中自动休沐由建议保证）。
 * 返回更新后的员工数组。
 */
export function applyScheduleSuggestions(
  employees: readonly Employee[],
  suggestions: readonly ScheduleSuggestion[],
  day: number
): { employees: Employee[]; applied: number; warnings: string[] } {
  let next = [...employees];
  let applied = 0;
  const warnings: string[] = [];
  for (const s of suggestions) {
    const target = next.find((e) => e.id === s.employeeId);
    if (!target) continue;
    const res = assignShift(target, s.suggestedShift, day);
    if (!res) {
      warnings.push(`${s.employeeName}学艺中，未排班`);
      continue;
    }
    next = next.map((e) => (e.id === s.employeeId ? res.employee : e));
    applied += 1;
    if (res.warning) warnings.push(res.warning);
  }
  return { employees: next, applied, warnings };
}

/** 便捷：传入完整 state（store 接线用），返回排班概览 */
export function scheduleOverview(state: TangGameState): ShiftCoverage {
  return getShiftCoverage(state.employees ?? [], state.day);
}
