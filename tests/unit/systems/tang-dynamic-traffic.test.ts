/**
 * 动态客流单测（TANG-TRF-001 模块一）
 * 覆盖：客人数公式（最低 2 上限 20、评分/声望贡献、随机浮动 -1..2）、
 *       评分四档类型权重表、接待策略三档（亲力亲为/择要接待/全托伙计）、
 *       加权客流生成（动态人数 + 回头客 20% 保留）。
 */
import { describe, expect, it } from 'vitest';
import {
  applyReceptionStrategy,
  calculateDailyGuestCount,
  calculateGuestTypeWeights,
  distributeTrafficTypes,
  generateDailyGuestsWithWeights,
} from '@/systems/tang-dynamic-traffic';
import type { KnownGuestRecord } from '@/types/tang-manager';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

describe('calculateDailyGuestCount · 客人数公式（用户 1.1 逐字）', () => {
  it('公式：基础 2 + floor(score×1.5) + floor(reputation/150) + randomInt(-1,2)', () => {
    // score=2.0 → floor(3)=3；reputation=300 → floor(2)=2；基础 2
    // rng=0 → randomInt=-1 → 2+3+2-1 = 6
    expect(calculateDailyGuestCount({ score: 2.0, reputation: 300 }, () => 0)).toBe(6);
    // rng=0.999 → randomInt=2 → 2+3+2+2 = 9
    expect(calculateDailyGuestCount({ score: 2.0, reputation: 300 }, () => 0.999)).toBe(9);
  });

  it('最低 2：评分声望极低且随机浮动为负时钳制到 2', () => {
    expect(calculateDailyGuestCount({ score: 0, reputation: 0 }, () => 0)).toBe(2);
  });

  it('上限 20：评分声望极高时钳制到 20', () => {
    // 2 + floor(5×1.5=7) + floor(2000/150=13) + delta(-1..2) = 21..24 → 20
    expect(calculateDailyGuestCount({ score: 5.0, reputation: 2000 }, () => 0)).toBe(20);
    expect(calculateDailyGuestCount({ score: 5.0, reputation: 2000 }, () => 0.999)).toBe(20);
  });

  it('声望贡献按 150 取整：reputation 149→0、150→1（rng=0.5 → randomInt=1）', () => {
    // 2 + 0 + floor(149/150)=0 + 1 = 3；2 + 0 + floor(150/150)=1 + 1 = 4
    expect(calculateDailyGuestCount({ score: 0, reputation: 149 }, () => 0.5)).toBe(3);
    expect(calculateDailyGuestCount({ score: 0, reputation: 150 }, () => 0.5)).toBe(4);
  });
});

describe('calculateGuestTypeWeights · 评分四档权重表（用户 1.1 逐字）', () => {
  it('<2.0：normal65/big10/special10/help10/observe5', () => {
    expect(calculateGuestTypeWeights({ score: 1.0 })).toEqual({ normal: 65, big_order: 10, special: 10, help: 10, observe: 5 });
  });

  it('2.0-3.5：normal50/big15/special15/help10/observe10（2.0 与 3.4 同档）', () => {
    const w2 = calculateGuestTypeWeights({ score: 2.0 });
    const w34 = calculateGuestTypeWeights({ score: 3.4 });
    expect(w2).toEqual({ normal: 50, big_order: 15, special: 15, help: 10, observe: 10 });
    expect(w34).toEqual(w2);
  });

  it('3.5-4.5：normal35/big20/special20/help10/observe15（3.5 与 4.4 同档）', () => {
    const w35 = calculateGuestTypeWeights({ score: 3.5 });
    const w44 = calculateGuestTypeWeights({ score: 4.4 });
    expect(w35).toEqual({ normal: 35, big_order: 20, special: 20, help: 10, observe: 15 });
    expect(w44).toEqual(w35);
  });

  it('≥4.5：normal25/big25/special25/help10/observe15', () => {
    expect(calculateGuestTypeWeights({ score: 4.5 })).toEqual({ normal: 25, big_order: 25, special: 25, help: 10, observe: 15 });
    expect(calculateGuestTypeWeights({ score: 5.0 })).toEqual({ normal: 25, big_order: 25, special: 25, help: 10, observe: 15 });
  });
});

