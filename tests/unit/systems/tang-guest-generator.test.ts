/**
 * 客人生成系统单测（tang-guest-generator）
 * 覆盖：固定 5 人、类型分布落在允许区间、名称来自池、基础消费在类型区间（含店型微调）。
 */
import { describe, expect, it } from 'vitest';
import { GUEST_NAME_POOLS } from '@/config/tang-guest-content';
import {
  distributeGuestTypes,
  generateDailyGuests,
} from '@/systems/tang-guest-generator';

/** 固定 rng：返回 0.5（确定性；洗牌/取整均可复现） */
const rng = (): number => 0.5;

describe('distributeGuestTypes（百分比 → 5 人取整分布）', () => {
  it('任意难度恰好摊出 5 人', () => {
    for (const difficulty of ['A', 'B', 'C'] as const) {
      const types = distributeGuestTypes(difficulty, 5);
      expect(types).toHaveLength(5);
      const set = new Set(types);
      for (const t of set) {
        expect(['normal', 'big_order', 'special', 'help', 'observe']).toContain(t);
      }
    }
  });

  it('B 难度分布：普通2/大单1/特殊1/求助1/观察0', () => {
    const types = distributeGuestTypes('B', 5);
    const count = (t: string): number => types.filter((x) => x === t).length;
    expect(count('normal')).toBe(2);
    expect(count('big_order')).toBe(1);
    expect(count('special')).toBe(1);
    expect(count('help')).toBe(1);
    expect(count('observe')).toBe(0);
  });

  it('A 难度分布：普通3/大单1/特殊1（求助与观察权重过小被取整舍去）', () => {
    const types = distributeGuestTypes('A', 5);
    const count = (t: string): number => types.filter((x) => x === t).length;
    expect(count('normal')).toBe(3);
    expect(count('big_order')).toBe(1);
    expect(count('special')).toBe(1);
  });

  it('C 难度分布：普通2/大单1/特殊1/求助1', () => {
    const types = distributeGuestTypes('C', 5);
    const count = (t: string): number => types.filter((x) => x === t).length;
    expect(count('normal')).toBe(2);
    expect(count('big_order')).toBe(1);
    expect(count('special')).toBe(1);
    expect(count('help')).toBe(1);
  });
});

describe('generateDailyGuests', () => {
  it('生成恰好 5 位客人，均未处理', () => {
    const guests = generateDailyGuests('jiulou', 'B', 1, rng);
    expect(guests).toHaveLength(5);
    for (const g of guests) {
      expect(g.handled).toBe(false);
      expect(g.id).toBeTruthy();
      expect(g.mentalOS).toBeNull();
    }
  });

  it('客人名称来自对应类型名称池', () => {
    const guests = generateDailyGuests('jiulou', 'B', 1, rng);
    for (const g of guests) {
      expect(GUEST_NAME_POOLS[g.type]).toContain(g.name);
    }
  });

  it('基础消费落在类型区间（含店型微调 ±10% 内）', () => {
    const guests = generateDailyGuests('jiulou', 'B', 1, rng);
    const range: Record<string, [number, number]> = {
      normal: [2, 5],
      big_order: [8, 15],
      special: [3, 8],
      help: [1, 3],
      observe: [2, 4],
    };
    for (const g of guests) {
      const [min, max] = range[g.type]!;
      expect(g.baseConsumption).toBeGreaterThanOrEqual(min * 0.9);
      expect(g.baseConsumption).toBeLessThanOrEqual(max * 1.1);
    }
  });

  it('店型微调：同难度下布庄客单 ≥ 酒楼（系数 1.1 vs 1.0）', () => {
    const a = generateDailyGuests('jiulou', 'B', 1, rng);
    const b = generateDailyGuests('buzhuang', 'B', 1, rng);
    // 用相同 rng 序列时，仅店型系数不同 → 布庄每单 ≥ 酒楼
    for (let i = 0; i < a.length; i++) {
      expect(b[i]!.baseConsumption).toBeGreaterThanOrEqual(a[i]!.baseConsumption);
    }
  });

  it('day 不影响生成结果数量（数量由难度 guestCount 决定：B 5 / C 6）', () => {
    const b1 = generateDailyGuests('yaopu', 'B', 30, rng);
    const b2 = generateDailyGuests('yaopu', 'B', 45, rng);
    expect(b1).toHaveLength(5);
    expect(b2).toHaveLength(5);
    // Step 5a 1.3：C 难度 6 客
    const c1 = generateDailyGuests('yaopu', 'C', 30, rng);
    expect(c1).toHaveLength(6);
  });

  it('A 难度 5 客、B 难度 5 客', () => {
    expect(generateDailyGuests('jiulou', 'A', 1, rng)).toHaveLength(5);
    expect(generateDailyGuests('jiulou', 'B', 1, rng)).toHaveLength(5);
  });
});
