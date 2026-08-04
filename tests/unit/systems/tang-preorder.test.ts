/**
 * 大单预购单测（TANG-TRF-001 模块二）
 * 覆盖：20% 触发互斥 / 势力特殊事件 / 最多 5 个进行中、
 *       生成按等级（铜/银/金/玉）、总价=零售×1.1~1.3、定金 30%、期限 5-15（势力更紧）、
 *       违约金分级四来源、备货进度、交货结算、逾期违约、三来源叙事。
 */
import { describe, expect, it } from 'vitest';
import {
  checkOverdueOrders,
  checkPreOrderTrigger,
  deliverOrder,
  generateOrderNarrative,
  generatePreOrder,
  getOrderProgress,
  getPreOrderPenalty,
  reserveGoodsForOrder,
} from '@/systems/tang-preorder';
import type { Guest, KnownGuestRecord, PreOrder, PreOrderContext, ShopItem } from '@/types/tang-manager';

function makeItem(overrides: Partial<ShopItem> = {}): ShopItem {
  return {
    id: 'i1',
    name: '米酒',
    price: 2,
    cost: 1,
    stock: 50,
    category: '食材',
    volume: 1,
    expiry: 90,
    status: 'normal',
    ...overrides,
  };
}

const shopItems: ShopItem[] = [
  makeItem(),
  makeItem({ id: 'i2', name: '羊肉', price: 3, category: '食材' }),
  makeItem({ id: 'i3', name: '酱牛肉', price: 5, category: '食材' }),
  makeItem({ id: 'i4', name: '时蔬', price: 1, category: '食材' }),
];

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    name: '胡商',
    type: 'big_order',
    description: '要店里最好的货。',
    baseConsumption: 12,
    mentalOS: null,
    handled: false,
    guestLevel: 'bronze',
    ...overrides,
  };
}

function makeCtx(overrides: Partial<PreOrderContext> = {}): PreOrderContext {
  return { shopType: 'jiulou', day: 10, preOrders: [], shopItems, factionRelationships: {}, ...overrides };
}

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

describe('checkPreOrderTrigger · 触发互斥（用户 2.2）', () => {
  it('大单客 20% 变预购（rng<0.2 → random 来源；与现货互斥）', () => {
    const order = checkPreOrderTrigger(makeGuest(), makeCtx(), () => 0.1);
    expect(order).not.toBeNull();
    expect(order!.source).toBe('random');
    expect(order!.penaltyType).toBe('basic');
    expect(order!.status).toBe('pending');
  });

  it('大单客 80% 现货（rng≥0.2 → 不触发预购）', () => {
    expect(checkPreOrderTrigger(makeGuest(), makeCtx(), () => 0.9)).toBeNull();
  });

  it('普通客人不触发预购（无论 rng）', () => {
    const normal = makeGuest({ type: 'normal' });
    expect(checkPreOrderTrigger(normal, makeCtx(), () => 0.05)).toBeNull();
  });

  it('势力特殊事件：沈听澜 → shen / 谢七 → xie（severe）', () => {
    const shen = checkPreOrderTrigger(makeGuest({ name: '沈听澜', type: 'special' }), makeCtx(), () => 0.9);
    expect(shen).not.toBeNull();
    expect(shen!.source).toBe('shen');
    expect(shen!.penaltyType).toBe('severe');
    const xie = checkPreOrderTrigger(makeGuest({ name: '谢七', type: 'special' }), makeCtx(), () => 0.9);
    expect(xie!.source).toBe('xie');
    expect(xie!.penaltyType).toBe('severe');
  });

  it('势力相关预购：任一派系关系 ≥40 且大单客 10% → faction（记录 factionId）', () => {
    const ctx = makeCtx({ factionRelationships: { xishi: 45 } });
    const order = checkPreOrderTrigger(makeGuest(), ctx, () => 0.05);
    expect(order).not.toBeNull();
    expect(order!.source).toBe('faction');
    expect(order!.factionId).toBe('xishi');
    expect(order!.penaltyType).toBe('severe');
  });

  it('进行中预购 ≥5 不触发（上限保护）', () => {
    const active: PreOrder[] = Array.from({ length: 5 }, (_, i) => ({
      id: `o${i}`,
      guestName: '客',
      guestIdentity: '',
      source: 'random',
      items: [],
      deposit: 1,
      finalPayment: 1,
      totalValue: 2,
      deadline: 20,
      acceptedDay: 1,
      status: 'accepted',
      penaltyType: 'basic',
      narrative: '',
    }));
    const ctx = makeCtx({ preOrders: active });
    expect(checkPreOrderTrigger(makeGuest({ name: '沈听澜' }), ctx, () => 0.1)).toBeNull();
    expect(checkPreOrderTrigger(makeGuest(), ctx, () => 0.1)).toBeNull();
  });
});

