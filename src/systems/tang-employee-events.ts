/**
 * 《我在唐朝当掌柜》员工事件系统（Step 5a 2.5）
 * 纯函数：checkEmployeeEvents(state, rng?) 在 settleDay 后调用，返回事件结果数组；
 * store 应用满意度/离职/加薪/建议加成并记录 eventLog。
 * - 请求涨薪：满意度<50 基准 15%（自动答应：满意度+5、本月 +2 两——占位）
 * - 员工矛盾：5% 概率（结果占位：自动和稀泥，双方满意度-2；UI 调解为后续增强）
 * - 被挖角：8% 概率；满意度<40 → 15%（低满意度被挖概率高）→ 离职
 * - 特殊员工背景揭露：isSpecial 且入职≥15 天且未揭露，10% → backgroundRevealed=true、
 *   满意度+5、按 hiddenFlaw 产生负面（占位：-5 两）+ 触发完整剧情标记
 * - 改进建议：满意度≥70 且技能≥2，8% → 次日基础收益 +2%（incomeBonus=0.02）
 */
import type { Employee, EmployeeEventResult, TangGameState } from '@/types/tang-manager';

/** 各事件基准概率（可导出便于测试/调参） */
export const EMPLOYEE_EVENT_RATES = {
  raiseRequest: 0.15, // 满意度<50
  conflict: 0.05,
  poached: 0.08, // 满意度≥40
  poachedLow: 0.15, // 满意度<40
  backgroundReveal: 0.1, // 入职≥15 天
  suggestion: 0.08, // 满意度≥70 且技能≥2
} as const;

/** TANG-SOC-001 模块六：社交类员工事件概率 */
export const SOCIAL_EVENT_RATES = {
  apprenticeRequest: 0.04, // 拜师请求
  sectConflict: 0.03, // 师门恩怨
  poachThreat: 0.05, // 挖角威胁
  jointVenture: 0.02, // 合伙创业
  familyTrouble: 0.04, // 家中有难
  reportColleague: 0.03, // 举报同僚
} as const;

/** 计算入职天数（今天 - 入职日；hireDay 次日到岗，故 day 与 hireDay 同日时算 1 天） */
export function daysEmployed(employee: Employee, day: number): number {
  return Math.max(0, day - employee.hireDay + 1);
}

/**
 * 结算后判定员工事件（2.5）。遍历在职员工，按概率产出事件结果。
 * @param state 完整游戏状态（读取 employees/day）
 */
export function checkEmployeeEvents(
  state: TangGameState,
  rng: () => number = Math.random
): EmployeeEventResult[] {
  const employees = state.employees ?? [];
  const results: EmployeeEventResult[] = [];
  const day = state.day;

  for (const emp of employees) {
    // 请求涨薪（满意度<50）
    if (emp.satisfaction < 50 && rng() < EMPLOYEE_EVENT_RATES.raiseRequest) {
      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        type: 'raise_request',
        title: '请求涨薪',
        description: `${emp.name}搓着手，期期艾艾地开口：东家，这月钱……是不是该涨涨了？`,
        satisfactionChange: 5,
        goldChange: -2, // 本月 +2 两（占位：不按 salary 比例）
      });
      continue;
    }

    // 员工矛盾（5%）：自动和稀泥（占位），波及随机另一位员工
    if (rng() < EMPLOYEE_EVENT_RATES.conflict) {
      const others = employees.filter((e) => e.id !== emp.id);
      const other = others.length > 0 ? others[Math.floor(rng() * others.length)]! : undefined;
      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        type: 'conflict',
        title: '员工矛盾',
        description: other
          ? `${emp.name}与${other.name}为了排班的事吵了起来。你各打五十大板，劝二人和为贵（占位：自动和稀泥）。`
          : `${emp.name}一个人闷闷不乐，像是跟谁置气。你安抚了几句。`,
        satisfactionChange: -2,
        goldChange: 0,
        otherEmployeeId: other?.id,
      });
      continue;
    }

    // 被挖角（8%；满意度<40 → 15%）：低满意度易被挖走
    const poachRate = emp.satisfaction < 40 ? EMPLOYEE_EVENT_RATES.poachedLow : EMPLOYEE_EVENT_RATES.poached;
    if (rng() < poachRate) {
      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        type: 'poached',
        title: '被人挖角',
        description: `对街新开的铺子看中了${emp.name}的手艺，许了双倍月钱。他收拾包袱，朝你拱了拱手：「东家，对不住了。」`,
        satisfactionChange: 0,
        goldChange: 0,
        quit: true,
      });
      continue;
    }

    // 特殊员工背景揭露（入职≥15 天，10%）
    if (emp.isSpecial && !emp.backgroundRevealed && daysEmployed(emp, day) >= 15 && rng() < EMPLOYEE_EVENT_RATES.backgroundReveal) {
      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        type: 'background_reveal',
        title: '背景揭露',
        description: `一日酒后，${emp.name}红着眼眶说了实话：${emp.hiddenBackground ?? '他从前有一段不愿提起的过往'}。原来他还有一个${emp.hiddenFlaw ?? '不为人知的毛病'}。`,
        satisfactionChange: 5,
        goldChange: -5, // hiddenFlaw 负面效果（占位：-5 两，如嗜赌输钱/私藏货款）
      });
      continue;
    }

    // 改进建议（满意度≥70 且技能≥2，8%）→ 次日基础收益 +2%
    if (emp.satisfaction >= 70 && emp.skills.length >= 2 && rng() < EMPLOYEE_EVENT_RATES.suggestion) {
      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        type: 'suggestion',
        title: '改进建议',
        description: `${emp.name}凑过来，低声提了个主意：把伙计的排班错开，高峰时多个人手。你听了连连点头。`,
        satisfactionChange: 0,
        goldChange: 0,
        incomeBonus: 0.02,
      });
    }
  }
  return results;
}

