/**
 * 库存压力系统单测（tang-expiry · Step 5b-1.5 模块一）
 * 覆盖：expiry 递减与 expired/near_expiry 标记、removeExpiredGoods 移除与损失、
 *       getExpiryLabel 档位、仓储费（免费上限/超限/夏冬时令修正）、库房扩建费用/容量/耗时、
 *       月份换算与季节。
 */
import { describe, expect, it } from 'vitest';
import {
  calculateStorageCost,
  categoryVolume,
  expandWarehouseCost,
  expandWarehouseDuration,
  getExpiryLabel,
  getItemExpiry,
  getItemVolume,
  getSeason,
  maxStorageForLevel,
  monthOf,
  removeExpiredGoods,
  totalVolumeOf,
  updateExpiry,
  warehouseHealth,
  warehouseValue,
} from '@/systems/tang-expiry';
import type { ShopItem, TangGameState } from '@/types/tang-manager';

function makeItem(overrides: Partial<ShopItem> = {}): ShopItem {
  return {
    id: 'i1',
    name: '羊肉',
    price: 3,
    cost: 1.8,
    stock: 10,
    category: '食材',
    volume: 3,
    expiry: 5,
    status: 'normal',
    ...overrides,
  };
}

function makeState(overrides: Partial<TangGameState> = {}): Pick<TangGameState, 'shopItems' | 'freeStorageLimit' | 'day' | 'maxStorage'> {
  return {
    shopItems: [makeItem()],
    // TANG-S5B15-002 裁决：免费上限 170（= 初始货架体积）、maxStorage 200
    freeStorageLimit: 170,
    day: 1,
    maxStorage: 200,
    ...overrides,
  };
}

describe('月份与季节换算', () => {
  it('month = ceil(day/30)：day 1→1 月、30→1 月、31→2 月、90→3 月、120→4 月', () => {
    expect(monthOf(1)).toBe(1);
    expect(monthOf(30)).toBe(1);
    expect(monthOf(31)).toBe(2);
    expect(monthOf(90)).toBe(3);
    expect(monthOf(120)).toBe(4);
  });

  it('季节：1-3 春 / 4-6 夏 / 7-9 秋 / 10-12 冬（含图标）', () => {
    expect(getSeason(1)).toEqual({ season: '春', icon: '🌱' });
    expect(getSeason(150)).toEqual({ season: '夏', icon: '☀️' });
    expect(getSeason(240)).toEqual({ season: '秋', icon: '🍁' });
    expect(getSeason(330)).toEqual({ season: '冬', icon: '❄️' });
  });
});

describe('体积/保质期兜底与库容', () => {
  it('getItemVolume/getItemExpiry 缺省兜底（1 / -1）', () => {
    expect(getItemVolume({})).toBe(1);
    expect(getItemExpiry({})).toBe(-1);
    expect(getItemVolume(makeItem({ volume: 0.5 }))).toBe(0.5);
    expect(getItemExpiry(makeItem({ expiry: 90 }))).toBe(90);
  });

  it('totalVolumeOf = Σ(stock × volume)；categoryVolume 按类目', () => {
    const items = [makeItem({ stock: 2, volume: 3 }), makeItem({ id: 'i2', name: '丝绸', stock: 5, volume: 1, category: '布匹' })];
    expect(totalVolumeOf(items)).toBe(11);
    expect(categoryVolume(items, '食材')).toBe(6);
    expect(categoryVolume(items, '布匹')).toBe(5);
  });

  it('warehouseValue = Σ(stock × cost)', () => {
    const items = [makeItem({ stock: 2, cost: 1.8 }), makeItem({ id: 'i2', name: '丝绸', stock: 5, cost: 5, category: '布匹' })];
    expect(warehouseValue(items)).toBe(28.6);
  });
});

describe('updateExpiry · 陈损递减', () => {
  it('每日递减 1：expiry 5 → 4（status 保持 normal）', () => {
    const { items } = updateExpiry([makeItem({ expiry: 5 })]);
    expect(items[0]!.expiry).toBe(4);
    expect(items[0]!.status).toBe('normal');
  });

  it('expiry 1 → 0 标记 expired 并入陈损列表；expiry 2 → 1 标记 near_expiry', () => {
    const r = updateExpiry([makeItem({ id: 'a', expiry: 1 }), makeItem({ id: 'b', expiry: 2 })]);
    expect(r.expiredIds).toContain('a');
    expect(r.nearIds).toContain('b');
    const a = r.items.find((i) => i.id === 'a')!;
    const b = r.items.find((i) => i.id === 'b')!;
    expect(a.status).toBe('expired');
    expect(a.expiry).toBe(0);
    expect(b.status).toBe('near_expiry');
    expect(b.expiry).toBe(1);
  });

  it('-1 永不过期：expiry 保持 -1、不入陈损/临期列表', () => {
    const r = updateExpiry([makeItem({ expiry: -1 })]);
    expect(r.items[0]!.expiry).toBe(-1);
    expect(r.expiredIds).toHaveLength(0);
    expect(r.nearIds).toHaveLength(0);
  });
});

