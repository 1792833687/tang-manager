/**
 * 《我在唐朝当掌柜》产业巅峰挑战配置（v1.2 · 规格书模块四）
 * Lv5 之后的终极目标：酒楼皇家宴席 / 布庄御用朝服 / 药铺起死回生。
 * 纯数据，不依赖 store。
 */
export type PeakChallengeType = 'imperial_banquet' | 'imperial_robe' | 'resurrection';

export interface PeakChallengeDef {
  type: PeakChallengeType;
  industry: 'tavern' | 'clothier' | 'herbalist';
  name: string;
  /** 触发条件描述 */
  trigger: { level: number; reputation: number; extra: string };
  /** 挑战内容（纯文案） */
  content: string;
  /** 基准成功率（0-1） */
  baseSuccessRate: number;
  /** 成功率上限（0-1） */
  maxSuccessRate: number;
  /** 成功奖励 */
  reward: { title: string; desc: string; permanentBuff: string };
  /** 失败惩罚 */
  penalty: { desc: string; reputationDelta: number; silverDelta: number };
}

export const PEAK_CHALLENGES: Record<PeakChallengeType, PeakChallengeDef> = {
  imperial_banquet: {
    type: 'imperial_banquet',
    industry: 'tavern',
    name: '皇家宴席',
    trigger: { level: 5, reputation: 900, extra: '评分 ≥ 4.8' },
    content: '七日内筹备 50 人皇家宴席：需 8 道菜 + 3 种酒，食材品质 ≥ 4。',
    baseSuccessRate: 0.3,
    maxSuccessRate: 0.8,
    reward: { title: '天下第一楼', desc: '宴席收益永久 +30%', permanentBuff: 'banquet_income_1.3' },
    penalty: { desc: '声望 -50 · 官府关系 -20 · 6 个月内不可再挑战', reputationDelta: -50, silverDelta: 0 },
  },
  imperial_robe: {
    type: 'imperial_robe',
    industry: 'clothier',
    name: '御用朝服',
    trigger: { level: 5, reputation: 900, extra: '累计官服定制 ≥ 10 次' },
    content: '十四日内完成御用朝服：需锦缎×5 + 金线×3 + 刺绣×2，品质必须 5。',
    baseSuccessRate: 0.25,
    maxSuccessRate: 0.75,
    reward: { title: '御用织造', desc: '所有定制订单溢价 +40% · 官府盘查概率 -80%', permanentBuff: 'custom_premium_1.4' },
    penalty: { desc: '声望 -80 · 赔偿 500 两 · 1 年内不可再挑战', reputationDelta: -80, silverDelta: -500 },
  },
  resurrection: {
    type: 'resurrection',
    industry: 'herbalist',
    name: '起死回生',
    trigger: { level: 5, reputation: 900, extra: '医疗知识 Lv3 · 累计坐诊 ≥ 50 次' },
    content: '接到濒死病人，三日内研发对症秘方。',
    baseSuccessRate: 0.3,
    maxSuccessRate: 0.7,
    reward: { title: '再世华佗', desc: '所有药方售价 +50% · 坐诊成功率永久 100%', permanentBuff: 'prescription_price_1.5' },
    penalty: { desc: '病人死亡 · 声望 -100 · 评分 -0.5 · 赔偿 300 两', reputationDelta: -100, silverDelta: -300 },
  },
};

/** 成功率加成规则（规格书 4.2） */
export const PEAK_BONUS_RULES: Record<PeakChallengeType, { label: string; base: number; perUnit: number }> = {
  imperial_banquet: { label: '厨师技能/食材品质/宴席经验', base: 0.05, perUnit: 0.05 },
  imperial_robe: { label: '裁缝技能/面料品质/定制经验', base: 0.05, perUnit: 0.05 },
  resurrection: { label: '每本医书 +10% / 坐诊经验 +2%', base: 0.1, perUnit: 0.02 },
};
