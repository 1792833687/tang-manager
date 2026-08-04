/**
 * 《我在唐朝当掌柜》名声关系网类型（TANG-SOC-001 模块五）
 * 长安五大势力 + NPC 好感 + 特权。与 types/tang-manager.ts 的 Faction[]/NPCFavor[] 字段对应。
 * @module types/tang-factions
 */

/** 势力类型：行会 / 官府 / 地下 / 风月 / 朝廷（Step 5b-5 巍明楼六派系之第六） */
export type FactionType = 'guild' | 'government' | 'underground' | 'commercial' | 'court';

/** 势力特权（threshold 0-100：20/40/60/80/100 五档） */
export interface FactionPerk {
  /** 解锁阈值（20/40/60/80/100） */
  threshold: number;
  /** 特权名（古风） */
  name: string;
  /** 特权描述（逐字） */
  description: string;
  /** 效果：type=折扣/供货/声望/庇护/照拂/独家 + value */
  effect: { type: string; value: number };
}

/** 长安势力（五方；relationship 0-100） */
export interface Faction {
  id: string;
  name: string;
  type: FactionType;
  /** 关系值 0-100（updateFactionRelationship clamp） */
  relationship: number;
  description: string;
  /** 首领（会长/掌柜/府尹…） */
  leader: string;
  /** 势力代表色（竹青/蓝/红/暗紫/桃粉） */
  color: string;
  perks: FactionPerk[];
}

/** NPC 好感（沈听澜/谢七/赵员外/京兆府尹；favor 0-100） */
export interface NPCFavor {
  npcId: string;
  npcName: string;
  /** 好感 0-100 */
  favor: number;
  /** 所属势力 id（与 Faction.id 关联） */
  factionId?: string;
  /** 关系评语（按好感档位：陌路/点头/熟络/心腹/死党） */
  relationship: string;
  /** 已解锁特权名（favor≥阈值时展示） */
  unlockedPerks: string[];
}

/** 势力关系更新结果（updateFactionRelationship） */
export interface FactionUpdateResult {
  factionId: string;
  factionName: string;
  relationship: number;
  /** 本次变动量（实际 clamp 后） */
  delta: number;
  /** 变动原因（记录流水） */
  reason: string;
  /** 本次新解锁的特权（跨阈值时非空） */
  newlyUnlocked: FactionPerk[];
  /** 关系评语（古风档位） */
  verdict: string;
}

/** NPC 好感联动结果（applyFactionToNpc） */
export interface NpcFavorUpdate {
  npcId: string;
  npcName: string;
  favor: number;
}
