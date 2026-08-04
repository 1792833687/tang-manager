/**
 * 《我在唐朝当掌柜》接待系统重设计 — 对话 / 店型流程 / 店员提醒 / 故事弹窗 类型
 * 模块一~四：三店特色接待、对话状态机、店员提醒、事件故事弹窗。
 * 与既有 types/tang-manager.ts 解耦（独立文件，避免扰动巨型类型面）。
 */
import type { GuestType, ShopType } from '@/types/tang-manager';

/** 客人心情（2.1：愉悦 30% / 平淡 50% / 烦躁 15% / 挑剔 5%） */
export type GuestMood = 'joyful' | 'calm' | 'irritated' | 'picky';

/** 对话阶段状态机（2.1） */
export type DialoguePhase =
  | 'greeting' // 客人开场白
  | 'player_response' // 玩家选择回应方式
  | 'guest_reply' // 客人回应
  | 'recommend' // 玩家推荐商品/方案
  | 'guest_feedback' // 客人反馈（成交/犹豫/拒绝）
  | 'follow_up' // 犹豫→追加操作
  | 'resolution'; // 成交/失败→故事弹窗

/** 对话消息（6：dialogueHistory 元素；AI 上下文用） */
export interface DialogueMessage {
  role: 'guest' | 'player' | 'system' | 'staff';
  content: string;
  /** 内容来源：ai（天机阁） / template（预设模板兜底） */
  source?: 'ai' | 'template';
  phase?: DialoguePhase;
}

/** 玩家回应方式（2.1 player_response 阶段三选） */
export type ResponseStyle = 'warm' | 'professional' | 'honest_price';

/** 回应方式效果表（2.1：热情寒暄 / 专业分析 / 实在报价） */
export interface ResponseEffect {
  style: ResponseStyle;
  label: string;
  /** UI 提示文案 */
  hint: string;
  /** 好感变动 */
  favorDelta: number;
  /** 信任变动 */
  trustDelta: number;
  /** 成交率加成（百分点） */
  closeBonus: number;
  /** 利润上限扣减（百分点；实在报价 -20） */
  profitCapPenalty: number;
  /** 适合客人类型 */
  suitedFor: GuestType[];
}

/** 心情配置（2.1 心情系统） */
export interface MoodConfig {
  id: GuestMood;
  label: string;
  icon: string;
  /** 生成权重（千分比，合计 1000） */
  weight: number;
  /** 成交率加成（百分点） */
  closeBonus: number;
  /** 耐心衰减乘数（烦躁更高） */
  patienceDecayMul: number;
  /** 成交后满意度倍率（挑剔 ×2） */
  satisfactionMul: number;
  /** AI 对话风格提示 */
  styleHint: string;
}

/** 对话状态（引擎纯函数输入/输出；UI 会话状态） */
export interface DialogueState {
  guestId: string;
  guestName: string;
  shopType: ShopType;
  phase: DialoguePhase;
  mood: GuestMood;
  /** 好感 0-100 */
  favor: number;
  /** 信任 0-100 */
  trust: number;
  /** 轮次（每经过一个对话阶段 +1） */
  turn: number;
  history: DialogueMessage[];
  /** 客人偏好是否已揭示（recommend 阶段提醒触发） */
  preferenceRevealed: boolean;
  /** 推荐阶段所选计划（三店流程自用） */
  plan?: ShopReceptionPlan;
  /** 客人当前是否犹豫（follow_up 阶段） */
  hesitating?: boolean;
  /** 价格敏感标记（实在报价后；利润上限扣减生效） */
  priceSensitive?: boolean;
}

/** 三店推荐计划（recommend 阶段产出；三种店铺完全独立的结构） */
export type ShopReceptionPlan =
  | { shop: 'jiulou'; dishIds: string[]; giftDishId?: string; judgeRequested?: boolean }
  | { shop: 'buzhuang'; fabricId: string; styleId: string; extraOp?: 'measure' | 'sample' | 'swap_fabric' }
  | { shop: 'yaopu'; mainHerbId: string; adjuvantIds: string[]; guideId?: string; pulseUsed?: boolean };

/** 三店流程统一结果（供 store 落账 + 弹窗展示；数值已由纯函数算定） */
export interface ShopReceptionResult {
  ok: boolean;
  shop: ShopType;
  /** 客人 id（可选；缺省按当前接待客人） */
  guestId?: string;
  /** 本单收益（两） */
  income: number;
  /** 收益倍率（组合分/匹配度换算；展示用） */
  incomeMultiplier: number;
  /** 满意度变动 */
  satisfactionDelta: number;
  /** 好感变动 */
  favorDelta: number;
  /** 精力消耗 */
  energyConsumed: number;
  review: 'good' | 'bad';
  /** 夸奖触发（气氛+10 / 声望+1 20% 由 store 应用） */
  praised?: boolean;
  /** 投诉触发 */
  complaintTriggered?: boolean;
  /** 结果叙事正文（AI 或模板兜底） */
  narrative: string;
  /** 客人关键台词（弹窗引号包裹；可选） */
  guestLine?: string;
  /** 数值变动摘要（弹窗底部小字；AI 兜底/展示用） */
  summary: string[];
  /** 店型特色追加状态 */
  flags?: {
    /** 赠菜口碑传播 */
    wordOfMouth?: boolean;
    /** 评菜获得研发线索 */
    recipeClue?: string;
    /** 赠菜消耗库存 */
    giftDishConsumed?: boolean;
    /** 药铺痊愈后送谢礼事件 */
    thankYouGift?: boolean;
    /** 药铺医疗纠纷 */
    medicalDispute?: boolean;
    /** 布庄成交（true）/ 未成交（false/缺省） */
    closed?: boolean;
  };
  /** 接待摘要（handledNote） */
  handledNote?: string;
}

/** 店员提醒（3.1：最多 1 条/阶段） */
export interface StaffReminder {
  id: string;
  /** 提醒人 */
  staff: '阿昭' | '账房' | '护卫';
  /** 触发阶段 */
  phase: DialoguePhase | 'greeting';
  /** 气泡文案 */
  message: string;
  /** 采纳效果说明（展示 + UI 追加） */
  effect: string;
}

/** 故事弹窗叙事（4.1：标题/正文/NPC台词/数值变动） */
export interface StoryNarrative {
  title: string;
  /** 旁白正文（3-5 句场景描写） */
  body: string;
  /** NPC 台词（可选，引号包裹展示） */
  npcLine?: string;
  /** 数值变动小字 */
  numbers: string[];
  source?: 'ai' | 'template';
}

/** 对话引擎上下文（系统纯函数输入；只取用到的字段） */
export interface DialogueContext {
  shopType: ShopType;
  guestType: GuestType;
  /** 客人故事标签 */
  storyTag?: string;
  /** 客人需求描述 */
  description: string;
  /** 偏好是否已揭示 */
  preferenceRevealed: boolean;
  /** 客人基础消费 */
  baseConsumption: number;
  /** 库存是否充足（recommend 阶段提醒） */
  hasStock?: boolean;
  /** 最近一次推荐商品名（重复推荐提醒用） */
  lastRecommended?: string;
  /** 是否差评师 */
  isBadReviewer?: boolean;
  /** 是否有账房（价格提醒用） */
  hasAccountant?: boolean;
  /** 是否有护卫（差评师提醒用） */
  hasGuard?: boolean;
  /** 排队耐心（低落触发挽留提醒） */
  patience?: number;
}
