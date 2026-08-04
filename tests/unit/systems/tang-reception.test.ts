/**
 * 接待系统单测（tang-reception）
 * 覆盖：normal 收益区间/精力-5/20%声望；mind_read 消耗次数/精力-10/OS 填充/40%上浮；
 *       reject 0 收益/30%评分-0.02/help 额外声望-2；insightRemaining<=0 时 mind_read 返回 null；
 *       Step 3 3.2 反噬（B 3 次/C 2 次触发、反讽池、A 无反噬）、污染（幻觉池）、
 *       3.4 投诉（普通 10%、差评师 100%、消费减半/评分-0.02）、markContaminatedGuests。
 * 注：normal 分支新增投诉判定消耗 1 次 rng（普通 10%），贴边测试改用序列 rng 避开。
 */
import { describe, expect, it } from 'vitest';
import {
  BACKLASH_OS,
  computeStockInfo,
  desiredItemForGuest,
  handleGuest,
  markContaminatedGuests,
} from '@/systems/tang-reception';
import { GUEST_OS_POOLS, HALLUCINATION_OS_POOL, REVERSE_OS_POOL } from '@/config/tang-guest-content';
import type { Guest, ShopItem } from '@/types/tang-manager';

function makeItem(overrides: Partial<ShopItem> = {}): ShopItem {
  return {
    id: 'i1',
    name: '米酒',
    price: 1,
    cost: 0.6,
    stock: 10,
    category: '食材',
    volume: 1,
    expiry: 90,
    status: 'normal',
    ...overrides,
  };
}

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    name: '李四',
    type: 'normal',
    description: '点了店里最贵的菜。',
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

describe('handleGuest · normal', () => {
  it('收益 = baseConsumption × (0.8~1.2)，精力-5，review=good', () => {
    const guest = makeGuest({ baseConsumption: 4 });
    // rng=0.5 → 倍率 0.8+0.5*0.4 = 1.0 → 收益 4.0（投诉判定 0.5≥0.1 不触发）
    const result = handleGuest(guest, 'normal', { insightRemaining: 3 }, () => 0.5)!;
    expect(result.income).toBe(4.0);
    expect(result.energyConsumed).toBe(5);
    expect(result.review).toBe('good');
    expect(result.usedMindRead).toBe(false);
    expect(result.scoreChange).toBe(0);
  });

  it('收益区间：rng 贴边 0 → ×0.8；贴边 0.99 → ×1.196（<1.2）', () => {
    const guest = makeGuest({ baseConsumption: 5 });
    // 序列：0(基础倍率×0.8) → 0.9(投诉不触发)
    const low = handleGuest(guest, 'normal', { insightRemaining: 3 }, seq(0, 0.9))!;
    expect(low.income).toBe(4.0);
    const high = handleGuest(guest, 'normal', { insightRemaining: 3 }, () => 0.99)!;
    expect(high.income).toBeLessThanOrEqual(6.0);
    expect(high.income).toBeGreaterThan(5.0);
  });

  it('20% 概率声望+1（rng<0.2 触发）', () => {
    const guest = makeGuest();
    const praise = handleGuest(guest, 'normal', { insightRemaining: 3 }, () => 0.1)!;
    expect(praise.reputationChange).toBe(1);
    const noPraise = handleGuest(guest, 'normal', { insightRemaining: 3 }, () => 0.9)!;
    expect(noPraise.reputationChange).toBe(0);
  });
});

