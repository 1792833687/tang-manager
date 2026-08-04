/**
 * 《我在唐朝当掌柜》意外之喜系统（TANG-ADD-001 模块二）
 * 纯函数：checkRareEvents(state, rng?) 打烊遍历 6 稀有事件独立判定——
 * 条件不满足（声望/西市关系/天数/谢七登场/负债零）跳过；已触发（triggeredKey 已记录）跳过；
 * 命中 → 返回触发列表（由 store 应用奖励并标记+手札录记录）。
 * 铁律：古风措辞；不持有游戏状态。
 */
import { RARE_EVENTS } from '@/config/tang-rare-events';
import type { RareEvent } from '@/types/tang-manager';

/** 判定所需状态子集（只读字段；避免整份 state 耦合） */
export interface RareEventState {
  reputation: number;
  day: number;
  legacyDebt: number;
  /** 西市商团关系（factions 中 id='xishi' 的 relationship；缺省 0） */
  factionRelationship: number;
  /** 谢七好感（>0 视为已登场；街头偶遇前置） */
  xieQiFavor: number;
  /** 已触发稀有事件 key（去重） */
  completedRareEvents?: readonly string[];
  /** 坎卦 事件概率×2（event_double 接线：hexagramEventChance 默认 1） */
  hexagramEventChance?: number;
}

/** 条件判定（单事件；不满足返回 false） */
export function rareEventMeetsCondition(event: RareEvent, state: RareEventState): boolean {
  const c = event.condition;
  if (c.minReputation !== undefined && state.reputation < c.minReputation) return false;
  if (c.minFactionRelationship !== undefined && state.factionRelationship < c.minFactionRelationship) return false;
  if (c.minDay !== undefined && state.day < c.minDay) return false;
  if (c.requireXieQiAppeared && state.xieQiFavor <= 0) return false;
  if (c.requireDebtZero && state.legacyDebt > 0) return false;
  return true;
}

/**
 * 打烊遍历独立判定（每事件一次掷骰；命中概率 = chance × hexagramEventChance 封顶 1）。
 * 返回本次触发的事件列表（store 应用奖励/标记/手札录）。
 */
export function checkRareEvents(
  state: RareEventState,
  rng: () => number = Math.random
): RareEvent[] {
  const triggered: RareEvent[] = [];
  const done = state.completedRareEvents ?? [];
  const chanceMult = state.hexagramEventChance ?? 1;
  for (const event of RARE_EVENTS) {
    if (done.includes(event.triggeredKey)) continue;
    if (!rareEventMeetsCondition(event, state)) continue;
    if (rng() < Math.min(1, event.chance * chanceMult)) {
      triggered.push(event);
    }
  }
  return triggered;
}
