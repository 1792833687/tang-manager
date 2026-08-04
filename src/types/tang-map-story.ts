/**
 * 《我在唐朝当掌柜》地图与事件系统深化类型（地图与事件深化 模块一~七）
 * 节点微型故事 / 节点居民对话 / 事件选择影响追踪（连锁反应）/ 事件疲劳度 / 区域特色事件。
 */
import type { GameEvent, GameEventEffect } from '@/types/tang-manager';

/** 节点故事种类：首次探访 / 重复访问 / 特殊时机 */
export type NodeStoryKind = 'first' | 'repeat' | 'special';

/** 节点微型故事 */
export interface NodeStory {
  id: string;
  nodeId: string;
  kind: NodeStoryKind;
  content: string;
}

/** 节点居民类型 */
export type ResidentType = '店伙计' | '老住户' | '路人' | '小孩';

/** 节点居民 */
export interface NodeResident {
  id: string;
  nodeId: string;
  name: string;
  type: ResidentType;
  /** 对话内容（1-2 句，古风） */
  line: string;
  /** 可选效果（如 羊肉进价-10%） */
  effect?: { type: string; value?: number; note?: string };
}

/** 事件历史记录（模块二 2.1） */
export interface EventRecord {
  eventId: string;
  /** 玩家选择的选项 id */
  choiceId: string;
  day: number;
  /** 事件叙事（故事弹窗内容） */
  narrative: string;
}

/** 待触发连锁事件（模块二 2.1） */
export interface PendingConsequence {
  id: string;
  sourceEventId: string;
  /** 将在哪一天触发 */
  triggerDay: number;
  consequenceEventId: string;
  /** 触发时的叙事 */
  narrative: string;
  /** 触发时应用的效果（数值） */
  effect?: GameEventEffect;
}

/** 事件疲劳度状态（模块四 4.2） */
export interface EventFatigue {
  /** 各事件最近触发日（30 天冷却） */
  lastTriggerDay: Record<string, number>;
  /** 各类别 7 天内触发次数 */
  categoryCounts: Record<string, { day: number; count: number }>;
  /** 连续触发天数（3 天后强制休息） */
  consecutiveDays: number;
  /** 一次性事件已完成集合 */
  oneTimeDone: Record<string, boolean>;
}

/** 节点故事揭示记录（store 持久化） */
export type NodeStoriesRevealed = Record<string, NodeStoryKind[]>;

/** 区域标识 */
export type MapRegion = 'yongle' | 'east_market' | 'west_market' | 'changan';

/** 区域特色事件池（模块三） */
export interface RegionEventPool {
  region: MapRegion;
  name: string;
  events: GameEvent[];
}
