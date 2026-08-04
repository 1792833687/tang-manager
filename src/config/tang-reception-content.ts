/**
 * 《我在唐朝当掌柜》三店特色接待内容配置（模块一）
 * 酒楼宴席 / 布庄量身 / 药铺问诊 的选项数据与匹配规则常量。
 * 纯数据文件：无状态、无副作用；数值规则见各店 systems/tang-reception-*.ts。
 */

/** 菜品分类 */
export type TavernDishCategory = '冷盘' | '热菜' | '汤品' | '酒水' | '甜点';

/** 酒楼菜品选项 */
export interface TavernDishOption {
  id: string;
  name: string;
  category: TavernDishCategory;
  /** 消耗的库存食材名（与 shopItems.name 对齐） */
  ingredient: string;
  /** 是否招牌菜 */
  signature?: boolean;
  /** 荤素类别（搭配均衡判定用） */
  kind: 'meat' | 'veg' | 'wine' | 'sweet';
}

/** 酒楼菜单（每类 2 样；库存食材限定为 时蔬/酱牛肉/羊肉/米酒） */
export const TAVERN_DISHES: TavernDishOption[] = [
  { id: 'cold_veg', name: '凉拌时蔬', category: '冷盘', ingredient: '时蔬', kind: 'veg' },
  { id: 'cold_beef', name: '五香酱牛肉', category: '冷盘', ingredient: '酱牛肉', kind: 'meat', signature: true },
  { id: 'hot_lamb', name: '红焖羊肉', category: '热菜', ingredient: '羊肉', kind: 'meat', signature: true },
  { id: 'hot_veg', name: '清炒时蔬', category: '热菜', ingredient: '时蔬', kind: 'veg' },
  { id: 'soup_lamb', name: '羊肉羹', category: '汤品', ingredient: '羊肉', kind: 'meat' },
  { id: 'soup_veg', name: '时蔬豆腐汤', category: '汤品', ingredient: '时蔬', kind: 'veg' },
  { id: 'wine_rice', name: '米酒', category: '酒水', ingredient: '米酒', kind: 'wine' },
  { id: 'wine_osmanthus', name: '桂花酒', category: '酒水', ingredient: '米酒', kind: 'wine' },
  { id: 'sweet_preserve', name: '蜜饯果脯', category: '甜点', ingredient: '时蔬', kind: 'sweet' },
  { id: 'sweet_laozao', name: '醪糟甜汤', category: '甜点', ingredient: '米酒', kind: 'sweet' },
];

/** 搭配评分规则（1.1）：荤素均衡 +2 / 有招牌菜 +3 / 有酒水 +1 */
export const TAVERN_COMBO_RULES = {
  meatVegBalance: 2,
  signatureBonus: 3,
  wineBonus: 1,
  /** 总搭配分 ≥ 5 → 满意 */
  satisfiedThreshold: 5,
  /** 总搭配分 < 3 → 不满 */
  unhappyThreshold: 3,
  /** 满意：收益上浮区间（10-30%） */
  satisfiedBoost: [0.1, 0.3] as const,
  /** 不满：收益下降区间（10-20%） */
  unhappyPenalty: [0.1, 0.2] as const,
  /** 赠菜：好感 +15 */
  giftFavor: 15,
  /** 赠菜：口碑传播概率 */
  giftWordOfMouthChance: 0.2,
  /** 请评菜：精力 -5 */
  judgeEnergy: 5,
  /** 请评菜：研发线索概率 */
  judgeClueChance: 0.35,
};

/** 布庄面料选项 */
export interface ClothierFabricOption {
  id: string;
  name: string;
  /** 价格系数（相对基础消费） */
  priceFactor: number;
  /** 风格维度亲和：朴素/结实 / 华贵/体面 / 时新 */
  affinities: Array<'plain' | 'luxury' | 'fashion'>;
  /** 替代面料推荐时利润折扣（%）：换料利润可能下降 */
  swapProfitPenalty: number;
}

/** 布庄面料（4 种） */
export const CLOTHIER_FABRICS: ClothierFabricOption[] = [
  { id: 'coarse', name: '粗布', priceFactor: 0.7, affinities: ['plain'], swapProfitPenalty: 0.1 },
  { id: 'cotton', name: '棉布', priceFactor: 0.85, affinities: ['plain', 'fashion'], swapProfitPenalty: 0.08 },
  { id: 'silk', name: '丝绸', priceFactor: 1.2, affinities: ['luxury', 'fashion'], swapProfitPenalty: 0.12 },
  { id: 'brocade', name: '锦缎', priceFactor: 1.5, affinities: ['luxury'], swapProfitPenalty: 0.15 },
];

/** 布庄款式（3 种） */
export interface ClothierStyleOption {
  id: string;
  name: string;
  affinities: Array<'plain' | 'luxury' | 'fashion'>;
  /** 款式加价系数 */
  priceFactor: number;
}

export const CLOTHIER_STYLES: ClothierStyleOption[] = [
  { id: 'plain', name: '素雅', affinities: ['plain'], priceFactor: 1.0 },
  { id: 'luxury', name: '华贵', affinities: ['luxury'], priceFactor: 1.3 },
  { id: 'fashion', name: '时新', affinities: ['fashion'], priceFactor: 1.15 },
];

/** 布庄匹配/追加规则（1.2） */
export const CLOTHIER_RULES = {
  /** 面料+款式均匹配：成交率 70-90% */
  closeHigh: [0.7, 0.9] as const,
  /** 单维匹配：成交率 45-65% */
  closeMid: [0.45, 0.65] as const,
  /** 均不匹配：成交率 20-35%（犹豫） */
  closeLow: [0.2, 0.35] as const,
  /** 量体：精力 -3，满意度 +10，成交率 +20% */
  measureEnergy: 3,
  measureSatisfaction: 10,
  measureCloseBonus: 0.2,
  /** 展示样衣：成交率 +15% */
  sampleCloseBonus: 0.15,
  /** 推荐替代面料：成交率 +10% 但利润可能下降（按面料 swapProfitPenalty） */
  swapCloseBonus: 0.1,
};

