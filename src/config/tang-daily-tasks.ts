/**
 * 《我在唐朝当掌柜》今日要务配置（TANG-ADD-001 模块三）
 * 今日要务："今日要务：手札每日推演出的紧要之事，完成可得先祖红印加持。"
 * 8 要务逐字：大单接待 声望+10 / 净利30 满意度+3 / 用通晓人心 额外+1次 / 卖丝绸3 评分+0.02 /
 * 市集捡漏 金5 / 闲聊 线索1 / 无投诉 气氛+10 / 接待完所有客 精力+10。
 * 纯数据，不依赖 store；抽取/结算纯函数在 systems/tang-daily-tasks.ts。
 */
import type { DailyTask, WeeklyTask } from '@/types/tang-manager';

/** 今日要务全量（清晨抽 2 个；排除昨日已完成） */
export const DAILY_TASKS: readonly DailyTask[] = [
  {
    id: 'task-big-order',
    title: '大单接待',
    description: '今日须好生接待一位大单贵客，莫要让大主顾空手而归。',
    condition: { bigOrderHandled: true },
    reward: { reputation: 10 },
    stampText: '了',
  },
  {
    id: 'task-net-profit',
    title: '净利三十',
    description: '今日净利须满三十两，方不负先祖红印。',
    condition: { minNetProfit: 30 },
    reward: { satisfaction: 3 },
    stampText: '了',
  },
  {
    id: 'task-mind-read',
    title: '用通晓人心',
    description: '今日须用一次「通晓人心」，洞察来客心事。',
    condition: { mindReadUsed: true },
    reward: { mindReadBonus: 1 },
    stampText: '了',
  },
  {
    id: 'task-sell-silk',
    title: '卖丝绸三匹',
    description: '今日须卖出三匹丝绸，让长安街巷都见识陆记的好料子。',
    condition: { silkSold: 3 },
    reward: { score: 0.02 },
    stampText: '了',
  },
  {
    id: 'task-market-deal',
    title: '市集捡漏',
    description: '今日须在市易务或暗标上捡一回漏，赚一笔便宜。',
    condition: { marketDealTriggered: true },
    reward: { silver: 5 },
    stampText: '了',
  },
  {
    id: 'task-chat',
    title: '闲话一席',
    description: '今日须与来客闲谈一席，探听些长安城的新鲜事。',
    condition: { chatUsed: true },
    reward: { clue: 'daily-chat' },
    stampText: '了',
  },
  {
    id: 'task-no-complaint',
    title: '无投诉之日',
    description: '今日须让每一位客人心满意足，不落一句怨言。',
    condition: { noComplaints: true },
    reward: { atmosphere: 10 },
    stampText: '了',
  },
  {
    id: 'task-all-guests',
    title: '接待完所有客',
    description: '今日须把登门的客人都好生招呼周全，不留一个冷板凳。',
    condition: { allGuestsHandled: true },
    reward: { energy: 10 },
    stampText: '了',
  },
];

/** id → 要务 索引 */
export const DAILY_TASK_MAP: Readonly<Record<string, DailyTask>> = Object.fromEntries(
  DAILY_TASKS.map((t) => [t.id, t])
);

/** 要务查询（id → 定义；不存在返回 null） */
export function dailyTaskById(id: string): DailyTask | null {
  return DAILY_TASK_MAP[id] ?? null;
}

// ============================================================
// TANG-TRF-001：周级要务（模块三）——每周一刷新，周日打烊结算奖励
// 四要务逐字：本周接待大单 / 本周完成预购 / 本周净利 / 本周通晓人心
// 大单目标动态（评分<3.0→1 位 / ≥3.0→2 位）由 generateWeeklyTasks 重写
// ============================================================

/** 周级要务全量（周一生成全部四项；进度由接待/预购/结算/通晓人心接线累加） */
export const WEEKLY_TASKS: readonly WeeklyTask[] = [
  {
    id: 'week-big-orders',
    title: '周接待大单',
    description: '本周须好生接待大单贵客，莫让大主顾空手而归。',
    target: 1, // 动态：评分<3.0→1 / ≥3.0→2
    reward: { reputation: 30 },
    stampText: '周',
  },
  {
    id: 'week-preorder',
    title: '周成交预购',
    description: '本周须完成一笔预购订单，按期交货不负所托。',
    target: 1,
    reward: { silver: 50 },
    stampText: '周',
  },
  {
    id: 'week-net-profit',
    title: '周净利三百',
    description: '本周净利须满三百两，方显陆记经营之能。',
    target: 300,
    reward: { score: 0.05 },
    stampText: '周',
  },
  {
    id: 'week-mind-read',
    title: '周通晓人心',
    description: '本周须用三次「通晓人心」，洞察来客心事。',
    target: 3,
    reward: { mindReadBonus: 1 },
    stampText: '周',
  },
];

/** id → 周级要务 索引 */
export const WEEKLY_TASK_MAP: Readonly<Record<string, WeeklyTask>> = Object.fromEntries(
  WEEKLY_TASKS.map((t) => [t.id, t])
);

/** 周级要务查询（id → 定义；不存在返回 null） */
export function weeklyTaskById(id: string): WeeklyTask | null {
  return WEEKLY_TASK_MAP[id] ?? null;
}
