/**
 * 《我在唐朝当掌柜》事件疲劳度系统（地图与事件深化 模块四 4.2）
 * - 同一事件每 30 天最多触发 1 次
 * - 同一类别每 7 天最多触发 2 次
 * - 连续 3 天触发后，第 4 天强制休息
 * - 部分事件一次性（触发后不再重复）
 * 纯函数。
 */
import type { EventFatigue } from '@/types/tang-map-story';

function emptyFatigue(): EventFatigue {
  return { lastTriggerDay: {}, categoryCounts: {}, consecutiveDays: 0, oneTimeDone: {} };
}

/** 空疲劳状态（store 初始值用） */
export function createEventFatigue(): EventFatigue {
  return emptyFatigue();
}

/** 是否可触发（纯函数）：冷却/频次/强制休息/一次性 */
export function canTriggerEvent(
  eventId: string,
  category: string,
  fatigue: EventFatigue,
  day: number,
  oneTime: boolean
): boolean {
  if (oneTime && fatigue.oneTimeDone[eventId]) return false;
  const last = fatigue.lastTriggerDay[eventId] ?? -999;
  if (day - last < 30) return false;
  const cat = fatigue.categoryCounts[category];
  if (cat && day - cat.day < 7 && cat.count >= 2) return false;
  if (fatigue.consecutiveDays >= 3) return false;
  return true;
}

/** 记录一次触发（纯函数） */
export function recordTrigger(
  fatigue: EventFatigue,
  eventId: string,
  category: string,
  day: number,
  oneTime: boolean
): EventFatigue {
  const cat = fatigue.categoryCounts[category];
  const nextCat = cat && day - cat.day < 7 ? { day: cat.day, count: cat.count + 1 } : { day, count: 1 };
  return {
    lastTriggerDay: { ...fatigue.lastTriggerDay, [eventId]: day },
    categoryCounts: { ...fatigue.categoryCounts, [category]: nextCat },
    consecutiveDays: fatigue.consecutiveDays + 1,
    oneTimeDone: oneTime ? { ...fatigue.oneTimeDone, [eventId]: true } : fatigue.oneTimeDone,
  };
}

/** 强制休息（连续 3 天后；次日重置为 0——纯函数，供 startNewDay 调用） */
export function resetConsecutive(fatigue: EventFatigue): EventFatigue {
  return { ...fatigue, consecutiveDays: 0 };
}