describe('removeExpiredGoods · 陈损清理', () => {
  it('移除 status=expired 的商品，totalLoss = Σ(cost × stock)', () => {
    const { remainingItems, expiredItems, totalLoss } = removeExpiredGoods([
      makeItem({ id: 'a', status: 'expired', stock: 4, cost: 2 }),
      makeItem({ id: 'b', name: '米酒', stock: 3, status: 'normal' }),
    ]);
    expect(expiredItems.map((i) => i.id)).toEqual(['a']);
    expect(remainingItems.map((i) => i.id)).toEqual(['b']);
    expect(totalLoss).toBe(8);
  });

  it('expiry=0 但 status 未标记也按陈损移除（双保险）', () => {
    const { expiredItems } = removeExpiredGoods([makeItem({ id: 'a', expiry: 0 })]);
    expect(expiredItems).toHaveLength(1);
  });
});

describe('getExpiryLabel · 陈损期标签', () => {
  it('档位：-1 可久贮 / 0 已陈损 / 1 今日到期 / 3 即将到期 / 7 尚可 / 8+ 新货', () => {
    expect(getExpiryLabel(-1)).toMatchObject({ text: '可久贮', tone: 'dim' });
    expect(getExpiryLabel(0)).toMatchObject({ text: '已陈损', tone: 'red' });
    expect(getExpiryLabel(1)).toMatchObject({ text: '今日到期', tone: 'red' });
    expect(getExpiryLabel(3)).toMatchObject({ tone: 'orange' });
    expect(getExpiryLabel(7)).toMatchObject({ tone: 'green' });
    expect(getExpiryLabel(12)).toMatchObject({ text: expect.stringContaining('新货'), tone: 'green' });
  });
});

describe('calculateStorageCost · 仓储费', () => {
  it('未超免费上限（170）不收费', () => {
    expect(calculateStorageCost(makeState({ shopItems: [makeItem({ stock: 10, volume: 1 })], day: 1 }))).toBe(0);
  });

  it('超限：超过 freeStorageLimit 部分每 10 单位每日 1 两，月初扣整月（×30）', () => {
    // 200 单位（超 30）→ 每日 ceil(30/10)=3 → 月费 90
    const state = makeState({ shopItems: [makeItem({ stock: 200, volume: 1 })], day: 31 });
    expect(calculateStorageCost(state)).toBe(90);
  });

  it('夏季（5-7 月）食材费翻倍「暑热难贮，需加冰鉴」', () => {
    // 200 单位全为食材（超 30）→ 每日基础 3 + 食材加倍 3 = 6 → 月费 180（day 150 = 5 月）
    const state = makeState({ shopItems: [makeItem({ stock: 200, volume: 1, category: '食材' })], day: 150 });
    expect(calculateStorageCost(state)).toBe(180);
  });

  it('冬季（11-1 月）布匹费 +50%「冬湿需防潮，多加炭火烘烤」', () => {
    // 200 单位全为布匹（超 30）→ 每日基础 3 + 布匹加 50%（ceil(3×0.5)=2） = 5 → 月费 150（day 330 = 11 月）
    const state = makeState({ shopItems: [makeItem({ stock: 200, volume: 1, category: '布匹' })], day: 330 });
    expect(calculateStorageCost(state)).toBe(150);
  });

  it('非夏冬季不修正（秋日食材无加倍）', () => {
    const state = makeState({ shopItems: [makeItem({ stock: 200, volume: 1, category: '食材' })], day: 240 }); // 8 月
    expect(calculateStorageCost(state)).toBe(90);
  });
});

describe('库房扩建', () => {
  it('等级 1→5 容量：200/250/300/350/400', () => {
    expect(maxStorageForLevel(1)).toBe(200);
    expect(maxStorageForLevel(2)).toBe(250);
    expect(maxStorageForLevel(5)).toBe(400);
  });

  it('费用 = 等级×200、耗时 = 等级×3', () => {
    expect(expandWarehouseCost(1)).toBe(200);
    expect(expandWarehouseCost(4)).toBe(800);
    expect(expandWarehouseDuration(1)).toBe(3);
    expect(expandWarehouseDuration(4)).toBe(12);
  });

  it('库房健康度：空仓 100、满仓 0、半仓 50', () => {
    const state = makeState({ shopItems: [makeItem({ stock: 0 })], maxStorage: 200 });
    expect(warehouseHealth(state)).toBe(100);
    const full = makeState({ shopItems: [makeItem({ stock: 200, volume: 1 })], maxStorage: 200 });
    expect(warehouseHealth(full)).toBe(0);
    const half = makeState({ shopItems: [makeItem({ stock: 100, volume: 1 })], maxStorage: 200 });
    expect(warehouseHealth(half)).toBe(50);
  });
});
