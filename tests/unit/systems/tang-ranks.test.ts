/**
 * 商阶单测（TANG-ADD-001 模块八）
 * 覆盖：7 段位阈值、评定由高到低、晋升贺词逐字、进度。
 */
import { describe, expect, it } from 'vitest';
import { MERCHANT_RANKS } from '@/config/tang-ranks';
import { evaluateRank, getRankPromotionMessage, rankProgress, rankThresholdMet } from '@/systems/tang-ranks';
import type { RankState } from '@/systems/tang-ranks';

const baseState: RankState = {
  day: 1,
  score: 1.0,
  shopCount: 1,
  silver: 0,
  reputation: 0,
  totalNetProfit: 0,
  endingTriggered: null,
};

describe('商阶配置 · 7 段位', () => {
  it('7 段位全量：id/name/threshold/type/description 逐字', () => {
    expect(MERCHANT_RANKS).toHaveLength(7);
    const ids = MERCHANT_RANKS.map((r) => r.id);
    expect(ids).toEqual(['shang-sheng', 'ju-bo', 'da-jia', 'zhang-gui', 'xing-shang', 'xue-tu', 'bai-ding']);
    const map = Object.fromEntries(MERCHANT_RANKS.map((r) => [r.id, r]));
    expect(map['bai-ding']!.name).toBe('白丁');
    expect(map['xue-tu']!.threshold).toBe(30);
    expect(map['xue-tu']!.type).toBe('day');
    expect(map['xing-shang']!.threshold).toBe(3.0);
    expect(map['zhang-gui']!.threshold).toBe(2);
    expect(map['da-jia']!.threshold).toBe(100000);
    expect(map['ju-bo']!.threshold).toBe(900);
    expect(map['shang-sheng']!.type).toBe('ending');
  });
});

describe('rankThresholdMet · 门槛判定', () => {
  it('学徒：day≥30', () => {
    const r = MERCHANT_RANKS.find((x) => x.id === 'xue-tu')!;
    expect(rankThresholdMet(r, { ...baseState, day: 29 })).toBe(false);
    expect(rankThresholdMet(r, { ...baseState, day: 30 })).toBe(true);
  });

  it('行商：评分 ≥3.0', () => {
    const r = MERCHANT_RANKS.find((x) => x.id === 'xing-shang')!;
    expect(rankThresholdMet(r, { ...baseState, score: 2.9 })).toBe(false);
    expect(rankThresholdMet(r, { ...baseState, score: 3.0 })).toBe(true);
  });

  it('掌柜：分店 ≥2', () => {
    const r = MERCHANT_RANKS.find((x) => x.id === 'zhang-gui')!;
    expect(rankThresholdMet(r, { ...baseState, shopCount: 1 })).toBe(false);
    expect(rankThresholdMet(r, { ...baseState, shopCount: 2 })).toBe(true);
  });

  it('商圣：触发一代商圣结局', () => {
    const r = MERCHANT_RANKS.find((x) => x.id === 'shang-sheng')!;
    expect(rankThresholdMet(r, { ...baseState, endingTriggered: 'shang-sheng' })).toBe(true);
    expect(rankThresholdMet(r, { ...baseState, endingTriggered: 'huangshang' })).toBe(false);
  });
});

describe('evaluateRank · 评定', () => {
  it('初始状态 → 白丁（最低段位）', () => {
    expect(evaluateRank(baseState).id).toBe('bai-ding');
  });

  it('day=30 → 学徒', () => {
    expect(evaluateRank({ ...baseState, day: 30 }).id).toBe('xue-tu');
  });

  it('day=30 + 评分 3.0 → 行商（阈值由高到低匹配）', () => {
    expect(evaluateRank({ ...baseState, day: 30, score: 3.0 }).id).toBe('xing-shang');
  });

  it('分店 2 + 资产 10 万 → 大贾（高于掌柜）', () => {
    expect(evaluateRank({ ...baseState, shopCount: 2, silver: 100000 }).id).toBe('da-jia');
  });

  it('复合 900：声望 + 评分×100 + 分店×50 ≥900 → 巨擘', () => {
    expect(evaluateRank({ ...baseState, reputation: 700, score: 1.0, shopCount: 2 }).id).toBe('ju-bo');
    expect(evaluateRank({ ...baseState, reputation: 699, score: 1.0, shopCount: 2 }).id).not.toBe('ju-bo');
  });
});

describe('getRankPromotionMessage · 晋升贺词逐字', () => {
  it('白丁→学徒 30 日已过；学徒→行商 街坊称掌柜；行商→掌柜 先祖手迹', () => {
    expect(getRankPromotionMessage('bai-ding', 'xue-tu')).toContain('三十日已过');
    expect(getRankPromotionMessage('xue-tu', 'xing-shang')).toContain('街坊');
    expect(getRankPromotionMessage('xing-shang', 'zhang-gui')).toContain('先祖手迹');
  });

  it('掌柜→大贾 三代未有；大贾→巨擘 已在山顶；巨擘→商圣 天下人封', () => {
    expect(getRankPromotionMessage('zhang-gui', 'da-jia')).toContain('三代未有');
    expect(getRankPromotionMessage('da-jia', 'ju-bo')).toContain('已在山顶');
    expect(getRankPromotionMessage('ju-bo', 'shang-sheng')).toContain('天下人封');
  });

  it('同级晋升 → 空字符串', () => {
    expect(getRankPromotionMessage('bai-ding', 'bai-ding')).toBe('');
  });
});

describe('rankProgress · 进度', () => {
  it('day=15 → 0.5；day=60 封顶 1', () => {
    expect(rankProgress(baseState)).toBeCloseTo(1 / 30, 5);
    expect(rankProgress({ ...baseState, day: 60 })).toBe(1);
  });
});
