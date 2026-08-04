/**
 * 《我在唐朝当掌柜》酒楼宴席接待（模块一 1.1）
 * 独立于布庄/药铺的接待流程（不得共用同一处理函数）：
 *   客人需求 → 玩家搭配菜品（冷/热/汤/酒/甜 各 1-2 样）→ 赠菜/请评菜 → 结果叙事弹窗
 * 纯函数：所有数值由本文件算定，rng 可注入（默认 Math.random）。
 * 搭配评分：荤素均衡 +2 / 有招牌菜 +3 / 有酒水 +1；总分 ≥5 满意（收益 +10~30%），<3 不满（收益 -10~20%）。
 */
import {
  TAVERN_DISHES,
  TAVERN_COMBO_RULES,
  type TavernDishOption,
} from '@/config/tang-reception-content';
import { SUCCESS_NARRATIVES, FAIL_NARRATIVES, pickTemplate } from '@/config/tang-dialogue-templates';
import type { Guest, ShopItem, ShopType } from '@/types/tang-manager';
import type { ShopReceptionResult } from '@/types/tang-dialogue';

/** 酒楼接待计划（UI recommend 阶段产出） */
export interface TavernPlan {
  shop: 'jiulou';
  /** 已选菜品 id（每类 1-2 样） */
  dishIds: string[];
  /** 赠菜（送一道招牌菜，不收费） */
  giftDishId?: string;
  /** 请评菜（老饕品评新菜） */
  judgeRequested?: boolean;
}

