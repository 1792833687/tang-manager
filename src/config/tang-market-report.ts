/**
 * 《我在唐朝当掌柜》市场调查报告配置（2026-08-06 新增系统）
 * 基于 priceIndex/inflationModifier + 各品类参考价，给出当前行情判断与采买建议。
 * 纯数据，不依赖 store；渲染在 market-report-panel。
 */
/** 品类中文名 */
export const MARKET_CATEGORY_LABEL: Record<string, string> = { 食材: '食材', 布匹: '布匹', 药材: '药材' };

/** 各品类参考价区间（两；按货品成色取中位，实际以货架价为准） */
export const MARKET_CATEGORY_REFERENCE: Record<string, { min: number; max: number; note: string }> = {
  食材: { min: 2, max: 8, note: '时蔬肉蛋米面，行情随年景浮动最勤。' },
  布匹: { min: 5, max: 20, note: '绸缎锦帛，看新丝上市与官采多寡。' },
  药材: { min: 1, max: 12, note: '参茸贵细，时令与虫情皆能左右。' },
};

/** 物价指数 → 行情判断（古风一句） */
export function marketOutlook(priceIndex: number): { label: string; color: string; advice: string } {
  const p = priceIndex ?? 1;
  if (p < 0.95) {
    return { label: '市面萧条，物价低迷', color: '#4A7C59', advice: '此时进货最划算，宜多多采买囤货；待价高时再出货。' };
  }
  if (p > 1.2) {
    return { label: '物价高涨，百物腾贵', color: '#C0392B', advice: '货紧价高，手头存货宜尽快沽清；切莫此时重金补货。' };
  }
  if (p > 1.05) {
    return { label: '行情走高，货随价涨', color: '#D97706', advice: '可酌量出货回笼银钱，进货需挑紧俏货色。' };
  }
  return { label: '物价平稳，买卖两宜', color: '#8B6F47', advice: '按部就班经营即可，逢挂牌捡漏可多留意。' };
}

/** 行情建议（基于当前货架价与参考价比较） */
export function categoryAdvice(itemCount: number, avgPrice: number, refMin: number, refMax: number): string {
  if (itemCount === 0) return '货架空空，宜补货陈列。';
  const mid = (refMin + refMax) / 2;
  if (avgPrice > refMax) return '定价偏高，出货慢，可适当下调走量。';
  if (avgPrice < refMin) return '定价偏低，利薄，可小幅上调。';
  return '定价适中，随行就市即可。';
}
