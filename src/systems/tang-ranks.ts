/**
 * 《我在唐朝当掌柜》商阶系统（TANG-ADD-001 模块八）
 * 商阶："商阶：长安商界的辈分。从白丁到商圣，非一日之功——手札会根据你的成就自动评定。"
 * 纯函数：
 * - evaluateRank(state)：打烊评定——按阈值由高到低匹配（白丁→商圣 7 段）。
 * - getRankPromotionMessage(fromId, toId)：晋升贺词逐字。
 * 铁律：古风措辞；不持有游戏状态。
 */
import { MERCHANT_RANKS } from '@/config/tang-ranks';
import type { MerchantRank } from '@/types/tang-manager';

/** 评定所需状态子集 */
export interface RankState {
  day: number;
  score: number;
  shopCount: number;
  silver: number;
  reputation: number;
  totalNetProfit: number;
  /** 已触发结局 id（商圣 结局门槛） */
  endingTriggered?: string | null;
}

/** 段位门槛判定 */
export function rankThresholdMet(rank: MerchantRank, state: RankState): boolean {
  switch (rank.type) {
    case 'day':
      return state.day >= rank.threshold;
    case 'score':
      return state.score >= rank.threshold;
    case 'shop':
      return state.shopCount >= rank.threshold;
    case 'asset':
      return state.silver >= rank.threshold;
    case 'composite':
      // 巨擘 复合 900：声望 + 评分×100 + 分店×50 的复合分（工程定，注释）
      return state.reputation + state.score * 100 + state.shopCount * 50 >= rank.threshold;
    case 'ending':
      // 商圣：触发一代商圣结局
      return state.endingTriggered === 'shang-sheng';
    default:
      return false;
  }
}

/** 打烊评定当前商阶（阈值由高到低；返回匹配的最高段位） */
export function evaluateRank(state: RankState): MerchantRank {
  for (const rank of MERCHANT_RANKS) {
    if (rankThresholdMet(rank, state)) {
      return rank;
    }
  }
  return MERCHANT_RANKS[MERCHANT_RANKS.length - 1]!; // 兜底白丁
}

/** 晋升进度（0-1；展示用：当前段位以上一级完成度，简化按 day/30） */
export function rankProgress(state: RankState): number {
  return Math.min(1, state.day / 30);
}

/** 晋升贺词逐字（白丁→学徒 30 日已过… / 学徒→行商 街坊称掌柜 / 行商→掌柜 先祖手迹 /
 *  掌柜→大贾 三代未有 / 大贾→巨擘 已在山顶 / 巨擘→商圣 天下人封） */
export function getRankPromotionMessage(fromId: string, toId: string): string {
  if (fromId === toId) return '';
  const from = fromId ?? 'bai-ding';
  switch (`${from}->${toId}`) {
    case 'bai-ding->xue-tu':
      return '三十日已过，你终于从白身学徒，迈进了长安商海的门槛。手札贺道：「后生可畏。」';
    case 'xue-tu->xing-shang':
      return '街坊开始称你一声「掌柜」。手札贺道：「口碑渐起，行商之身。」';
    case 'xing-shang->zhang-gui':
      return '先祖手迹在此页微微发亮：「分号落成，掌柜之尊。」';
    case 'zhang-gui->da-jia':
      return '三代未有之盛，今日成于你手。手札贺道：「家资十万，大贾之列。」';
    case 'da-jia->ju-bo':
      return '你已在山顶。手札贺道：「巨擘之位，长安仰望。」';
    case 'ju-bo->shang-sheng':
      return '天下人封你一声「商圣」。手札最后一页，缓缓浮现先祖的落款。';
    default:
      return '手札翻过一页，你的商阶更上层楼。';
  }
}