/** 酒楼接待上下文（只取用到的字段） */
export interface TavernReceptionContext {
  baseConsumption: number;
  guestType: Guest['type'];
  /** 库存（可选）：食材不足的菜不可选/不计分 */
  shopItems?: readonly ShopItem[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 库存可用菜品（食材有货）；无库存信息时全部可用 */
export function availableTavernDishes(shopItems: readonly ShopItem[] | undefined): TavernDishOption[] {
  if (!shopItems || shopItems.length === 0) return [...TAVERN_DISHES];
  const stock = new Map(shopItems.map((it) => [it.name, (it.stock ?? 0) - (it.reserved ?? 0)]));
  return TAVERN_DISHES.filter((d) => (stock.get(d.ingredient) ?? 0) > 0);
}

/** 搭配评分（纯函数）：荤素均衡 +2 / 有招牌菜 +3 / 有酒水 +1 */
export function scoreTavernCombo(
  dishIds: readonly string[],
  dishes: readonly TavernDishOption[] = TAVERN_DISHES
): number {
  const selected = dishes.filter((d) => dishIds.includes(d.id));
  let score = 0;
  const kinds = new Set(selected.map((d) => d.kind));
  if (kinds.has('meat') && kinds.has('veg')) score += TAVERN_COMBO_RULES.meatVegBalance;
  if (selected.some((d) => d.signature)) score += TAVERN_COMBO_RULES.signatureBonus;
  if (kinds.has('wine')) score += TAVERN_COMBO_RULES.wineBonus;
  return score;
}

/** 组合档位：delight（≥5 满意）/ normal（3-4）/ disappoint（<3 不满） */
export type TavernComboTier = 'delight' | 'normal' | 'disappoint';

export function tavernComboTier(score: number): TavernComboTier {
  if (score >= TAVERN_COMBO_RULES.satisfiedThreshold) return 'delight';
  if (score < TAVERN_COMBO_RULES.unhappyThreshold) return 'disappoint';
  return 'normal';
}

/** 组合分 → 收益倍率（纯函数；rng 决定区间内取值） */
export function tavernIncomeMultiplier(tier: TavernComboTier, rng: () => number): number {
  if (tier === 'delight') {
    const [lo, hi] = TAVERN_COMBO_RULES.satisfiedBoost;
    return round1(1 + lo + rng() * (hi - lo));
  }
  if (tier === 'disappoint') {
    const [lo, hi] = TAVERN_COMBO_RULES.unhappyPenalty;
    return round1(1 - (lo + rng() * (hi - lo)));
  }
  return 1;
}

function interpolate(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? '');
  return out;
}

/** 挑选叙事模板并插值（纯函数；rng 可注入） */
export function tavernNarrative(
  tier: TavernComboTier,
  plan: TavernPlan,
  dishes: readonly TavernDishOption[],
  income: number,
  rng: () => number
): string {
  const name = (id: string | undefined) => dishes.find((d) => d.id === id)?.name ?? '拿手菜';
  const first = plan.dishIds.map((id) => name(id)).filter(Boolean)[0] ?? '拿手菜';
  const vars = { guestName: '客官', dishName: first, income: String(Math.round(income)) };
  const pool = tier === 'disappoint' ? FAIL_NARRATIVES.jiulou : SUCCESS_NARRATIVES.jiulou;
  return interpolate(pickTemplate(pool, rng), vars);
}

/**
 * 酒楼接待主流程（纯函数）：
 * 1. 校验计划（至少 1 道菜；赠菜必须是招牌菜；请评菜需精力）
 * 2. 组合评分 → 档位 → 收益倍率
 * 3. 赠菜：好感 +15、消耗库存、20% 口碑传播
 * 4. 请评菜：精力 -5、35% 研发线索
 * 5. 结果叙事 + 摘要
 */
export function handleTavernReception(
  guest: Guest,
  plan: TavernPlan,
  ctx: TavernReceptionContext,
  rng: () => number = Math.random
): ShopReceptionResult {
  const dishes = availableTavernDishes(ctx.shopItems);
  const combo = scoreTavernCombo(plan.dishIds, dishes);
  const tier = tavernComboTier(combo);
  const mult = tavernIncomeMultiplier(tier, rng);
  const base = guest.baseConsumption * (0.8 + rng() * 0.4);
  const income = round1(base * mult);

  let energy = 5;
  let favorDelta = 0;
  const flags: NonNullable<ShopReceptionResult['flags']> = {};

  // 赠菜：送一道招牌菜（消耗库存但不收费），好感 +15，20% 口碑传播
  if (plan.giftDishId) {
    const gift = dishes.find((d) => d.id === plan.giftDishId);
    if (gift?.signature) {
      favorDelta += TAVERN_COMBO_RULES.giftFavor;
      flags.giftDishConsumed = true;
      flags.wordOfMouth = rng() < TAVERN_COMBO_RULES.giftWordOfMouthChance;
    }
  }

  // 请评菜：精力 -5，35% 获得研发线索
  if (plan.judgeRequested) {
    energy += TAVERN_COMBO_RULES.judgeEnergy;
    if (rng() < TAVERN_COMBO_RULES.judgeClueChance) {
      flags.recipeClue = '新菜研发线索（醋溜鱼片）';
    }
  }

  const ok = tier !== 'disappoint';
  const review: 'good' | 'bad' = ok ? 'good' : 'bad';
  const satisfactionDelta = tier === 'delight' ? 12 : tier === 'normal' ? 5 : -12;
  const narrative = tavernNarrative(tier, plan, dishes, income, rng);

  const summary = [
    `搭配分 ${combo}（${tier === 'delight' ? '宾主尽欢' : tier === 'normal' ? '尚可' : '客有微词'}）`,
    `入账 ${Math.round(income)} 两（×${mult}）`,
    `精力 -${energy}`,
    plan.giftDishId ? '赠菜一道（不收费）' : null,
    plan.judgeRequested ? '请老饕评菜' : null,
    flags.wordOfMouth ? '口碑传播' : null,
    flags.recipeClue ? `研发线索：${flags.recipeClue}` : null,
  ].filter((s): s is string => !!s);

  return {
    ok,
    shop: 'jiulou',
    income,
    incomeMultiplier: mult,
    satisfactionDelta,
    favorDelta,
    energyConsumed: energy,
    review,
    praised: ok && rng() < 0.2,
    narrative,
    summary,
    flags,
    handledNote: `宴席接待·搭配分${combo}·入账${Math.round(income)}两`,
  };
}

/** 兜底店型标签（类型收窄用） */
export const TAVERN_SHOP: ShopType = 'jiulou';
