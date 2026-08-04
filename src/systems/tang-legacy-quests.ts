/**
 * 《我在唐朝当掌柜》陆家遗命系统（TANG-ADD-001 模块四）
 * 遗命："遗命：陆氏先祖未竟之愿，浮现于手札之上。完成可得先祖福荫，或解锁隐藏故事。"
 * 纯函数：
 * - checkLegacyQuestTrigger(state)：清晨判定（条件 + 前置完成 + 未完成）→ 返回应激活的遗命。
 * - checkLegacyQuestCompletion(state)：打烊判定当前遗命达成 → 返回完成的遗命（store 应用奖励/解锁下一个）。
 * 铁律：古风措辞；不持有游戏状态。
 */
import { LEGACY_QUESTS } from '@/config/tang-legacy-quests';
import type { LegacyQuest } from '@/types/tang-manager';

/** 判定所需状态子集（只读） */
export interface LegacyQuestState {
  day: number;
  silver: number;
  reputation: number;
  legacyDebt: number;
  /** 西市商团关系（id='xishi' 的 relationship；缺省 0） */
  factionRelationship: number;
  /** 已持线索 id */
  clueIds: readonly string[];
  /** 已访问地图节点 id */
  visitedNodes: readonly string[];
  /** 是否破产过 */
  hasGoneBroke: boolean;
  /** 已完成遗命 id（前置推进） */
  completedLegacyQuests?: readonly string[];
  /** 当前激活遗命 id（非空则不再触发新遗命，除非完成） */
  activeLegacyQuestId?: string | null;
}

/** 前置条件判定（单遗命） */
export function legacyQuestPrerequisiteMet(quest: LegacyQuest, state: LegacyQuestState): boolean {
  const c = quest.condition;
  if (c.requiresQuest && !(state.completedLegacyQuests ?? []).includes(c.requiresQuest)) return false;
  return true;
}

/** 触发条件判定（单遗命） */
export function legacyQuestTriggerMet(quest: LegacyQuest, state: LegacyQuestState): boolean {
  const c = quest.condition;
  if (c.minSilver !== undefined && state.silver < c.minSilver) return false;
  if (c.minReputation !== undefined && state.reputation < c.minReputation) return false;
  if (c.minFactionRelationship !== undefined && state.factionRelationship < c.minFactionRelationship) return false;
  if (c.requiredClue && !state.clueIds.includes(c.requiredClue)) return false;
  if (c.requiredNode && !state.visitedNodes.includes(c.requiredNode)) return false;
  if (c.minDay !== undefined && state.day < c.minDay) return false;
  if (c.requireNoBankruptcy && state.hasGoneBroke) return false;
  return true;
}

/**
 * 清晨判定：遍历遗命（按配置顺序）——
 * 已完成的跳过；前置未满足跳过；触发条件满足且当前无激活 → 返回该遗命（store 写入 activeLegacyQuest）。
 */
export function checkLegacyQuestTrigger(
  state: LegacyQuestState
): LegacyQuest | null {
  if (state.activeLegacyQuestId) return null;
  const done = state.completedLegacyQuests ?? [];
  for (const quest of LEGACY_QUESTS) {
    if (done.includes(quest.id)) continue;
    if (!legacyQuestPrerequisiteMet(quest, state)) continue;
    if (legacyQuestTriggerMet(quest, state)) {
      return quest;
    }
  }
  return null;
}

/** 完成条件判定（单遗命） */
export function legacyQuestCompletionMet(quest: LegacyQuest, state: LegacyQuestState): boolean {
  return legacyQuestTriggerMet(quest, state);
}

/** 打烊判定当前遗命完成：返回完成的遗命（不存在/未激活/未达成返回 null） */
export function checkLegacyQuestCompletion(
  state: LegacyQuestState,
  active: LegacyQuest | null | undefined
): LegacyQuest | null {
  if (!active) return null;
  if ((state.completedLegacyQuests ?? []).includes(active.id)) return null;
  if (legacyQuestCompletionMet(active, state)) {
    return active;
  }
  return null;
}
