/**
 * 《我在唐朝当掌柜》布庄量身定制接待（模块一 1.2）
 * 独立于酒楼/药铺的接待流程（不得共用同一处理函数）：
 *   客人需求 → 推荐面料+款式 → （犹豫时）量体/展示样衣/推荐替代面料 → 结果叙事弹窗
 * 纯函数：rng 可注入。匹配规则：面料+款式均匹配 成交率 70-90%；单维 45-65%；均不匹配 20-35%（犹豫）。
 */
import {
  CLOTHIER_FABRICS,
  CLOTHIER_STYLES,
  CLOTHIER_RULES,
  type ClothierFabricOption,
  type ClothierStyleOption,
} from '@/config/tang-reception-content';
import { SUCCESS_NARRATIVES, FAIL_NARRATIVES, pickTemplate } from '@/config/tang-dialogue-templates';
import type { Guest, ShopType } from '@/types/tang-manager';
import type { ShopReceptionResult } from '@/types/tang-dialogue';

export interface ClothierPlan {
  shop: 'buzhuang';
  fabricId: string;
  styleId: string;
  /** 追加操作（客人犹豫时） */
  extraOp?: 'measure' | 'sample' | 'swap_fabric';
}

export interface ClothierReceptionContext {
  baseConsumption: number;
  guestType: Guest['type'];
}

type Dimension = 'plain' | 'luxury' | 'fashion';

/** 客人偏好维度（纯函数）：按需求关键词 + 客人类型推断 */
export function clothierPreferenceDimension(guest: Guest): Dimension {
  const text = `${guest.description ?? ''} ${guest.storyTag ?? ''}`;
  if (/结实|耐穿|粗人|朴素|干活|远门/.test(text)) return 'plain';
  if (/体面|嫁妆|喜庆|绸|华贵|官|富/.test(text)) return 'luxury';
  if (/时兴|时髦|时新|窄袖|潮流/.test(text)) return 'fashion';
  switch (guest.type) {
    case 'big_order':
      return 'luxury';
    case 'special':
      return 'fashion';
    default:
      return 'plain';
  }
}

/** 面料+款式与客人偏好的匹配维度数（0/1/2；纯函数） */
export function clothierMatchCount(
  fabricId: string,
  styleId: string,
  dimension: Dimension
): number {
  const fabric = CLOTHIER_FABRICS.find((f) => f.id === fabricId);
  const style = CLOTHIER_STYLES.find((s) => s.id === styleId);
  let n = 0;
  if (fabric?.affinities.includes(dimension)) n += 1;
  if (style?.affinities.includes(dimension)) n += 1;
  return n;
}

/** 基础成交率区间（纯函数；匹配维度数 → 区间） */
export function clothierCloseRange(match: number): readonly [number, number] {
  if (match >= 2) return CLOTHIER_RULES.closeHigh;
  if (match === 1) return CLOTHIER_RULES.closeMid;
  return CLOTHIER_RULES.closeLow;
}

/** 追加操作加成（纯函数）：量体 +20% / 样衣 +15% / 换料 +10% */
export function clothierExtraCloseBonus(extraOp: ClothierPlan['extraOp']): number {
  switch (extraOp) {
    case 'measure':
      return CLOTHIER_RULES.measureCloseBonus;
    case 'sample':
      return CLOTHIER_RULES.sampleCloseBonus;
    case 'swap_fabric':
      return CLOTHIER_RULES.swapCloseBonus;
    default:
      return 0;
  }
}

/** 换料的利润折扣（纯函数）：按替代面料的 swapProfitPenalty */
export function clothierSwapPenalty(fabricId: string): number {
  return CLOTHIER_FABRICS.find((f) => f.id === fabricId)?.swapProfitPenalty ?? 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function interpolate(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? '');
  return out;
}

