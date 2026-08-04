/**
 * 《我在唐朝当掌柜》宴席菜单组合评分（2026-08-06 · 规格书模块三 3.3）
 * 纯函数：荤素均衡 / 招牌菜 / 酒水匹配 / 预算控制 / 宴席类型必备菜。
 * 总分 ≥8 大获成功 / 5-7 顺利 / <5 有瑕疵（收益 -20%）。
 */
export interface MenuDish {
  id: string;
  name: string;
  /** meat 荤 / veg 素 / soup 汤 / wine 酒 / dessert 甜 */
  kind: 'meat' | 'veg' | 'soup' | 'wine' | 'dessert';
  cost: number;
  signature?: boolean;
}

/** 宴席必备菜（寿宴需长寿面/整鸡，婚宴需双份等） */
export const BANQUET_REQUIRED_DISHES: Record<string, string[]> = {
  shou_yan: ['长寿面', '整鸡'],
  hun_yan: ['双份菜品'],
  xi_chen: ['洗尘酒'],
  jian_xing: ['干粮'],
  shang_hui: ['雅间珍馐'],
};

export interface BanquetScoringInput {
  dishes: readonly MenuDish[];
  banquetType: string;
  budget: number;
}

/** 组合评分（纯函数；规格书 3.3 五项） */
export function scoreBanquetMenu({ dishes, banquetType, budget }: BanquetScoringInput): number {
  let score = 0;
  const meatCount = dishes.filter((d) => d.kind === 'meat').length;
  const vegCount = dishes.filter((d) => d.kind === 'veg').length;
  const totalCost = dishes.reduce((s, d) => s + d.cost, 0);
  // 荤素均衡：荤:素 在 4:3 至 5:3
  if (vegCount > 0 && meatCount / vegCount >= 4 / 3 - 0.001 && meatCount / vegCount <= 5 / 3 + 0.001) score += 2;
  // 招牌菜：每道 +3（上限 6）
  score += Math.min(6, dishes.filter((d) => d.signature).length * 3);
  // 酒水匹配：有酒水 +2
  if (dishes.some((d) => d.kind === 'wine')) score += 2;
  // 预算控制：成本在预算 50-70%
  if (budget > 0 && totalCost / budget >= 0.5 && totalCost / budget <= 0.7) score += 2;
  // 宴席类型必备菜
  const required = BANQUET_REQUIRED_DISHES[banquetType] ?? [];
  if (required.length > 0 && required.some((r) => dishes.some((d) => d.name.includes(r) || (r === '双份菜品' && dishes.filter((x) => x.kind === 'meat').length >= 2)))) score += 3;
  return score;
}

/** 总分档位（规格书 3.3） */
export function banquetTier(score: number): 'great' | 'ok' | 'flawed' {
  if (score >= 8) return 'great';
  if (score >= 5) return 'ok';
  return 'flawed';
}
