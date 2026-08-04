/**
 * 《我在唐朝当掌柜》蛛丝马迹类型（Step 5b-5 模块二）
 * 蛛丝马迹："蛛丝马迹：将各处搜集来的零散情报汇集一处，若有心串联，或可窥见长安城暗流之下的真相。"
 * Clue 字段（用户 2.1 逐字）：id/source/sourceType/content/category/day/connected[]/resolved
 * 线索池见 config/tang-clue-pool.ts；系统纯函数见 systems/tang-clues.ts。
 * @module types/tang-clues
 */

/** 线索来源类型：客商 / NPC / 事件 / 地图 / 传闻 */
export type ClueSourceType = 'guest' | 'npc' | 'event' | 'map' | 'rumor';

/** 线索类别：沈听澜线 / 谢七线 / 债主线 / 政治线 / 商业线 / 隐秘线 */
export type ClueCategory = 'shen' | 'xie' | 'debt' | 'politics' | 'business' | 'secret';

/** 蛛丝马迹线索（用户 2.1 逐字） */
export interface Clue {
  /** 唯一标识（线索池 id 或生成 id） */
  id: string;
  /** 来源（人名 / 事件名 / 地名，古风措辞） */
  source: string;
  /** 来源类型（客商/NPC/事件/地图/传闻） */
  sourceType: ClueSourceType;
  /** 线索内容（三行摘要体） */
  content: string;
  /** 类别（六线：shen/xie/debt/politics/business/secret） */
  category: ClueCategory;
  /** 获取日 */
  day: number;
  /** 已关联线索 id（玩家手动连接或自动关联写入） */
  connected: string[];
  /** 是否已解析（resolveClue；执棋者结局要求全解析） */
  resolved: boolean;
}

/** 线索类别中文标签（蛛丝马迹面板筛选栏复用） */
export const CLUE_CATEGORY_LABEL: Record<ClueCategory, string> = {
  shen: '沈氏暗流',
  xie: '谢七门道',
  debt: '债主往事',
  politics: '庙堂风云',
  business: '商海秘辛',
  secret: '隐秘传闻',
};

/** 线索来源类型中文标签（小卡来源标签） */
export const CLUE_SOURCE_LABEL: Record<ClueSourceType, string> = {
  guest: '客商',
  npc: '故人',
  event: '事件',
  map: '舆图',
  rumor: '传闻',
};