describe('handleGuest · mind_read', () => {
  it('消耗通晓人心（标记 usedMindRead），精力-10，OS 填充自类型池', () => {
    const guest = makeGuest({ type: 'normal' });
    const result = handleGuest(guest, 'mind_read', { insightRemaining: 3 }, () => 0.5)!;
    expect(result.usedMindRead).toBe(true);
    expect(result.energyConsumed).toBe(10);
    expect(result.review).toBe('good');
    expect(GUEST_OS_POOLS[guest.type]).toContain(result.mentalOS);
  });

  it('40% 概率收益上浮 10-30%（在 normal 收益基础上）', () => {
    const guest = makeGuest({ baseConsumption: 4 });
    // 序列：0.5(基础倍率=1.0) → 0(OS 取第 0 条) → 0.3(<0.4 触发上浮) → 0.5(上浮 +20%)
    const result = handleGuest(guest, 'mind_read', { insightRemaining: 3 }, seq(0.5, 0, 0.3, 0.5))!;
    expect(result.income).toBeCloseTo(4 * 1.2, 5); // 4 × (1.1 + 0.5*0.2) = 4.8
  });

  it('未触发上浮时收益与 normal 一致', () => {
    const guest = makeGuest({ baseConsumption: 4 });
    // 序列：0.5(倍率1.0) → 0(OS) → 0.9(不触发上浮)
    const result = handleGuest(guest, 'mind_read', { insightRemaining: 3 }, seq(0.5, 0, 0.9))!;
    expect(result.income).toBe(4.0);
  });

  it('mind_read 不触发 normal 的 20% 声望', () => {
    const guest = makeGuest();
    const result = handleGuest(guest, 'mind_read', { insightRemaining: 3 }, () => 0.1)!;
    expect(result.reputationChange).toBe(0);
  });

  it('通晓人心次数不足时返回 null（纯函数防御）', () => {
    const guest = makeGuest();
    expect(handleGuest(guest, 'mind_read', { insightRemaining: 0 }, () => 0.5)).toBeNull();
  });

  it('mind_read 不触发投诉（complaintTriggered 为 undefined）', () => {
    const guest = makeGuest();
    const result = handleGuest(guest, 'mind_read', { insightRemaining: 3 }, () => 0.05)!;
    expect(result.complaintTriggered).toBeUndefined();
  });
});

describe('handleGuest · reject', () => {
  it('收益 0、精力 0、review=bad', () => {
    const guest = makeGuest();
    const result = handleGuest(guest, 'reject', { insightRemaining: 3 }, () => 0.5)!;
    expect(result.income).toBe(0);
    expect(result.energyConsumed).toBe(0);
    expect(result.review).toBe('bad');
    expect(result.usedMindRead).toBe(false);
  });

  it('30% 概率评分-0.02（rng<0.3 触发）', () => {
    const guest = makeGuest();
    const hit = handleGuest(guest, 'reject', { insightRemaining: 3 }, () => 0.2)!;
    expect(hit.scoreChange).toBe(-0.02);
    const miss = handleGuest(guest, 'reject', { insightRemaining: 3 }, () => 0.9)!;
    expect(miss.scoreChange).toBe(0);
  });

  it('type=help 额外声望-2；普通客人声望 0', () => {
    const help = makeGuest({ type: 'help' });
    const helpResult = handleGuest(help, 'reject', { insightRemaining: 3 }, () => 0.9)!;
    expect(helpResult.reputationChange).toBe(-2);
    const normal = makeGuest({ type: 'normal' });
    const normalResult = handleGuest(normal, 'reject', { insightRemaining: 3 }, () => 0.9)!;
    expect(normalResult.reputationChange).toBe(0);
  });
});

