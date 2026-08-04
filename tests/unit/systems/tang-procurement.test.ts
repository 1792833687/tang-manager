/**
 * 进货策略系统单测（tang-procurement · Step 5b-1.5 模块二）
 * 覆盖：批量折扣 4 档阶梯、籴粜契定金与到期入库、挂牌生成与购买、次品概率按难度与辨货技能。
 */
import { describe, expect, it } from 'vitest';
import {
  bulkDiscountFor,
  calculateBulkPrice,
  checkDefectiveGoods,
  checkForwardContracts,
  createForwardContract,
  generateMarketListings,
  hasGoodEyeEmployee,
  purchaseListing,
} from '@/systems/tang-procurement';
import type { ShopItem, TangGameState } from '@/types/tang-manager';

function makeItem(overrides: Partial<ShopItem> = {}): ShopItem {
  return {
    id: 'i1',
    name: '羊肉',
    price: 3,
    cost: 1.8,
    stock: 20,
    category: '食材',
    volume: 3,
    expiry: 10,
    status: 'normal',
    ...overrides,
  };
}

function makeState(overrides: Partial<TangGameState> = {}): Partial<TangGameState> {
  return {
    shopItems: [makeItem()],
    day: 1,
    difficulty: 'B',
    forwardContracts: [],
    employees: [],
    ...overrides,
  };
}

const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

describe('批量折扣阶梯', () => {
  it('1-9 原价 / 10-29 九折 / 30-49 八折 / 50+ 七折', () => {
    expect(bulkDiscountFor(1)).toBe(1);
    expect(bulkDiscountFor(9)).toBe(1);
    expect(bulkDiscountFor(10)).toBe(0.9);
    expect(bulkDiscountFor(29)).toBe(0.9);
    expect(bulkDiscountFor(30)).toBe(0.8);
    expect(bulkDiscountFor(49)).toBe(0.8);
    expect(bulkDiscountFor(50)).toBe(0.7);
    expect(bulkDiscountFor(200)).toBe(0.7);
  });

  it('calculateBulkPrice：单价 = 原价×折扣、总价 = 单价×数量', () => {
    const r = calculateBulkPrice(3, 20); // 九折：2.7 × 20 = 54
    expect(r.discount).toBe(0.9);
    expect(r.unitPrice).toBe(2.7);
    expect(r.totalCost).toBe(54);
    const r50 = calculateBulkPrice(3, 50); // 七折：2.1 × 50 = 105
    expect(r50.unitPrice).toBe(2.1);
    expect(r50.totalCost).toBe(105);
  });

  it('数量下限 1（quantity=0 按 1 处理）', () => {
    expect(calculateBulkPrice(3, 0).totalCost).toBe(3);
  });
});

describe('籴粜契（远期收购契约）', () => {
  it('预购价 = 市价×0.7、定金 = 总价三成', () => {
    const c = createForwardContract({ item: makeItem({ price: 3 }), quantity: 10, basePrice: 3, deliveryDay: 8, day: 1 });
    expect(c.unitPrice).toBe(2.1);
    expect(c.totalPrice).toBe(21);
    expect(c.deposit).toBe(6.3);
    expect(c.deliveryDay).toBe(8);
    expect(c.status).toBe('pending');
  });

  it('到期（deliveryDay ≤ day）自动入库，状态置 delivered，返回实际入库量', () => {
    const c = createForwardContract({ item: makeItem({ price: 3 }), quantity: 10, basePrice: 3, deliveryDay: 8, day: 1 });
    const state = makeState({ forwardContracts: [c], day: 8, difficulty: 'B' });
    // rng 0.9 ≥ 触发概率 0.2+0.1 → 无次品
    const { delivered, contracts } = checkForwardContracts(state, () => 0.9);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.actualQuantity).toBe(10);
    expect(delivered[0]!.loss).toBe(0);
    expect(contracts[0]!.status).toBe('delivered');
  });

  it('未到期不触发到货', () => {
    const c = createForwardContract({ item: makeItem(), quantity: 5, basePrice: 3, deliveryDay: 8, day: 1 });
    const { delivered } = checkForwardContracts(makeState({ forwardContracts: [c], day: 7 }), () => 0.9);
    expect(delivered).toHaveLength(0);
  });
});