describe('generatePreOrder · 按等级生成（用户 2.2 逐字）', () => {
  it('铜客：1-2 种 × 3-10；总价=零售×溢价、定金 30%、期限 5-15', () => {
    const order = generatePreOrder(makeGuest({ guestLevel: 'bronze' }), 'random', makeCtx(), () => 0);
    // rng=0：1 种（米酒）、数量 3、溢价 1.1、期限 5
    expect(order.items.length).toBe(1);
    expect(order.items[0]!.itemName).toBe('米酒');
    expect(order.items[0]!.quantity).toBe(3);
    const retail = 3 * 2; // 米酒价 2
    expect(order.totalValue).toBeCloseTo(retail * 1.1, 5);
    expect(order.deposit).toBeCloseTo(order.totalValue * 0.3, 5);
    expect(order.finalPayment).toBeCloseTo(order.totalValue - order.deposit, 5);
    expect(order.deadline).toBe(15); // day 10 + 5
  });

  it('金客：3 种 × 10（rng=0 确定性）', () => {
    const order = generatePreOrder(makeGuest({ guestLevel: 'gold' }), 'random', makeCtx(), () => 0);
    expect(order.items.length).toBe(3);
    for (const it of order.items) {
      expect(it.quantity).toBe(10);
    }
  });

  it('玉客：4 种 × 20（rng=0 确定性）', () => {
    const order = generatePreOrder(makeGuest({ guestLevel: 'diamond' }), 'random', makeCtx(), () => 0);
    expect(order.items.length).toBe(4);
    for (const it of order.items) {
      expect(it.quantity).toBe(20);
    }
  });

  it('势力订单期限更紧（3-7 天，rng=0 → +3）', () => {
    const order = generatePreOrder(makeGuest({ name: '谢七' }), 'xie', makeCtx(), () => 0);
    expect(order.deadline).toBe(13); // day 10 + 3
  });
});

describe('getPreOrderPenalty · 违约金分级四来源（用户 2.3 逐字）', () => {
  const order: PreOrder = {
    id: 'o1',
    guestName: '胡商',
    guestIdentity: '',
    source: 'random',
    items: [{ itemId: 'i1', itemName: '米酒', quantity: 10, reserved: 0 }],
    deposit: 6,
    finalPayment: 14,
    totalValue: 20,
    deadline: 20,
    acceptedDay: 10,
    status: 'accepted',
    penaltyType: 'basic',
    narrative: '',
  };

  it('random basic：退定金 + 客流失（声望-5 近似）、无额外违约金', () => {
    const pen = getPreOrderPenalty('random', order);
    expect(pen.depositRefund).toBe(6);
    expect(pen.extraPenalty).toBe(0);
    expect(pen.reputationDelta).toBe(5);
    expect(pen.shenDelta).toBe(0);
    expect(pen.xieDelta).toBe(0);
  });

  it('shen severe：退定金 + 1.5×违约金 + 沈-20 + 声望-20', () => {
    const pen = getPreOrderPenalty('shen', order);
    expect(pen.depositRefund).toBe(6);
    expect(pen.extraPenalty).toBeCloseTo(20 * 0.2 * 1.5, 5); // 6
    expect(pen.shenDelta).toBe(20);
    expect(pen.reputationDelta).toBe(20);
  });

  it('xie severe：退定金 + 违约金 + 谢-25 + 地下-15', () => {
    const pen = getPreOrderPenalty('xie', order);
    expect(pen.xieDelta).toBe(25);
    expect(pen.factionDelta).toBe(15);
    expect(pen.factionId).toBe('underground');
    expect(pen.extraPenalty).toBeCloseTo(6, 5);
  });

  it('faction severe：退定金 + 违约金 + 势力-30 + 声望-30', () => {
    const pen = getPreOrderPenalty('faction', { ...order, factionId: 'xishi' });
    expect(pen.factionDelta).toBe(30);
    expect(pen.factionId).toBe('xishi');
    expect(pen.reputationDelta).toBe(30);
    expect(pen.extraPenalty).toBeCloseTo(6, 5);
  });
});