describe('反噬（3.2）', () => {
  it('B 难度第 3 次对同一身份 mind_read 触发反噬：固定警示 OS、消费砍半、评分-0.05', () => {
    const guest = makeGuest({ baseConsumption: 4 });
    const result = handleGuest(
      guest,
      'mind_read',
      { insightRemaining: 3, difficulty: 'B', insightUsedOnNPC: 2 },
      () => 0.5
    )!;
    expect(result.backlashTriggered).toBe(true);
    expect(result.mentalOS).toBe(BACKLASH_OS);
    expect(result.income).toBe(2.0); // 4 × 1.0 / 2
    expect(result.scoreChange).toBe(-0.05);
    expect(result.review).toBe('good');
  });

  it('C 难度第 2 次对同一身份 mind_read 触发反噬', () => {
    const guest = makeGuest({ baseConsumption: 4 });
    const result = handleGuest(
      guest,
      'mind_read',
      { insightRemaining: 3, difficulty: 'C', insightUsedOnNPC: 1 },
      () => 0.5
    )!;
    expect(result.backlashTriggered).toBe(true);
    expect(result.mentalOS).toBe(BACKLASH_OS);
  });

  it('A 难度无反噬：累计再多也走正常 OS 池', () => {
    const guest = makeGuest();
    const result = handleGuest(
      guest,
      'mind_read',
      { insightRemaining: 3, difficulty: 'A', insightUsedOnNPC: 99 },
      seq(0.5, 0, 0.9)
    )!;
    expect(result.backlashTriggered).toBeUndefined();
    expect(result.usedReverseOS).toBeUndefined();
    expect(GUEST_OS_POOLS[guest.type]).toContain(result.mentalOS);
  });

  it('反噬后同一身份再次 mind_read：OS 从反讽/假信息池抽取', () => {
    const guest = makeGuest();
    const result = handleGuest(
      guest,
      'mind_read',
      { insightRemaining: 3, difficulty: 'B', insightUsedOnNPC: 3 },
      seq(0.5, 0, 0.9)
    )!;
    expect(result.backlashTriggered).toBeUndefined();
    expect(result.usedReverseOS).toBe(true);
    expect(REVERSE_OS_POOL).toContain(result.mentalOS);
  });

  it('污染客人 mind_read：OS 从幻觉池抽取且标记 contaminated', () => {
    const guest = makeGuest({ contaminated: true });
    const result = handleGuest(
      guest,
      'mind_read',
      { insightRemaining: 3, difficulty: 'B', insightUsedOnNPC: 0 },
      seq(0.5, 0, 0.9)
    )!;
    expect(result.contaminated).toBe(true);
    expect(HALLUCINATION_OS_POOL).toContain(result.mentalOS);
  });
});

describe('markContaminatedGuests（3.2 污染标记）', () => {
  it('insightUsedTotal 未达阈值（B 30）不标记', () => {
    const guests = [makeGuest({ id: 'a' }), makeGuest({ id: 'b' })];
    const out = markContaminatedGuests(guests, 29, 'B', () => 0.5);
    expect(out.every((g) => !g.contaminated)).toBe(true);
  });

  it('insightUsedTotal 达阈值后随机标记 1-2 位（rng<0.5 → 1 位；rng≥0.5 → 2 位）', () => {
    const guests = [makeGuest({ id: 'a' }), makeGuest({ id: 'b' }), makeGuest({ id: 'c' })];
    const one = markContaminatedGuests(guests, 30, 'B', () => 0.4);
    expect(one.filter((g) => g.contaminated).length).toBe(1);
    // 序列：0.6(≥0.5 → 2 位) → 0.1(idx=0) → 0.8(idx=2) 标记两位不同客人
    const two = markContaminatedGuests(guests, 30, 'B', seq(0.6, 0.1, 0.8));
    expect(two.filter((g) => g.contaminated).length).toBe(2);
  });
});

describe('投诉（3.4）', () => {
  it('普通客人 10% 触发投诉：消费减半、评分-0.02（rng<0.1）', () => {
    const guest = makeGuest({ baseConsumption: 4 });
    // 序列：0.5(倍率1.0) → 0.05(<0.1 触发投诉) → 0.9(声望 0)
    const result = handleGuest(guest, 'normal', { insightRemaining: 3 }, seq(0.5, 0.05, 0.9))!;
    expect(result.complaintTriggered).toBe(true);
    expect(result.income).toBe(2.0); // 4 / 2
    expect(result.scoreChange).toBe(-0.02);
    expect(result.review).toBe('good');
  });

  it('普通客人 rng≥0.1 不触发投诉', () => {
    const guest = makeGuest();
    const result = handleGuest(guest, 'normal', { insightRemaining: 3 }, seq(0.5, 0.2, 0.9))!;
    expect(result.complaintTriggered).toBeUndefined();
    expect(result.income).toBe(4.0);
  });

  it('差评师 100% 触发投诉（不看 rng）', () => {
    const guest = makeGuest({ baseConsumption: 4, isBadReviewer: true });
    const result = handleGuest(guest, 'normal', { insightRemaining: 3 }, () => 0.5)!;
    expect(result.complaintTriggered).toBe(true);
    expect(result.income).toBe(2.0);
    expect(result.scoreChange).toBe(-0.02);
  });
});

