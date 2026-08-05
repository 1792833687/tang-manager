/**
 * 《我在唐朝当掌柜》情报分级配置（v1.2 · 规格书模块一 1.2）
 * 三级情报：坊间闲谈（免费）/ 商会情报（声望≥300 或付费）/ 地下消息（谢七好感≥50 或付费）。
 * 纯数据，不依赖 store。
 */
export interface IntelligenceTierDef {
  tier: 1 | 2 | 3;
  name: string;
  /** 初始准确度区间 */
  accuracyRange: readonly [number, number];
  /** 有效天数区间 */
  validityRange: readonly [number, number];
  /** 打探费用（两） */
  investigationCost: number;
  /** 打探精力消耗 */
  investigationEnergyCost: number;
  icon: string;
}

export const INTELLIGENCE_TIERS: Record<1 | 2 | 3, IntelligenceTierDef> = {
  1: { tier: 1, name: '坊间闲谈', accuracyRange: [0.4, 0.6], validityRange: [1, 3], investigationCost: 1, investigationEnergyCost: 5, icon: '🍵' },
  2: { tier: 2, name: '商会情报', accuracyRange: [0.6, 0.8], validityRange: [2, 5], investigationCost: 5, investigationEnergyCost: 10, icon: '🏮' },
  3: { tier: 3, name: '地下消息', accuracyRange: [0.7, 0.95], validityRange: [3, 7], investigationCost: 20, investigationEnergyCost: 15, icon: '🌑' },
};

/** 来源初始可信度（规格书 1.4） */
export const SOURCE_INITIAL_RELIABILITY: Record<string, number> = {
  苏大娘: 0.6,
  程掌柜: 0.7,
  谢七: 0.8,
  市井偶闻: 0.4,
};

/** 验证准确 → +0.1（上限 0.95）；不准确 → -0.15（下限 0.2） */
export const RELIABILITY_UP = 0.1;
export const RELIABILITY_DOWN = 0.15;
export const RELIABILITY_MAX = 0.95;
export const RELIABILITY_MIN = 0.2;
