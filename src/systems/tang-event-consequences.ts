/**
 * 《我在唐朝当掌柜》事件分支与连锁反应系统（地图与事件深化 模块二）
 * 事件选择 → 影响追踪（eventHistory）→ 按指定天数触发连锁事件（pendingConsequences）。
 * 连锁示例：邻居借粮/官府征用/乞丐讨食/竞争对手打压。纯函数：rng 可注入。
 */
import type { EventRecord, PendingConsequence } from '@/types/tang-map-story';
import type { GameEventEffect } from '@/types/tang-manager';

/** 连锁事件定义（sourceEventId + choiceId → 后续） */
export interface ConsequenceDef {
  sourceEventId: string;
  choiceId: string;
  consequenceEventId: string;
  /** 延迟天数 */
  delayDays: number;
  narrative: string;
  effect?: GameEventEffect;
  /** 触发概率（缺省 1） */
  chance?: number;
}

/** 连锁事件表（模块二 2.1 示例 + 2.2 分支树） */
export const CHAIN_EVENT_DEFS: ConsequenceDef[] = [
  // 邻居借粮
  { sourceEventId: 'neighbor-borrow', choiceId: 'lend', consequenceEventId: 'neighbor-repay', delayDays: 7, narrative: '隔壁王掌柜亲自登门，手里提着一篮鸡蛋。陆掌柜，上次借的粮，今日一并还了。这是自家鸡下的蛋，不成敬意。', effect: { reputation: 5, gold: 3 } },
  { sourceEventId: 'neighbor-borrow', choiceId: 'refuse', consequenceEventId: 'neighbor-cool', delayDays: 0, narrative: '王掌柜转身离开时，脸上的笑意淡了几分。此后他见了你，只点个头，不再多说。', effect: { reputation: -2 } },
  // 官府征用
  { sourceEventId: 'govt-requisition', choiceId: 'cooperate', consequenceEventId: 'govt-reward', delayDays: 15, narrative: '京兆府差人送来一封公文——念你上次配合军需征用，特免本月商税。', effect: { gold: 20, reputation: 8 } },
  { sourceEventId: 'govt-requisition', choiceId: 'delay', consequenceEventId: 'govt-warn', delayDays: 7, narrative: '京兆府又来人了——这次语气没那么客气。上次征用你推三阻四，府尹大人很不高兴。这个月的税，加两成。', effect: { gold: -15, reputation: -4 } },
  // 乞丐讨食
  { sourceEventId: 'beggar-beg', choiceId: 'give', consequenceEventId: 'beggar-repay', delayDays: 90, chance: 0.05, narrative: '三个月前你施舍过的那个老乞丐，今天又来了——但他这次不是来讨饭的。掌柜的恩情我一直记着。我在城外破庙里发现了一坛埋了多年的老酒——送给你，算是我的一点心意。', effect: { gold: 500 } },
  // 竞争对手打压（分支树 2.2）
  { sourceEventId: 'rival-pressure', choiceId: 'negotiate', consequenceEventId: 'rival-channel', delayDays: 30, narrative: '竞争对手主动登门，说愿意让出一个客源渠道——以和为贵，两利。', effect: { reputation: 10 } },
  { sourceEventId: 'rival-pressure', choiceId: 'retaliate', consequenceEventId: 'rival-escalate', delayDays: 15, narrative: '你以牙还牙，对方也不甘示弱——商战升级，风声渐紧。', effect: { gold: -20 } },
  { sourceEventId: 'rival-pressure', choiceId: 'endure', consequenceEventId: 'rival-encroach', delayDays: 60, narrative: '你忍气吞声，对方却得寸进尺——客源流失加剧，再不能坐视不理。', effect: { reputation: -6 } },
];

/** 记录事件选择（纯函数） */
export function recordEvent(
  history: readonly EventRecord[],
  eventId: string,
  choiceId: string,
  day: number,
  narrative: string
): EventRecord[] {
  return [...history, { eventId, choiceId, day, narrative }].slice(-50);
}

/** 事件是否已选择过某选项（纯函数；一次性判定） */
export function hasChosen(history: readonly EventRecord[], eventId: string, choiceId: string): boolean {
  return history.some((r) => r.eventId === eventId && r.choiceId === choiceId);
}

/** 按选择生成待触发连锁（纯函数；应用 chance 与 delay） */
export function addPendingConsequence(
  pending: readonly PendingConsequence[],
  sourceEventId: string,
  choiceId: string,
  day: number,
  rng: () => number = Math.random
): PendingConsequence[] {
  const def = CHAIN_EVENT_DEFS.find((d) => d.sourceEventId === sourceEventId && d.choiceId === choiceId);
  if (!def || (def.chance !== undefined && rng() >= def.chance)) return [...pending];
  const triggerDay = def.delayDays <= 0 ? day : day + def.delayDays;
  const item: PendingConsequence = {
    id: `pc-${sourceEventId}-${choiceId}-${day}-${Math.floor(rng() * 1000)}`,
    sourceEventId,
    triggerDay,
    consequenceEventId: def.consequenceEventId,
    narrative: def.narrative,
    ...(def.effect ? { effect: def.effect } : {}),
  };
  return [...pending, item];
}

/** 每日检查到期连锁（纯函数）：返回到期项与剩余项 */
export function checkPendingConsequences(
  pending: readonly PendingConsequence[],
  day: number
): { due: PendingConsequence[]; remaining: PendingConsequence[] } {
  const due = pending.filter((p) => p.triggerDay <= day);
  const remaining = pending.filter((p) => p.triggerDay > day);
  return { due, remaining };
}

/** 行为/库存/人际触发候选（模块四 4.1；纯函数返回可触发事件 id 列表） */
export function checkBehaviorTriggers(input: {
  day: number;
  consecutiveFullReceptionDays: number;
  daysSinceMindRead: number;
  usedAllFiveMovesOnce: boolean;
  inventoryValue: number;
  maxItemStock: number;
  noExpiryStreak: number;
  xiaoerFavor: number;
  harmonyStreak: number;
  conflictStreak: number;
}): string[] {
  const out: string[] = [];
  if (input.consecutiveFullReceptionDays >= 5) out.push('event-overwork');
  if (input.daysSinceMindRead >= 10) out.push('event-rusty-insight');
  if (input.usedAllFiveMovesOnce) out.push('event-versatile-boss');
  if (input.inventoryValue >= 1000) out.push('event-thief-watch');
  if (input.maxItemStock >= 50) out.push('event-hoarding-inquiry');
  if (input.noExpiryStreak >= 7) out.push('event-warehouse-praise');
  if (input.xiaoerFavor >= 50 && input.xiaoerFavor < 70) out.push('event-favor-50');
  else if (input.xiaoerFavor >= 70 && input.xiaoerFavor < 90) out.push('event-favor-70');
  else if (input.xiaoerFavor >= 90) out.push('event-favor-90');
  if (input.harmonyStreak >= 15) out.push('event-best-friends');
  if (input.conflictStreak >= 7) out.push('event-open-conflict');
  return out;
}