/**
 * 布庄接待主流程（纯函数）：
 * 1. 推断客人偏好维度 → 匹配维度数 → 基础成交率区间
 * 2. 追加操作加成（量体/样衣/换料）→ 随机成交判定
 * 3. 成交：收益 = 基础消费 × 面料系数 × 款式系数 × (0.9~1.1) × 换料折扣
 * 4. 未成交：收益 0，差评，失败叙事
 */
export function handleClothierReception(
  guest: Guest,
  plan: ClothierPlan,
  ctx: ClothierReceptionContext,
  rng: () => number = Math.random
): ShopReceptionResult {
  const dimension = clothierPreferenceDimension(guest);
  const match = clothierMatchCount(plan.fabricId, plan.styleId, dimension);
  const [lo, hi] = clothierCloseRange(match);
  const extraBonus = clothierExtraCloseBonus(plan.extraOp);
  const closeChance = Math.min(0.95, lo + rng() * (hi - lo) + extraBonus);

  const fabric = CLOTHIER_FABRICS.find((f) => f.id === plan.fabricId);
  const style = CLOTHIER_STYLES.find((s) => s.id === plan.styleId);
  const fabricName = fabric?.name ?? '料子';
  const styleName = style?.name ?? '样式';

  let energy = 0;
  let satisfactionDelta = 0;
  const closed = rng() < closeChance;

  if (plan.extraOp === 'measure') {
    energy += CLOTHIER_RULES.measureEnergy;
    satisfactionDelta += CLOTHIER_RULES.measureSatisfaction;
  }

  if (!closed) {
    const vars = { guestName: guest.name, fabricName };
    const narrative = interpolate(pickTemplate(FAIL_NARRATIVES.buzhuang, rng), vars);
    return {
      ok: false,
      shop: 'buzhuang',
      income: 0,
      incomeMultiplier: 0,
      satisfactionDelta: satisfactionDelta - 5,
      favorDelta: 0,
      energyConsumed: energy,
      review: 'bad',
      narrative,
      summary: ['未成交', `客人偏好：${dimension === 'plain' ? '朴素' : dimension === 'luxury' ? '华贵' : '时新'}`, '客人犹豫而去'],
      flags: { closed: false },
      handledNote: '量身未成·客人离去',
    };
  }

  const priceFactor = (fabric?.priceFactor ?? 1) * (style?.priceFactor ?? 1);
  const swapPenalty = plan.extraOp === 'swap_fabric' ? clothierSwapPenalty(plan.fabricId) : 0;
  const base = guest.baseConsumption * (0.9 + rng() * 0.2);
  const income = round1(base * priceFactor * (1 - swapPenalty));

  const vars = { guestName: guest.name, fabricName, styleName, income: String(Math.round(income)) };
  const narrative = interpolate(pickTemplate(SUCCESS_NARRATIVES.buzhuang, rng), vars);

  return {
    ok: true,
    shop: 'buzhuang',
    income,
    incomeMultiplier: round1(priceFactor * (1 - swapPenalty)),
    satisfactionDelta: satisfactionDelta + 10,
    favorDelta: 5,
    energyConsumed: energy,
    review: 'good',
    praised: rng() < 0.2,
    narrative,
    summary: [
      `${fabricName}·${styleName}`,
      `成交（偏好${dimension === 'plain' ? '朴素' : dimension === 'luxury' ? '华贵' : '时新'}匹配 ${match}/2）`,
      `入账 ${Math.round(income)} 两`,
      plan.extraOp === 'measure' ? '量体裁衣 精力-3' : null,
      plan.extraOp === 'sample' ? '展示样衣' : null,
      plan.extraOp === 'swap_fabric' ? '推荐替代面料（利润略降）' : null,
    ].filter((s): s is string => !!s),
    flags: { closed: true },
    handledNote: `量身成交·${fabricName}${styleName}·入账${Math.round(income)}两`,
  };
}

/** 兜底店型标签 */
export const CLOTHIER_SHOP: ShopType = 'buzhuang';
