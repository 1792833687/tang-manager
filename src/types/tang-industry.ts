/**
 * 《我在唐朝当掌柜》店铺特色产业系统类型（产业系统 模块一~五）
 * 三种产业完全独立：酒楼（新菜研发+宴席）/ 布庄（织造合作+定制订单）/ 药铺（坐堂医+药方研发）。
 * 每种产业 5 级升级路径，条件：评分 + 累计次数/数量。
 */
import type { ShopType } from '@/types/tang-manager';

// ==================== 酒楼 ====================

/** 研发方向 */
export type DishCategory = '荤菜' | '素菜' | '汤品' | '点心' | '酒品';

/** 新研发菜品 */
export interface TavernDish {
  id: string;
  name: string;
  category: DishCategory;
  /** 品质 1-5 */
  quality: number;
  /** 制作成本（两） */
  cost: number;
  /** 售价（两） */
  price: number;
  /** 受欢迎度 0-100（随销售动态变化） */
  popularity: number;
  /** 是否招牌菜 */
  isSignature: boolean;
  /** 所需食材 */
  ingredients: string[];
  /** 特殊效果文案 */
  bonus: string;
}

/** 进行中的菜品研发 */
export interface TavernResearchJob {
  id: string;
  dishId: string;
  dishName: string;
  category: DishCategory;
  /** 指派厨师 id（可空 = 掌柜亲研） */
  chefId?: string;
  /** 研发周期（天） */
  totalDays: number;
  /** 剩余天数 */
  remainingDays: number;
  /** 成功率（0-1；厨师技能/食材品质修正） */
  successRate: number;
  /** 投入成本（两） */
  cost: number;
}

/** 宴席类型 */
export type BanquetType = 'shou_yan' | 'hun_yan' | 'xi_chen' | 'jian_xing' | 'shang_hui';

/** 宴席订单 */
export interface Banquet {
  id: string;
  type: BanquetType;
  /** 人数规模 */
  guestCount: number;
  /** 预算（两） */
  budget: number;
  /** 举办日期 */
  holdDay: number;
  /** 筹备进度 0-100（玩家筹备时累加） */
  prepProgress: number;
  /** 雅间布置：普通/精致/豪华 */
  decor: 'normal' | 'refined' | 'luxury';
  /** 已选菜品 id（6-8 道） */
  dishIds: string[];
  /** 酒水安排（按人数备酒） */
  wineAmount: number;
  status: 'preparing' | 'held' | 'cancelled';
  /** 结算结果（举办后写入） */
  result?: BanquetResult;
}

export interface BanquetResult {
  income: number;
  cost: number;
  netProfit: number;
  reputationGain: number;
  /** 宾客引荐触发 */
  referral?: boolean;
}

// ==================== 布庄 ====================

/** 织工 */
export interface Weaver {
  id: string;
  name: string;
  /** 技艺 1-5 */
  skill: number;
  /** 抽成比例 0-1 */
  commission: number;
  /** 自带声望 0-100 */
  reputation: number;
  /** 满意度 0-100 */
  satisfaction: number;
  /** 当前寄卖商品 */
  currentGoods: WeaverGoods[];
  status: 'active' | 'resting' | 'left';
}

/** 寄卖商品 */
export interface WeaverGoods {
  id: string;
  name: string;
  category: '成衣' | '布匹' | '刺绣品';
  quality: number;
  /** 定价（两） */
  price: number;
  /** 售出标记 */
  sold: boolean;
  /** 售出日 */
  soldDay?: number;
}

/** 定制订单类型 */
export type CustomOrderType = 'bridal' | 'official' | 'longevity' | 'daily' | 'bulk';

/** 定制订单 */
export interface CustomOrder {
  id: string;
  type: CustomOrderType;
  guestName: string;
  /** 面料 */
  fabric: string;
  /** 款式 */
  style: string;
  /** 纹样 */
  pattern?: string;
  /** 指派裁缝 id */
  tailorId?: string;
  /** 工期（天） */
  totalDays: number;
  /** 剩余天数 */
  remainingDays: number;
  /** 要求（匹配判定用） */
  requirement: string;
  /** 报酬（两） */
  reward: number;
  status: 'making' | 'delivered' | 'rejected';
  result?: CustomOrderResult;
}

export interface CustomOrderResult {
  grade: 'perfect' | 'basic' | 'flawed' | 'reject';
  income: number;
  satisfactionDelta: number;
  note: string;
}

// ==================== 药铺 ====================

/** 坐堂郎中 */
export interface Physician {
  id: string;
  name: string;
  /** 擅长领域 */
  specialty: string;
  /** 医术 1-5 */
  skill: number;
  /** 月薪（两） */
  salary: number;
  /** 个人声望 0-100 */
  reputation: number;
  /** 每日带来病人数 */
  patientsPerDay: number;
  /** 满意度 0-100 */
  satisfaction: number;
  status: 'active' | 'on_leave' | 'left';
  personality: string;
}

/** 药方类型 */
export type HerbRecipeCategory = '汤剂' | '丸剂' | '散剂' | '膏剂';

/** 已研发药方 */
export interface HerbRecipe {
  id: string;
  name: string;
  category: HerbRecipeCategory;
  /** 主治症状 */
  targetSymptom: string;
  /** 品质 1-5 */
  quality: number;
  /** 所需药材 */
  ingredients: string[];
  /** 售价（两） */
  price: number;
  /** 疗效 0-100 */
  effectiveness: number;
  /** 是否独家秘方 */
  isPatent: boolean;
}

/** 进行中的药方研发 */
export interface HerbResearchJob {
  id: string;
  recipeId: string;
  recipeName: string;
  category: HerbRecipeCategory;
  targetSymptom: string;
  /** 指派药师/郎中 id */
  researcherId?: string;
  totalDays: number;
  remainingDays: number;
  /** 成功/改良/失败判定 */
  mode: 'new' | 'improve';
  cost: number;
}

// ==================== 产业等级 ====================

/** 产业等级定义（每产业 5 级） */
export interface IndustryLevelDef {
  level: number;
  name: string;
  /** 描述（能力解锁） */
  desc: string;
  /** 升级条件 */
  require: { score: number; count: number; countLabel: string };
}

/** 产业等级状态（升级进度展示用） */
export interface IndustryState {
  level: number;
  /** 累计次数（宴席/订单/病人/研发数等，按产业） */
  count: number;
}

/** 产业标识 */
export type IndustryKind = 'tavern' | 'clothier' | 'herbalist';

/** 产业进度（升级条件判定输入） */
export interface IndustryProgressInput {
  kind: IndustryKind;
  level: number;
  score: number;
  count: number;
}

/** 产业升级结果 */
export interface IndustryUpgradeResult {
  ok: boolean;
  nextLevel?: number;
  nextName?: string;
  reason?: string;
  /** 手札贺词（祖辈口吻） */
  blessing?: string;
}

/** 产业汇总（me 面板经营之道展示） */
export interface IndustryOverview {
  shopType: ShopType;
  industries: Array<{
    kind: IndustryKind;
    name: string;
    level: number;
    levelName: string;
    count: number;
    next: { score: number; count: number; countLabel: string } | null;
    canUpgrade: boolean;
    bless: string;
  }>;
}
