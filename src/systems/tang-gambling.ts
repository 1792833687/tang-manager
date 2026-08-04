/**
 * 《我在唐朝当掌柜》西市赌坊（内容深化 TANG-CONT-D 模块四）
 * 纯函数（可测）：
 * - rollGamblingOdds(rng?)：预估赔率 1.5~3（每次打开赌坊面板刷新）
 * - placeBet(amount, odds, useLuckyStar, state, rng?)：下注 1-100 两；基础胜率 45%、
 *   用福星高照 65%（面板「福星高照×1.5」即 45%→65% 近似）；胜 = amount×odds、负 = -amount；
 *   福星高照等价交换在赌坊场景：被赌坊老板盯上（反噬概率翻倍 25%→50%），下次赌坊赢利抽水 10%
 *   （额外扣赢利 10%）。
 * - rollXieQiGamblingEncounter(state, rng?)：谢七互动——好感≥20 在场可能提私人赌约（复用 tang-bets）；
 *   ≥60 偶尔透露「手气好」台子（本次胜率临时 +10%）。
 * 铁律：古风措辞；纯函数不持有游戏状态；rng 可注入便于测试。
 */
import { checkBetOffer } from '@/systems/tang-bets';
import type { TangBet } from '@/types/tang-manager';

/** 下注金额范围（两） */
export const GAMBLING_MIN_BET = 1;
export const GAMBLING_MAX_BET = 100;

/** 赔率下限 / 上限（1.5~3，每次打开面板刷新） */
export const GAMBLING_ODDS_MIN = 1.5;
export const GAMBLING_ODDS_MAX = 3;

/** 基础胜率 / 用福星高照胜率 */
export const GAMBLING_BASE_WIN_RATE = 0.45;
export const GAMBLING_LUCKY_WIN_RATE = 0.65;

/** 被赌坊老板盯上的概率（反噬）：基础 25%，用福星高照翻倍 50% */
export const GAMBLING_MARK_CHANCE = 0.25;
export const GAMBLING_LUCKY_MARK_CHANCE = 0.5;

/** 被盯上后下次赢利抽水比例（10%） */
export const GAMBLING_BOSS_CUT = 0.1;

/** 下注所需状态子集 */
export interface GamblingState {
  silver: number;
  /** 福星高照剩余次数（用福星高照须 >0） */
  luckRemaining: number;
  /** 被赌坊老板盯上：下次赌坊赢利抽水 10% */
  gamblingSuspicion?: boolean;
}

