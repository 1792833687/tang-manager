/**
 * 《我在唐朝当掌柜》市易务暗标系统（TANG-ADD-001 模块六）
 * 暗标："暗标：市易务偶有不明货物挂牌，不知具体何物，仅标品类。起价极低，价高者得——开标方知赚赔。"
 * 纯函数：
 * - checkBlindAuction(rng?)：每月初一随机挂 1 个暗标。
 * - bidOnAuction(auction, bid, silver, rng?)：出价≥起拍 → 扣款；
 *   50% 基础中标概率 + 出价越高越高中标（每超起拍 1 两 +1%，封顶 90%）；
 *   中标按 possibleOutcomes 概率抽奖；未中退还。
 * - resolveAuction(auction, won, rng?)：开标展示（古风文案）与抽奖结算。
 * 铁律：古风措辞；不持有游戏状态。
 */
import { BLIND_AUCTIONS } from '@/config/tang-blind-auction';
import type { BlindAuction, BlindAuctionOutcome } from '@/types/tang-manager';

/** 每月初一随机挂 1 个暗标（等概率） */
export function checkBlindAuction(rng: () => number = Math.random): BlindAuction {
  const idx = Math.floor(rng() * BLIND_AUCTIONS.length);
  return BLIND_AUCTIONS[Math.min(idx, BLIND_AUCTIONS.length - 1)]!;
}

export interface BidResult {
  ok: boolean;
  reason?: string;
  /** 是否中标（未中退还出价） */
  won: boolean;
  /** 实际扣款（两；中标扣出价，未中扣 0） */
  cost: number;
  /** 中标概率（0-1） */
  winChance: number;
}

/** 中标概率：50% 基础 + 每超出起拍 1 两 +1%，封顶 90% */
export function auctionWinChance(auction: BlindAuction, bid: number): number {
  if (bid < auction.startPrice) return 0;
  const over = bid - auction.startPrice;
  return Math.min(0.9, 0.5 + over * 0.01);
}

/**
 * 出价：出价≥起拍才可；先扣款（视为中标应付款）；
 * 按 winChance 掷骰——中标返回 won=true（扣款保留），未中返回 won=false（store 退还）。
 */
export function bidOnAuction(
  auction: BlindAuction,
  bid: number,
  silver: number,
  rng: () => number = Math.random
): BidResult {
  if (bid < auction.startPrice) {
    return { ok: false, reason: `出价不得低于起拍 ${auction.startPrice} 两`, won: false, cost: 0, winChance: 0 };
  }
  if (silver < bid) {
    return { ok: false, reason: '现银不足', won: false, cost: 0, winChance: 0 };
  }
  const winChance = auctionWinChance(auction, bid);
  const won = rng() < winChance;
  return { ok: true, won, cost: won ? bid : 0, winChance };
}

/** 按概率抽奖（possibleOutcomes；概率和为 1 由配置保证） */
export function drawAuctionOutcome(
  auction: BlindAuction,
  rng: () => number = Math.random
): BlindAuctionOutcome {
  const roll = rng();
  let acc = 0;
  for (const o of auction.possibleOutcomes) {
    acc += o.chance;
    if (roll < acc) return o;
  }
  return auction.possibleOutcomes[auction.possibleOutcomes.length - 1]!;
}

export interface AuctionResolveResult {
  auction: BlindAuction;
  won: boolean;
  outcome: BlindAuctionOutcome | null;
  /** 净银变动（中标 = outcome.silver；未中 = 0） */
  silverDelta: number;
  message: string;
}

/** 开标展示：中标 → 恭喜 + 抽奖结算；未中 → 遗憾（已由 store 退还出价） */
export function resolveAuction(
  auction: BlindAuction,
  won: boolean,
  rng: () => number = Math.random
): AuctionResolveResult {
  if (!won) {
    return {
      auction,
      won: false,
      outcome: null,
      silverDelta: 0,
      message: '市易务差人送来一口空箱子，附字条：「此标另有得主，银两已原路奉还。下月再来碰碰运气。」',
    };
  }
  const outcome = drawAuctionOutcome(auction, rng);
  const silverDelta = outcome.silver ?? 0;
  const moneyText = silverDelta >= 0 ? `得银 ${silverDelta} 两` : `折银 ${-silverDelta} 两`;
  const recipeText = outcome.recipe ? `，并附一张泛黄的配方「${outcome.recipe}」` : '';
  return {
    auction,
    won: true,
    outcome,
    silverDelta,
    message: `市易务差人送来一口箱子，开箱一看——${outcome.label}！${moneyText}${recipeText}。恭喜掌柜！`,
  };
}
