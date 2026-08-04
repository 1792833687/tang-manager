/**
 * 客人偏好系统单测（TANG-RCP-001 模块一 tang-guest-preference）
 * 覆盖：生成数量/类型匹配/匹配收益×1.3 不匹配×0.8/三法揭示概率（≥6 用例）。
 */
import { describe, expect, it } from 'vitest';
import {
  checkPreferenceMatch,
  generatePreferences,
  revealPreference,
} from '@/systems/tang-guest-preference';
import type { Guest } from '@/types/tang-manager';

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    name: '李四',
    type: 'normal',
    description: 'x',
    baseConsumption: 4,
    mentalOS: null,
    handled: false,
    ...overrides,
  };
}

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

describe('generatePreferences（1.2 逐字：酒楼 菜品/风格、布庄 面料/风格、药铺 药性/价格）', () => {
  it('生成 1-2 个偏好，全部初始未揭示', () => {
    const prefs = generatePreferences('normal', 'jiulou', () => 0.5);
    expect(prefs.length).toBeGreaterThanOrEqual(1);
    expect(prefs.length).toBeLessThanOrEqual(2);
    expect(prefs.every((p) => !p.revealed)).toBe(true);
    expect(prefs.every((p) => ['item', 'style', 'price'].includes(p.type))).toBe(true);
  });

  it('酒楼偏好类型：item 菜品（值来自米酒/酱牛肉/羊肉/时蔬）或 style 风格', () => {
    const prefs = generatePreferences('normal', 'jiulou', seq(0.1, 0.5)); // 0.1 < 0.6 → item
    expect(prefs[0]!.type).toBe('item');
    expect(['米酒', '酱牛肉', '羊肉', '时蔬']).toContain(prefs[0]!.value);
    const style = generatePreferences('normal', 'jiulou', seq(0.8, 0.2, 0.5)); // 0.8 ≥ 0.6 → style
    expect(style[0]!.type).toBe('style');
    expect(['排场', '精致', '家常', '简朴']).toContain(style[0]!.value);
  });

  it('药铺可生成 price 偏好（药性/价格）', () => {
    const prefs = generatePreferences('normal', 'yaopu', seq(0.9, 0.5)); // 0.9 ≥ 0.6+0.3 → price
    expect(prefs[0]!.type).toBe('price');
    expect(['平价', '高价']).toContain(prefs[0]!.value);
  });

  it('去重：同 type+value 不重复', () => {
    for (let i = 0; i < 30; i++) {
      const prefs = generatePreferences('big_order', 'buzhuang', () => 0.5);
      const keys = prefs.map((p) => `${p.type}:${p.value}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('checkPreferenceMatch（1.1 逐字：已揭示才检测；匹配 ×1.3+10 / 不匹配 ×0.8-5）', () => {
  it('未揭示任何偏好 → matched=null，不做检测（倍率 1 / 满意 0）', () => {
    const guest = makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: false }] });
    const r = checkPreferenceMatch(guest, 'normal');
    expect(r.matched).toBeNull();
    expect(r.incomeMultiplier).toBe(1);
    expect(r.satisfactionDelta).toBe(0);
  });

  it('已揭示 item 偏好 + recommend 命中 → ×1.3 / +10', () => {
    const guest = makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: true }] });
    const r = checkPreferenceMatch(guest, 'recommend', 'i-mijiu', '米酒');
    expect(r.matched).toBe(true);
    expect(r.incomeMultiplier).toBe(1.3);
    expect(r.satisfactionDelta).toBe(10);
  });

  it('已揭示 item 偏好 + recommend 未命中 → ×0.8 / -5', () => {
    const guest = makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: true }] });
    const r = checkPreferenceMatch(guest, 'recommend', 'i-yangrou', '羊肉');
    expect(r.matched).toBe(false);
    expect(r.incomeMultiplier).toBe(0.8);
    expect(r.satisfactionDelta).toBe(-5);
  });

  it('已揭示 style 偏好 + normal 且客型受用 → ×1.3 / +10', () => {
    // 大单客偏好「排场」→ normal 接待命中
    const guest = makeGuest({ type: 'big_order', preferences: [{ type: 'style', value: '排场', revealed: true }] });
    const r = checkPreferenceMatch(guest, 'normal');
    expect(r.matched).toBe(true);
    // 求助客偏好「排场」→ 不受用 → 不匹配
    const help = makeGuest({ type: 'help', preferences: [{ type: 'style', value: '排场', revealed: true }] });
    const r2 = checkPreferenceMatch(help, 'normal');
    expect(r2.matched).toBe(false);
  });

  it('已揭示 price 偏好 + 客单落档 → ×1.3 / +10', () => {
    const guest = makeGuest({ baseConsumption: 3, preferences: [{ type: 'price', value: '平价', revealed: true }] });
    expect(checkPreferenceMatch(guest, 'normal').matched).toBe(true);
    const high = makeGuest({ baseConsumption: 10, preferences: [{ type: 'price', value: '平价', revealed: true }] });
    expect(checkPreferenceMatch(high, 'normal').matched).toBe(false);
  });
});

describe('revealPreference（1.1 逐字：mind_read 100% / observation 50% / regular_visit 第三次自动）', () => {
  it('mind_read 100% 揭示一个偏好，并同步 preferenceRevealed', () => {
    const guest = makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: false }, { type: 'style', value: '家常', revealed: false }] });
    const r = revealPreference(guest, 'mind_read', () => 0.2);
    expect(r.revealed).not.toBeNull();
    expect(r.revealed!.revealed).toBe(true);
    expect(r.guest.preferences!.filter((p) => p.revealed).length).toBe(1);
    expect(r.guest.preferenceRevealed).toBe(true);
    expect(r.allRevealed).toBe(false);
  });

  it('observation 50%：rng<0.5 揭示、rng≥0.5 不揭示', () => {
    const guest = makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: false }] });
    expect(revealPreference(guest, 'observation', () => 0.4).revealed).not.toBeNull();
    expect(revealPreference(guest, 'observation', () => 0.9).revealed).toBeNull();
  });

  it('regular_visit（第三次来访自动）100% 揭示', () => {
    const guest = makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: false }] });
    const r = revealPreference(guest, 'regular_visit', () => 0.99);
    expect(r.revealed).not.toBeNull();
  });

  it('全部已揭示 → allRevealed=true 且不重复揭示', () => {
    const guest = makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: true }] });
    const r = revealPreference(guest, 'mind_read', () => 0.5);
    expect(r.revealed).toBeNull();
    expect(r.allRevealed).toBe(true);
  });
});
