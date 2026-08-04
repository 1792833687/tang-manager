/**
 * 内容深化 TANG-CONT-B 单测（tang-content-b）
 * 覆盖：经营策略结算修正（模块六·1）/ 成就奖励发放（模块六·2）/
 *       线索墙手动连接判定（模块六·3）/ 镖队到达入银（模块六·4）/
 *       特殊能力每日重置（模块六·5）/ 变卖分店（模块一）。
 * 验证驱动：纯函数先行，store 接线集成验证。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useTangManagerStore } from '@/stores/tang-manager';
import {
  businessStrategyIncomeFactor,
  businessStrategyGuestFactor,
  BUSINESS_STRATEGY_LABEL,
} from '@/systems/tang-business-strategy';
import { settleDay } from '@/systems/tang-settlement';
import { estimateShopValue, sellBranch, maxEmployeesForShops } from '@/systems/tang-shop-sale';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_REWARDS,
  applyAchievementReward,
  achievementRegularCustomerBonus,
  achievementRewardById,
} from '@/config/tang-achievements';
import { judgeClueConnection, pairwiseConnect } from '@/systems/tang-clues';
import { calculateDailyGuestCount } from '@/systems/tang-dynamic-traffic';
import { checkCaravanDaily } from '@/systems/tang-caravan';
import type { Caravan } from '@/types/tang-caravan';
import type { TradeContext } from '@/systems/tang-trade';
import type { Clue } from '@/types/tang-clues';
import type { Employee, TangGameState } from '@/types/tang-manager';

const seq =
  (...values: number[]): (() => number) =>
  () => values.shift() ?? 0.5;

function makeState(overrides: Partial<TangGameState> = {}): TangGameState {
  return {
    phase: 'playing',
    player: null,
    shopType: 'jiulou',
    difficulty: 'B',
    silver: 50,
    gold: 50,
    legacyDebt: 200,
    debt: 200,
    monthlyInterest: 5,
    score: 2.0,
    reputation: 10,
    xiaoerFavor: 30,
    xiaoerSatisfaction: 60,
    energy: 100,
    day: 1,
    insightRemaining: 3,
    luckRemaining: 1,
    guests: [],
    currentGuestIndex: 0,
    ledger: [],
    todaySettlement: null,
    shopItems: [],
    unlockedAchievements: [],
    insightUsedTotal: 0,
    dailyEnergyConsumed: 0,
    events: [],
    pendingEvents: [],
    eventLog: [],
    insightUsedOnNPC: {},
    totalNetProfit: 0,
    maxGamblingWin: 0,
    hasGoneBroke: false,
    xiaoerGone: false,
    shenDebt: false,
    shenPartner: false,
    xieQiFavor: 0,
    shenTinglanFavor: 0,
    gamblingAddictionDays: 0,
    luckUsedTotal: 0,
    bankruptcyStartDay: 0,
    pendingComplaint: null,
    aiNarrationEnabled: true,
    aiModel: 'openai/gpt-4o-mini',
    stage: 1,
    employees: [],
    maxEmployees: 4,
    dailyActionsRemaining: 1,
    afternoonActions: [],
    shopCount: 1,
    xieQiIdentityRevealed: false,
    specialEmployeeStoryCompleted: false,
    employeeBonusRate: 0,
    businessStrategy: 'steady',
    ...overrides,
  };
}

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'e1',
    name: '张铁柱',
    type: 'waiter',
    satisfaction: 60,
    salary: 5,
    hireDay: 1,
    backgroundRevealed: false,
    skills: [],
    ...overrides,
  };
}

function makeClue(overrides: Partial<Clue> = {}): Clue {
  return {
    id: 'c1',
    source: '客商闲谈',
    sourceType: 'gossip',
    content: '某日某地一事',
    category: 'shen',
    day: 3,
    connected: [],
    resolved: false,
    ...overrides,
  };
}

function makeTrade(overrides: Partial<TradeContext> = {}): TradeContext {
  return {
    day: 5,
    silver: 500,
    nodePriceModifiers: { 'luji-laodian': 1, 'wangji-buzhuang': 1.2 },
    greenChannels: [],
    transportingGoods: [],
    employees: [],
    shenTinglanFavor: 0,
    xieQiFavor: 0,
    reputation: 0,
    shopItems: [{ category: '食材', price: 3 }],
    mapEvents: [],
    ...overrides,
  };
}

function makeCaravan(overrides: Partial<Caravan> = {}): Caravan {
  return {
    id: 'c1',
    name: '陆记镖队',
    leader: '赵铁柱',
    members: [],
    guards: 1,
    route: null,
    status: 'idle',
    currentGoods: [],
    departureDay: 5,
    arrivalDay: 5,
    totalTrips: 0,
    totalValue: 0,
    eventLog: [],
    leaderExp: 0,
    ...overrides,
  };
}

describe('模块六·1 经营策略', () => {
  it('收益系数：薄利多销 0.8 / 奇货可居 1.3 / 稳健 1 / 缺省 1', () => {
    expect(businessStrategyIncomeFactor('thin')).toBe(0.8);
    expect(businessStrategyIncomeFactor('rare')).toBe(1.3);
    expect(businessStrategyIncomeFactor('steady')).toBe(1);
    expect(businessStrategyIncomeFactor(undefined)).toBe(1);
  });

  it('客人数系数：薄利多销 1.3 / 奇货可居 0.7 / 稳健 1', () => {
    expect(businessStrategyGuestFactor('thin')).toBe(1.3);
    expect(businessStrategyGuestFactor('rare')).toBe(0.7);
    expect(businessStrategyGuestFactor('steady')).toBe(1);
  });

  it('策略中文名齐全', () => {
    expect(BUSINESS_STRATEGY_LABEL.thin).toBe('薄利多销');
    expect(BUSINESS_STRATEGY_LABEL.rare).toBe('奇货可居');
    expect(BUSINESS_STRATEGY_LABEL.steady).toBe('稳健经营');
  });

  it('settleDay 接线：薄利多销 → 基础收益 ×0.8（固定 rng 下收益低于稳健）', () => {
    // 同 rng 序列：薄利基础收益 = 稳健 ×0.8
    const thin = settleDay(makeState({ businessStrategy: 'thin' }), seq(0.5, 0.5, 0.5));
    const steady = settleDay(makeState({ businessStrategy: 'steady' }), seq(0.5, 0.5, 0.5));
    expect(thin.settlement.baseIncome).toBeCloseTo(steady.settlement.baseIncome * 0.8, 5);
  });

  it('settleDay 接线：奇货可居 → 基础收益 ×1.3（固定 rng 下收益高于稳健）', () => {
    const rare = settleDay(makeState({ businessStrategy: 'rare' }), seq(0.5, 0.5, 0.5));
    const steady = settleDay(makeState({ businessStrategy: 'steady' }), seq(0.5, 0.5, 0.5));
    expect(rare.settlement.baseIncome).toBeCloseTo(steady.settlement.baseIncome * 1.3, 5);
  });

  it('客人数公式接线：×guestCountFactor 后四舍五入再截断 2-20', () => {
    // score=2.0 reputation=10 → base = 2 + 3 + 0 + delta；delta=-1 → 4；×1.3 → 5.2 → 5
    const count = calculateDailyGuestCount({ score: 2, reputation: 10, guestCountFactor: 1.3 }, seq(0));
    expect(count).toBe(5);
    // ×0.7 → 2.8 → 3
    const countLow = calculateDailyGuestCount({ score: 2, reputation: 10, guestCountFactor: 0.7 }, seq(0));
    expect(countLow).toBe(3);
  });
});

describe('模块六·2 成就奖励发放', () => {
  it('applyAchievementReward：回头客 → 熟客+5 无一次性声望；招财进宝 → 声望+15', () => {
    const r1 = applyAchievementReward({ reputation: 10, score: 2 }, 'regular-customer');
    expect(r1.reward?.regularCustomerBonus).toBe(5);
    expect(r1.reputationDelta).toBe(0);
    const r2 = applyAchievementReward({ reputation: 10, score: 2 }, 'fortune');
    expect(r2.reputationDelta).toBe(15);
  });

  it('applyAchievementReward：未知成就 → 无奖励', () => {
    const r = applyAchievementReward({ reputation: 10, score: 2 }, 'not-exist');
    expect(r.reward).toBeNull();
    expect(r.reputationDelta).toBe(0);
    expect(r.scoreDelta).toBe(0);
  });

  it('achievementRegularCustomerBonus：回头客解锁 → +5 百分点；未解锁 → 0', () => {
    expect(achievementRegularCustomerBonus([])).toBe(0);
    expect(achievementRegularCustomerBonus(['regular-customer'])).toBe(5);
    expect(achievementRegularCustomerBonus(['regular-customer', 'fortune'])).toBe(5);
  });

  it('奖励映射表覆盖全部成就 id（每个已定义成就都有奖励文案）', () => {
    for (const a of ACHIEVEMENTS) {
      expect(ACHIEVEMENT_REWARDS[a.id]).toBeDefined();
      expect(achievementRewardById(a.id)?.desc.length).toBeGreaterThan(0);
    }
  });
});

describe('模块六·3 线索墙手动连接判定', () => {
  it('同类别 → match', () => {
    const clues = [
      makeClue({ id: 'a', category: 'shen' }),
      makeClue({ id: 'b', category: 'shen' }),
    ];
    expect(judgeClueConnection(clues, 'a', 'b')).toBe('match');
  });

  it('不同类别 → none', () => {
    const clues = [
      makeClue({ id: 'a', category: 'shen' }),
      makeClue({ id: 'b', category: 'business' }),
    ];
    expect(judgeClueConnection(clues, 'a', 'b')).toBe('none');
  });

  it('已在关联 → match（即便不同类别）', () => {
    const clues = [
      makeClue({ id: 'a', category: 'shen', connected: ['b'] }),
      makeClue({ id: 'b', category: 'business', connected: ['a'] }),
    ];
    expect(judgeClueConnection(clues, 'a', 'b')).toBe('match');
  });

  it('同卡或不存在 → none', () => {
    expect(judgeClueConnection([makeClue()], 'c1', 'c1')).toBe('none');
    expect(judgeClueConnection([makeClue()], 'c1', 'missing')).toBe('none');
  });

  it('pairwiseConnect 与判定一致：match 后可互连', () => {
    const clues = [makeClue({ id: 'a', category: 'shen' }), makeClue({ id: 'b', category: 'shen' })];
    const res = pairwiseConnect(clues, 'a', 'b');
    expect(res.connected).toBe(true);
    expect(res.clues[0]!.connected).toContain('b');
    expect(judgeClueConnection(res.clues, 'a', 'b')).toBe('match');
  });
});

describe('模块一 变卖分店', () => {
  it('估值 = 累计投入(200) × 七成 = 140', () => {
    expect(estimateShopValue()).toBe(140);
  });

  it('员工上限公式：shopCount 1 → 4 / 2 → 6 / 3 → 8', () => {
    expect(maxEmployeesForShops(1)).toBe(4);
    expect(maxEmployeesForShops(2)).toBe(6);
    expect(maxEmployeesForShops(3)).toBe(8);
  });

  it('只剩一家店 → 祖传老店不可变卖', () => {
    const res = sellBranch(1, [makeEmployee()]);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('此乃祖传老店，不可变卖');
  });

  it('变卖一家分店：估值入账、店铺-1、超员员工离职、其余保留', () => {
    // 2 家店满编 6 人；变卖 1 家 → 新上限 4 → 2 名分店伙计离职
    const employees = [
      makeEmployee({ id: 'e1', name: '张铁柱' }),
      makeEmployee({ id: 'e2', name: '李四娘' }),
      makeEmployee({ id: 'e3', name: '王麻子' }),
      makeEmployee({ id: 'e4', name: '赵五郎' }),
      makeEmployee({ id: 'e5', name: '钱六斤' }),
      makeEmployee({ id: 'e6', name: '孙七巧' }),
    ];
    const res = sellBranch(2, employees);
    expect(res.ok).toBe(true);
    expect(res.valuation).toBe(140);
    expect(res.newShopCount).toBe(1);
    expect(res.newMaxEmployees).toBe(4);
    expect(res.keptEmployees!.length).toBe(4);
    expect(res.laidOffNames).toEqual(['钱六斤', '孙七巧']);
  });
});

describe('模块六·4 镖队到达入银（修复：原实现只记事件不落账）', () => {
  it('到达结算 → silverDelta 含卖货收入（36）', () => {
    const c = makeCaravan({
      status: 'in_transit',
      route: { from: 'luji-laodian', to: 'wangji-buzhuang' },
      currentGoods: [{ itemName: '羊肉', quantity: 10, unitCost: 3 }],
      arrivalDay: 5,
    });
    const res = checkCaravanDaily({ day: 5, caravans: [c], trade: makeTrade({ day: 5 }) }, seq(0.9));
    expect(res.events[0]!.arrival).toBeDefined();
    expect(res.silverDelta).toBe(36); // 3×1.2×10
  });

  it('返程到达（无卖货）→ silverDelta 不增加', () => {
    const c = makeCaravan({
      status: 'in_transit',
      route: { from: 'luji-laodian', to: 'wangji-buzhuang' },
      currentGoods: [],
      arrivalDay: 5,
      returning: true,
    });
    const res = checkCaravanDaily({ day: 5, caravans: [c], trade: makeTrade({ day: 5 }) }, seq(0.9));
    expect(res.caravans[0]!.status).toBe('idle');
    expect(res.silverDelta).toBe(0);
  });
});

describe('store 接线集成（内容深化 TANG-CONT-B）', () => {
  beforeEach(() => {
    useTangManagerStore.getState().resetGame();
    useTangManagerStore.getState().initByDifficulty('B');
  });

  it('setBusinessStrategy / 经营策略持久字段', () => {
    useTangManagerStore.getState().setBusinessStrategy('thin');
    expect(useTangManagerStore.getState().businessStrategy).toBe('thin');
  });

  it('模块六·5 修复：特殊能力次数每日清晨重置（消耗后 startNewDay 恢复为难度上限）', () => {
    const s0 = useTangManagerStore.getState();
    expect(s0.insightRemaining).toBe(3); // B 难度 3 次
    expect(s0.luckRemaining).toBe(1); // B 难度 1 次
    // 消耗全部次数
    useTangManagerStore.setState({ insightRemaining: 0, luckRemaining: 0 });
    useTangManagerStore.getState().startNewDay();
    const after = useTangManagerStore.getState();
    expect(after.insightRemaining).toBe(3);
    expect(after.luckRemaining).toBe(1);
  });

  it('变卖接线：祖传老店不可变卖；变卖 → 现银+估值、店铺-1、soldShops=true', () => {
    const store = useTangManagerStore.getState();
    // 仅一家店
    const denied = store.sellShop();
    expect(denied.ok).toBe(false);
    expect(denied.reason).toBe('此乃祖传老店，不可变卖');
    // 扩张到 2 家店（shenPartner 联动 shopCount+1）
    useTangManagerStore.setState({ shopCount: 2, employees: [] });
    const silverBefore = useTangManagerStore.getState().silver;
    const sold = useTangManagerStore.getState().sellShop();
    expect(sold.ok).toBe(true);
    expect(sold.valuation).toBe(140);
    const after = useTangManagerStore.getState();
    expect(after.silver).toBe(silverBefore + 140);
    expect(after.shopCount).toBe(1);
    expect(after.soldShops).toBe(true);
    expect(after.eventLog.some((e) => e.startsWith('shop-sold:'))).toBe(true);
  });

  it('变卖接线：超出新上限的员工离职并登记去向', () => {
    // shopCount 2 → 新上限 4；放 6 名员工（2 家店满编）→ 2 名离职
    const employees = Array.from({ length: 6 }, (_, i) =>
      makeEmployee({ id: `e${i}`, name: `伙计${i}` })
    );
    useTangManagerStore.setState({ shopCount: 2, employees });
    const sold = useTangManagerStore.getState().sellShop();
    expect(sold.ok).toBe(true);
    expect(sold.laidOffNames).toEqual(['伙计4', '伙计5']);
    const after = useTangManagerStore.getState();
    expect(after.employees.length).toBe(4);
    expect(after.maxEmployees).toBe(4);
    expect(after.eventLog.some((e) => e.startsWith('emp-laidoff:伙计4:'))).toBe(true);
  });
});
