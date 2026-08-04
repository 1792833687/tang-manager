/**
 * 《我在唐朝当掌柜》店员提醒系统（模块三）
 * 在对话各阶段检测是否需要店员提醒；最多 1 条/阶段，避免刷屏。
 * 纯函数：checkStaffReminders(guest, gameState, phase) → StaffReminder[]。
 */
import type { DialogueContext, DialoguePhase, StaffReminder } from '@/types/tang-dialogue';
import { STAFF_REMINDER_POOL, type ReminderDef } from '@/config/tang-staff-reminder-pools';
import type { ApplyReminderResult, ReminderContext, ReminderPriority, StaffReminder as GlobalReminder } from '@/types/tang-reminders';

/** 提醒模板表（3.1；每条 1 套，足够简短） */
const REMINDER_TEMPLATES: Record<string, (ctx: DialogueContext) => StaffReminder | null> = {
  // greeting：客人可能是差评师 → 护卫提醒
  bad_reviewer: (ctx) =>
    ctx.isBadReviewer && ctx.hasGuard
      ? {
          id: 'remind-bad-reviewer',
          staff: '护卫',
          phase: 'greeting',
          message: '东家，这人有点面熟——上个月在西市闹过事。小心着点。',
          effect: '已留意差评师：接待时避免触怒（若处理不当易招投诉）。',
        }
      : null,
  // recommend：库存不足 → 阿昭提醒
  stock_short: (ctx) =>
    ctx.hasStock === false
      ? {
          id: 'remind-stock-short',
          staff: '阿昭',
          phase: 'recommend',
          message: `掌柜的，这位客官要的量不够了——我去隔壁借点还是推掉？`,
          effect: '库存不足：成交收益将下降（缺货减两成）。',
        }
      : null,
  // recommend：客人偏好已揭示 → 阿昭提醒
  preference: (ctx) =>
    ctx.preferenceRevealed
      ? {
          id: 'remind-preference',
          staff: '阿昭',
          phase: 'recommend',
          message: '掌柜的，这位客官上回就夸过咱家的货——要不要照他的偏好再推荐一次？',
          effect: '按偏好推荐：成交率与满意度提升。',
        }
      : null,
  // guest_feedback：客人犹豫 → 阿昭提醒
  hesitate: (ctx) =>
    (ctx.patience ?? 100) < 40
      ? {
          id: 'remind-hesitate',
          staff: '阿昭',
          phase: 'guest_feedback',
          message: '掌柜的，这位客官看了好几回了——要不要送点小东西给他个台阶？',
          effect: '追加操作（赠礼/优惠）可挽回犹豫的客人。',
        }
      : null,
  // guest_feedback：客人对价格不满 → 账房提醒
  price: (ctx) =>
    ctx.hasAccountant
      ? {
          id: 'remind-price',
          staff: '账房',
          phase: 'guest_feedback',
          message: '东家，这客官是老主顾了，上次来也是这个价——要不抹个零？',
          effect: '抹零/实在报价可提高成交率（利润略降）。',
        }
      : null,
};

/** 优先级顺序（返回第一条命中的提醒） */
const PRIORITY: Array<keyof typeof REMINDER_TEMPLATES> = [
  'bad_reviewer',
  'stock_short',
  'preference',
  'hesitate',
  'price',
];

/**
 * 检测店员提醒（纯函数）：按优先级返回至多 1 条匹配当前阶段的提醒。
 * 每个阶段独立调用（避免刷屏）。
 */
export function checkStaffReminders(ctx: DialogueContext, phase: DialoguePhase): StaffReminder[] {
  for (const key of PRIORITY) {
    const tpl = REMINDER_TEMPLATES[key]!;
    const reminder = tpl(ctx);
    if (reminder && reminder.phase === phase) return [reminder];
  }
  return [];
}

/** 是否存在任何匹配提醒（UI 轮询用；纯函数） */
export function hasAnyReminder(ctx: DialogueContext, phase: DialoguePhase): boolean {
  return checkStaffReminders(ctx, phase).length > 0;
}

// ============================================================
// 店员互动提升（模块一）：经营全局提醒 generateStaffReminders / applyReminderEffect
// 与上方 checkStaffReminders（接待对话阶段提醒）并存——前者覆盖经营各环节，后者服务对话面板。
// ============================================================

const PRIORITY_ORDER: Record<ReminderPriority, number> = { high: 0, medium: 1, low: 2 };

/** 该店员是否在岗（纯函数）：阿昭常驻；其余员工按类型匹配 */
function staffOnDuty(ctx: ReminderContext, staffId: string): boolean {
  if (staffId === 'a_zhao') return true;
  return ctx.employees.some((e) => e.type === staffId);
}

/** 生成当前阶段提醒（纯函数）：按条件过滤 → 构建内容 → 优先级排序 → 最多 2 条 */
export function generateStaffReminders(
  ctx: ReminderContext,
  phase: string,
  rng: () => number = Math.random
): GlobalReminder[] {
  const hits: GlobalReminder[] = [];
  for (const def of STAFF_REMINDER_POOL) {
    if (def.triggerPhase !== phase) continue;
    if (!staffOnDuty(ctx, def.staffId)) continue;
    if (!def.test(ctx)) continue;
    hits.push({
      id: def.id,
      staffId: def.staffId,
      staffName: def.staffName,
      triggerPhase: def.triggerPhase,
      condition: def.condition,
      content: def.build(ctx),
      suggestion: def.suggestion,
      effectIfAccepted: def.effect,
      priority: def.priority,
    });
  }
  // 同店员同时只显示 1 条：同一 staffId 取优先级最高的一条
  const byStaff = new Map<string, GlobalReminder>();
  for (const r of hits) {
    const cur = byStaff.get(r.staffId);
    if (!cur || PRIORITY_ORDER[r.priority] < PRIORITY_ORDER[cur.priority]) byStaff.set(r.staffId, r);
  }
  return [...byStaff.values()]
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.staffName.localeCompare(b.staffName))
    .slice(0, 2);
}

/**
 * 采纳/忽略提醒（纯函数）：
 * - 采纳：返回采纳效果；该店员满意度 +2（感觉被重视）
 * - 忽略：无效果；连续忽略同一店员 3 次 → 该店员满意度 -5（说了也白说），计数清零
 */
export function applyReminderEffect(
  reminders: GlobalReminder[],
  reminderId: string,
  accepted: boolean,
  ignoreCounts: Record<string, number> = {}
): ApplyReminderResult {
  const reminder = reminders.find((r) => r.id === reminderId);
  if (!reminder) {
    return { reminders, satisfactionDeltas: {}, ignoreCounts };
  }
  const next = reminders.filter((r) => r.id !== reminderId);
  const deltas: Record<string, number> = {};
  const counts: Record<string, number> = { ...ignoreCounts };
  if (accepted) {
    deltas[reminder.staffId] = (deltas[reminder.staffId] ?? 0) + 2;
    return { reminders: next, satisfactionDeltas: deltas, acceptedEffect: reminder.effectIfAccepted, ignoreCounts: counts };
  }
  const prev = counts[reminder.staffId] ?? 0;
  const nextCount = prev + 1;
  counts[reminder.staffId] = nextCount;
  if (nextCount >= 3) {
    deltas[reminder.staffId] = (deltas[reminder.staffId] ?? 0) - 5;
    counts[reminder.staffId] = 0;
  }
  return { reminders: next, satisfactionDeltas: deltas, ignoreCounts: counts };
}
