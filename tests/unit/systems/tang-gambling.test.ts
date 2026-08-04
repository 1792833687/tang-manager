/**
 * 西市赌坊单测（内容深化 TANG-CONT-D 模块四）
 * 覆盖：赔率 1.5-3、下注校验（1-100/现银/福星次数）、胜率 45%/65%、胜负结算、
 *      被老板盯上抽水 10%、福星反噬概率翻倍、谢七互动（赌约/手气台）。
 */
import { describe, expect, it } from 'vitest';
import {
  GAMBLING_BASE_WIN_RATE,
  GAMBLING_LUCKY_WIN_RATE,
  GAMBLING_MAX_BET,
  GAMBLING_MIN_BET,
  placeBet,
  rollGamblingOdds,
  rollXieQiGamblingEncounter,
} from '@/systems/tang-gambling';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

describe('rollGamblingOdds · 赔率', () => {
  it('赔率在 1.5~3 之间且保留 1 位小数', () => {
    expect(rollGamblingOdds(() => 0)).toBe(1.5);
    expect(rollGamblingOdds(() => 1)).toBe(3);
    const mid = rollGamblingOdds(() => 0.5);
    expect(mid).toBeGreaterThanOrEqual(1.5);
    expect(mid).toBeLessThanOrEqual(3);
    expect(mid * 10).toBe(Math.round(mid * 10));
  });
});

describe('placeBet · 校验', () => {
  it('金额须 1-100 两', () => {
    const r0 = placeBet(0, 2, false, { silver: 100, luckRemaining: 1 });
    const r100 = placeBet(GAMBLING_MAX_BET + 1, 2, false, { silver: 100, luckRemaining: 1 });
    expect(r0.ok).toBe(false);
    expect(r100.ok).toBe(false);
    expect(r0.reason).toContain(`${GAMBLING_MIN_BET}-${GAMBLING_MAX_BET}`);
    // 边界合法
    expect(placeBet(GAMBLING_MIN_BET, 2, false, { silver: 100, luckRemaining: 1 }).ok).toBe(true);
    expect(placeBet(GAMBLING_MAX_BET, 2, false, { silver: 100, luckRemaining: 1 }).ok).toBe(true);
  });

  it('现银不足拒绝', () => {
    const r = placeBet(50, 2, false, { silver: 10, luckRemaining: 1 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('现银不足');
  });

  it('用福星高照但次数已尽拒绝', () => {
    const r = placeBet(10, 2, true, { silver: 100, luckRemaining: 0 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('福星高照次数已尽');
  });
});

describe('placeBet · 胜负与抽水', () => {
  it('基础胜率 45%：rng<0.45 赢，rng≥0.45 输', () => {
    const win = placeBet(10, 2, false, { silver: 100, luckRemaining: 0 }, seq(0.1, 0.9));
    expect(win.ok).toBe(true);
    expect(win.win).toBe(true);
    expect(win.effectiveWinRate).toBe(GAMBLING_BASE_WIN_RATE);
    expect(win.silverDelta).toBe(20); // 10 × 2
    const lose = placeBet(10, 2, false, { silver: 100, luckRemaining: 0 }, seq(0.5, 0.1));
    expect(lose.win).toBe(false);
    expect(lose.silverDelta).toBe(-10);
  });

  it('用福星高照胜率 65%', () => {
    const r = placeBet(10, 2, true, { silver: 100, luckRemaining: 1 }, seq(0.6, 0.9));
    expect(r.effectiveWinRate).toBe(GAMBLING_LUCKY_WIN_RATE);
    expect(r.win).toBe(true); // 0.6 < 0.65
  });

  it('被老板盯上后赢利抽水 10%（额外扣赢利）', () => {
    const r = placeBet(100, 2, false, { silver: 200, luckRemaining: 0, gamblingSuspicion: true }, seq(0.1, 0.9));
    expect(r.win).toBe(true);
    expect(r.cutByBoss).toBe(20); // 200 × 10%
    expect(r.silverDelta).toBe(180); // 200 - 20
  });

  it('用福星高照反噬概率翻倍：同 rng 序列下 mark 命中（25%→50%）', () => {
    // markChance 判定用第二个 rng：0.4 < 0.5（福星）→ marked；0.4 >= 0.25（基础）→ 未 mark
    const lucky = placeBet(10, 2, true, { silver: 100, luckRemaining: 1 }, seq(0.6, 0.4));
    expect(lucky.markedByBoss).toBe(true);
    const normal = placeBet(10, 2, false, { silver: 100, luckRemaining: 0 }, seq(0.6, 0.4));
    expect(normal.markedByBoss).toBe(false);
  });

  it('谢七手气台：胜率临时 +10%（45%→55%）', () => {
    const r = placeBet(10, 2, false, { silver: 100, luckRemaining: 0 }, seq(0.5, 0.9), { luckyTable: true });
    expect(r.effectiveWinRate).toBe(0.55);
    expect(r.win).toBe(true); // 0.5 < 0.55
    expect(r.luckyTable).toBe(true);
  });
});

describe('rollXieQiGamblingEncounter · 谢七互动', () => {
  it('好感 <20：不提赌约、无手气台', () => {
    const r = rollXieQiGamblingEncounter({ xieQiFavor: 10 }, () => 0);
    expect(r.betOffer).toBeNull();
    expect(r.luckyTable).toBe(false);
  });

  it('好感 ≥20 且 rng<0.3：提私人赌约（复用 tang-bets）', () => {
    const r = rollXieQiGamblingEncounter({ xieQiFavor: 30, betOfferedToday: false }, seq(0.1, 0.5));
    expect(r.betOffer).not.toBeNull();
  });

  it('好感 ≥60 且 rng<0.15：透露「手气好」台子', () => {
    const r = rollXieQiGamblingEncounter({ xieQiFavor: 80 }, seq(0.9, 0.1));
    expect(r.luckyTable).toBe(true);
    expect(r.message).toContain('手气');
  });
});
