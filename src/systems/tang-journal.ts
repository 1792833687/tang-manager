/**
 * 《我在唐朝当掌柜》手札录系统（Step 5b-5 模块一）
 * 手札录："手札录：家传手札的空白页，自动记录经营历程、人物往来、重大抉择。可随时翻阅回味。"
 * 纯函数：recordEvent / recordNPCDialogue / recordMilestone / recordChoice（用户 1.2 各逐字）——
 * 只负责「生成 JournalEntry」，不写 store；store 的 addJournalEntry 负责追加。
 * 铁律：古风措辞；不持有游戏状态。
 */
import { v4 as uuidv4 } from 'uuid';
import type { JournalEntry, JournalEntryType } from '@/types/tang-journal';
import type { TangGameState } from '@/types/tang-manager';

/** 记录所需状态子集（只读 day） */
export interface JournalRecordContext {
  day: number;
}

/** 通用条目输入（四个 record 函数共用） */
export interface JournalRecordInput {
  title: string;
  content: string;
  tags?: string[];
  relatedNPC?: string;
  relatedEvent?: string;
}

function buildEntry(
  state: JournalRecordContext,
  type: JournalEntryType,
  input: JournalRecordInput
): JournalEntry {
  return {
    id: uuidv4(),
    day: state.day,
    type,
    title: input.title,
    content: input.content,
    tags: input.tags ?? [],
    ...(input.relatedNPC ? { relatedNPC: input.relatedNPC } : {}),
    ...(input.relatedEvent ? { relatedEvent: input.relatedEvent } : {}),
  };
}

/** 记录经营事件（type='event'；如 触发了债主上门/沈听澜到访） */
export function recordEvent(
  state: JournalRecordContext,
  input: JournalRecordInput
): JournalEntry {
  return buildEntry(state, 'event', input);
}

/** 记录人物往来（type='npc'；如 与沈听澜叙话/谢七拜会） */
export function recordNPCDialogue(
  state: JournalRecordContext,
  input: JournalRecordInput
): JournalEntry {
  return buildEntry(state, 'npc', input);
}

/** 记录里程碑（type='milestone'；如 开分店/升阶段/皇商招标） */
export function recordMilestone(
  state: JournalRecordContext,
  input: JournalRecordInput
): JournalEntry {
  return buildEntry(state, 'milestone', input);
}

/** 记录重大抉择（type='choice'；如 接受官职/婉拒皇商/卖店归隐） */
export function recordChoice(
  state: JournalRecordContext,
  input: JournalRecordInput
): JournalEntry {
  return buildEntry(state, 'choice', input);
}

/** 便捷：由 TangGameState 取 day 构造 context（store 接线用，避免各处展开） */
export function journalContext(state: Pick<TangGameState, 'day'>): JournalRecordContext {
  return { day: state.day };
}