describe('reserveGoodsForOrder · 备货预留（用户 2.4）', () => {
  const order: PreOrder = {
    id: 'o1',
    guestName: '胡商',
    guestIdentity: '',
    source: 'random',
    items: [{ itemId: 'i1', itemName: '米酒', quantity: 10, reserved: 0 }],
    deposit: 6,
    finalPayment: 14,
    totalValue: 20,
    deadline: 20,
    acceptedDay: 10,
    status: 'accepted',
    penaltyType: 'basic',
    narrative: '',
  };

  it('预留 5/10 → 进度 5/10、状态仍 accepted（不移库）', () => {
    const items = [makeItem({ id: 'i1', name: '米酒', stock: 5 })];
    const res = reserveGoodsForOrder('o1', items, [order]);
    expect(res.ok).toBe(true);
    expect(res.order!.items[0]!.reserved).toBe(5);
    expect(res.order!.status).toBe('accepted');
    // 不移库：stock 不变，仅 reserved 增加
    expect(res.shopItems![0]!.stock).toBe(5);
    expect(res.shopItems![0]!.reserved).toBe(5);
    expect(getOrderProgress(res.order!)).toEqual({ required: 10, reserved: 5, remaining: 5 });
  });

  it('货齐（预留=需求）→ 状态 ready', () => {
    const items = [makeItem({ id: 'i1', name: '米酒', stock: 10 })];
    const res = reserveGoodsForOrder('o1', items, [order]);
    expect(res.order!.status).toBe('ready');
    expect(res.order!.items[0]!.reserved).toBe(10);
  });

  it('未接下订单不可备货', () => {
    const pending = { ...order, status: 'pending' as const };
    const res = reserveGoodsForOrder('o1', shopItems, [pending]);
    expect(res.ok).toBe(false);
  });
});

describe('deliverOrder · 交货结算（用户 2.5 逐字）', () => {
  const order: PreOrder = {
    id: 'o1',
    guestName: '胡商',
    guestIdentity: '',
    source: 'random',
    items: [{ itemId: 'i1', itemName: '米酒', quantity: 10, reserved: 10 }],
    deposit: 6,
    finalPayment: 14,
    totalValue: 20,
    deadline: 20,
    acceptedDay: 10,
    status: 'ready',
    penaltyType: 'basic',
    narrative: '',
  };

  it('货未备齐 → 拒绝交货', () => {
    const notReady = { ...order, items: [{ itemId: 'i1', itemName: '米酒', quantity: 10, reserved: 5 }], status: 'accepted' as const };
    const res = deliverOrder('o1', makeDeliverState([notReady]), () => 0);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('货未备齐，不可交货');
  });

  it('交货：尾款入账、商品移库、声望+5（rng=0）、新客入回头客池、status delivered', () => {
    const items = [makeItem({ id: 'i1', name: '米酒', stock: 10, reserved: 10 })];
    const state = makeDeliverState([order], items);
    const res = deliverOrder('o1', state, () => 0);
    expect(res.ok).toBe(true);
    expect(res.order!.status).toBe('delivered');
    expect(res.silverDelta).toBe(14); // 尾款
    expect(res.reputationDelta).toBe(5); // 5 + randInt(0,25)=0
    // 移库：stock 10-10=0、reserved 清零
    expect(res.shopItems![0]!.stock).toBe(0);
    expect(res.shopItems![0]!.reserved).toBe(0);
    expect(res.shopItems![0]!.status).toBe('out_of_stock');
    expect(res.knownGuest).toBeDefined();
  });

  it('来源关系奖励：shen +10 / xie +10 / faction +10', () => {
    const shenRes = deliverOrder('o1', makeDeliverState([{ ...order, source: 'shen' }]), () => 0);
    expect(shenRes.shenDelta).toBe(10);
    const xieRes = deliverOrder('o1', makeDeliverState([{ ...order, source: 'xie' }]), () => 0);
    expect(xieRes.xieDelta).toBe(10);
    const factionRes = deliverOrder('o1', makeDeliverState([{ ...order, source: 'faction', factionId: 'xishi' }]), () => 0);
    expect(factionRes.factionDelta).toBe(10);
    expect(factionRes.factionId).toBe('xishi');
  });
});

function makeDeliverState(preOrders: PreOrder[], items: ShopItem[] = shopItems) {
  return {
    preOrders,
    shopItems: items,
    silver: 100,
    reputation: 50,
    shenTinglanFavor: 30,
    xieQiFavor: 20,
    factions: [{ id: 'xishi', relationship: 40 }],
    knownGuests: {} as Record<string, KnownGuestRecord>,
    day: 20,
  };
}

