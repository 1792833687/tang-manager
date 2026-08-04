/**
 * 谢七彩头单测（TANG-ADD-001 模块五）
 * 覆盖：触发（谢七登场+30% 概率）、胜负条件、输赢结算、未接无影响。
 */
import { describe, expect, it } from 'vitest';
import { TANG_BETS } from '@/config/tang-bets';
import { betConditionMet, checkBetOffer, resolveBet } from '@/systems/tang-bets';
import type { BetTrack } from '@/systems/tang-bets';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

const winTrack: BetTrack = {
  netProfit: 100,
  backlashToday: 1,
  rejectedToday: 1,
  specialGuestToday: true,
};

describe('checkBetOffer · 触发', () => {
  it('谢七未登场（xieQiFavor=0）→ 不触发', () => {
    expect(checkBetOffer({ xieQiFavor: 0, betOfferedToday: false }, () => 0)).toBeNull();
  });

  it('今日已出现赌约 → 不重复触发', () => {
    expect(checkBetOffer({ xieQiFavor: 10, betOfferedToday: true }, () => 0)).toBeNull();
  });

  it('谢七登场 + rng≥0.3 → 不触发（70% 无赌约）', () => {
    expect(checkBetOffer({ xieQiFavor: 10, betOfferedToday: false }, () => 0.3)).toBeNull();
  });

  it('谢七登场 + rng<0.3 → 触发随机赌约（4 个之一）', () => {
    const bet = checkBetOffer({ xieQiFavor: 10, betOfferedToday: false }, seq(0.1, 0.5));
    expect(bet).not.toBeNull();
    expect(TANG_BETS.some((b) => b.id === bet!.id)).toBe(true);
  });
});

describe('betConditionMet · 胜负条件', () => {
  it('净利之赌：净利 ≤50 不满足（须 >50）', () => {
    const bet = TANG_BETS.find((b) => b.id === 'bet-net-profit')!;
    expect(betConditionMet(bet, { ...winTrack, netProfit: 50 })).toBe(false);
    expect(betConditionMet(bet, { ...winTrack, netProfit: 50.1 })).toBe(true);
  });

  it('反噬之赌：今日无反噬不满足', () => {
    const bet = TANG_BETS.find((b) => b.id === 'bet-backlash')!;
    expect(betConditionMet(bet, { ...winTrack, backlashToday: 0 })).toBe(false);
    expect(betConditionMet(bet, { ...winTrack, backlashToday: 1 })).toBe(true);
  });

  it('拒客之赌：今日无拒客不满足', () => {
    const bet = TANG_BETS.find((b) => b.id === 'bet-reject')!;
    expect(betConditionMet(bet, { ...winTrack, rejectedToday: 0 })).toBe(false);
    expect(betConditionMet(bet, { ...winTrack, rejectedToday: 1 })).toBe(true);
  });

  it('贵客之赌：今日无特殊客不满足', () => {
    const bet = TANG_BETS.find((b) => b.id === 'bet-noble')!;
    expect(betConditionMet(bet, { ...winTrack, specialGuestToday: false })).toBe(false);
    expect(betConditionMet(bet, { ...winTrack, specialGuestToday: true })).toBe(true);
  });
});

describe('resolveBet · 结算', () => {
  it('接下且条件达成 → 赢：好感+10、双倍赌注', () => {
    const bet = TANG_BETS.find((b) => b.id === 'bet-net-profit')!;
    const res = resolveBet(bet, true, winTrack);
    expect(res?.outcome).toBe('win');
    expect(res?.favorDelta).toBe(10);
    expect(res?.silverDelta).toBe(20); // 十两 × 2
  });

  it('接下且条件未达成 → 输：拿走赌注', () => {
    const bet = TANG_BETS.find((b) => b.id === 'bet-net-profit')!;
    const res = resolveBet(bet, true, { ...winTrack, netProfit: 10 });
    expect(res?.outcome).toBe('lose');
    expect(res?.silverDelta).toBe(-10);
    expect(res?.favorDelta).toBe(0);
  });

  it('未接（accepted=false）→ declined，无银无好感', () => {
    const bet = TANG_BETS.find((b) => b.id === 'bet-noble')!;
    const res = resolveBet(bet, false, winTrack);
    expect(res?.outcome).toBe('declined');
    expect(res?.silverDelta).toBe(0);
    expect(res?.favorDelta).toBe(0);
  });

  it('无赌约（null/undefined）→ null', () => {
    expect(resolveBet(null, true, winTrack)).toBeNull();
    expect(resolveBet(undefined, true, winTrack)).toBeNull();
  });

  it('贵客之赌输：bonusOnLose 西市情报出现在消息中', () => {
    const bet = TANG_BETS.find((b) => b.id === 'bet-noble')!;
    const res = resolveBet(bet, true, { ...winTrack, specialGuestToday: false });
    expect(res?.outcome).toBe('lose');
    expect(res?.message).toContain('西市情报');
    expect(bet.bonusOnLose).toBe('西市情报');
  });
});

describe('赌约配置 · stake/win 逐字', () => {
  it('4 赌约：stake 与 win 逐字', () => {
    expect(TANG_BETS).toHaveLength(4);
    const map = Object.fromEntries(TANG_BETS.map((b) => [b.id, b]));
    expect(map['bet-net-profit']!.stake).toBe(10);
    expect(map['bet-backlash']!.stake).toBe(5);
    expect(map['bet-reject']!.stake).toBe(15);
    expect(map['bet-noble']!.stake).toBe(20);
    expect(map['bet-net-profit']!.win.silverWin).toBe(20);
    expect(map['bet-backlash']!.win.silverWin).toBe(10);
    expect(map['bet-reject']!.win.silverWin).toBe(30);
    expect(map['bet-noble']!.win.silverWin).toBe(40);
  });
});
