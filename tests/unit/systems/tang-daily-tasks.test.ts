/**
 * 今日要务单测（TANG-ADD-001 模块三）
 * 覆盖：抽取排除昨日已完成、各条件判定、结算奖励映射、红印（完成 id）。
 */
import { describe, expect, it } from 'vitest';
import { DAILY_TASKS, WEEKLY_TASKS } from '@/config/tang-daily-tasks';
import {
  addWeeklyProgress,
  checkTaskCompletion,
  checkWeeklyTasks,
  generateDailyTasks,
  generateWeeklyTasks,
  taskConditionMet,
} from '@/systems/tang-daily-tasks';
import type { DailyTaskTrack } from '@/systems/tang-daily-tasks';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

const track: DailyTaskTrack = {
  netProfit: 100,
  bigOrderHandled: 1,
  mindReadUsed: 1,
  silkSold: 3,
  marketDealTriggered: true,
  chatUsed: 1,
  complaints: 0,
  guestsHandled: 5,
  guestsTotal: 5,
  rejectedGuests: 0,
};

describe('generateDailyTasks · 抽取', () => {
  it('清晨抽 2 个；默认从 8 要务池抽取', () => {
    const tasks = generateDailyTasks([], seq(0.1, 0.4));
    expect(tasks).toHaveLength(2);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(2);
  });

  it('排除昨日已完成：昨日完成 6 项 → 今日只从剩余 2 项抽', () => {
    const allIds = DAILY_TASKS.map((t) => t.id);
    const done = allIds.slice(0, 6);
    const tasks = generateDailyTasks(done, seq(0, 0.9));
    expect(tasks.length).toBeLessThanOrEqual(2);
    for (const t of tasks) {
      expect(done).not.toContain(t.id);
    }
  });

  it('池不足时按可抽取数返回（昨日完成 7 项 → 抽 1）', () => {
    const done = DAILY_TASKS.map((t) => t.id).slice(0, 7);
    const tasks = generateDailyTasks(done, seq(0));
    expect(tasks).toHaveLength(1);
  });

  it('昨日全部完成 → 抽 0（下一日重新纳入）', () => {
    const done = DAILY_TASKS.map((t) => t.id);
    expect(generateDailyTasks(done, seq(0))).toHaveLength(0);
  });
});

describe('taskConditionMet · 条件判定', () => {
  it('净利三十：净利 ≥30 满足、<30 不满足', () => {
    const task = DAILY_TASKS.find((t) => t.id === 'task-net-profit')!;
    expect(taskConditionMet(task, { ...track, netProfit: 30 })).toBe(true);
    expect(taskConditionMet(task, { ...track, netProfit: 29 })).toBe(false);
  });

  it('无投诉：投诉>0 不满足', () => {
    const task = DAILY_TASKS.find((t) => t.id === 'task-no-complaint')!;
    expect(taskConditionMet(task, { ...track, complaints: 0 })).toBe(true);
    expect(taskConditionMet(task, { ...track, complaints: 1 })).toBe(false);
  });

  it('接待完所有客：已接待 < 总数不满足', () => {
    const task = DAILY_TASKS.find((t) => t.id === 'task-all-guests')!;
    expect(taskConditionMet(task, { ...track, guestsHandled: 5, guestsTotal: 5 })).toBe(true);
    expect(taskConditionMet(task, { ...track, guestsHandled: 4, guestsTotal: 5 })).toBe(false);
  });

  it('卖丝绸三匹：丝绸 <3 不满足', () => {
    const task = DAILY_TASKS.find((t) => t.id === 'task-sell-silk')!;
    expect(taskConditionMet(task, { ...track, silkSold: 3 })).toBe(true);
    expect(taskConditionMet(task, { ...track, silkSold: 2 })).toBe(false);
  });
});

