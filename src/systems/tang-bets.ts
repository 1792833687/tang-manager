/**
 * 《我在唐朝当掌柜》谢七彩头系统（TANG-ADD-001 模块五）
 * 彩头："彩头：谢七好赌，常与人下彩头。输了认栽，赢了翻倍——但别让他摸清你的底。"
 * 纯函数：
 * - checkBetOffer(state, rng?)：谢七登场（xieQiFavor>0）+ 未触发 + 30% 概率随机抽 1 个赌约。
 * - resolveBet(bet, track)：打烊结算——赢：好感+10+双倍赌注；输：拿走赌注（+bonusOnLose 文案）。
 * 铁律：古风措辞；不持有游戏状态。
 */
import { TANG_BETS } from '@/config/tang-bets';
import type { TangBet } from '@/types/tang-manager';

/** 判定所需状态子集 */
export interface BetOfferState {
  xieQiFavor: number;
  /** 今日已出现赌约（谢七登场未触发；activeBet 或历史标记） */
  betOfferedToday?: boolean;
}

/** 今日赌约判定所需追踪（只读） */
export interface BetTrack {
  netProfit: number;
  /** 今日反噬次数 */
  backlashToday: number;
  /** 今日拒客数 */
  rejectedToday: number;
  /** 今日是否有特殊客（type='special' 且已接待） */
  specialGuestToday: boolean;
}

/** 赌约胜负条件判定 */
export function betConditionMet(bet: TangBet, track: BetTrack): boolean {
  const c = bet.condition;
  if (c.minNetProfit !== undefined && track.netProfit <= c.minNetProfit) return false;
  if (c.backlashToday && track.backlashToday < 1) return false;
  if (c.rejectedToday && track.rejectedToday < 1) return false;
  if (c.specialGuestToday && !track.specialGuestToday) return false;
  return true;
}

/**
 * 清晨检测谢七赌约：谢七登场 + 今日未出现 + 30% 概率 → 随机抽 1 个赌约（返回 null 表示无）。
 * 说明：30% 概率在首个随机判定（rng() < 0.3）；抽取第二个随机。
 */
export function checkBetOffer(
  state: BetOfferState,
  rng: () => number = Math.random
): TangBet | null {
  if (state.xieQiFavor <= 0 || state.betOfferedToday) return null;
  if (rng() >= 0.3) return null;
  const idx = Math.floor(rng() * TANG_BETS.length);
  return TANG_BETS[Math.min(idx, TANG_BETS.length - 1)]!;
}

/** 打烊结算赌约：返回 { outcome, silverDelta, favorDelta, message }；bet 为 null 或未接 → declined */
export function resolveBet(
  bet: TangBet | null | undefined,
  accepted: boolean,
  track: BetTrack
): { bet: TangBet; outcome: 'win' | 'lose' | 'declined'; silverDelta: number; favorDelta: number; message: string } | null {
  if (!bet) return null;
  if (!accepted) {
    return { bet, outcome: 'declined', silverDelta: 0, favorDelta: 0, message: '你摆摆手：「谢七爷，今日不赌。」' };
  }
  if (betConditionMet(bet, track)) {
    return {
      bet,
      outcome: 'win',
      silverDelta: bet.win.silverWin,
      favorDelta: bet.win.favorGain,
      message: `你赢了！谢七骂骂咧咧地递来 ${bet.win.silverWin} 两：「愿赌服输，下回连本带利赢回来！」`,
    };
  }
  return {
    bet,
    outcome: 'lose',
    silverDelta: -bet.stake,
    favorDelta: 0,
    message: `${bet.loseMessage}${bet.bonusOnLose ? `（${bet.bonusOnLose}）` : ''}`,
  };
}
