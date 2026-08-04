/**
 * 《我在唐朝当掌柜》酒楼·新菜研发系统（产业系统 模块一 1.1）
 * 独立于布庄/药铺产业逻辑：选择方向 → 投入食材+银两 → 指派厨师 → 周期 1-5 天 → 判定。
 * 判定：大成功 10%（品质+2、招牌菜）/ 成功 70%（新菜）/ 失败 20%（研发经验，下次成功率 +5%）。
 * 招牌菜机制：点单概率 +50%、售价 +30%、每道评分 +0.02、上限 3 道（Lv3 起 +1）。
 * 纯函数：rng 可注入。
 */
import {
  DISH_NAME_POOL,
  RESEARCH_COST_BASE,
  RESEARCH_DAYS_RANGE,
  RESEARCH_OUTCOME,
  TAVERN_SIGNATURE_RULES,
  industryLevel,
} from '@/config/tang-industry-content';
import type { DishCategory, TavernDish, TavernResearchJob } from '@/types/tang-industry';

function pick<T>(arr: readonly T[], rng: () => number): T {
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)]!;
}

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** 研发方向 → 新菜 id（纯函数；按方向名称池） */
export function nextDishName(category: DishCategory, rng: () => number): string {
  return pick(DISH_NAME_POOL[category], rng);
}

/** 复杂度（纯函数）：品类复杂度影响周期（点心/酒品较短） */
export function dishComplexity(category: DishCategory): number {
  if (category === '酒品') return 1;
  if (category === '点心') return 2;
  if (category === '汤品') return 3;
  return 4; // 荤/素
}

/** 开始研发（纯函数）：生成研发任务 */
export function startTavernResearch(
  category: DishCategory,
  chefSkill: number,
  ingredientQuality: number,
  rng: () => number = Math.random
): TavernResearchJob {
  const complexity = dishComplexity(category);
  const totalDays = Math.min(RESEARCH_DAYS_RANGE[1], Math.max(RESEARCH_DAYS_RANGE[0], complexity + (rng() < 0.5 ? 0 : 1)));
  // 成功率：基础 0.7 + 厨师技能×0.04 + 食材品质×0.02（封顶 0.95）
  const successRate = Math.min(0.95, 0.7 + chefSkill * 0.04 + ingredientQuality * 0.02);
  const dishName = nextDishName(category, rng);
  return {
    id: `tr-${Date.now().toString(36)}-${Math.floor(rng() * 1000)}`,
    dishId: `dish-${category}-${dishName}`,
    dishName,
    category,
    totalDays,
    remainingDays: totalDays,
    successRate,
    cost: RESEARCH_COST_BASE + complexity * 5,
  };
}

/** 判定研发结果（纯函数）：grand/success/fail → 产出新菜或研发经验 */
export function settleTavernResearch(
  job: TavernResearchJob,
  rng: () => number = Math.random
): { ok: boolean; dish?: TavernDish; experience?: boolean; grand?: boolean } {
  const roll = rng();
  // 成功率按 job.successRate 缩放（厨师技能/食材品质影响研发成功率）
  const successThreshold = RESEARCH_OUTCOME.grand + job.successRate * 0.8;
  if (roll < RESEARCH_OUTCOME.grand) {
    return {
      ok: true,
      grand: true,
      dish: {
        id: job.dishId,
        name: job.dishName,
        category: job.category,
        quality: 4,
        cost: job.cost,
        price: Math.round(job.cost * 2.2),
        popularity: 70,
        isSignature: true,
        ingredients: [],
        bonus: '吃过的人都赞不绝口——口碑传播 +20%',
      },
    };
  }
  if (roll < successThreshold) {
    return {
      ok: true,
      dish: {
        id: job.dishId,
        name: job.dishName,
        category: job.category,
        quality: randInt(1, 3, rng),
        cost: job.cost,
        price: Math.round(job.cost * 1.8),
        popularity: 40,
        isSignature: false,
        ingredients: [],
        bonus: '',
      },
    };
  }
  return { ok: false, experience: true };
}

/** 研发经验：下次成功率 +5%（纯函数） */
export function applyResearchExperience(successRate: number, stacks: number): number {
  return Math.min(0.95, successRate + stacks * 0.05);
}

/** 招牌菜上限（纯函数）：Lv3 起 +1 */
export function maxSignatures(tavernLevel: number): number {
  return TAVERN_SIGNATURE_RULES.maxSignatures + (tavernLevel >= 3 ? 1 : 0);
}

/** 能否设为招牌菜（纯函数） */
export function canSetSignature(dishes: readonly TavernDish[], tavernLevel: number): boolean {
  return dishes.filter((d) => d.isSignature).length < maxSignatures(tavernLevel);
}

/** 招牌菜售价上浮（纯函数） */
export function signaturePrice(base: number): number {
  return Math.round(base * (1 + TAVERN_SIGNATURE_RULES.priceBonus));
}

/** Lv5 全菜品售价 +20%（纯函数） */
export function tavernLevelPriceBonus(level: number, base: number): number {
  const bonus = level >= 5 ? 0.2 : 0;
  return Math.round(base * (1 + bonus) * 10) / 10;
}

/** 升级条件判定（1.3）：评分 + 累计宴席数 */
export function checkTavernLevelUp(level: number, score: number, banquetCount: number): boolean {
  const next = industryLevel('tavern', level + 1);
  if (next.level <= level) return false;
  return score >= next.require.score && banquetCount >= next.require.count;
}

/** 下一级需求（纯函数；me 面板展示） */
export function tavernNextRequirement(level: number): { score: number; count: number; countLabel: string } | null {
  const next = industryLevel('tavern', level + 1);
  if (next.level <= level) return null;
  return next.require;
}
