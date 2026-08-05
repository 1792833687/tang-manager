/**
 * 《我在唐朝当掌柜》NPC 双向情绪与秘密系统（v1.2 · 规格书模块二）
 * 纯函数：行为记忆（最近 5 次）/ 底线判定 / 秘密发现态度 / 墙头草与站队联动 / 连续行为效果。
 * 不持有状态；rng 可注入（默认 Math.random）。
 */

/** 互动记录（规格书 2.3） */
export interface NPCInteraction {
  day: number;
  actionType: 'request_accepted' | 'request_refused' | 'advice_taken' | 'advice_ignored' | 'gift_given' | 'betrayal';
  description: string;
}

/** NPC 底线（规格书 2.4 表） */
export const NPC_BOTTOM_LINES: Record<string, string[]> = {
  'shen-tinglan': ['背叛商会利益', '利用他的信任牟取私利'],
  'xie-qi': ['出卖朋友', '向官府举报他'],
  'su_daniang': ['伤害平康坊的女子', '利用她探听的消息害人'],
  'cheng-zhanggui': ['勾结沈听澜打压他', '挖走他的织工'],
  'lu_bo': ['怀疑你父母的死因', '不尊重陆家祖训'],
};

/** 秘密发现后态度（规格书 2.5） */
export type SecretReaction = 'trust' | 'wary' | 'hostile';

/** 记录互动（保留最近 5 条；纯函数） */
export function recordInteraction(
  interactions: readonly NPCInteraction[],
  entry: NPCInteraction
): NPCInteraction[] {
  return [...interactions, entry].slice(-5);
}

/** 连续同类行为计数（从最近往前数；纯函数） */
export function consecutiveActionCount(
  interactions: readonly NPCInteraction[],
  actionType: NPCInteraction['actionType']
): number {
  let count = 0;
  for (let i = interactions.length - 1; i >= 0; i--) {
    if (interactions[i]!.actionType === actionType) count += 1;
    else break;
  }
  return count;
}

/** 连续 3 次拒绝 → 好感上限 -20%（30 天）；连续 3 次采纳 → 好感获取 +50%（30 天）——返回效果标记 */
export function interactionEffects(
  interactions: readonly NPCInteraction[],
  day: number
): { favorCapReduced: boolean; favorGainBoosted: boolean; untilDay: number } {
  const refused = consecutiveActionCount(interactions, 'request_refused');
  const adopted = consecutiveActionCount(interactions, 'advice_taken');
  const favorCapReduced = refused >= 3;
  const favorGainBoosted = adopted >= 3;
  return { favorCapReduced, favorGainBoosted, untilDay: day + 30 };
}

/** 秘密发现后的态度与好感变动（规格书 2.5） */
export function onSecretDiscovered(favor: number): { reaction: SecretReaction; favorDelta: number; message: string } {
  if (favor >= 70) {
    return { reaction: 'trust', favorDelta: 10, message: '既然你已知道，我也不瞒你了——此事还望掌柜守口如瓶。' };
  }
  if (favor >= 40) {
    return { reaction: 'wary', favorDelta: -5, message: '你是怎么查到的？这件事说来话长……' };
  }
  return { reaction: 'hostile', favorDelta: -20, message: '你查我？你到底想干什么？' };
}

/** 触碰底线 → 好感暴跌 30-50 且 30 天无法正常恢复（纯函数；返回变动） */
export function onBottomLineCrossed(rng: () => number = Math.random): { favorDelta: number; blockUntilDay: number; message: string } {
  const drop = 30 + Math.floor(rng() * 21); // 30-50
  return { favorDelta: -drop, blockUntilDay: 0, message: '（对方神色骤冷——你踩到了他不可触碰的底线。）' };
}

/** 墙头草检测（规格书 2.6）：同时与两人高好感 → 各降 10 */
export function checkFenceSitter(favorA: number, favorB: number, threshold = 70): boolean {
  return favorA >= threshold && favorB >= threshold;
}

/** 明确站队奖励：拒绝一方、支持另一方 → 被支持方 +15 */
export function standReward(favorDelta: number): number {
  return favorDelta > 0 ? 15 : 0;
}

/** 人脉链：苏大娘好感≥60 → 程掌柜每月自动 +3（纯函数） */
export function referralBoost(suDaniangFavor: number): number {
  return suDaniangFavor >= 60 ? 3 : 0;
}
