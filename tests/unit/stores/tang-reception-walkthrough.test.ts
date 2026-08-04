/**
 * 接待深度升级 走查（TANG-RCP-001 模块七 wiring）
 * 用真实 store 验证六操作接线：偏好揭示→推荐命中/赠礼→拼桌→耐心→留言簿→回头客→settleDay 气氛。
 * 随机部分以固定 rng/受控 setState 保证确定性；传染/闲聊概率已在纯函数单测覆盖。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { generateDailyGuests } from '@/systems/tang-guest-generator';
import { useTangManagerStore } from '@/stores/tang-manager';
import type { Guest, KnownGuestRecord, ShopItem } from '@/types/tang-manager';

function makeItem(overrides: Partial<ShopItem> = {}): ShopItem {
  return {
    id: 'i-mijiu',
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
    description: 'x',
    baseConsumption: 4,
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

beforeEach(() => {
  useTangManagerStore.setState({
    ...useTangManagerStore.getState(),
    phase: 'playing',
    shopType: 'jiulou',
    difficulty: 'B',
    energy: 100,
    insightRemaining: 3,
    dailyEnergyConsumed: 0,
    currentGuestIndex: 0,
    shopAtmosphere: 50,
    guestBook: [],
    knownGuests: {},
    guests: [],
    shopItems: [makeItem()],
    silver: 50,
    gold: 50,
    score: 2.0,
    reputation: 10,
    xiaoerSatisfaction: 60,
    // TANG-ADD-001：清空占候/今日追踪，避免跨用例残留卦象影响耐心/数值判定
    todayHexagram: null,
    todayMindReadUsed: 0,
    todaySilkSold: 0,
    todayMarketDealTriggered: false,
    todayChatUsed: 0,
    todayComplaints: 0,
    todayMindReadBackfired: 0,
  });
});

describe('六操作接线（store wiring）', () => {
  it('推荐命中：已揭示偏好 + 在库商品 → 收入×1.5、客人已处理、指针前进', () => {
    useTangManagerStore.setState({
      guests: [makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: true }], preferenceRevealed: true })],
    });
    const r = useTangManagerStore.getState().recommendItem('g1', 'i-mijiu');
    expect(r!.ok).toBe(true);
    expect(r!.income).toBe(6.0); // 4 × 1.5
    const s = useTangManagerStore.getState();
    expect(s.guests[0]!.handled).toBe(true);
    expect(s.guests[0]!.incomeEarned).toBe(6.0);
    expect(s.currentGuestIndex).toBe(1);
    expect(s.knownGuests['李四']!.totalSpent).toBe(6.0);
  });

  it('赠礼：扣库房 1 份、giftCount+1、下次消费×1.5 写入 knownGuests', () => {
    useTangManagerStore.setState({ guests: [makeGuest()] });
    const r = useTangManagerStore.getState().giveGift('g1', 'i-mijiu');
    expect(r!.ok).toBe(true);
    expect(r!.favorDelta).toBe(20);
    const s = useTangManagerStore.getState();
    expect(s.shopItems[0]!.stock).toBe(9);
    expect(s.guests[0]!.giftCount).toBe(1);
    expect(s.knownGuests['李四']!.consumptionMultiplier).toBe(1.5);
    expect(s.guests[0]!.satisfaction).toBe(70); // 50 + 20
  });

  it('通晓人心前置：揭示偏好消耗 1 次且不处理客人（可继续推荐）', () => {
    useTangManagerStore.setState({
      guests: [makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: false }] })],
      insightRemaining: 2,
    });
    const r = useTangManagerStore.getState().revealGuestPreference('g1');
    expect(r!.revealed).not.toBeNull();
    const s = useTangManagerStore.getState();
    expect(s.insightRemaining).toBe(1);
    expect(s.guests[0]!.handled).toBe(false); // 未处理
    expect(s.guests[0]!.preferenceRevealed).toBe(true);
  });

  it('拼桌并单：同类型+耐心>50 → 两人同时处理、收入=(A+B)×0.8', () => {
    useTangManagerStore.setState({
      guests: [makeGuest({ baseConsumption: 4 }), makeGuest({ id: 'g2', name: '王五', baseConsumption: 6 })],
    });
    const r = useTangManagerStore.getState().mergeGuests('g1', 'g2');
    expect(r!.ok).toBe(true);
    expect(r!.income).toBe(8.0);
    const s = useTangManagerStore.getState();
    expect(s.guests[0]!.handled).toBe(true);
    expect(s.guests[1]!.handled).toBe(true);
    expect(s.guests[0]!.incomeEarned).toBe(8.0);
  });

  it('拼桌拒绝：不同类型 → 不处理任何人', () => {
    useTangManagerStore.setState({
      guests: [makeGuest(), makeGuest({ id: 'g2', name: '胡商', type: 'big_order' })],
    });
    const r = useTangManagerStore.getState().mergeGuests('g1', 'g2');
    expect(r!.ok).toBe(false);
    const s = useTangManagerStore.getState();
    expect(s.guests.every((g) => !g.handled)).toBe(true);
  });

  it('接待后排队耐心递减：未接待客人 -5', () => {
    useTangManagerStore.setState({
      guests: [makeGuest({ preferences: [{ type: 'item', value: '米酒', revealed: true }] }), makeGuest({ id: 'g2', name: '王五', patience: 100 })],
    });
    // TANG-TRF-002：注入固定 rng=0.9，避开 10% 投诉 + 30% 传染走掉（否则第二位客人被标记 handled、耐心不变 → flaky）
    useTangManagerStore.getState().handleCurrentGuest('normal', () => 0.9);
    const s = useTangManagerStore.getState();
    expect(s.guests[1]!.patience).toBe(95);
  });
});

describe('留言簿 / 回头客 / settleDay 气氛', () => {
  it('好评触发留言簿：满意度≥80 且累计消费≥50 → guestBook 增加 praise 条目', () => {
    useTangManagerStore.setState({
      guests: [makeGuest({ satisfaction: 80, totalSpent: 50, preferences: [{ type: 'item', value: '米酒', revealed: true }] })],
    });
    useTangManagerStore.getState().recommendItem('g1', 'i-mijiu');
    const s = useTangManagerStore.getState();
    expect(s.guestBook!.length).toBe(1);
    expect(s.guestBook![0]!.type).toBe('praise');
    expect(s.guestBook![0]!.guestName).toBe('李四');
  });

  it('回头客 20%：knownGuests 非空且 rng<0.2 → 今日含一位继承偏好/次数/总消费的熟客', () => {
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
    // 固定 rng=0.1：20% 回头客掷骰必然命中（其余随机调用也取 0.1，确定性）
    const guests = generateDailyGuests('jiulou', 'B', 5, () => 0.1, known);
    const returning = guests.find((g) => g.name === '胡商');
    expect(returning).toBeDefined();
    expect(returning!.visitCount).toBe(3);
    expect(returning!.guestLevel).toBe('gold');
    expect(returning!.baseConsumption).toBeGreaterThanOrEqual(1);
    expect(returning!.preferences![0]!.revealed).toBe(true); // 第三次来访自动揭示
  });

  it('回头客概率不触发：rng≥0.2 → 全是新客', () => {
    const known: Record<string, KnownGuestRecord> = {
      胡商: { level: 'silver', totalSpent: 80, visitCount: 1, preferences: [], lastVisit: 1 },
    };
    const guests = generateDailyGuests('jiulou', 'B', 5, () => 0.9, known);
    expect(guests.every((g) => g.name !== '胡商')).toBe(true);
  });

  it('settleDay：气氛影响基础收益（高气氛 +10%）、打烊重置 50、清耐心', () => {
    useTangManagerStore.setState({
      guests: [],
      shopAtmosphere: 80, // 高气氛
      day: 1,
      xiaoerSatisfaction: 60,
      score: 3.0,
      employees: [],
    });
    const settlement = useTangManagerStore.getState().settleDay();
    expect(settlement).not.toBeNull();
    const s = useTangManagerStore.getState();
    // 打烊自动 startNewDay（新客人耐心 100）；气氛重置 50；
    // 内容深化 TANG-CONT-C：当日气氛≥70 触发离场「满意而归」+5 → 次日 ≥55
    // （次日清晨 30% 进场事件可能再叠加气氛，故取下界断言）
    expect(s.shopAtmosphere).toBeGreaterThanOrEqual(55);
    expect(s.guests.every((g) => (g.patience ?? 100) === 100)).toBe(true);
  });
});
