/**
 * 动态地图事件单测（tang-map-events · Step 5b-2 模块三）
 * 覆盖：事件生成数量/层过滤/去重、respond 与 ignore 效果、过期清理、收益修正系数。
 */
import { describe, expect, it } from 'vitest';
import {
  expireMapEvents,
  generateMapEvents,
  getActiveMapEventEffects,
  handleMapEvent,
  mapEventIncomeFactor,
} from '@/systems/tang-map-events';
import type { MapEvent, MapEventEffect } from '@/types/tang-map';

const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function makeActiveEvent(overrides: Partial<MapEvent> = {}): MapEvent {
  return {
    id: 'ev-test-1',
    type: 'opportunity',
    title: '胡商清仓',
    description: '波斯邸绸缎贱价抛售。',
    nodeId: 'bosidian',
    spawnDay: 1,
    expireDay: 3,
    status: 'active',
    effects: [{ goldChange: 8, energyCost: 5 }],
    ignoredEffects: [],
    passiveEffects: [{ priceChange: { itemCategory: '布匹', multiplier: 0.7, nodeId: 'bosidian' } }],
    ...overrides,
  };
}

describe('generateMapEvents', () => {
  it('生成 1-2 个事件，且只落在已解锁层', () => {
    // rng=0 → count 1；候选模板点位须在 yongle 层
    const events = generateMapEvents({
      day: 5,
      unlockedLayers: ['yongle'],
      activeEventIds: [],
      rng: seq(0, 0.1),
    });
    expect(events.length).toBe(1);
    expect(events[0]!.spawnDay).toBe(5);
    expect(events[0]!.expireDay).toBeGreaterThan(5);
    expect(events[0]!.status).toBe('active');
  });

  it('rng≥0.5 时生成 2 个互不重复的事件', () => {
    const events = generateMapEvents({
      day: 5,
      unlockedLayers: ['yongle', 'east_west_market', 'changan'],
      activeEventIds: [],
      rng: seq(0.6, 0, 0.1),
    });
    expect(events.length).toBe(2);
    expect(events[0]!.id).not.toBe(events[1]!.id);
  });

  it('避开已 active 的同模板事件（去重）', () => {
    const activeEventIds = ['ev-hunhun-naoshi-3', 'ev-hu-shang-qingcang-3'];
    const events = generateMapEvents({
      day: 4,
      unlockedLayers: ['yongle', 'east_west_market'],
      activeEventIds,
      rng: seq(0, 0),
    });
    for (const e of events) {
      expect(activeEventIds.includes(e.id.replace(/-\d+$/, ''))).toBe(false);
    }
  });
});

describe('handleMapEvent', () => {
  it('respond 返回效果并置 resolved（商机兑现收益）', () => {
    const event = makeActiveEvent();
    const r = handleMapEvent(event, 'respond', { energy: 50, silver: 100, hasGuard: false });
    expect(r.ok).toBe(true);
    expect(r.updatedEvent!.status).toBe('resolved');
    expect(r.effects![0]!.goldChange).toBe(8);
  });

  it('ignore 保持 active（自然过期承受负面）', () => {
    const event = makeActiveEvent();
    const r = handleMapEvent(event, 'ignore', { energy: 50, silver: 100, hasGuard: false });
    expect(r.ok).toBe(true);
    expect(r.updatedEvent!.status).toBe('active');
    expect(r.effects).toBeUndefined();
  });

  it('needGuard 威胁无护卫时 respond 失败', () => {
    const event = makeActiveEvent({
      type: 'threat',
      effects: [{ reputationChange: 5, energyCost: 10, needGuard: true }],
    });
    const r = handleMapEvent(event, 'respond', { energy: 50, silver: 100, hasGuard: false });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('护卫');
  });

  it('精力不足时 respond 失败', () => {
    const event = makeActiveEvent({ effects: [{ goldChange: 8, energyCost: 30 }] });
    const r = handleMapEvent(event, 'respond', { energy: 10, silver: 100, hasGuard: false });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('精力');
  });

  it('已失效事件不可再处理', () => {
    const event = makeActiveEvent({ status: 'resolved' });
    const r = handleMapEvent(event, 'respond', { energy: 50, silver: 100, hasGuard: false });
    expect(r.ok).toBe(false);
  });
});

describe('expireMapEvents', () => {
  it('打烊清 expireDay≤day 的 active，并汇总忽略负面效果', () => {
    const e1 = makeActiveEvent({ id: 'e1', expireDay: 5 });
    const e2 = makeActiveEvent({
      id: 'e2',
      type: 'threat',
      expireDay: 8,
      ignoredEffects: [{ goldChange: -8 }, { reputationChange: -5 }],
    });
    const e3 = makeActiveEvent({ id: 'e3', status: 'resolved', expireDay: 5 });
    const r = expireMapEvents({ mapEvents: [e1, e2, e3], day: 5 });
    expect(r.events.find((e) => e.id === 'e1')!.status).toBe('expired');
    expect(r.events.find((e) => e.id === 'e2')!.status).toBe('active');
    expect(r.events.find((e) => e.id === 'e3')!.status).toBe('resolved');
    expect(r.expired.map((e) => e.id)).toEqual(['e1']);
    expect(r.negativeEffects.reduce((s, e) => s + (e.goldChange ?? 0), 0)).toBe(0);
    expect(r.expired.length).toBe(1);
  });

  it('忽略的威胁过期时施加一次性负面（goldChange 汇总）', () => {
    const threat = makeActiveEvent({
      id: 't1',
      type: 'threat',
      expireDay: 3,
      ignoredEffects: [{ goldChange: -8 }],
    });
    const r = expireMapEvents({ mapEvents: [threat], day: 4 });
    expect(r.negativeEffects[0]!.goldChange).toBe(-8);
  });
});

describe('getActiveMapEventEffects / mapEventIncomeFactor', () => {
  it('active 事件的持续效果被汇总；过期/已处置不计入', () => {
    const active = makeActiveEvent({ passiveEffects: [{ goldChange: 10 }] });
    const expired = makeActiveEvent({ id: 'x', status: 'expired', passiveEffects: [{ goldChange: 99 }] });
    const effects = getActiveMapEventEffects([active, expired]);
    expect(effects.reduce((s, e) => s + (e.goldChange ?? 0), 0)).toBe(10);
  });

  it('特价（mult<1）助益收益系数；涨价（mult>1）受损', () => {
    const cheap = makeActiveEvent();
    expect(mapEventIncomeFactor([cheap])).toBeCloseTo(1.3, 5); // 0.7 → 2-0.7=1.3
    const dear = makeActiveEvent({
      id: 'd',
      passiveEffects: [{ priceChange: { itemCategory: '食材', multiplier: 1.3, nodeId: 'matou-cangku' } }],
    });
    expect(mapEventIncomeFactor([dear])).toBeCloseTo(1 / 1.3, 5);
  });

  it('收益系数 clamp [0.5, 1.5]', () => {
    const tiny: MapEventEffect = { priceChange: { itemCategory: '布匹', multiplier: 0.2, nodeId: 'x' } };
    const huge: MapEventEffect = { priceChange: { itemCategory: '布匹', multiplier: 3, nodeId: 'x' } };
    const e1 = makeActiveEvent({ id: 'e1', passiveEffects: [tiny] });
    const e2 = makeActiveEvent({ id: 'e2', passiveEffects: [huge] });
    expect(mapEventIncomeFactor([e1])).toBe(1.5);
    expect(mapEventIncomeFactor([e2])).toBe(0.5);
  });
});
