/**
 * 成就检测单测（tang-achievements / 3.5）
 * 覆盖：新签名 checkAchievements(gameState, settlement)；
 *       保留项（第一桶金/回头客）+ 5 新成就（招财进宝/长安名店/无债一身轻/赌神在世/东山再起）；
 *       已解锁不重复返回。
 */
import { describe, expect, it } from 'vitest';
import { checkAchievements } from '@/config/tang-achievements';
import type { DaySettlement } from '@/types/tang-manager';

type AchievementState = Parameters<typeof checkAchievements>[0];

function makeState(overrides: Partial<AchievementState> = {}): AchievementState {
  return {
    totalNetProfit: 0,
    score: 1.0,
    legacyDebt: 200,
    maxGamblingWin: 0,
    hasGoneBroke: false,
    unlockedAchievements: [],
    ...overrides,
  };
}

function makeSettlement(overrides: Partial<DaySettlement> = {}): DaySettlement {
  return {
    day: 1,
    baseIncome: 0,
    guestIncome: 0,
    expenses: 0,
    netIncome: 0,
    scoreChange: 0,
    reputationChange: 0,
    xiaoerFavorChange: 0,
    energyConsumed: 0,
    ...overrides,
  };
}

describe('checkAchievements · 保留项', () => {
  it('第一桶金：netIncome≥100', () => {
    const newly = checkAchievements(makeState(), makeSettlement({ netIncome: 100 }));
    expect(newly).toContain('first-bucket');
    expect(checkAchievements(makeState(), makeSettlement({ netIncome: 99 }))).not.toContain('first-bucket');
  });

  it('回头客：score≥4.0', () => {
    expect(checkAchievements(makeState({ score: 4.0 }), makeSettlement())).toContain('regular-customer');
    expect(checkAchievements(makeState({ score: 3.9 }), makeSettlement())).not.toContain('regular-customer');
  });
});

describe('checkAchievements · 5 新成就（3.5）', () => {
  it('招财进宝：totalNetProfit≥10000', () => {
    expect(checkAchievements(makeState({ totalNetProfit: 9999 }), makeSettlement())).not.toContain('fortune');
    expect(checkAchievements(makeState({ totalNetProfit: 10000 }), makeSettlement())).toContain('fortune');
  });

  it('长安名店：score≥5.0', () => {
    expect(checkAchievements(makeState({ score: 4.99 }), makeSettlement())).not.toContain('changan-famous');
    expect(checkAchievements(makeState({ score: 5.0 }), makeSettlement())).toContain('changan-famous');
  });

  it('无债一身轻：legacyDebt=0', () => {
    expect(checkAchievements(makeState({ legacyDebt: 1 }), makeSettlement())).not.toContain('debt-free');
    expect(checkAchievements(makeState({ legacyDebt: 0 }), makeSettlement())).toContain('debt-free');
  });

  it('赌神在世：maxGamblingWin≥200', () => {
    expect(checkAchievements(makeState({ maxGamblingWin: 199 }), makeSettlement())).not.toContain('gambler');
    expect(checkAchievements(makeState({ maxGamblingWin: 200 }), makeSettlement())).toContain('gambler');
  });

  it('东山再起：hasGoneBroke 且 score≥3.0', () => {
    expect(checkAchievements(makeState({ hasGoneBroke: true, score: 2.9 }), makeSettlement())).not.toContain('comeback');
    expect(checkAchievements(makeState({ hasGoneBroke: false, score: 3.0 }), makeSettlement())).not.toContain('comeback');
    expect(checkAchievements(makeState({ hasGoneBroke: true, score: 3.0 }), makeSettlement())).toContain('comeback');
  });

  it('已解锁不重复返回', () => {
    const state = makeState({
      totalNetProfit: 10000,
      score: 5.0,
      legacyDebt: 0,
      maxGamblingWin: 250,
      hasGoneBroke: true,
      unlockedAchievements: ['first-bucket', 'regular-customer', 'fortune', 'changan-famous', 'debt-free', 'gambler', 'comeback'],
    });
    expect(checkAchievements(state, makeSettlement({ netIncome: 200 }))).toEqual([]);
  });
});
