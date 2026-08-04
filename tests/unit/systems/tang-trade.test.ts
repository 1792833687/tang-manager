/**
 * 跑商物流单测（tang-trade · Step 5b-2 模块四 / 五）
 * 覆盖：物价系数范围/事件修正、每日 ±5%、利润公式、物流天数运费风险、绿通减半、
 * 跑商结算（到达/被劫）、绿通解锁阈值与自动通道。
 */
import { describe, expect, it } from 'vitest';
import {
  calculateLogistics,
  calculateTradeProfit,
  checkTransportArrivals,
  executeTradeRun,
  getEffectiveGreenChannels,
  getNodePriceModifier,
  unlockGreenChannel,
  updateNodePriceModifiers,
  type TradeContext,
} from '@/systems/tang-trade';
import type { TransportingGoods } from '@/types/tang-map';

const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function makeCtx(overrides: Partial<TradeContext> = {}): TradeContext {
  return {
    day: 1,
    silver: 500,
    nodePriceModifiers: {
      'luji-laodian': 1,
      'wangji-buzhuang': 1.2,
      'dongshi-shanghui': 1.05,
      'shanghao-jia': 0.95,
      'matou-cangku': 1.1,
      'xishi-shangtuan': 0.9,
    },
    greenChannels: [],
    transportingGoods: [],
    employees: [],
    shenTinglanFavor: 0,
    xieQiFavor: 0,
    reputation: 0,
    shopItems: [{ category: '食材', price: 3 }],
    mapEvents: [],
    ...overrides,
  };
}

function makeInTransit(overrides: Partial<TransportingGoods> = {}): TransportingGoods {
  return {
    id: 'tg-1',
    itemCategory: '食材',
    quantity: 10,
    buyPrice: 3,
    sellNodeId: 'wangji-buzhuang',
    departureDay: 1,
    arrivalDay: 2,
    risk: 0,
    status: 'in_transit',
    ...overrides,
  };
}

describe('getNodePriceModifier / updateNodePriceModifiers', () => {
  it('每日系数落在 0.8-1.5（无事件时）', () => {
    const m = getNodePriceModifier('luji-laodian', '食材', makeCtx());
    expect(m).toBeGreaterThanOrEqual(0.8);
    expect(m).toBeLessThanOrEqual(1.5);
    // 货架基准价 × 系数：luji 1.0
    expect(getNodePriceModifier('wangji-buzhuang', '食材', makeCtx())).toBe(1.2);
  });

  it('active 事件价格效果叠加（点位命中）', () => {
    const ctx = makeCtx({
      mapEvents: [
        { status: 'active', passiveEffects: [{ priceChange: { itemCategory: '布匹', multiplier: 0.7, nodeId: 'bosidian' } }] },
      ],
    });
    // bosidian 无每日系数（缺省 1）× 0.7
    expect(getNodePriceModifier('bosidian', '布匹', ctx)).toBeCloseTo(0.7, 5);
    // clamp [0.5, 2]
    const extreme = makeCtx({
      nodePriceModifiers: { x: 1.5 },
      mapEvents: [{ status: 'active', passiveEffects: [{ priceChange: { itemCategory: '布匹', multiplier: 1.8, nodeId: 'x' } }] }],
    });
    expect(getNodePriceModifier('x', '布匹', extreme)).toBe(2);
  });

  it('每日 ±5% 微调且 clamp 0.8-1.5', () => {
    const next = updateNodePriceModifiers({ 'luji-laodian': 1 }, 2, seq(0.5));
    expect(next['luji-laodian']).toBeCloseTo(1, 5); // drift 1.0
    const up = updateNodePriceModifiers({ 'luji-laodian': 1.48 }, 2, seq(1)); // +5% → 1.554 → clamp 1.5
    expect(up['luji-laodian']).toBe(1.5);
    const down = updateNodePriceModifiers({ 'luji-laodian': 0.82 }, 2, seq(0)); // -5% → 0.779 → clamp 0.8
    expect(down['luji-laodian']).toBe(0.8);
  });
});

describe('calculateLogistics', () => {
  it('直达商路：天数=baseTime、运费=distance×0.5、风险=baseRisk', () => {
    const r = calculateLogistics('luji-laodian', 'wangji-buzhuang', makeCtx());
    expect(r.transportDays).toBe(1);
    expect(r.freight).toBe(1); // 2×0.5
    expect(r.risk).toBe(0.05);
    expect(r.routeId).toBe('r-luji-wangji');
  });

  it('绿色通道：天数/运费减半', () => {
    const ctx = makeCtx({ greenChannels: ['r-luji-wangji'] });
    const r = calculateLogistics('luji-laodian', 'wangji-buzhuang', ctx);
    expect(r.transportDays).toBe(1); // ceil(0.5)=1
    expect(r.freight).toBe(0.5);
    expect(r.green).toBe(true);
  });

  it('护卫：风险减半', () => {
    const ctx = makeCtx({ employees: [{ type: 'guard', restToday: false }] });
    const r = calculateLogistics('luji-laodian', 'wangji-buzhuang', ctx);
    expect(r.risk).toBeCloseTo(0.03, 5); // 0.05/2
  });

  it('无直达商路兜底', () => {
    const r = calculateLogistics('huanggong', 'zhangpo-jia', makeCtx());
    expect(r.transportDays).toBe(2);
    expect(r.green).toBe(false);
  });
});