describe('市易务挂牌', () => {
  it('生成 1-2 个挂牌：优先库存低商品、五至八折、限购 20-100、仅当日', () => {
    const low = makeItem({ id: 'low', name: '锦缎', stock: 1, price: 15 });
    const high = makeItem({ id: 'high', name: '丝绸', stock: 100, price: 8 });
    const listings = generateMarketListings({ shopItems: [high, low], day: 5, rng: seq(0.9, 0.5, 0.5) });
    expect(listings.length).toBeGreaterThanOrEqual(1);
    expect(listings.length).toBeLessThanOrEqual(2);
    // 第一候选为库存最低的锦缎
    expect(listings[0]!.itemName).toBe('锦缎');
    for (const l of listings) {
      expect(l.discount).toBeGreaterThanOrEqual(0.5);
      expect(l.discount).toBeLessThanOrEqual(0.8);
      expect(l.maxQuantity).toBeGreaterThanOrEqual(20);
      expect(l.maxQuantity).toBeLessThanOrEqual(100);
      expect(l.day).toBe(5);
      expect(l.listedPrice).toBeLessThan(l.originalPrice);
    }
  });

  it('购买：扣现银、入库 actualGoodQuantity、扣 remainingToday；次品概率按难度+一成', () => {
    const listing = {
      id: 'ml-1', itemName: '羊肉', originalPrice: 3, listedPrice: 2.4, discount: 0.8,
      maxQuantity: 50, remainingToday: 50, day: 1,
    };
    // 序列：0.1(触发次品 0.2+0.1) → 0.5(次品率 0.1+0.5*0.2=0.2 → 实际 8)
    const r = purchaseListing({
      listing, quantity: 10, silver: 100, difficulty: 'B', employees: [], rng: seq(0.1, 0.5),
    });
    expect(r.ok).toBe(true);
    expect(r.actualGoodQuantity).toBe(8); // 10 × (1-0.2)
    expect(r.loss).toBe(2);
    expect(r.cost).toBe(24); // 2.4 × 10（含次品全额计价）
    expect(r.listing.remainingToday).toBe(40);
  });

  it('超限购/现银不足拒绝', () => {
    const listing = { id: 'ml-1', itemName: '羊肉', originalPrice: 3, listedPrice: 2.4, discount: 0.8, maxQuantity: 5, remainingToday: 5, day: 1 };
    const over = purchaseListing({ listing, quantity: 10, silver: 100, difficulty: 'B', employees: [] });
    expect(over.ok).toBe(false);
    const poor = purchaseListing({ listing, quantity: 1, silver: 1, difficulty: 'B', employees: [] });
    expect(poor.ok).toBe(false);
    expect(poor.reason).toContain('现银不足');
  });
});

describe('次品检测（checkDefectiveGoods）', () => {
  it('A 难度：半成概率（rng<0.05）触发半成至一成次品率', () => {
    const noDefect = checkDefectiveGoods(100, 'A', 0, false, () => 0.9);
    expect(noDefect.isDefective).toBe(false);
    const defect = checkDefectiveGoods(100, 'A', 0, false, seq(0.01, 0.5));
    expect(defect.isDefective).toBe(true);
    expect(defect.defectiveRate).toBeGreaterThanOrEqual(0.05);
    expect(defect.defectiveRate).toBeLessThanOrEqual(0.1);
  });

  it('B 难度：二成概率触发一成至三成', () => {
    const noDefect = checkDefectiveGoods(100, 'B', 0, false, () => 0.9);
    expect(noDefect.isDefective).toBe(false);
    const defect = checkDefectiveGoods(100, 'B', 0, false, seq(0.1, 0.5));
    expect(defect.defectiveRate).toBeGreaterThanOrEqual(0.1);
    expect(defect.defectiveRate).toBeLessThanOrEqual(0.3);
  });

  it('C 难度：三成五概率触发二成至五成', () => {
    const defect = checkDefectiveGoods(100, 'C', 0, false, seq(0.3, 0.5));
    expect(defect.isDefective).toBe(true);
    expect(defect.defectiveRate).toBeGreaterThanOrEqual(0.2);
    expect(defect.defectiveRate).toBeLessThanOrEqual(0.5);
  });

  it('籴粜契/挂牌 extraChance+0.1 提高触发概率（B：0.2→0.3，rng=0.25 触发）', () => {
    const normal = checkDefectiveGoods(10, 'B', 0, false, () => 0.25);
    expect(normal.isDefective).toBe(false);
    const boosted = checkDefectiveGoods(10, 'B', 0.1, false, () => 0.25);
    expect(boosted.isDefective).toBe(true);
  });

  it('「辨货」技能（good_eye）次品率减半', () => {
    const without = checkDefectiveGoods(100, 'C', 0, false, seq(0.1, 0.5));
    const withEye = checkDefectiveGoods(100, 'C', 0, true, seq(0.1, 0.5));
    // 次品率 0.35 → 0.175，整数损失 35 → 17（floor），不足严格一半由取整造成
    expect(withEye.defectiveRate).toBeLessThan(without.defectiveRate);
    expect(withEye.loss).toBe(Math.floor(without.loss / 2));
    expect(withEye.actualGoodQuantity).toBe(100 - withEye.loss);
    expect(hasGoodEyeEmployee([{ skills: [{ id: 'good_eye' }] }])).toBe(true);
    expect(hasGoodEyeEmployee([{ skills: [{ id: 'other' }] }])).toBe(false);
  });
});