/**
 * 应用员工事件结果（纯函数，store 调用）：返回 { employees, goldDelta, bonusRate, eventLogAdditions, specialStoryCompleted }
 * - 涨薪：满意度+5、扣 2 两
 * - 矛盾：双方满意度-2
 * - 挖角：移除该员工
 * - 背景揭露：backgroundRevealed=true、满意度+5、扣 5 两、specialEmployeeStoryCompleted=true
 * - 建议：bonusRate 累计（封顶 0.06）
 */
export function applyEmployeeEvents(
  employees: readonly Employee[],
  events: readonly EmployeeEventResult[],
  day: number
): {
  employees: Employee[];
  goldDelta: number;
  bonusRate: number;
  eventLogAdditions: string[];
  specialStoryCompleted: boolean;
} {
  let goldDelta = 0;
  let bonusRate = 0;
  let specialStoryCompleted = false;
  const eventLogAdditions: string[] = [];

  let next = employees.map((e) => ({ ...e }));
  for (const ev of events) {
    eventLogAdditions.push(`emp-ev:${ev.type}:${ev.employeeName}:${day}`);
    goldDelta += ev.goldChange;
    if (ev.incomeBonus) bonusRate += ev.incomeBonus;
    if (ev.type === 'background_reveal') specialStoryCompleted = true;
    if (ev.type === 'poached' && ev.quit) {
      next = next.filter((e) => e.id !== ev.employeeId);
      continue;
    }
    next = next.map((e) => {
      if (e.id === ev.employeeId) {
        if (ev.type === 'background_reveal') {
          return { ...e, satisfaction: Math.min(100, e.satisfaction + ev.satisfactionChange), backgroundRevealed: true };
        }
        return { ...e, satisfaction: Math.min(100, e.satisfaction + ev.satisfactionChange) };
      }
      // 矛盾波及方
      if (ev.otherEmployeeId && e.id === ev.otherEmployeeId) {
        return { ...e, satisfaction: Math.max(0, e.satisfaction - 2) };
      }
      return e;
    });
  }

  return { employees: next, goldDelta, bonusRate: Math.min(0.06, bonusRate), eventLogAdditions, specialStoryCompleted };
}

// ============================================================
// TANG-SOC-001 模块六：社交类员工事件（6 新事件）
// ============================================================

/**
 * 结算后判定社交类员工事件（模块六 6.1 逐字）。独立于 checkEmployeeEvents 调用，
 * 由 store 在 settleDay 后追加（避免与既有事件概率串扰）。
 * - 拜师请求：费用半价成功率 70%
 * - 师门恩怨：师徒矛盾需调解
 * - 挖角威胁：匹配开价或打感情牌
 * - 合伙创业：两高满意度想开分店 正面
 * - 家中有难：预支月钱或给假
 * - 举报同僚：调查真伪
 */