describe('calculateTradeProfit', () => {
  it('利润=(sell-buy)×qty-运费-风险损耗', () => {
    const p = calculateTradeProfit('luji-laodian', 'wangji-buzhuang', '食材', 10, makeCtx());
    expect(p.buyPrice).toBe(3); // 3×1.0
    expect(p.sellPrice).toBe(3.6); // 3×1.2
    const expectedLoss = Math.round(10 * 3.6 * 0.05 * 0.3 * 100) / 100; // 0.54
    expect(p.profit).toBeCloseTo(6 - 1 - expectedLoss, 5);
    expect(p.riskLoss).toBeCloseTo(expectedLoss, 5);
  });
});

describe('executeTradeRun', () => {
  it('扣现银与运费、入在途队列（arrivalDay=day+transportDays）', () => {
    const ctx = makeCtx();
    const r = executeTradeRun('luji-laodian', 'wangji-buzhuang', '食材', 10, ctx);
    expect(r.ok).toBe(true);
    expect(r.goods!.status).toBe('in_transit');
    expect(r.goods!.arrivalDay).toBe(2); // day1 + 1日
    expect(r.goods!.buyPrice).toBe(3);
    expect(r.cost === undefined).toBe(true); // 纯函数不扣钱，返回预估；store 侧扣款
    expect(r.profit).toBeGreaterThan(0);
  });

  it('现银不足拒绝发车', () => {
    const ctx = makeCtx({ silver: 5 });
    const r = executeTradeRun('luji-laodian', 'wangji-buzhuang', '食材', 100, ctx);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('现银');
  });

  it('买卖同地拒绝', () => {
    const r = executeTradeRun('luji-laodian', 'luji-laodian', '食材', 10, makeCtx());
    expect(r.ok).toBe(false);
  });
});

describe('checkTransportArrivals', () => {
  it('到达日结算：售得 gross = 到达市价 × 数量', () => {
    const ctx = makeCtx({ day: 2, transportingGoods: [makeInTransit()] });
    const results = checkTransportArrivals(ctx, seq(1)); // rng≥risk 0 → 到达
    expect(results.length).toBe(1);
    expect(results[0]!.status).toBe('arrived');
    expect(results[0]!.sellPrice).toBe(3.6);
    expect(results[0]!.gross).toBe(36);
  });

  it('被劫：损失 30-70%（rng<risk）', () => {
    const ctx = makeCtx({
      day: 2,
      transportingGoods: [makeInTransit({ risk: 1 })],
    });
    const results = checkTransportArrivals(ctx, seq(0, 0.5)); // 0<1 触发，lossRate=0.5
    expect(results[0]!.status).toBe('robbed');
    expect(results[0]!.robbedLoss).toBe(18); // 36×0.5
    expect(results[0]!.gross).toBe(18); // 回收
  });

  it('未到期不结算', () => {
    const ctx = makeCtx({ day: 1, transportingGoods: [makeInTransit()] });
    expect(checkTransportArrivals(ctx)).toEqual([]);
  });
});

describe('unlockGreenChannel / getEffectiveGreenChannels', () => {
  it('东市线须沈听澜好感≥60；西市线须谢七好感≥50；官道须声望≥500', () => {
    expect(unlockGreenChannel('r-dongshi-shanghao-jia', makeCtx({ shenTinglanFavor: 50 })).ok).toBe(false);
    expect(unlockGreenChannel('r-dongshi-shanghao-jia', makeCtx({ shenTinglanFavor: 60 })).ok).toBe(true);
    expect(unlockGreenChannel('r-shanghao-yi-matou', makeCtx({ xieQiFavor: 40 })).ok).toBe(false);
    expect(unlockGreenChannel('r-shanghao-yi-matou', makeCtx({ xieQiFavor: 50 })).ok).toBe(true);
    expect(unlockGreenChannel('r-jingzhao-huanggong', makeCtx({ reputation: 400 })).ok).toBe(false);
    expect(unlockGreenChannel('r-jingzhao-huanggong', makeCtx({ reputation: 500 })).ok).toBe(true);
  });

  it('自动通道：沈听澜≥80 东市全绿 / 谢七≥70 西市风险归零 / 声望≥700 官道全解锁', () => {
    const east = makeCtx({ shenTinglanFavor: 85 });
    expect(getEffectiveGreenChannels(east).has('r-dongshi-bosidian')).toBe(true);

    const west = makeCtx({ xieQiFavor: 75 });
    expect(getEffectiveGreenChannels(west).has('r-shanghao-yi-matou')).toBe(true);
    const westLog = calculateLogistics('shanghao-yi', 'matou-cangku', west);
    expect(westLog.risk).toBe(0);

    const official = makeCtx({ reputation: 750 });
    expect(getEffectiveGreenChannels(official).has('r-jingzhao-pingzhun')).toBe(true);
  });

  it('天然官道恒为绿色通道', () => {
    const green = getEffectiveGreenChannels(makeCtx());
    expect(green.has('r-jingzhao-pingzhun')).toBe(true);
  });
});
