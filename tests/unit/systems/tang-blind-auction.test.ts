/**
 * 市易务暗标单测（TANG-ADD-001 模块六）
 * 覆盖：初一挂标、出价校验、中标概率（起价越高越高封顶 90%）、抽奖结算。
 */
import { describe, expect, it } from 'vitest';
import { BLIND_AUCTIONS } from '@/config/tang-blind-auction';
import {
  auctionWinChance,
  bidOnAuction,
  checkBlindAuction,
  drawAuctionOutcome,
  resolveAuction,
} from '@/systems/tang-blind-auction';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

describe('checkBlindAuction · 初一挂标', () => {
  it('随机挂 1 个（3 个之一）', () => {
    const auction = checkBlindAuction(() => 0);
    expect(auction).not.toBeNull();
    expect(BLIND_AUCTIONS.some((a) => a.id === auction.id)).toBe(true);
  });

  it('3 暗标配置：id/category/description/startPrice/possibleOutcomes 齐全', () => {
    expect(BLIND_AUCTIONS).toHaveLength(3);
    const map = Object.fromEntries(BLIND_AUCTIONS.map((a) => [a.id, a]));
    expect(map['auction-west-goods']!.startPrice).toBe(50);
    expect(map['auction-seized']!.startPrice).toBe(30);
    expect(map['auction-warehouse']!.startPrice).toBe(20);
    for (const a of BLIND_AUCTIONS) {
      expect(a.category).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.possibleOutcomes.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('auctionWinChance · 中标概率', () => {
  it('低于起拍 → 0；等于起拍 → 50%；每超 1 两 +1%', () => {
    const a = BLIND_AUCTIONS.find((x) => x.id === 'auction-west-goods')!;
    expect(auctionWinChance(a, 49)).toBe(0);
    expect(auctionWinChance(a, 50)).toBeCloseTo(0.5, 5);
    expect(auctionWinChance(a, 60)).toBeCloseTo(0.6, 5);
  });

  it('封顶 90%（起拍 +40 两以上不再涨）', () => {
    const a = BLIND_AUCTIONS.find((x) => x.id === 'auction-west-goods')!;
    expect(auctionWinChance(a, 200)).toBe(0.9);
  });
});

describe('bidOnAuction · 出价', () => {
  it('出价低于起拍 → 拒绝', () => {
    const a = BLIND_AUCTIONS[0]!;
    const r = bidOnAuction(a, a.startPrice - 1, 1000, () => 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('起拍');
  });

  it('现银不足 → 拒绝', () => {
    const a = BLIND_AUCTIONS[0]!;
    const r = bidOnAuction(a, a.startPrice, a.startPrice - 1, () => 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('现银不足');
  });

  it('rng<winChance → 中标（cost=出价）；rng≥winChance → 未中（cost=0 退还）', () => {
    const a = BLIND_AUCTIONS[0]!;
    const won = bidOnAuction(a, a.startPrice, 1000, () => 0.1);
    expect(won.ok).toBe(true);
    expect(won.won).toBe(true);
    expect(won.cost).toBe(a.startPrice);
    const lost = bidOnAuction(a, a.startPrice, 1000, () => 0.9);
    expect(lost.ok).toBe(true);
    expect(lost.won).toBe(false);
    expect(lost.cost).toBe(0);
  });

  it('高价出价必中标（rng=0.89 < 90%）', () => {
    const a = BLIND_AUCTIONS[0]!;
    const r = bidOnAuction(a, a.startPrice + 100, 1000, () => 0.89);
    expect(r.won).toBe(true);
  });
});

describe('drawAuctionOutcome · 抽奖', () => {
  it('按概率抽奖：rng=0 → 第一个结果；rng=0.99 → 最后一个', () => {
    const a = BLIND_AUCTIONS[0]!;
    expect(drawAuctionOutcome(a, () => 0).label).toBe(a.possibleOutcomes[0]!.label);
    expect(drawAuctionOutcome(a, () => 0.99).label).toBe(a.possibleOutcomes[a.possibleOutcomes.length - 1]!.label);
  });

  it('废弃仓库 5% 稀有配方：rng 落在该区间 → recipe', () => {
    const a = BLIND_AUCTIONS.find((x) => x.id === 'auction-warehouse')!;
    // 稀有配方是最后一项（chance 0.05）；rng≥0.95 命中
    const outcome = drawAuctionOutcome(a, () => 0.97);
    expect(outcome.recipe).toBe('rare-recipe');
  });
});

describe('resolveAuction · 开标', () => {
  it('未中标 → 遗憾消息、无银变动', () => {
    const a = BLIND_AUCTIONS[0]!;
    const res = resolveAuction(a, false, () => 0);
    expect(res.won).toBe(false);
    expect(res.silverDelta).toBe(0);
    expect(res.outcome).toBeNull();
    expect(res.message).toContain('市易务');
  });

  it('中标 → 恭喜消息 + 抽奖结算（rng=0.05 首个结果 上等香料 +200）', () => {
    const a = BLIND_AUCTIONS[0]!;
    const res = resolveAuction(a, true, () => 0.05);
    expect(res.won).toBe(true);
    expect(res.outcome?.label).toBe('上等香料');
    expect(res.silverDelta).toBe(200);
    expect(res.message).toContain('恭喜掌柜');
  });

  it('中标亏损结果 → silverDelta 为负', () => {
    const a = BLIND_AUCTIONS[0]!;
    // 霉变药材 chance 0.15，累计 0.85-1.0 → rng=0.9
    const res = resolveAuction(a, true, () => 0.9);
    expect(res.outcome?.label).toBe('霉变药材');
    expect(res.silverDelta).toBe(-30);
  });
});
