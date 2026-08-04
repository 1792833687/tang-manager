/**
 * 《我在唐朝当掌柜》药铺问诊开方接待（模块一 1.3）
 * 独立于酒楼/布庄的接待流程（不得共用同一处理函数）：
 *   客人描述症状 → 配伍药方（主药必选/辅药 1-2 味/药引 1 味）→ 把脉/送服药建议 → 结果叙事弹窗
 * 纯函数：rng 可注入。主药对症 → 疗效好（收入 ×1.2~1.4，满意度 +15）；不对症 → 效果差（×0.7~0.85，-10）。
 */
import {
  HERB_OPTIONS,
  SYMPTOMS,
  HERBALIST_RULES,
  matchSymptom,
  type HerbOption,
  type SymptomDef,
} from '@/config/tang-reception-content';
import { SUCCESS_NARRATIVES, FAIL_NARRATIVES, pickTemplate } from '@/config/tang-dialogue-templates';
import type { Guest, ShopType } from '@/types/tang-manager';
import type { ShopReceptionResult } from '@/types/tang-dialogue';

export interface HerbalistPlan {
  shop: 'yaopu';
  mainHerbId: string;
  adjuvantIds: string[];
  guideId?: string;
  /** 把脉：精力 -5，药方匹配率 +30% */
  pulseUsed?: boolean;
  /** 送服药建议：满意度 +5，不消耗库存 */
  adviceGiven?: boolean;
}

export interface HerbalistReceptionContext {
  baseConsumption: number;
  guestType: Guest['type'];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 找药材（纯函数） */
export function findHerb(id: string): HerbOption | undefined {
  return HERB_OPTIONS.find((h) => h.id === id);
}

/** 主药是否对症（纯函数） */
export function mainHerbMatches(mainHerbId: string, symptom: SymptomDef): boolean {
  return symptom.mainHerbs.includes(mainHerbId);
}

/**
 * 药方匹配判定（纯函数）：
 * 返回 { matched, satisfactionDelta, incomeMultiplier }——把脉可 30% 修正误判（精准诊断）。
 */
export function evaluateHerbalistPrescription(
  mainHerbId: string,
  symptom: SymptomDef,
  pulseUsed: boolean,
  rng: () => number
): { matched: boolean; satisfactionDelta: number; incomeMul: number } {
  let matched = mainHerbMatches(mainHerbId, symptom);
  if (!matched && pulseUsed && rng() < HERBALIST_RULES.pulseMatchBonus) {
    // 把脉精准判断病因 → 原方被修正为对症
    matched = true;
  }
  if (matched) {
    const [lo, hi] = HERBALIST_RULES.mainHit.incomeMul;
    return { matched: true, satisfactionDelta: HERBALIST_RULES.mainHit.satisfaction, incomeMul: round1(lo + rng() * (hi - lo)) };
  }
  const [lo, hi] = HERBALIST_RULES.mainMiss.incomeMul;
  return { matched: false, satisfactionDelta: HERBALIST_RULES.mainMiss.satisfaction, incomeMul: round1(lo + rng() * (hi - lo)) };
}

function interpolate(tpl: string, vars: Record<string, string>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? '');
  return out;
}

/**
 * 药铺接待主流程（纯函数）：
 * 1. 症状匹配（按 description 关键词）
 * 2. 主药对症判定（把脉 30% 修正）→ 疗效/满意度/收益倍率
 * 3. 辅药/药引命中加成；服药建议 +5
 * 4. 疗效好 30% 触发「痊愈后送谢礼」；疗效差 5% 触发「医疗纠纷」
 */
export function handleHerbalistReception(
  guest: Guest,
  plan: HerbalistPlan,
  ctx: HerbalistReceptionContext,
  rng: () => number = Math.random
): ShopReceptionResult {
  const symptom = matchSymptom(guest.description);
  const evalRes = evaluateHerbalistPrescription(plan.mainHerbId, symptom, plan.pulseUsed ?? false, rng);

  let satisfactionDelta = evalRes.satisfactionDelta;
  let energy = plan.pulseUsed ? HERBALIST_RULES.pulseEnergy : 0;

  // 辅药命中：+5/味；药引命中：+3
  for (const aid of plan.adjuvantIds) {
    const herb = findHerb(aid);
    if (herb && herb.effectiveFor.includes(symptom.id)) satisfactionDelta += HERBALIST_RULES.adjuvantHit;
  }
  if (plan.guideId) {
    const guide = findHerb(plan.guideId);
    if (guide && guide.effectiveFor.includes(symptom.id)) satisfactionDelta += HERBALIST_RULES.guideHit;
  }
  if (plan.adviceGiven) satisfactionDelta += HERBALIST_RULES.adviceSatisfaction;

  const base = guest.baseConsumption * (0.8 + rng() * 0.4);
  const income = round1(base * evalRes.incomeMul);

  const mainName = findHerb(plan.mainHerbId)?.name ?? '主药';
  const flags: NonNullable<ShopReceptionResult['flags']> = {};
  const ok = evalRes.matched;
  const review: 'good' | 'bad' = ok ? 'good' : 'bad';

  if (ok && rng() < HERBALIST_RULES.thankYouChance) flags.thankYouGift = true;
  if (!ok && rng() < HERBALIST_RULES.disputeChance) flags.medicalDispute = true;

  const vars = { guestName: guest.name, herbName: mainName, income: String(Math.round(income)) };
  const narrative = interpolate(
    pickTemplate(ok ? SUCCESS_NARRATIVES.yaopu : FAIL_NARRATIVES.yaopu, rng),
    vars
  );

  return {
    ok,
    shop: 'yaopu',
    income,
    incomeMultiplier: evalRes.incomeMul,
    satisfactionDelta,
    favorDelta: ok ? 5 : 0,
    energyConsumed: energy,
    review,
    praised: ok && rng() < 0.2,
    narrative,
    summary: [
      `症状：${symptom.label}`,
      `主药 ${mainName}（${ok ? '对症' : '未中'}）`,
      plan.pulseUsed ? '把脉 精力-5' : null,
      plan.adviceGiven ? '送服药建议' : null,
      `入账 ${Math.round(income)} 两`,
      flags.thankYouGift ? '痊愈后送谢礼' : null,
      flags.medicalDispute ? '医疗纠纷' : null,
    ].filter((s): s is string => !!s),
    flags,
    handledNote: `问诊开方·${mainName}${ok ? '对症' : '未中'}·入账${Math.round(income)}两`,
  };
}

/** 兜底店型标签 */
export const HERBALIST_SHOP: ShopType = 'yaopu';
