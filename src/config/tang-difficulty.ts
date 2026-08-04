/**
 * 《我在唐朝当掌柜》难度参数 — 唯一事实源
 *
 * 字段含义（与 types/tang-manager.ts 的 TangDifficultyParams 一致）：
 * - label                难度中文名
 * - tagline              难度副标语
 * - initialGold          初始资金（两）
 * - initialDebt          初始负债（两）
 * - monthlyInterest      每月月息（两）
 * - initialScore         初始店铺评分（1.0-5.0）
 * - initialReputation    初始声望（0-1000）
 * - initialXiaoerFavor   初始小二好感（0-100）
 * - initialXiaoerSatisfaction 初始小二满意度（0-100）
 * - insightChances       特殊能力「通晓人心」可用次数
 * - insightBacklash      「通晓人心」反噬次数（0 = 无反噬）
 * - luckChances          特殊能力「福星高照」可用次数
 * - luckNegative         「福星高照」负面效果描述
 * - ledgerErrorRate      手札记账错误率（0-1 小数）
 *
 * 数据精确对应需求规格：
 * A·小本经营：80两/负债100/月息2/评分1.5/声望20/好感40/满意度70；通晓人心5次、无反噬、福星高照2次无负面、手札0%错误
 * B·正经营生：50两/负债200/月息5/评分1.0/声望10/好感30/满意度60；通晓人心3次、3次触发反噬、福星高照1次轻微负面、手札20%错误
 * C·大买卖：30两/负债300/月息8/评分0.8/声望0/好感20/满意度50；通晓人心3次、2次触发反噬、福星高照1次严格等价、手札40%错误
 */
import type { Difficulty, TangDifficultyParams } from '@/types/tang-manager';

export const DIFFICULTY_PARAMS: Record<Difficulty, TangDifficultyParams> = {
  A: {
    label: '小本经营',
    tagline: '稳扎稳打，薄利多销',
    initialGold: 80,
    initialDebt: 100,
    monthlyInterest: 2,
    initialScore: 1.5,
    initialReputation: 20,
    initialXiaoerFavor: 40,
    initialXiaoerSatisfaction: 70,
    insightChances: 5,
    insightBacklash: 0,
    luckChances: 2,
    luckNegative: '无负面',
    ledgerErrorRate: 0,
    dailyActionCount: 2,
    guestCount: 5,
    penaltyChance: 0.03,
    specialExpenseChance: 0.5,
  },
  B: {
    label: '正经营生',
    tagline: '如履薄冰，步步为营',
    initialGold: 50,
    initialDebt: 200,
    monthlyInterest: 5,
    initialScore: 1.0,
    initialReputation: 10,
    initialXiaoerFavor: 30,
    initialXiaoerSatisfaction: 60,
    insightChances: 3,
    insightBacklash: 3,
    luckChances: 1,
    luckNegative: '轻微负面',
    ledgerErrorRate: 0.2,
    dailyActionCount: 1,
    guestCount: 5,
    penaltyChance: 0.15,
    specialExpenseChance: 1,
  },
  C: {
    label: '大买卖',
    tagline: '富贵险中求，一步踏错满盘输',
    initialGold: 30,
    initialDebt: 300,
    monthlyInterest: 8,
    initialScore: 0.8,
    initialReputation: 0,
    initialXiaoerFavor: 20,
    initialXiaoerSatisfaction: 50,
    insightChances: 3,
    insightBacklash: 2,
    luckChances: 1,
    luckNegative: '严格等价',
    ledgerErrorRate: 0.4,
    dailyActionCount: 1,
    guestCount: 6,
    penaltyChance: 0.3,
    specialExpenseChance: 2,
  },
};

/** 兜底难度（理论上不可达，仅防御 noUncheckedIndexedAccess 下的 undefined） */
const FALLBACK_DIFFICULTY: Difficulty = 'B';

/** 安全取难度参数；d 恒为合法键，undefined 分支仅作类型收窄 */
export function getDifficultyParams(d: Difficulty): TangDifficultyParams {
  const p = DIFFICULTY_PARAMS[d];
  if (p) {
    return p;
  }
  return DIFFICULTY_PARAMS[FALLBACK_DIFFICULTY]!;
}

/**
 * 难度卡片特性文案（按需求规格逐条，A 6 条 / B 4 条 / C 5 条）。
 * 从 DIFFICULTY_PARAMS 推导，避免 UI 侧重复硬编码。
 */
export function difficultyTraitLines(p: TangDifficultyParams): string[] {
  if (p.label === '小本经营') {
    return ['资金宽裕', '债务压力小', '客人温和', '特殊能力无负面', 'NPC好感加倍', '手札完全可靠'];
  }
  if (p.label === '大买卖') {
    return ['资金紧张', '负债沉重', '全部反噬严格版', '手札40%不可靠', 'NPC主动设局'];
  }
  // B·正经营生兜底
  return ['标准配置', '启用反噬机制', '手札20%不可靠', 'NPC有独立利益'];
}
