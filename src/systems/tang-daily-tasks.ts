/**
 * 《我在唐朝当掌柜》今日要务系统（TANG-ADD-001 模块三）
 * 今日要务："今日要务：手札每日推演出的紧要之事，完成可得先祖红印加持。"
 * 纯函数：
 * - generateDailyTasks(昨日已完成 id, rng?)：清晨抽 2 个（排除昨日已完成）。
 * - checkTaskCompletion(今日状态, 今日要务, rng?)：打烊判定每个要务条件，
 *   完成 → 返回新完成 id（由 store 盖「了」红印 + 发奖励）。
 * 铁律：古风措辞；不持有游戏状态。
 */
import { DAILY_TASKS, DAILY_TASK_MAP, WEEKLY_TASKS, WEEKLY_TASK_MAP } from '@/config/tang-daily-tasks';
import type { DailyTask, WeeklyTask } from '@/types/tang-manager';

/** 判定所需今日追踪状态（只读；store 接线写入） */
export interface DailyTaskTrack {
  /** 今日净利 */
  netProfit: number;
  /** 今日已接待大单数（type='big_order' 且 handled） */
  bigOrderHandled: number;
  /** 今日通晓人心使用次数 */
  mindReadUsed: number;
  /** 今日卖出丝绸数 */
  silkSold: number;
  /** 今日市集捡漏触发 */
  marketDealTriggered: boolean;
  /** 今日闲聊次数 */
  chatUsed: number;
  /** 今日投诉数 */
  complaints: number;
  /** 今日已接待客人总数 */
  guestsHandled: number;
  /** 今日客人总数 */
  guestsTotal: number;
  /** 今日拒客数 */
  rejectedGuests: number;
}

/** 单任务条件判定 */
export function taskConditionMet(task: DailyTask, track: DailyTaskTrack): boolean {
  const c = task.condition;
  if (c.bigOrderHandled && track.bigOrderHandled < 1) return false;
  if (c.minNetProfit !== undefined && track.netProfit < c.minNetProfit) return false;
  if (c.mindReadUsed && track.mindReadUsed < 1) return false;
  if (c.silkSold !== undefined && track.silkSold < c.silkSold) return false;
  if (c.marketDealTriggered && !track.marketDealTriggered) return false;
  if (c.chatUsed && track.chatUsed < 1) return false;
  if (c.noComplaints && track.complaints > 0) return false;
  if (c.allGuestsHandled && track.guestsHandled < track.guestsTotal) return false;
  return true;
}

/** 清晨抽 2 个今日要务（排除昨日已完成；池不足按可抽取数返回） */
export function generateDailyTasks(
  yesterdayCompleted: readonly string[] = [],
  rng: () => number = Math.random
): DailyTask[] {
  const pool = DAILY_TASKS.filter((t) => !yesterdayCompleted.includes(t.id));
  const picked: DailyTask[] = [];
  const candidates = [...pool];
  const count = Math.min(2, candidates.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * candidates.length);
    const task = candidates.splice(Math.min(idx, candidates.length - 1), 1)[0]!;
    picked.push(task);
  }
  return picked;
}

/**
 * 打烊判定今日要务完成：返回新完成 id（不含已完成的）。
 * 说明：完成判定不含随机；rng 参数预留（如需奖励波动）。
 */
export function checkTaskCompletion(
  tasks: readonly DailyTask[] | undefined,
  track: DailyTaskTrack,
  alreadyCompleted: readonly string[] = []
): string[] {
  const done = alreadyCompleted;
  const newly: string[] = [];
  for (const task of tasks ?? []) {
    if (done.includes(task.id)) continue;
    if (taskConditionMet(task, track)) {
      newly.push(task.id);
    }
  }
  return newly;
}

/** 按 id 查要务（奖励发放用；不存在返回 null） */
export function dailyTaskById(id: string): DailyTask | null {
  return DAILY_TASK_MAP[id] ?? null;
}

// ============================================================
// TANG-TRF-001：周级要务（模块三）——每周一刷新，周日打烊结算
// 与今日要务（日任务）并存：日任务每日清晨抽 2 个；周任务每周一刷新全部四项。
// ============================================================

/**
 * 生成本周要务（每周一 startNewDay 刷新；大单目标按评分动态：
 * 评分<3.0 → 1 位 / ≥3.0 → 2 位）。
 */
export function generateWeeklyTasks(score: number): WeeklyTask[] {
  const bigOrderTarget = score < 3.0 ? 1 : 2;
  return WEEKLY_TASKS.map((t) => (t.id === 'week-big-orders' ? { ...t, target: bigOrderTarget } : { ...t }));
}

/**
 * 打烊判定本周要务完成（进度 ≥ target 即完成；返回新完成 id，由 store 发奖励）。
 */
export function checkWeeklyTasks(
  tasks: readonly WeeklyTask[] | undefined,
  progress: Record<string, number> | undefined
): string[] {
  const newly: string[] = [];
  for (const task of tasks ?? []) {
    if ((progress?.[task.id] ?? 0) >= task.target) {
      newly.push(task.id);
    }
  }
  return newly;
}

/** 周级要务进度累加（防负数；接待/预购/结算/通晓人心接线用） */
export function addWeeklyProgress(
  progress: Record<string, number> | undefined,
  key: string,
  delta: number
): Record<string, number> {
  const base = progress ?? {};
  return { ...base, [key]: Math.max(0, (base[key] ?? 0) + delta) };
}

/** 按 id 查周级要务（奖励发放用；不存在返回 null） */
export function weeklyTaskById(id: string): WeeklyTask | null {
  return WEEKLY_TASK_MAP[id] ?? null;
}
