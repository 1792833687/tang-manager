/**
 * TANG-POLISH-001 模块一：面板统一化 — 导航顺序铁律 + 快捷键映射验收测试
 *
 * 甲方铁律（v1.0 面板统一化）：12 个一级面板固定顺序
 *   我 → 接待 → 货架 → 账本 → 伙计 → 钱庄 → 舆图 → 门路 → 镖队 → 巍明楼 → 手札录 → 成就
 * 快捷键：1-9 → 前 9 项；0 → 第 10 项；[ → 第 11 项；] → 第 12 项。
 *
 * 防回归点：
 * 1. NAV_ITEMS 顺序被改动（移动端底部栏 / 侧栏 / 快捷键共用同一数组）
 * 2. 快捷键映射与 NAV_ITEMS 顺序脱钩（page.tsx 用 NAV_ITEMS[idx] 取 key）
 * 3. 条件解锁（巍明楼声望/阶段、镖队分店/地图层）逻辑回归
 * 4. 12 面板 key 完整性（PANEL_TITLES/PANEL_CONTENT 依赖 Record<NavItemKey, ...> 编译期校验，
 *    这里补运行期断言：NavItemKey 恰好 12 个且与顺序表一致）
 */
import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, isNavItemUnlocked, type NavItemKey } from '../../../../src/components/nav-sidebar';

/** 甲方铁律顺序（勿改） */
const IRON_ORDER: NavItemKey[] = [
  'me',
  'reception',
  'shelf',
  'ledger',
  'staff',
  'bank',
  'map',
  'faction',
  'caravan',
  'politics',
  'journal',
  'achievement',
];

describe('TANG-POLISH-001 模块一：导航顺序铁律', () => {
  it('NAV_ITEMS 前 12 项与甲方铁律顺序完全一致，第 13 项为店铺管理（2026-08-05 扩展）', () => {
    expect(NAV_ITEMS.length).toBe(13);
    expect(NAV_ITEMS.slice(0, 12).map((item) => item.key)).toEqual(IRON_ORDER);
    expect(NAV_ITEMS[12]!.key).toBe('shop');
  });

  it('NAV_ITEMS 的 key 唯一（无重复面板）', () => {
    const keys = NAV_ITEMS.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('NAV_ITEMS 每项均带短名与图标（底部栏/侧栏依赖）', () => {
    for (const item of NAV_ITEMS) {
      expect(item.short.length).toBeGreaterThan(0);
      expect(item.iconKey.length).toBeGreaterThan(0);
    }
  });
});

describe('TANG-POLISH-001 模块一：快捷键 1-12 映射（与 NAV_ITEMS 顺序一致）', () => {
  /** 与 page.tsx 相同的映射逻辑（保持同步；page.tsx 为 UI 键盘监听不便单测） */
  function keyToIndex(key: string): number {
    if (key >= '1' && key <= '9') return Number(key) - 1;
    if (key === '0') return 9;
    if (key === '[') return 10;
    if (key === ']') return 11;
    return -1;
  }

  it('数字 1-9 映射前 9 项（我→…→镖队）', () => {
    for (let i = 1; i <= 9; i++) {
      const idx = keyToIndex(String(i));
      expect(idx).toBe(i - 1);
      expect(NAV_ITEMS[idx].key).toBe(IRON_ORDER[i - 1]);
    }
  });

  it('数字 0 映射第 10 项（巍明楼）', () => {
    expect(NAV_ITEMS[keyToIndex('0')].key).toBe('politics');
  });

  it('[ 映射第 11 项（手札录）、] 映射第 12 项（成就）', () => {
    expect(NAV_ITEMS[keyToIndex('[')].key).toBe('journal');
    expect(NAV_ITEMS[keyToIndex(']')].key).toBe('achievement');
  });

  it('越界键返回 -1（不触发切换）', () => {
    expect(keyToIndex('/')).toBe(-1);
    expect(keyToIndex('a')).toBe(-1);
  });
});

describe('TANG-POLISH-001 模块一：条件解锁', () => {
  const baseState = { reputation: 0, stage: 1, shopCount: 1, unlockedLayers: [] as readonly string[] };

  it('巍明楼：声望≥700 且 阶段≥3 才解锁', () => {
    expect(isNavItemUnlocked('politics', { ...baseState, reputation: 699, stage: 3 })).toBe(false);
    expect(isNavItemUnlocked('politics', { ...baseState, reputation: 700, stage: 2 })).toBe(false);
    expect(isNavItemUnlocked('politics', { ...baseState, reputation: 700, stage: 3 })).toBe(true);
  });

  it('镖队：分店≥2 且 解锁东市西市 才解锁', () => {
    expect(isNavItemUnlocked('caravan', { ...baseState, shopCount: 2, unlockedLayers: [] })).toBe(false);
    expect(isNavItemUnlocked('caravan', { ...baseState, shopCount: 1, unlockedLayers: ['east_west_market'] })).toBe(false);
    expect(isNavItemUnlocked('caravan', { ...baseState, shopCount: 2, unlockedLayers: ['east_west_market'] })).toBe(true);
  });

  it('其余面板恒显示（含店铺管理 shop）', () => {
    for (const key of IRON_ORDER) {
      if (key === 'politics' || key === 'caravan') continue;
      expect(isNavItemUnlocked(key, baseState)).toBe(true);
    }
    expect(isNavItemUnlocked('shop', baseState)).toBe(true);
  });
});
