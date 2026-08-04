/**
 * 镖队单测（tang-caravan · Step 5b-5 模块四）
 * 覆盖：建队/路线设定（复用 Step 5b-2 商路）、装货发车（库房减、算到达日）、
 *       在途事件池（劫匪 40% 护卫击退/货损、风雨、抄近道、商机、盘查、平安）、
 *       到达结算（卖价/利润/返程）、每日推进。
 */
import { describe, expect, it } from 'vitest';
import {
  createCaravan,
  setupCaravanRoute,
  loadCaravan,
  triggerCaravanEvent,
  resolveCaravanArrival,
  checkCaravanDaily,
  type CaravanState,
} from '@/systems/tang-caravan';
import type { TradeContext } from '@/systems/tang-trade';
import type { Caravan } from '@/types/tang-caravan';

const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function makeTrade(overrides: Partial<TradeContext> = {}): TradeContext {
  return {
    day: 1,
    silver: 500,
    nodePriceModifiers: { 'luji-laodian': 1, 'wangji-buzhuang': 1.2 },
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

function makeState(overrides: Partial<CaravanState> = {}): CaravanState {
  return {
    day: 5,
    caravans: [],
    trade: makeTrade({ day: 5 }),
    ...overrides,
  };
}

function makeCaravan(overrides: Partial<Caravan> = {}): Caravan {
  return {
    id: 'c1',
    name: '陆记镖队',
    leader: '赵铁柱',
    members: [],
    guards: 1,
    route: null,
    status: 'idle',
    currentGoods: [],
    departureDay: 5,
    arrivalDay: 5,
    totalTrips: 0,
    totalValue: 0,
    eventLog: [],
    leaderExp: 0,
    ...overrides,
  };
}

describe('createCaravan / setupCaravanRoute', () => {
  it('建队初始 idle；设定路线 → loading 且 route 写入', () => {
    const c = createCaravan({ name: '陆记镖队', leader: '赵铁柱', members: [], guards: 1 }, 5);
    expect(c.status).toBe('idle');
    const res = setupCaravanRoute(c, 'luji-laodian', 'wangji-buzhuang', makeState());
    expect(res.ok).toBe(true);
    expect(res.caravan!.status).toBe('loading');
    expect(res.caravan!.route).toEqual({ from: 'luji-laodian', to: 'wangji-buzhuang' });
  });

  it('无直达商路 → 拒绝', () => {
    const c = makeCaravan();
    const res = setupCaravanRoute(c, 'luji-laodian', 'luji-laodian', makeState());
    expect(res.ok).toBe(false);
  });
});

describe('loadCaravan 装货发车', () => {
  it('loading → in_transit；到达日 = day + 运输天数；返回扣货清单', () => {
    const c = makeCaravan({ route: { from: 'luji-laodian', to: 'wangji-buzhuang' }, status: 'loading' });
    const res = loadCaravan(c, [{ itemName: '羊肉', quantity: 10, unitCost: 3 }], makeState());
    expect(res.ok).toBe(true);
    expect(res.caravan!.status).toBe('in_transit');
    expect(res.caravan!.arrivalDay).toBe(6); // day5 + 1 日
    expect(res.caravan!.currentGoods[0]!.quantity).toBe(10);
    expect(res.shopItems).toEqual([{ itemName: '羊肉', quantity: 10 }]);
  });

  it('未设路线 → 拒绝装货', () => {
    const res = loadCaravan(makeCaravan(), [{ itemName: '羊肉', quantity: 10, unitCost: 3 }], makeState());
    expect(res.ok).toBe(false);
  });
});

describe('triggerCaravanEvent 在途事件池', () => {
  it('劫匪：有护卫 60% 击退（roll<0.4 且 rng<0.6）', () => {
    const c = makeCaravan({ guards: 1 });
    const ev = triggerCaravanEvent(c, makeState(), seq(0, 0.5));
    expect(ev.eventType).toBe('robbers');
    expect(ev.guardsRepelled).toBe(true);
    expect(ev.goodsLossRate).toBeUndefined();
  });

  it('劫匪：无护卫 损 30-70% 货', () => {
    const c = makeCaravan({ guards: 0 });
    const ev = triggerCaravanEvent(c, makeState(), seq(0, 0.5));
    expect(ev.eventType).toBe('robbers');
    expect(ev.goodsLossRate).toBeCloseTo(0.5, 5); // 0.3 + 0.5*0.4
  });

  it('风雨 +1-3 天 / 抄近道 -1 天', () => {
    const storm = triggerCaravanEvent(makeCaravan(), makeState(), seq(0.45, 0.5));
    expect(storm.eventType).toBe('storm');
    expect(storm.arrivalDayDelta).toBe(2); // 1 + floor(0.5*3)=1 → 2
    const shortcut = triggerCaravanEvent(makeCaravan(), makeState(), seq(0.6));
    expect(shortcut.eventType).toBe('shortcut');
    expect(shortcut.arrivalDayDelta).toBe(-1);
  });

  it('商机提前卖 / 盘查罚款 / 平安领队+2', () => {
    const opp = triggerCaravanEvent(makeCaravan(), makeState(), seq(0.7, 0.5));
    expect(opp.eventType).toBe('opportunity');
    expect(opp.silverDelta).toBeGreaterThanOrEqual(5);
    const inspect = triggerCaravanEvent(makeCaravan(), makeState(), seq(0.85, 0.5));
    expect(inspect.eventType).toBe('inspection');
    expect(inspect.silverDelta).toBeLessThan(0);
    const safe = triggerCaravanEvent(makeCaravan(), makeState(), seq(0.95));
    expect(safe.eventType).toBe('safe');
    expect(safe.leaderExpGain).toBe(2);
  });
});

describe('resolveCaravanArrival 到达结算', () => {
  it('按目的地物价卖出；利润=卖价-运费-本金；开始返程；趟数+1', () => {
    const c = makeCaravan({
      status: 'in_transit',
      route: { from: 'luji-laodian', to: 'wangji-buzhuang' },
      currentGoods: [{ itemName: '羊肉', quantity: 10, unitCost: 3 }],
      arrivalDay: 6,
    });
    const res = resolveCaravanArrival(c, makeState());
    expect(res.ok).toBe(true);
    expect(res.revenue).toBe(36); // 3×1.2×10
    expect(res.profit).toBe(5); // 36 - 1 运费 - 30 本金
    expect(res.returnStarted).toBe(true);
    expect(res.caravan!.returning).toBe(true);
    expect(res.caravan!.totalTrips).toBe(1);
    expect(res.caravan!.totalValue).toBe(36);
    expect(res.caravan!.status).toBe('in_transit');
  });
});

describe('checkCaravanDaily 每日推进', () => {
  it('到达日结算：未返程 → 卖货 + 开始返程（rng≥0.3 不触发途中事件）', () => {
    const c = makeCaravan({
      status: 'in_transit',
      route: { from: 'luji-laodian', to: 'wangji-buzhuang' },
      currentGoods: [{ itemName: '羊肉', quantity: 10, unitCost: 3 }],
      arrivalDay: 5,
    });
    const res = checkCaravanDaily({ day: 5, caravans: [c], trade: makeTrade({ day: 5 }) }, seq(0.9));
    expect(res.events.length).toBeGreaterThan(0);
    expect(res.events[0]!.arrival).toBeDefined();
    expect(res.caravans[0]!.returning).toBe(true);
  });

  it('返程到达 → 回店 idle', () => {
    const c = makeCaravan({
      status: 'in_transit',
      route: { from: 'luji-laodian', to: 'wangji-buzhuang' },
      currentGoods: [],
      arrivalDay: 5,
      returning: true,
    });
    const res = checkCaravanDaily({ day: 5, caravans: [c], trade: makeTrade({ day: 5 }) }, seq(0.9));
    expect(res.caravans[0]!.status).toBe('idle');
    expect(res.caravans[0]!.returning).toBe(false);
  });

  it('未到到达日不结算', () => {
    const c = makeCaravan({
      status: 'in_transit',
      route: { from: 'luji-laodian', to: 'wangji-buzhuang' },
      currentGoods: [{ itemName: '羊肉', quantity: 10, unitCost: 3 }],
      arrivalDay: 10,
    });
    const res = checkCaravanDaily({ day: 5, caravans: [c], trade: makeTrade({ day: 5 }) }, seq(0.9));
    expect(res.caravans[0]!.status).toBe('in_transit');
    expect(res.caravans[0]!.returning).toBeUndefined();
  });
});
