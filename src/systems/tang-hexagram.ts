/**
 * 《我在唐朝当掌柜》手札占候系统（TANG-ADD-001 模块一）
 * 占候："占候：先祖在手札中留下的卜筮之术，每日清晨翻看手札，自会浮现当日卦象与判词，指引一日经营。"
 * 纯函数：
 * - drawHexagram(rng?)：每日清晨随机一卦（八卦等概率）。
 * - applyHexagramEffect(hexagram, context, rng?)：按 effect.type 修正当日数值——
 *   income_multiplier 结算×1.15 / guest_random 客消±20% / cost_reduction 采买×0.9 /
 *   event_double 事件概率×2 / big_order_bonus 大单+30% / patience_decay_double 耐心×2 /
 *   praise_bonus 夸奖+20%；谦卦（none）原样返回。
 * 铁律：古风措辞；不持有游戏状态；store 接线（settleDay/接待/采买/事件）见 store。
 */
import { HEXAGRAMS } from '@/config/tang-hexagrams';
import type { Hexagram, HexagramContext } from '@/types/tang-manager';

/** 每日清晨随机一卦（八卦等概率；rng 可选参数便于测试） */
export function drawHexagram(rng: () => number = Math.random): Hexagram {
  const idx = Math.floor(rng() * HEXAGRAMS.length);
  return HEXAGRAMS[Math.min(idx, HEXAGRAMS.length - 1)]!;
}

/**
 * 按卦象效果修正当日数值上下文。
 * 返回新 context（不修改入参）；无卦象（null/undefined）或谦卦（none）原样返回。
 * 说明：guest_random 的 ±20% 方向随机（rng<0.5 减、否则加），其余修正确定。
 */
export function applyHexagramEffect(
  hexagram: Hexagram | null | undefined,
  context: HexagramContext,
  rng: () => number = Math.random
): HexagramContext {
  if (!hexagram) {
    return { ...context };
  }
  const value = hexagram.effect.value;
  switch (hexagram.effect.type) {
    case 'income_multiplier':
      return { ...context, baseIncome: (context.baseIncome ?? 0) * value };
    case 'guest_random': {
      const factor = rng() < 0.5 ? 1 - value : 1 + value;
      return { ...context, guestIncome: (context.guestIncome ?? 0) * factor };
    }
    case 'cost_reduction':
      return { ...context, procurementCost: (context.procurementCost ?? 0) * value };
    case 'event_double':
      return { ...context, eventChance: (context.eventChance ?? 1) * value };
    case 'big_order_bonus':
      return { ...context, bigOrderIncome: (context.bigOrderIncome ?? 0) * (1 + value) };
    case 'patience_decay_double':
      return { ...context, patienceDecay: (context.patienceDecay ?? 1) * value };
    case 'praise_bonus':
      return { ...context, praiseChance: (context.praiseChance ?? 0) + value };
    case 'none':
    default:
      return { ...context };
  }
}

/** 便捷：卦象占断配色（UI 翻开卡用；缺省平稳灰） */
export function hexagramTagColor(hexagram: Hexagram | null | undefined): string {
  return hexagram?.tagColor ?? '#9ca3af';
}
