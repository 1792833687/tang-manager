/**
 * 大单预购 + 动态客流 store 走查（TANG-TRF-001 wiring）
 * 用真实 store 验证：接待策略三档接线（delegate 收益/无精力、priority 亲接大单）、
 * 大单预购触发互斥（20% → 下订/80% 现货）、接单收定金、备货预留、交货结算、
 * 逾期违约分级、周级要务刷新与结算。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { generateWeeklyTasks } from '@/systems/tang-daily-tasks';
import { useTangManagerStore } from '@/stores/tang-manager';
import type { Guest, PreOrder, ShopItem } from '@/types/tang-manager';

function makeItem(overrides: Partial<ShopItem> = {}): ShopItem {
  return {
    id: 'i-mijiu',
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

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g1',
    name: '胡商',
    type: 'big_order',
    description: '要店里最好的货。',
    baseConsumption: 10,
    mentalOS: null,
    handled: false,
    preferences: [],
    preferenceRevealed: false,
    visitCount: 1,
    guestLevel: 'bronze',
    totalSpent: 0,
    patience: 100,
    satisfaction: 50,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<PreOrder> = {}): PreOrder {
  return {
    id: 'o1',
    guestName: '胡商',
    guestIdentity: '',
    source: 'random',
    items: [{ itemId: 'i-mijiu', itemName: '米酒', quantity: 10, reserved: 0 }],
    deposit: 6,
    finalPayment: 14,
    totalValue: 20,
    deadline: 20,
    acceptedDay: 10,
    status: 'accepted',
    penaltyType: 'basic',
    narrative: '',
    ...overrides,
  };
}

beforeEach(() => {
  useTangManagerStore.getState().resetGame();
  useTangManagerStore.setState({
    phase: 'playing',
    shopType: 'jiulou',
    difficulty: 'B',
    energy: 100,
    insightRemaining: 3,
    dailyEnergyConsumed: 0,
    currentGuestIndex: 0,
    guests: [],
    shopItems: [makeItem()],
    silver: 100,
    gold: 100,
    score: 2.0,
    reputation: 10,
    knownGuests: {},
    todayHexagram: null,
    todayMindReadUsed: 0,
  });
});

// TANG-TRF-002：固定 rng 注入点（handleCurrentGuest 第二参数）。
// rng=1 → 大单 20% 预购恒不触发（1≥0.2）→ 现货亲接路径；delegate 收益恒取上限 ×0.8。
// rng=0.1 → 大单 20% 预购恒触发（0.1<0.2）→ 下订路径。
const RNG_SPOT = (): number => 1;
const RNG_PREORDER = (): number => 0.1;

describe('接待策略三档接线（用户 1.2 逐字）', () => {
  it('全托伙计 delegate：收益 ×0.7~0.8、无精力消耗、不走偏好匹配（客人已处理）', () => {
    useTangManagerStore.setState({
      receptionStrategy: 'delegate',
      guests: [makeGuest({ baseConsumption: 10 })],
    });
    // rng=1 → 预购不触发且 delegate 收益恒取上限 ×0.8 = 8（确定性）
    const result = useTangManagerStore.getState().handleCurrentGuest('normal', RNG_SPOT);
    expect(result).not.toBeNull();
    expect(result!.income).toBe(8);
    expect(result!.energyConsumed).toBe(0);
    const s = useTangManagerStore.getState();
    expect(s.guests[0]!.handled).toBe(true);
    expect(s.guests[0]!.incomeEarned).toBe(8);
    expect(s.energy).toBe(100); // 无精力消耗
    expect(s.guests[0]!.handledNote).toContain('伙计代劳');
  });

  it('择要接待 priority：大单亲接（有精力消耗），普通指派（无精力）', () => {
    useTangManagerStore.setState({
      receptionStrategy: 'priority',
      guests: [makeGuest({ baseConsumption: 10 })],
    });
    // rng=1 → 大单 20% 预购恒不触发（1≥0.2）→ 走现货亲接路径；normal 流程精力-5 确定性
    const bigResult = useTangManagerStore.getState().handleCurrentGuest('normal', RNG_SPOT);
    expect(bigResult!.energyConsumed).toBe(5);

    useTangManagerStore.setState({
      receptionStrategy: 'priority',
      currentGuestIndex: 0,
      guests: [makeGuest({ id: 'g2', name: '李四', type: 'normal', baseConsumption: 4 })],
    });
    const normalResult = useTangManagerStore.getState().handleCurrentGuest('normal', RNG_SPOT);
    expect(normalResult!.energyConsumed).toBe(0); // 指派伙计
    expect(normalResult!.income).toBe(3.2); // 4 × 0.8（rng=1 恒取上限）
  });
});

describe('大单预购触发互斥（用户 2.2）', () => {
  it('大单客 rng<0.2 → 下订预购（现货互斥：收入 0、客人已处理、订单入列）', () => {
    useTangManagerStore.setState({ guests: [makeGuest()] });
    const result = useTangManagerStore.getState().handleCurrentGuest('normal', RNG_PREORDER);
    const s = useTangManagerStore.getState();
    expect(result!.income).toBe(0);
    expect(s.guests[0]!.handled).toBe(true);
    expect(s.guests[0]!.incomeEarned).toBe(0);
    expect(s.preOrders).toHaveLength(1);
    expect(s.preOrders![0]!.status).toBe('pending');
    expect(s.preOrders![0]!.source).toBe('random');
    expect(s.preOrders![0]!.guestName).toBe('胡商');
    // 周级要务：本周接待大单 +1
    expect(s.weeklyTaskProgress!['week-big-orders']).toBe(1);
  });

  it('大单客 rng≥0.2 → 现货消费（不产生预购）', () => {
    useTangManagerStore.setState({ guests: [makeGuest({ baseConsumption: 10 })] });
    useTangManagerStore.getState().handleCurrentGuest('normal', RNG_SPOT);
    const s = useTangManagerStore.getState();
    expect(s.preOrders).toHaveLength(0);
    expect(s.guests[0]!.handled).toBe(true);
    expect(s.guests[0]!.incomeEarned).toBeGreaterThan(0);
  });
});

describe('预购生命周期（接单 → 备货 → 交货）', () => {
  it('acceptPreOrder：pending → accepted，定金入账', () => {
    useTangManagerStore.setState({ preOrders: [makeOrder({ status: 'pending' })] });
    const r = useTangManagerStore.getState().acceptPreOrder('o1');
    expect(r!.ok).toBe(true);
    const s = useTangManagerStore.getState();
    expect(s.preOrders![0]!.status).toBe('accepted');
    expect(s.silver).toBe(106); // 100 + 定金 6
    expect(s.gold).toBe(106);
  });

  it('reserveGoods → 货齐置 ready；deliverOrder → 尾款入账、移库、声望、新客入池、周要务+1', () => {
    useTangManagerStore.setState({
      preOrders: [makeOrder({ items: [{ itemId: 'i-mijiu', itemName: '米酒', quantity: 10, reserved: 0 }] })],
      shopItems: [makeItem({ stock: 10 })],
    });
    const r1 = useTangManagerStore.getState().reserveGoods('o1');
    expect(r1!.ok).toBe(true);
    expect(useTangManagerStore.getState().preOrders![0]!.status).toBe('ready');

    const r2 = useTangManagerStore.getState().deliverOrder('o1');
    expect(r2!.ok).toBe(true);
    const s = useTangManagerStore.getState();
    expect(s.preOrders![0]!.status).toBe('delivered');
    expect(s.silver).toBe(114); // 100 + 尾款 14
    expect(s.shopItems[0]!.stock).toBe(0);
    expect(s.shopItems[0]!.reserved).toBe(0);
    expect(s.reputation).toBeGreaterThanOrEqual(15); // 10 + 5~30
    expect(s.knownGuests!['胡商']).toBeDefined();
    expect(s.weeklyTaskProgress!['week-preorder']).toBe(1);
  });

  it('货未备齐不可交货', () => {
    useTangManagerStore.setState({
      preOrders: [makeOrder({ items: [{ itemId: 'i-mijiu', itemName: '米酒', quantity: 10, reserved: 5 }] })],
      shopItems: [makeItem({ stock: 5 })],
    });
    const r = useTangManagerStore.getState().deliverOrder('o1');
    expect(r!.ok).toBe(false);
    expect(r!.reason).toBe('货未备齐，不可交货');
  });
});

describe('逾期违约（用户 2.3/2.5）', () => {
  it('checkOverdueOrders：accepted 且 deadline≤day → 违约罚定金+客流失、解除预留', () => {
    useTangManagerStore.setState({
      preOrders: [makeOrder({ items: [{ itemId: 'i-mijiu', itemName: '米酒', quantity: 10, reserved: 5 }], deadline: 10, acceptedDay: 5 })],
      shopItems: [makeItem({ stock: 10, reserved: 5 })],
      day: 10,
      silver: 100,
    });
    const overdue = useTangManagerStore.getState().checkOverdueOrders();
    expect(overdue).toHaveLength(1);
    const s = useTangManagerStore.getState();
    expect(s.preOrders![0]!.status).toBe('overdue');
    // 退定金 6 + 客流失（声望-5）；定金退还给客人
    expect(s.silver).toBe(94); // 100 - 6
    expect(s.reputation).toBe(5); // 10 - 5
    expect(s.shopItems[0]!.reserved).toBe(0); // 解除预留
    expect(s.shopItems[0]!.stock).toBe(10); // 不移库
  });

  it('势力订单逾期：退定金 + 违约金 + 声望/关系扣减（shen severe）', () => {
    useTangManagerStore.setState({
      preOrders: [makeOrder({ source: 'shen', penaltyType: 'severe', deadline: 10, acceptedDay: 5, totalValue: 20, deposit: 6 })],
      day: 10,
      silver: 100,
      reputation: 100,
      shenTinglanFavor: 50,
    });
    const overdue = useTangManagerStore.getState().checkOverdueOrders();
    expect(overdue[0]!.source).toBe('shen');
    const s = useTangManagerStore.getState();
    // 退定金 6 + 违约金 20×0.2×1.5=6 → 共扣 12
    expect(s.silver).toBe(88);
    expect(s.reputation).toBe(80); // 100 - 20
    expect(s.shenTinglanFavor).toBe(30); // 50 - 20
  });
});

describe('周级要务（模块三）', () => {
  it('周日打烊 settleWeeklyTasks：进度达标 → 发奖励（银 50 + 评分 0.05）', () => {
    const tasks = generateWeeklyTasks(2.0); // 大单 target=1（评分 2.0<3.0）
    useTangManagerStore.setState({
      day: 7,
      weeklyTasks: tasks,
      weeklyTaskProgress: {
        'week-big-orders': 1,
        'week-preorder': 1,
        'week-net-profit': 300,
        'week-mind-read': 3,
      },
      silver: 100,
      score: 2.0,
    });
    const done = useTangManagerStore.getState().settleWeeklyTasks();
    expect(done).toHaveLength(4);
    const s = useTangManagerStore.getState();
    expect(s.silver).toBe(150); // +50 周预购奖励
    expect(s.score).toBeCloseTo(2.05, 5); // +0.05 周净利奖励
  });

  it('startNewDay 周一（day%7===1）刷新周要务并清零进度', () => {
    useTangManagerStore.setState({
      day: 7,
      weeklyTasks: [],
      weeklyTaskProgress: { 'week-net-profit': 100 },
    });
    useTangManagerStore.getState().startNewDay(); // 7 → 8（周一）
    const s = useTangManagerStore.getState();
    expect(s.day).toBe(8);
    expect(s.weeklyTasks!.length).toBe(4);
    expect(s.weeklyTaskProgress).toEqual({});
  });

  it('非周一不刷新周要务', () => {
    useTangManagerStore.setState({
      day: 8,
      weeklyTasks: generateWeeklyTasks(2.0),
      weeklyTaskProgress: { 'week-net-profit': 50 },
    });
    useTangManagerStore.getState().startNewDay(); // 8 → 9（周二）
    const s = useTangManagerStore.getState();
    expect(s.weeklyTaskProgress!['week-net-profit']).toBe(50);
    expect(s.weeklyTasks!.length).toBe(4);
  });
});