describe('applyReceptionStrategy · 接待策略三档（用户 1.2 逐字）', () => {
  const normalGuest = { id: 'g1', name: '李四', type: 'normal' as const, description: 'x', baseConsumption: 10, mentalOS: null, handled: false };
  const bigOrderGuest = { ...normalGuest, id: 'g2', type: 'big_order' as const };

  it('亲力亲为 all：一律亲接（personal）', () => {
    expect(applyReceptionStrategy(normalGuest, 'all').mode).toBe('personal');
    expect(applyReceptionStrategy(bigOrderGuest, 'all').mode).toBe('personal');
  });

  it('全托伙计 delegate：一律指派（收益 ×0.7~0.8、无精力消耗、不走偏好匹配由 store 接线）', () => {
    const r = applyReceptionStrategy(normalGuest, 'delegate', () => 0.5);
    expect(r.mode).toBe('delegated');
    // 0.7 + 0.5×0.1 = 0.75 → 10 × 0.75 = 7.5
    expect(r.delegatedIncome).toBe(7.5);
  });

  it('择要接待 priority：大单/特殊亲接，其余指派', () => {
    expect(applyReceptionStrategy(bigOrderGuest, 'priority').mode).toBe('personal');
    const special = { ...normalGuest, id: 'g3', type: 'special' as const };
    expect(applyReceptionStrategy(special, 'priority').mode).toBe('personal');
    const delegated = applyReceptionStrategy(normalGuest, 'priority', () => 0.5);
    expect(delegated.mode).toBe('delegated');
    expect(delegated.delegatedIncome).toBe(7.5);
  });
});

describe('generateDailyGuestsWithWeights · 动态客流生成（替代旧函数，回头客保留）', () => {
  it('动态人数：score=2/reputation=0 + rng=0.5 → 6 位；类型按二档权重', () => {
    const guests = generateDailyGuestsWithWeights(
      { shopType: 'jiulou', difficulty: 'B', score: 2.0, reputation: 0 },
      () => 0.5
    );
    expect(guests).toHaveLength(6);
    const count = (t: string): number => guests.filter((g) => g.type === t).length;
    // 权重 50/15/15/10/10 × 6：期望 3/0.9/0.9/0.6/0.6 → 取整 3 + 补齐 big/special/help
    expect(count('normal')).toBe(3);
    expect(count('big_order')).toBe(1);
    expect(count('special')).toBe(1);
    expect(count('help')).toBe(1);
    expect(guests.every((g) => !g.handled)).toBe(true);
  });

  it('回头客 20% 逻辑保留：knownGuests 非空且 rng<0.2 → 含一位继承数据的熟客', () => {
    const known: Record<string, KnownGuestRecord> = {
      胡商: {
        level: 'gold',
        totalSpent: 200,
        visitCount: 2,
        preferences: [{ type: 'item', value: '米酒', revealed: true }],
        lastVisit: 3,
        consumptionMultiplier: 1.5,
      },
    };
    const guests = generateDailyGuestsWithWeights(
      { shopType: 'jiulou', difficulty: 'B', score: 2.0, reputation: 0, knownGuests: known, day: 5 },
      () => 0.1
    );
    const returning = guests.find((g) => g.name === '胡商');
    expect(returning).toBeDefined();
    expect(returning!.visitCount).toBe(3);
    expect(returning!.guestLevel).toBe('gold');
    expect(returning!.preferences![0]!.revealed).toBe(true); // 第三次来访自动揭示
  });

  it('回头客不触发：rng≥0.2 → 全为新客', () => {
    const known: Record<string, KnownGuestRecord> = {
      胡商: { level: 'silver', totalSpent: 80, visitCount: 1, preferences: [], lastVisit: 1 },
    };
    const guests = generateDailyGuestsWithWeights(
      { shopType: 'jiulou', difficulty: 'B', score: 2.0, reputation: 0, knownGuests: known },
      () => 0.9
    );
    expect(guests.every((g) => g.name !== '胡商')).toBe(true);
  });
});

describe('distributeTrafficTypes · 权重摊分', () => {
  it('权重摊满 count 位且类型合法', () => {
    const types = distributeTrafficTypes({ normal: 65, big_order: 10, special: 10, help: 10, observe: 5 }, 10, seq(0.5));
    expect(types).toHaveLength(10);
    for (const t of types) {
      expect(['normal', 'big_order', 'special', 'help', 'observe']).toContain(t);
    }
  });
});
