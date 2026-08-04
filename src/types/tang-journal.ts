/**
 * 《我在唐朝当掌柜》手札录类型（Step 5b-5 模块一）
 * 手札录："手札录：家传手札的空白页，自动记录经营历程、人物往来、重大抉择。可随时翻阅回味。"
 * JournalEntry 字段（用户 1.1 逐字）：id/day/type/title/content/tags/relatedNPC?/relatedEvent?
 * 与 types/tang-manager.ts 的 journal 字段对应；系统纯函数见 systems/tang-journal.ts。
 * @module types/tang-journal
 */

/** 手札条目类型：事件 / 人物往来 / 里程碑 / 抉择 / 成就 */
export type JournalEntryType = 'event' | 'npc' | 'milestone' | 'choice' | 'achievement';

/** 手札条目（用户 1.1 逐字） */
export interface JournalEntry {
  /** 唯一标识 */
  id: string;
  /** 记录日（经营天数） */
  day: number;
  /** 条目类型（event 事件 / npc 人物往来 / milestone 里程碑 / choice 抉择 / achievement 成就） */
  type: JournalEntryType;
  /** 标题（古风短句） */
  title: string;
  /** 正文（古风叙事） */
  content: string;
  /** 标签（分类检索用；如 沈听澜/谢七/税/店务） */
  tags: string[];
  /** 关联 NPC 名（可选） */
  relatedNPC?: string;
  /** 关联事件 id（可选） */
  relatedEvent?: string;
}

/** 手札条目类型中文标签（面板筛选栏复用） */
export const JOURNAL_TYPE_LABEL: Record<JournalEntryType, string> = {
  event: '事件',
  npc: '人物',
  milestone: '里程碑',
  choice: '抉择',
  achievement: '成就',
};