describe('checkOverdueOrders · 逾期违约（用户 2.5）', () => {
  it('accepted 且 deadline ≤ day → 置 overdue、解除预留', () => {
    const order: PreOrder = {
      id: 'o1',
      guestName: '胡商',
      guestIdentity: '',
      source: 'random',
      items: [{ itemId: 'i1', itemName: '米酒', quantity: 10, reserved: 5 }],
      deposit: 6,
      finalPayment: 14,
      totalValue: 20,
      deadline: 20,
      acceptedDay: 10,
      status: 'accepted',
      penaltyType: 'basic',
      narrative: '',
    };
    const items = [makeItem({ id: 'i1', name: '米酒', stock: 10, reserved: 5 })];
    const res = checkOverdueOrders([order], items, 20);
    expect(res.overdue).toHaveLength(1);
    expect(res.overdue[0]!.status).toBe('overdue');
    expect(res.preOrders[0]!.status).toBe('overdue');
    // 解除预留
    expect(res.shopItems[0]!.reserved).toBe(0);
    expect(res.shopItems[0]!.stock).toBe(10);
  });

  it('ready 且 deadline ≤ day 同样逾期', () => {
    const ready = {
      id: 'o2',
      guestName: '客',
      guestIdentity: '',
      source: 'random',
      items: [{ itemId: 'i1', itemName: '米酒', quantity: 3, reserved: 3 }],
      deposit: 2,
      finalPayment: 4,
      totalValue: 6,
      deadline: 15,
      acceptedDay: 10,
      status: 'ready' as const,
      penaltyType: 'basic' as const,
      narrative: '',
    };
    const res = checkOverdueOrders([ready], shopItems, 16);
    expect(res.overdue[0]!.status).toBe('overdue');
  });

  it('未到期不逾期；pending 超期未接下 → 作废移除', () => {
    const active = {
      id: 'o3',
      guestName: '客',
      guestIdentity: '',
      source: 'random',
      items: [{ itemId: 'i1', itemName: '米酒', quantity: 3, reserved: 0 }],
      deposit: 2,
      finalPayment: 4,
      totalValue: 6,
      deadline: 30,
      acceptedDay: 10,
      status: 'accepted' as const,
      penaltyType: 'basic' as const,
      narrative: '',
    };
    const pendingExpired = {
      id: 'o4',
      guestName: '客2',
      guestIdentity: '',
      source: 'random',
      items: [{ itemId: 'i1', itemName: '米酒', quantity: 3, reserved: 0 }],
      deposit: 2,
      finalPayment: 4,
      totalValue: 6,
      deadline: 10,
      acceptedDay: 5,
      status: 'pending' as const,
      penaltyType: 'basic' as const,
      narrative: '',
    };
    const res = checkOverdueOrders([active, pendingExpired], shopItems, 15);
    expect(res.overdue).toHaveLength(0);
    expect(res.preOrders.some((o) => o.id === 'o4')).toBe(false); // pending 作废移除
    expect(res.preOrders.some((o) => o.id === 'o3')).toBe(true); // active 保留
  });
});

describe('generateOrderNarrative · 三来源 offer 叙事（用户 2.7）', () => {
  const base = { guestName: '胡商', items: [{ itemId: 'i1', itemName: '米酒', quantity: 10, reserved: 0 }], totalValue: 20, deadline: 20 };

  it('随机 offer：含客人名与预留意图', () => {
    const n = generateOrderNarrative({ ...base, source: 'random' }, 'offer');
    expect(n).toContain('胡商');
    expect(n).toContain('预留');
  });

  it('沈听澜 offer：书信口吻', () => {
    const n = generateOrderNarrative({ ...base, source: 'shen' }, 'offer');
    expect(n).toContain('书信');
    expect(n).toContain('沈听澜');
  });

  it('谢七 offer：压低声音', () => {
    const n = generateOrderNarrative({ ...base, source: 'xie' }, 'offer');
    expect(n).toContain('压低声音');
  });

  it('势力 offer：势力中人', () => {
    const n = generateOrderNarrative({ ...base, source: 'faction' }, 'offer');
    expect(n).toContain('势力');
  });

  it('delivered / overdue 自拟', () => {
    expect(generateOrderNarrative({ ...base, source: 'random' }, 'delivered')).toContain('言而有信');
    expect(generateOrderNarrative({ ...base, source: 'random' }, 'overdue')).toContain('毁约');
  });
});