describe('checkTaskCompletion · 结算', () => {
  it('全条件满足 → 返回 8 个完成 id（奖励随 task.reward 映射）', () => {
    const newly = checkTaskCompletion(DAILY_TASKS, track);
    expect(newly).toHaveLength(8);
    expect(newly).toContain('task-big-order');
    expect(newly).toContain('task-chat');
  });

  it('已完成的 id 不再重复返回', () => {
    const newly = checkTaskCompletion(DAILY_TASKS, track, ['task-big-order']);
    expect(newly).not.toContain('task-big-order');
    expect(newly).toHaveLength(7);
  });

  it('条件不满足的要务不完成', () => {
    const bad: DailyTaskTrack = { ...track, netProfit: 0, bigOrderHandled: 0, mindReadUsed: 0, silkSold: 0, marketDealTriggered: false, chatUsed: 0, complaints: 3, guestsHandled: 0, rejectedGuests: 5 };
    const newly = checkTaskCompletion(DAILY_TASKS, bad);
    expect(newly).toHaveLength(0);
  });

  it('空任务/undefined → 空完成', () => {
    expect(checkTaskCompletion([], track)).toEqual([]);
    expect(checkTaskCompletion(undefined, track)).toEqual([]);
  });

  it('奖励字段齐全：大单接待 声望+10 / 净利三十 满意度+3 / 无投诉 气氛+10 / 接待完 精力+10', () => {
    const map = Object.fromEntries(DAILY_TASKS.map((t) => [t.id, t.reward]));
    expect(map['task-big-order']!.reputation).toBe(10);
    expect(map['task-net-profit']!.satisfaction).toBe(3);
    expect(map['task-mind-read']!.mindReadBonus).toBe(1);
    expect(map['task-sell-silk']!.score).toBe(0.02);
    expect(map['task-market-deal']!.silver).toBe(5);
    expect(map['task-no-complaint']!.atmosphere).toBe(10);
    expect(map['task-all-guests']!.energy).toBe(10);
  });
});

// ============================================================
// TANG-TRF-001：周级要务（与日任务并存：日任务每日、周任务每周）
// ============================================================

describe('generateWeeklyTasks · 周级要务（每周一刷新）', () => {
  it('生成四项周要务（大单/预购/净利/通晓人心）', () => {
    const tasks = generateWeeklyTasks(2.0);
    expect(tasks).toHaveLength(4);
    expect(new Set(tasks.map((t) => t.id))).toEqual(
      new Set(['week-big-orders', 'week-preorder', 'week-net-profit', 'week-mind-read'])
    );
  });

  it('大单目标动态：评分<3.0 → 1 位；≥3.0 → 2 位（用户 3 逐字）', () => {
    const low = generateWeeklyTasks(2.9);
    const high = generateWeeklyTasks(3.0);
    expect(low.find((t) => t.id === 'week-big-orders')!.target).toBe(1);
    expect(high.find((t) => t.id === 'week-big-orders')!.target).toBe(2);
  });

  it('配置项齐全：周预购 target=1、周净利 target=300、周通晓 target=3', () => {
    const map = Object.fromEntries(WEEKLY_TASKS.map((t) => [t.id, t]));
    expect(map['week-preorder']!.target).toBe(1);
    expect(map['week-net-profit']!.target).toBe(300);
    expect(map['week-mind-read']!.target).toBe(3);
  });
});

describe('checkWeeklyTasks / addWeeklyProgress · 进度判定与累加', () => {
  it('进度 ≥ target 完成；不足不完成', () => {
    const tasks = generateWeeklyTasks(2.0);
    expect(checkWeeklyTasks(tasks, { 'week-big-orders': 1, 'week-preorder': 1, 'week-net-profit': 300, 'week-mind-read': 3 })).toHaveLength(4);
    expect(checkWeeklyTasks(tasks, { 'week-big-orders': 0, 'week-net-profit': 299 })).toEqual([]);
  });

  it('addWeeklyProgress：累加并防负数', () => {
    expect(addWeeklyProgress({}, 'week-preorder', 1)).toEqual({ 'week-preorder': 1 });
    expect(addWeeklyProgress({ 'week-preorder': 1 }, 'week-preorder', 2)).toEqual({ 'week-preorder': 3 });
    expect(addWeeklyProgress({}, 'week-preorder', -5)).toEqual({ 'week-preorder': 0 });
  });
});