/** 下注结果 */
export interface GamblingResult {
  ok: boolean;
  reason?: string;
  /** 是否赢 */
  win: boolean;
  /** 本次赔率 */
  odds: number;
  /** 实际生效胜率（含谢七手气台加成） */
  effectiveWinRate: number;
  /** 下注金额（两） */
  betAmount: number;
  /** 银两变动：胜 = amount×odds（已扣抽水）、负 = -amount */
  silverDelta: number;
  /** 被盯上后本次赢利被老板抽水金额（两） */
  cutByBoss: number;
  /** 本次是否被老板盯上（下次赌坊赢利抽水） */
  markedByBoss: boolean;
  /** 谢七「手气好」台子：胜率临时 +10% */
  luckyTable: boolean;
  /** 古风结果文案 */
  message: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 预估赔率（1.5~3，保留 1 位小数；每次打开赌坊面板刷新） */
export function rollGamblingOdds(rng: () => number = Math.random): number {
  return Math.round((GAMBLING_ODDS_MIN + rng() * (GAMBLING_ODDS_MAX - GAMBLING_ODDS_MIN)) * 10) / 10;
}

/**
 * 下注（纯函数）。amount 须 1-100；win = rng() < 胜率。
 * - useLuckyStar：胜率 45%→65%，但被老板盯上概率翻倍（25%→50%）。
 * - 被盯上（state.gamblingSuspicion）后赢利抽水 10%（额外扣赢利 10%）。
 */
export function placeBet(
  amount: number,
  odds: number,
  useLuckyStar: boolean,
  state: GamblingState,
  rng: () => number = Math.random,
  opts: { luckyTable?: boolean } = {}
): GamblingResult {
  if (!Number.isFinite(amount) || amount < GAMBLING_MIN_BET || amount > GAMBLING_MAX_BET) {
    return {
      ok: false,
      win: false,
      odds,
      effectiveWinRate: 0,
      betAmount: 0,
      silverDelta: 0,
      cutByBoss: 0,
      markedByBoss: false,
      luckyTable: false,
      reason: `每注须 ${GAMBLING_MIN_BET}-${GAMBLING_MAX_BET} 两`,
      message: '',
    };
  }
  if ((state.silver ?? 0) < amount) {
    return {
      ok: false,
      win: false,
      odds,
      effectiveWinRate: 0,
      betAmount: amount,
      silverDelta: 0,
      cutByBoss: 0,
      markedByBoss: false,
      luckyTable: false,
      reason: '现银不足',
      message: '',
    };
  }
  if (useLuckyStar && (state.luckRemaining ?? 0) <= 0) {
    return {
      ok: false,
      win: false,
      odds,
      effectiveWinRate: 0,
      betAmount: amount,
      silverDelta: 0,
      cutByBoss: 0,
      markedByBoss: false,
      luckyTable: false,
      reason: '福星高照次数已尽',
      message: '',
    };
  }
  const luckyTable = opts.luckyTable === true;
  // 胜率：基础 45% / 用福星高照 65%；谢七「手气好」台子额外 +10%
  const baseRate = useLuckyStar ? GAMBLING_LUCKY_WIN_RATE : GAMBLING_BASE_WIN_RATE;
  const effectiveWinRate = Math.min(0.95, baseRate + (luckyTable ? 0.1 : 0));
  const win = rng() < effectiveWinRate;
  // 反噬：被老板盯上概率（用福星高照翻倍）
  const markChance = useLuckyStar ? GAMBLING_LUCKY_MARK_CHANCE : GAMBLING_MARK_CHANCE;
  const markedByBoss = rng() < markChance;
  // 被盯上后赢利抽水 10%
  const grossWin = win ? amount * odds : 0;
  const cutByBoss =
    win && state.gamblingSuspicion ? round2(grossWin * GAMBLING_BOSS_CUT) : 0;
  const silverDelta = win ? round2(grossWin - cutByBoss) : -amount;
  let message: string;
  if (!win) {
    message = `骰盅落定，你押的 ${amount} 两打了水漂。庄家笑眯眯地收起筹码：「客官，手气不佳，改日再来。」`;
  } else if (cutByBoss > 0) {
    message = `你赢了 ${round2(grossWin)} 两！可那赌坊老板皮笑肉不笑地拦住你：「客官被盯上了，这抽头 ${cutByBoss} 两得留下。」到手 ${silverDelta} 两。`;
  } else {
    message = `骰盅落定，你押中宝了！庄家黑着脸赔付 ${round2(grossWin)} 两：「客官好手气，下回再来。」`;
  }
  return {
    ok: true,
    win,
    odds,
    effectiveWinRate,
    betAmount: amount,
    silverDelta,
    cutByBoss,
    markedByBoss,
    luckyTable,
    message,
  };
}

/** 谢七互动所需状态子集 */
export interface XieQiGamblingState {
  xieQiFavor: number;
  /** 今日是否已提过赌约（activeBet 或历史标记） */
  betOfferedToday?: boolean;
}

/** 谢七赌坊互动结果 */
export interface XieQiGamblingEncounter {
  /** 好感≥20 且 30% 概率提出的私人赌约（复用 tang-bets；无则 null） */
  betOffer: TangBet | null;
  /** 好感≥60 且 15% 概率透露「手气好」台子（本次胜率临时 +10%） */
  luckyTable: boolean;
  /** 互动叙事文案 */
  message: string;
}

/**
 * 谢七赌坊互动（纯函数）：
 * - 好感≥20 在场时可能提私人赌约（复用 checkBetOffer：30% 概率随机抽 1 个）。
 * - 好感≥60 偶尔透露「手气好」台子（15% 概率；placeBet 传 luckyTable 生效）。
 */
export function rollXieQiGamblingEncounter(
  state: XieQiGamblingState,
  rng: () => number = Math.random
): XieQiGamblingEncounter {
  const favor = state.xieQiFavor ?? 0;
  const betOffer =
    favor >= 20
      ? checkBetOffer({ xieQiFavor: favor, betOfferedToday: state.betOfferedToday === true }, rng)
      : null;
  const luckyTable = favor >= 60 && rng() < 0.15;
  let message: string;
  if (betOffer) {
    message = `谢七斜倚在赌坊柱子边，冲你挤眉弄眼：「掌柜的，闲来无事，跟七爷我赌个彩头？」`;
  } else if (luckyTable) {
    message = `谢七凑近你，压低嗓音：「那边靠窗的台子手气正旺，掌柜的去碰碰运道。」`;
  } else if (favor >= 20) {
    message = `谢七朝你拱拱手：「掌柜的，赌坊里人多眼杂，赢了便走，莫要恋战。」`;
  } else {
    message = `赌坊里人声鼎沸，你与谢七遥遥点头，并未多言。`;
  }
  return { betOffer, luckyTable, message };
}