// ============================================================
// Step 5b-1.5：库存联动（缺货 / 品类充足 / 连续缺货）
// ============================================================

describe('desiredItemForGuest / computeStockInfo · 库存联动', () => {
  it('客人所需商品按店型与类型映射；缺货判定正确', () => {
    const guest = makeGuest({ type: 'big_order' });
    expect(desiredItemForGuest('jiulou', guest)).toBe('酱牛肉');
    expect(desiredItemForGuest('buzhuang', guest)).toBe('锦缎');
    const items = [makeItem({ name: '米酒', stock: 5 })];
    const info = computeStockInfo(items, 'jiulou', makeGuest({ type: 'normal' }), 0);
    expect(info.missingGood).toBe(false); // 米酒有货
    const noStock = computeStockInfo([makeItem({ name: '米酒', stock: 0 })], 'jiulou', makeGuest({ type: 'normal' }), 0);
    expect(noStock.missingGood).toBe(true);
  });

  it('storyTag 关键词优先：含「酒」→ 米酒', () => {
    expect(desiredItemForGuest('jiulou', makeGuest({ storyTag: '送别酒' }))).toBe('米酒');
  });

  it('品类充足：去重品类 >15 → varietyBonus=true', () => {
    const many = Array.from({ length: 16 }, (_, i) => makeItem({ id: `i${i}`, name: `品${i}`, stock: 1 }));
    expect(computeStockInfo(many, 'jiulou', makeGuest(), 0).varietyBonus).toBe(true);
    expect(computeStockInfo([makeItem()], 'jiulou', makeGuest(), 0).varietyBonus).toBe(false);
  });

  it('连续缺货 ≥3 日 → lostCustomerRisk=true', () => {
    expect(computeStockInfo([], 'jiulou', makeGuest(), 3).lostCustomerRisk).toBe(true);
    expect(computeStockInfo([], 'jiulou', makeGuest(), 2).lostCustomerRisk).toBe(false);
  });
});

describe('handleGuest · 库存联动数值', () => {
  it('缺货：消费减两成（×0.8）；rng 0.5 → 基础 4.0 → 3.2', () => {
    const result = handleGuest(makeGuest({ baseConsumption: 4 }), 'normal', { insightRemaining: 3, stockInfo: { missingGood: true, varietyBonus: false, lostCustomerRisk: false } }, () => 0.5)!;
    expect(result.income).toBe(3.2);
  });

  it('品类充足：消费上浮 5%（×1.05）', () => {
    const result = handleGuest(makeGuest({ baseConsumption: 4 }), 'normal', { insightRemaining: 3, stockInfo: { missingGood: false, varietyBonus: true, lostCustomerRisk: false } }, () => 0.5)!;
    expect(result.income).toBe(4.2); // 4 × 1.05
  });

  it('连续缺货（主顾流失）：再减 15%（×0.85）', () => {
    const result = handleGuest(makeGuest({ baseConsumption: 4 }), 'normal', { insightRemaining: 3, stockInfo: { missingGood: true, varietyBonus: false, lostCustomerRisk: true } }, () => 0.5)!;
    expect(result.income).toBe(2.7); // 4 × 0.8 × 0.85 = 2.72 → round1 2.7
  });

  it('无 stockInfo 时行为不变（兼容既有调用）', () => {
    const result = handleGuest(makeGuest({ baseConsumption: 4 }), 'normal', { insightRemaining: 3 }, () => 0.5)!;
    expect(result.income).toBe(4.0);
  });
});