/** 药铺药材选项 */
export interface HerbOption {
  id: string;
  name: string;
  slot: 'main' | 'adjuvant' | 'guide';
  /** 对症（症状 id 列表） */
  effectiveFor: string[];
  /** 库存食材名 */
  ingredient: string;
}

/** 药铺药材（主药 5 / 辅药 5 / 药引 4；库存对齐 人参/当归/黄连/枸杞/甘草） */
export const HERB_OPTIONS: HerbOption[] = [
  { id: 'renshen', name: '人参', slot: 'main', effectiveFor: ['insomnia', 'weakness'], ingredient: '人参' },
  { id: 'danggui', name: '当归', slot: 'main', effectiveFor: ['injury', 'weakness'], ingredient: '当归' },
  { id: 'huanglian', name: '黄连', slot: 'main', effectiveFor: ['cough', 'injury'], ingredient: '黄连' },
  { id: 'gouqi', name: '枸杞', slot: 'main', effectiveFor: ['insomnia', 'weakness'], ingredient: '枸杞' },
  { id: 'gancao', name: '甘草', slot: 'main', effectiveFor: ['cough', 'insomnia'], ingredient: '甘草' },
  { id: 'chuanbei', name: '川贝', slot: 'adjuvant', effectiveFor: ['cough'], ingredient: '甘草' },
  { id: 'suanzaoren', name: '酸枣仁', slot: 'adjuvant', effectiveFor: ['insomnia'], ingredient: '枸杞' },
  { id: 'dahuang', name: '大黄', slot: 'adjuvant', effectiveFor: ['injury'], ingredient: '黄连' },
  { id: 'huangqi', name: '黄芪', slot: 'adjuvant', effectiveFor: ['weakness'], ingredient: '人参' },
  { id: 'chenpi', name: '陈皮', slot: 'adjuvant', effectiveFor: ['cough', 'weakness'], ingredient: '甘草' },
  { id: 'shengjiang', name: '生姜', slot: 'guide', effectiveFor: ['cough'], ingredient: '时蔬' },
  { id: 'dazao', name: '大枣', slot: 'guide', effectiveFor: ['weakness', 'insomnia'], ingredient: '枸杞' },
  { id: 'bingtang', name: '冰糖', slot: 'guide', effectiveFor: ['cough'], ingredient: '米酒' },
  { id: 'jiu', name: '黄酒', slot: 'guide', effectiveFor: ['injury'], ingredient: '米酒' },
];

/** 症状定义（与模块一 1.3 预设模板对应） */
export interface SymptomDef {
  id: string;
  label: string;
  /** 主药命中集 */
  mainHerbs: string[];
  /** 辅药加分集 */
  adjuvantHerbs: string[];
  /** 药引加分集 */
  guideHerbs: string[];
}

/** 症状池（4 种；客人生成时按 description 关键词匹配） */
export const SYMPTOMS: SymptomDef[] = [
  { id: 'insomnia', label: '失眠盗汗', mainHerbs: ['renshen', 'gouqi'], adjuvantHerbs: ['suanzaoren'], guideHerbs: ['dazao'] },
  { id: 'cough', label: '久咳不愈', mainHerbs: ['gancao', 'huanglian'], adjuvantHerbs: ['chuanbei', 'chenpi'], guideHerbs: ['shengjiang', 'bingtang'] },
  { id: 'injury', label: '跌打损伤', mainHerbs: ['danggui', 'huanglian'], adjuvantHerbs: ['dahuang'], guideHerbs: ['jiu'] },
  { id: 'weakness', label: '虚乏体弱', mainHerbs: ['renshen', 'gouqi', 'danggui'], adjuvantHerbs: ['huangqi', 'chenpi'], guideHerbs: ['dazao'] },
];

/** 药铺规则（1.3） */
export const HERBALIST_RULES = {
  /** 主药命中：疗效好（收入 ×1.2~1.4，满意度 +15） */
  mainHit: { incomeMul: [1.2, 1.4] as const, satisfaction: 15 },
  /** 主药未命中：效果差（收入 ×0.7~0.85，满意度 -10） */
  mainMiss: { incomeMul: [0.7, 0.85] as const, satisfaction: -10 },
  /** 辅药命中：+5 满意度；药引命中：+3 满意度 */
  adjuvantHit: 5,
  guideHit: 3,
  /** 把脉：精力 -5，匹配率 +30% */
  pulseEnergy: 5,
  pulseMatchBonus: 0.3,
  /** 送服药建议：满意度 +5 */
  adviceSatisfaction: 5,
  /** 痊愈后送谢礼概率 */
  thankYouChance: 0.3,
  /** 医疗纠纷概率（方不对症时） */
  disputeChance: 0.05,
};

/** 按症状关键词匹配症状（纯函数；description 无命中回退 weakness） */
export function matchSymptom(description: string): SymptomDef {
  const kw: Array<[RegExp, string]> = [
    [/失眠|盗汗|多梦|睡/, 'insomnia'],
    [/咳|嗽|喘/, 'cough'],
    [/伤|肿|疼|痛|撞/, 'injury'],
  ];
  for (const [re, id] of kw) {
    if (re.test(description)) {
      const found = SYMPTOMS.find((s) => s.id === id);
      if (found) return found;
    }
  }
  return SYMPTOMS.find((s) => s.id === 'weakness')!;
}