export function checkSocialEmployeeEvents(
  state: TangGameState,
  rng: () => number = Math.random
): EmployeeEventResult[] {
  const employees = state.employees ?? [];
  const results: EmployeeEventResult[] = [];

  for (const emp of employees) {
    // 拜师请求（4%）：已有师傅/学艺中/技能已多 跳过
    if (
      !emp.mentorId &&
      !((emp.trainingCompletionDay ?? 0) > state.day) &&
      (emp.skills?.length ?? 0) <= 2 &&
      rng() < SOCIAL_EVENT_RATES.apprenticeRequest
    ) {
      const candidate = employees.find((e) => e.id !== emp.id && (e.skills?.length ?? 0) >= 3);
      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        type: 'apprentice_request',
        title: '拜师请求',
        description: `${emp.name}恭敬地拱手：「东家，我想拜${candidate?.name ?? '一位老师傅'}为师，学点真本事。束脩可减半，学成定当加倍报答。」`,
        satisfactionChange: 0,
        goldChange: 0,
        socialEventId: `social-apprentice-${emp.id}-${state.day}`,
        mentorCandidateId: candidate?.id,
      });
      continue;
    }

    // 师门恩怨（3%）：师徒关系存在且矛盾等级高
    if (emp.mentorId && rng() < SOCIAL_EVENT_RATES.sectConflict) {
      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        type: 'sect_conflict',
        title: '师门恩怨',
        description: `${emp.name}与师傅${employees.find((e) => e.id === emp.mentorId)?.name ?? '某师傅'}起了龃龉，说师傅藏私，不肯教真本事。`,
        satisfactionChange: 0,
        goldChange: 0,
        socialEventId: `social-sect-${emp.id}-${state.day}`,
        otherEmployeeId: emp.mentorId,
      });
      continue;
    }

    // 挖角威胁（5%）：对街铺子来挖
    if (rng() < SOCIAL_EVENT_RATES.poachThreat) {
      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        type: 'poach_threat',
        title: '挖角威胁',
        description: `对街新开的铺子托人传话：愿出双倍月钱请${emp.name}过去掌事。走还是留，全凭东家一句话。`,
        satisfactionChange: 0,
        goldChange: 0,
        socialEventId: `social-poach-${emp.id}-${state.day}`,
      });
      continue;
    }

    // 合伙创业（2%）：两位高满意度员工想开分店（正面）
    if (emp.satisfaction >= 70 && rng() < SOCIAL_EVENT_RATES.jointVenture) {
      const partner = employees.find((e) => e.id !== emp.id && e.satisfaction >= 70);
      if (partner) {
        results.push({
          employeeId: emp.id,
          employeeName: emp.name,
          type: 'joint_venture',
          title: '合伙创业',
          description: `${emp.name}与${partner.name}一道来见你，说想在坊外支个摊子，替东家开分店，赚了算东家的，亏了算他们的。`,
          satisfactionChange: 5,
          goldChange: 0,
          socialEventId: `social-venture-${emp.id}-${state.day}`,
          venturePartnerId: partner.id,
        });
      }
      continue;
    }

    // 家中有难（4%）：预支月钱或给假
    if (rng() < SOCIAL_EVENT_RATES.familyTrouble) {
      results.push({
        employeeId: emp.id,
        employeeName: emp.name,
        type: 'family_trouble',
        title: '家中有难',
        description: `${emp.name}红着眼圈来告假：家中老母病重，想预支些月钱请郎中，或容他几日假回乡照看。`,
        satisfactionChange: 0,
        goldChange: 0,
        socialEventId: `social-family-${emp.id}-${state.day}`,
      });
      continue;
    }

    // 举报同僚（3%）：有人举报另一位员工手脚不干净
    if (rng() < SOCIAL_EVENT_RATES.reportColleague) {
      const reported = employees.find((e) => e.id !== emp.id);
      if (reported) {
        results.push({
          employeeId: emp.id,
          employeeName: emp.name,
          type: 'report_colleague',
          title: '举报同僚',
          description: `${emp.name}神神秘秘地凑过来：「东家，我瞧见${reported.name}往怀里揣东西，怕不是贪了店里的银钱？」`,
          satisfactionChange: 0,
          goldChange: 0,
          socialEventId: `social-report-${emp.id}-${state.day}`,
          reportedId: reported.id,
        });
      }
    }
  }
  return results;
}

/**
 * 处理社交类事件结果（模块六 6.2 逐字）。
 * 得当：涉事 +10、关系改善；不当：-15、可能离职；忽略：3 天恶化。
 * 返回更新后的员工与事件应用详情；store 调用后把 event 标记 handled 并记录 eventLog。
 */
export function applySocialEvent(
  employees: readonly Employee[],
  event: EmployeeEventResult,
  action: 'well' | 'badly' | 'ignore'
): { employees: Employee[]; event: EmployeeEventResult; quitIds: string[] } {
  let quitIds: string[] = [];
  const applied: EmployeeEventResult = { ...event, handled: true };

  if (action === 'well') {
    applied.handledWell = true;
    applied.satisfactionChange = 10;
  } else if (action === 'badly') {
    applied.handledBadly = true;
    applied.satisfactionChange = -15;
    // 处理不当可能离职（满意度过低时）
    const target = employees.find((e) => e.id === event.employeeId);
    if (target && target.satisfaction + applied.satisfactionChange < 20) {
      quitIds.push(event.employeeId);
    }
  } else {
    applied.ignored = true;
    applied.satisfactionChange = 0;
    // 忽略：3 天恶化（store 记 socialIgnored map；此处仅标记，恶化由 store 每日推进）
  }

  const next = employees.map((e) => {
    if (e.id === event.employeeId) {
      return { ...e, satisfaction: Math.max(0, e.satisfaction + applied.satisfactionChange) };
    }
    // 得当：关系改善（涉事者与另一员工和睦 +2 由 relations 演化处理，此处标记）
    if (applied.handledWell && event.otherEmployeeId && e.id === event.otherEmployeeId) {
      return { ...e, satisfaction: Math.min(100, e.satisfaction + 5) };
    }
    // 举报同僚：调查真伪——伪报则举报人满意度 -5，属实则被举报人离职
    if (event.type === 'report_colleague') {
      if (action === 'well' && event.reportedId && e.id === event.reportedId) {
        quitIds.push(event.reportedId);
        return e;
      }
      if (action === 'badly' && e.id === event.employeeId) {
        return { ...e, satisfaction: Math.max(0, e.satisfaction - 5) };
      }
    }
    return e;
  });

  return { employees: next.filter((e) => !quitIds.includes(e.id)), event: applied, quitIds };
}
