/**
 * 《我在唐朝当掌柜》店员主动互动类型（店员互动提升 模块一）
 * 提醒气泡：店员在经营各环节主动观察/提醒/给建议，玩家可采纳或忽略。
 * 与 types/tang-dialogue.ts 的 StaffReminder（接待对话阶段提醒）区分——
 * 本文件为「经营全局提醒」类型（含员工 id/优先级/建议/效果）。
 */
import type { EmployeeType, GuestType, ShopType } from '@/types/tang-manager';

/** 提醒优先级：高=朱砂红 / 中=描金 / 低=竹青 */
export type ReminderPriority = 'high' | 'medium' | 'low';

/** 采纳后的效果描述（纯数据；具体落账由 store 按 effect.type 处理） */
export interface ReminderEffect {
  /** 效果类型（store 分发） */
  type: string;
  /** 数值（如 +20%、+3 好感） */
  value?: number;
  /** 目标（商品名/客人名/员工 id 等） */
  target?: string;
  /** 说明文案 */
  note?: string;
}

/** 店员提醒（模块一 1.1） */
export interface StaffReminder {
  id: string;
  /** 店员 ID（或 'a_zhao'） */
  staffId: string;
  /** 店员姓名 */
  staffName: string;
  /** 触发阶段（morning / reception / afternoon / closing / inventory / finance / staff） */
  triggerPhase: string;
  /** 触发条件描述 */
  condition: string;
  /** 提醒内容（1-2 句） */
  content: string;
  /** 建议操作（短句） */
  suggestion: string;
  /** 采纳后的效果 */
  effectIfAccepted: ReminderEffect;
  priority: ReminderPriority;
}

/** 提醒上下文（generateStaffReminders 输入；只取用到的字段，避免整份 state 耦合） */
export interface ReminderContext {
  day: number;
  phase: string;
  shopType: ShopType | null;
  /** 在岗员工（不含阿昭；阿昭经 xiaoer* 字段） */
  employees: Array<{ id: string; name: string; type: EmployeeType; satisfaction: number; skills?: Array<{ id: string }> }>;
  /** 阿昭满意度（0-100） */
  xiaoerSatisfaction: number;
  /** 今日客人（接待阶段） */
  guests?: Array<{ id: string; name: string; type: GuestType; visitCount?: number; isBadReviewer?: boolean; preferenceRevealed?: boolean; patience?: number }>;
  /** 库存（库存/陈损/采买阶段） */
  shopItems?: Array<{ name: string; stock: number; price?: number; cost?: number; expiry?: number; category?: string }>;
  /** 今日卦象 */
  todayHexagram?: string | null;
  /** 今日净收益 */
  todayNetProfit?: number;
  /** 今日是否有投诉 */
  todayComplaint?: boolean;
  /** 今日使用通晓人心次数 */
  todayMindReadUsed?: number;
  /** 现银 */
  silver: number;
  /** 贷款/赊账/投资等财务信息 */
  loans?: unknown[];
  credit?: number;
  investments?: unknown[];
  deposits?: unknown[];
  /** 周间要务是否临期（剩 2 天） */
  weeklyTaskDueSoon?: boolean;
  /** 连续未巡查天数 */
  daysSincePatrol?: number;
  /** 可拜访且好感≥40 的 NPC 名 */
  visitableNpc?: string;
  /** 是否有镖队出发（护卫提醒） */
  caravanDeparting?: boolean;
  /** 月内连续亏损天数 */
  lossStreak?: number;
  /** 滞销商品名 */
  slowMovingItem?: string;
  /** 相冲药材对 */
  clashingHerbs?: { a: string; b: string };
  /** 新到食材/布料 */
  newMaterial?: string;
  /** 菜单未更天数 */
  menuAgeDays?: number;
  /** 库房容量使用率（0-1） */
  storageUsage?: number;
  /** 大额闲置现银阈值是否满足 */
  idleSilver?: boolean;
}

/** 采纳/忽略结果（纯函数返回；store 落账） */
export interface ApplyReminderResult {
  /** 处理后的提醒列表（移除该条） */
  reminders: StaffReminder[];
  /** 员工满意度变动（staffId → delta） */
  satisfactionDeltas: Record<string, number>;
  /** 采纳后的效果（忽略为 null） */
  acceptedEffect?: ReminderEffect;
  /** 更新后的连续忽略计数（staffId → count） */
  ignoreCounts: Record<string, number>;
}
