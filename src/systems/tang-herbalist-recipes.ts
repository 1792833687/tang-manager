/**
 * 《我在唐朝当掌柜》药铺·药方研发系统（产业系统 模块三 3.2）
 * 独立于酒楼/布庄产业逻辑：选择方向（对应病症）→ 投入药材+银两 → 指派药师/郎中 →
 * 周期 2-7 天 → 判定（成功/改良/失败）。药方类型：汤/丸/散/膏。
 * 独家秘方：品质 ≥4 可设，售价 +50%，仅本店可售；郎中离职可能带走。
 * 纯函数：rng 可注入。
 */
import { HERB_PATENT_RULES, HERB_RECIPE_NAME_POOL, HERB_RESEARCH_OUTCOME, industryLevel } from '@/config/tang-industry-content';
import type { HerbRecipe, HerbRecipeCategory, HerbResearchJob } from '@/types/tang-industry';

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** 开始药方研发（纯函数）：周期 2-7 天 */
export function startHerbResearch(
  category: HerbRecipeCategory,
  targetSymptom: string,
  researcherSkill: number,
  rng: () => number = Math.random
): HerbResearchJob {
  const totalDays = randInt(2, 7, rng);
  const recipeName = pick(HERB_RECIPE_NAME_POOL[category], rng);
  return {
    id: `hr-${Date.now().toString(36)}-${Math.floor(rng() * 1000)}`,
    recipeId: `recipe-${category}-${recipeName}`,
    recipeName,
    category,
    targetSymptom,
    totalDays,
    remainingDays: totalDays,
    mode: 'new',
    cost: 15 + researcherSkill * 5,
  };
}

/** 判定药方研发（纯函数）：成功/改良/失败 */
export function settleHerbResearch(
  job: HerbResearchJob,
  rng: () => number = Math.random
): { ok: boolean; recipe?: HerbRecipe; improved?: boolean } {
  const roll = rng();
  if (roll < HERB_RESEARCH_OUTCOME.success) {
    return {
      ok: true,
      recipe: {
        id: job.recipeId,
        name: job.recipeName,
        category: job.category,
        targetSymptom: job.targetSymptom,
        quality: randInt(1, 4, rng),
        ingredients: [],
        price: Math.round(job.cost * 1.6),
        effectiveness: 50 + Math.floor(rng() * 40),
        isPatent: false,
      },
    };
  }
  if (roll < HERB_RESEARCH_OUTCOME.success + HERB_RESEARCH_OUTCOME.improve) {
    return { ok: true, improved: true };
  }
  return { ok: false };
}

/** 设为独家秘方（纯函数）：品质 ≥4 可设，售价 +50% */
export function setPatent(recipe: HerbRecipe): { recipe: HerbRecipe; ok: boolean } {
  if (recipe.quality < HERB_PATENT_RULES.minQuality) {
    return { recipe, ok: false };
  }
  const patented: HerbRecipe = { ...recipe, isPatent: true, price: Math.round(recipe.price * (1 + HERB_PATENT_RULES.priceBonus)) };
  return { recipe: patented, ok: true };
}

/** 主治病症药材销量加成（纯函数）：秘方/高品质药方对应的药材销量 +50% */
export function symptomSalesBonus(recipe: HerbRecipe): number {
  return recipe.isPatent || recipe.quality >= 3 ? HERB_PATENT_RULES.symptomSalesBonus : 0;
}

/** 秘方泄露风险（纯函数）：郎中离职时 20% 概率带走 */
export function patentLeak(rng: () => number = Math.random): boolean {
  return rng() < HERB_PATENT_RULES.leakChance;
}

/** 升级条件（3.3）：评分 + 累计治愈病人数 */
export function checkHerbalistLevelUp(level: number, score: number, curedCount: number): boolean {
  const next = industryLevel('herbalist', level + 1);
  if (next.level <= level) return false;
  return score >= next.require.score && curedCount >= next.require.count;
}
