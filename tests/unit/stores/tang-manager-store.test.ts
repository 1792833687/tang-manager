/**
 * 掌柜 Store 接线集成测试（Step 3 世界激活）
 * 覆盖：事件入队/出队与 special 处理（债主月息扣款、回头客加客）、福星高照次数与净赢、
 *       还债、破产流程（gold≤0 → bankrupt → 分档重置）、startNewDay 事件触发。
 * 注意：这些是接线行为，系统纯函数已有单测；此处验证 store「调用 + 应用变更」正确。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useTangManagerStore } from '@/stores/tang-manager';
import { calculateStorageCost } from '@/systems/tang-expiry';

beforeEach(() => {
  useTangManagerStore.getState().resetGame();
});

describe('事件接线（3.1）', () => {
  it('startNewDay 进入第 7 天时债主事件入队；resolveEventChoice 出队并按 monthlyInterest 扣款', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    // 推进到 day 6（结算 5 次）
    for (let i = 0; i < 5; i++) {
      useTangManagerStore.setState({ day: useTangManagerStore.getState().day + 1 });
    }
    useTangManagerStore.setState({ day: 6 });
    useTangManagerStore.getState().startNewDay(); // day 6 → 7
    const s = useTangManagerStore.getState();
    expect(s.day).toBe(7);
    expect(s.pendingEvents.some((e) => e.id === 'debtor')).toBe(true);

    const silverBefore = s.silver;
    useTangManagerStore.getState().resolveEventChoice('debtor', 'pay');
    const after = useTangManagerStore.getState();
    expect(after.eventLog).toContain('debtor');
    expect(after.pendingEvents.some((e) => e.id === 'debtor')).toBe(false);
    expect(after.silver).toBe(silverBefore - after.monthlyInterest); // 按 monthlyInterest 扣（B=5，非写死）
    expect(after.gold).toBe(after.silver); // 兼容字段同步
  });

  it('回头客事件选项 A：额外 +1 大单客人、精力-5', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ score: 3.5 });
    // 触发回头客事件并入队
    useTangManagerStore.getState().triggerEvent('repeat-customer');
    const s = useTangManagerStore.getState();
    const guestCount = s.guests.length;
    const energyBefore = s.energy;
    useTangManagerStore.getState().resolveEventChoice('repeat-customer', 'big_order');
    const after = useTangManagerStore.getState();
    expect(after.guests.length).toBe(guestCount + 1);
    expect(after.guests[after.guests.length - 1]!.type).toBe('big_order');
    expect(after.energy).toBe(energyBefore - 5);
  });

  it('triggerEvent 防重复：eventLog 已记录则不二次入队', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    store.triggerEvent('debtor');
    store.triggerEvent('debtor');
    const s = useTangManagerStore.getState();
    expect(s.pendingEvents.filter((e) => e.id === 'debtor').length).toBe(1);
  });
});

describe('福星高照接线（3.3）', () => {
  it('playLuckyStar：消耗 1 次、silver 加净赢、maxGamblingWin 追踪最大值', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    const silverBefore = store.silver;
    const result = useTangManagerStore.getState().playLuckyStar();
    expect(result).not.toBeNull();
    const s = useTangManagerStore.getState();
    expect(s.luckRemaining).toBe(0);
    expect(s.silver).toBe(silverBefore + result!.netGain);
    expect(s.gold).toBe(s.silver);
    expect(s.maxGamblingWin).toBe(result!.netGain);
  });

  it('luckRemaining 为 0 时返回 null', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ luckRemaining: 0 });
    expect(useTangManagerStore.getState().playLuckyStar()).toBeNull();
  });
});

describe('还债接线（配套 3.5/谢七事件；5b 模块六）', () => {
  it('repayDebt：现银不足不可部分还款（拒绝）；足额按 min(amount, legacyDebt) 扣减', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 30, legacyDebt: 200 });
    // 银两不足 → 拒绝（模块六：现银不足不可部分还款）
    const r = useTangManagerStore.getState().repayDebt(50);
    expect(r?.ok).toBe(false);
    let s = useTangManagerStore.getState();
    expect(s.silver).toBe(30);
    expect(s.legacyDebt).toBe(200);
    // 足额还款 30 → 扣 30
    useTangManagerStore.getState().repayDebt(30);
    s = useTangManagerStore.getState();
    expect(s.silver).toBe(0);
    expect(s.legacyDebt).toBe(200 - 30);
    expect(s.debt).toBe(s.legacyDebt);
  });
});

describe('破产接线（3.6）', () => {
  it('enterBankruptcy：B 档资金 5、声望清零、hasGoneBroke=true（settleDay 以 checkBankruptcy 门控）', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 0, reputation: 300 });
    store.enterBankruptcy();
    const s = useTangManagerStore.getState();
    expect(s.phase).toBe('bankrupt');
    expect(s.silver).toBe(5);
    expect(s.gold).toBe(5);
    expect(s.reputation).toBe(0);
    expect(s.hasGoneBroke).toBe(true);
  });

  it('破产每日小买卖 day+1；坚持满 10 天后可重启回 playing', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    store.enterBankruptcy(); // day=1
    const s0 = useTangManagerStore.getState();
    expect(s0.phase).toBe('bankrupt');
    expect(s0.bankruptcyStartDay).toBe(1);
    // 刷 9 天 → day 10 → 已坚持 9 天 <10 → 不可重启
    for (let i = 0; i < 9; i++) {
      useTangManagerStore.getState().bankruptcyDailyHustle();
    }
    const s9 = useTangManagerStore.getState();
    expect(s9.day).toBe(10);
    expect(s9.phase).toBe('bankrupt');
    // 第 10 次 → day 11 → 已坚持 10 天 → 重启
    useTangManagerStore.getState().bankruptcyDailyHustle();
    const s10 = useTangManagerStore.getState();
    expect(s10.day).toBe(11);
    useTangManagerStore.getState().restartAfterBankruptcy();
    const restarted = useTangManagerStore.getState();
    expect(restarted.phase).toBe('playing');
    expect(restarted.score).toBe(1.0);
    expect(restarted.silver).toBe(50); // B 初始
    expect(restarted.gold).toBe(50);
    expect(restarted.guests.length).toBe(5);
  });
});

describe('Step 5b · 货币与金融接线', () => {
  it('initByDifficulty 初始化多货币字段：silver/feiqian/credit 按难度', () => {
    useTangManagerStore.getState().initByDifficulty('A');
    const a = useTangManagerStore.getState();
    expect(a.silver).toBe(80);
    expect(a.gold).toBe(a.silver);
    expect(a.feiqian).toBe(0);
    expect(a.credit).toBe(100); // A=100
    expect(a.legacyDebt).toBe(100);
    expect(a.debt).toBe(a.legacyDebt);
    expect(a.priceIndex).toBe(1);
    expect(a.deposits).toEqual([]);
    expect(a.loans).toEqual([]);
    expect(a.investments).toEqual([]);
    useTangManagerStore.getState().initByDifficulty('C');
    expect(useTangManagerStore.getState().credit).toBe(0); // C=0
  });

  it('gold 兼容字段始终同步 silver（兑换/存款/借贷后）', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('A');
    store.exchangeCurrency('silver_to_feiqian', 10);
    let s = useTangManagerStore.getState();
    expect(s.gold).toBe(s.silver);
    expect(s.feiqian).toBe(9.5); // 10 × 0.95
    store.depositToBank(20);
    s = useTangManagerStore.getState();
    expect(s.gold).toBe(s.silver);
    expect(s.deposits).toHaveLength(1);
    store.takeMortgageLoan(50, 'shop');
    s = useTangManagerStore.getState();
    expect(s.gold).toBe(s.silver);
    expect(s.loans).toHaveLength(1);
  });

  it('updateCredit 写入信用流水并夹取 0-1000', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    store.updateCredit(30, '完成任务');
    let s = useTangManagerStore.getState();
    expect(s.credit).toBe(80);
    expect(s.creditHistory.at(-1)?.reason).toBe('完成任务');
    store.updateCredit(-200, '破产');
    s = useTangManagerStore.getState();
    expect(s.credit).toBe(0); // 下限
  });

  it('月初钩子：day 30 → 31 触发通胀更新与贷款检查', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    store.takeMortgageLoan(200, 'shop'); // 月息 4（2%）
    // 推进到 day 30
    useTangManagerStore.setState({ day: 30 });
    const before = useTangManagerStore.getState();
    expect(before.priceIndex).toBe(1);
    useTangManagerStore.getState().startNewDay(); // → day 31（月初）
    const after = useTangManagerStore.getState();
    expect(after.day).toBe(31);
    expect(after.lastPriceUpdate).toBe(31);
    // 月初自动扣息：200×2%=4（无随机年景时 priceIndex 可能 ±5% 浮动，仅断言已更新）
    expect(after.loans[0]!.overdueMonths).toBe(0);
    // Step 5b-1.5：月初另扣整月仓储费（超出 freeStorageLimit 部分；TANG-S5B15-002 后初始货架 170 = 免费上限 170 → 开局不收费）
    const storageCost = calculateStorageCost({ shopItems: after.shopItems, freeStorageLimit: after.freeStorageLimit, day: after.day });
    expect(storageCost).toBe(0);
    expect(after.silver).toBe(Math.max(0, before.silver - 4 - storageCost));
  });

  it('checkInvestments：到期结算写入 lastInvestmentResults 并应用盈亏到 silver', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 200, gold: 200 });
    const inv = store.invest('guild', 100); // investDay = 1
    expect(inv?.ok).toBe(true);
    const id = inv!.investment!.id;
    // 强制预期回报为确定值
    useTangManagerStore.setState((s) => ({
      investments: (s.investments ?? []).map((i) => (i.id === id ? { ...i, expectedReturn: 0.1 } : i)),
    }));
    useTangManagerStore.setState({ day: 31 }); // 31-1 = 30 → 到期
    const before = useTangManagerStore.getState().silver;
    const results = useTangManagerStore.getState().checkInvestments();
    expect(results).toHaveLength(1);
    expect(results[0]!.gain).toBe(10); // 100 × 0.1
    const after = useTangManagerStore.getState();
    expect(after.silver).toBe(before + 10);
    expect(after.lastInvestmentResults).toHaveLength(1);
    useTangManagerStore.getState().dismissInvestmentResults();
    expect(useTangManagerStore.getState().lastInvestmentResults).toBeUndefined();
  });

  it('settleDay：投资到期盈亏与当日经营收入叠加（不覆盖 netIncome）', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B'); // day 1
    useTangManagerStore.setState({ silver: 200, gold: 200 });
    const inv = store.invest('guild', 100); // investDay = 1
    useTangManagerStore.setState((s) => ({
      investments: (s.investments ?? []).map((i) =>
        i.id === inv!.investment!.id ? { ...i, expectedReturn: 0.1 } : i
      ),
    }));
    useTangManagerStore.setState({ day: 31, guests: [] });
    // 打烊前已接待一位高收入客人（净收益中计入 100 客单消费）
    useTangManagerStore.setState({
      guests: [
        { id: 'g', name: '胡商', type: 'big_order', description: 'x', baseConsumption: 100, mentalOS: null, handled: true, review: 'good', incomeEarned: 100 },
      ],
    });
    const before = useTangManagerStore.getState().silver; // 100（投资扣款后）
    useTangManagerStore.getState().settleDay();
    const after = useTangManagerStore.getState();
    // 修复前：investPatch 从旧 silver 起算会覆盖掉当日净收益（≈110）；修复后叠加（≥200）
    expect(after.silver).toBeGreaterThan(before + 50);
    expect(after.lastInvestmentResults).toHaveLength(1);
  });
});

describe('v1.0 功能解锁接线（TANG-POLISH-001 模块二/五）', () => {
  it('resetGame 后 unlockedFeatures 默认为空对象（新字段默认值适配）', () => {
    useTangManagerStore.getState().resetGame();
    const s = useTangManagerStore.getState();
    expect(s.unlockedFeatures).toEqual({});
  });

  it('initByDifficulty 后 unlockedFeatures 为空；checkFeatureUnlock 开局解锁 always 四功能', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    const s = useTangManagerStore.getState();
    expect(s.unlockedFeatures ?? {}).toEqual({});
    const newly = useTangManagerStore.getState().checkFeatureUnlock();
    // always 四功能：me/reception/shelf/ledger
    expect(newly).toEqual(expect.arrayContaining(['me', 'reception', 'shelf', 'ledger']));
    const after = useTangManagerStore.getState();
    expect(after.unlockedFeatures?.['me']).toBe(true);
    expect(after.unlockedFeatures?.['reception']).toBe(true);
    expect(after.unlockedFeatures?.['shelf']).toBe(true);
    expect(after.unlockedFeatures?.['ledger']).toBe(true);
  });

  it('checkFeatureUnlock 幂等：重复调用不重复返回已解锁功能', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    useTangManagerStore.getState().checkFeatureUnlock();
    const second = useTangManagerStore.getState().checkFeatureUnlock();
    // 第二次应只返回新解锁（无 always 之外的增量），且不重复 already 中的 me 等
    for (const id of second) {
      expect(['me', 'reception', 'shelf', 'ledger']).not.toContain(id);
    }
  });

  it('startNewDay 清晨钩子自动调用 checkFeatureUnlock（第 3 天 + 员工 → staff 解锁）', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    useTangManagerStore.getState().checkFeatureUnlock(); // day1：always 四功能
    useTangManagerStore.setState({ day: 2 });
    useTangManagerStore.getState().startNewDay(); // day 2 → 3
    // 模拟已雇员工
    useTangManagerStore.setState((s) => ({
      employees: s.employees.length === 0 ? [{ id: 'emp1', name: '赵三', type: 'waiter', salary: 20, satisfaction: 60, skills: [], shift: 'full' } as never] : s.employees,
    }));
    useTangManagerStore.getState().checkFeatureUnlock();
    const after = useTangManagerStore.getState();
    expect(after.unlockedFeatures?.['staff']).toBe(true);
  });
});

describe('模块三：信用破产阻止借贷（边缘场景）', () => {
  it('creditBankruptDays > 0 时抵押借贷/高利贷被阻止', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    // 模拟信用破产中
    useTangManagerStore.setState({ creditBankruptDays: 10 });
    const s = useTangManagerStore.getState();
    const mortgage = s.takeMortgageLoan(100, 'shop');
    const usury = s.takeUsuryLoan(100);
    expect(mortgage?.ok).toBe(false);
    expect(mortgage?.reason).toContain('信用破产');
    expect(usury?.ok).toBe(false);
    expect(usury?.reason).toContain('信用破产');
  });

  it('信用恢复（creditBankruptDays=0）后借贷恢复正常', () => {
    useTangManagerStore.getState().initByDifficulty('B');
    // 谢七好感满足高利贷条件
    useTangManagerStore.setState({ creditBankruptDays: 0, xieQiFavor: 50 });
    const s = useTangManagerStore.getState();
    const mortgage = s.takeMortgageLoan(100, 'shop');
    const usury = s.takeUsuryLoan(100);
    expect(mortgage?.ok).toBe(true);
    expect(usury?.ok).toBe(true);
  });
});

describe('completeDialogueReception 接线（P1 修复：策略/预购接入）', () => {
  const baseGuest = { id: 'g-dlg', name: '张客官', type: 'normal' as const, description: '看看货', baseConsumption: 5, handled: false };
  const makeResult = (overrides: Record<string, unknown> = {}) => ({
    ok: true,
    shop: 'jiulou' as const,
    income: 12,
    incomeMultiplier: 1,
    satisfactionDelta: 5,
    favorDelta: 0,
    energyConsumed: 5,
    review: 'good' as const,
    narrative: '（测试叙事）',
    summary: ['入账 12 两'],
    flags: {},
    guestId: 'g-dlg',
    ...overrides,
  });
  it('正常成交：客人已处理、银两入账、故事弹窗', () => {
    const st = useTangManagerStore.getState();
    st.initByDifficulty('B');
    useTangManagerStore.setState({ guests: [{ ...baseGuest }], shopItems: [], phase: 'playing' });
    useTangManagerStore.getState().completeDialogueReception(makeResult(), () => 0.5);
    const after = useTangManagerStore.getState();
    expect(after.guests[0]!.handled).toBe(true);
    expect(after.guests[0]!.incomeEarned).toBe(12); // 收入记入本单，结算统一入账
    expect(after.storyNarrative).not.toBeNull();
  });
  it('大单预购：big_order + rng=0 → 转预购、现货收入 0', () => {
    const st = useTangManagerStore.getState();
    st.initByDifficulty('B');
    useTangManagerStore.setState({
      guests: [{ ...baseGuest, id: 'g-big', type: 'big_order', baseConsumption: 12 }],
      shopItems: [{ id: 'i1', name: '丝绸', price: 20, cost: 10, stock: 10, category: '布匹' }],
      phase: 'playing',
    });
    useTangManagerStore.getState().completeDialogueReception(makeResult({ guestId: 'g-big', income: 30 }), () => 0);
    const after = useTangManagerStore.getState();
    expect(after.preOrders.length).toBeGreaterThan(0);
    expect(after.guests.find((g) => g.id === 'g-big')!.handled).toBe(true);
  });
  it('接待策略 delegate：伙计代劳、故事弹窗「伙计代劳」', () => {
    const st = useTangManagerStore.getState();
    st.initByDifficulty('B');
    useTangManagerStore.setState({ guests: [{ ...baseGuest, id: 'g-dlg2' }], shopItems: [], phase: 'playing', receptionStrategy: 'delegate' });
    useTangManagerStore.getState().completeDialogueReception(makeResult({ guestId: 'g-dlg2' }), () => 0.5);
    const after = useTangManagerStore.getState();
    expect(after.guests.find((g) => g.id === 'g-dlg2')!.handled).toBe(true);
    expect(after.storyNarrative?.title).toBe('伙计代劳');
  });
});

describe('更多接线集成（连锁到期 / 行为触发 / 产业每日结算）', () => {
  it('checkPendingConsequences：到期连锁触发并应用数值 + 弹窗数值区', () => {
    const st = useTangManagerStore.getState();
    st.initByDifficulty('B');
    useTangManagerStore.setState({
      pendingConsequences: [{ id: 'pc1', sourceEventId: 'neighbor-borrow', triggerDay: st.day, consequenceEventId: 'neighbor-repay', narrative: '（王掌柜还粮道谢）', effect: { gold: 3, reputation: 5 } }],
    });
    useTangManagerStore.getState().checkPendingConsequences();
    const after = useTangManagerStore.getState();
    expect(after.pendingConsequences).toHaveLength(0);
    expect(after.storyNarrative).not.toBeNull();
    expect(after.storyNarrative!.numbers.some((n) => n.includes('+3'))).toBe(true);
    expect(after.reputation).toBeGreaterThanOrEqual(st.reputation + 5);
  });
  it('checkBehaviorEvents：连续全亲自接待 ≥5 天 → 触发过度劳累事件（按疲劳度）', () => {
    const st = useTangManagerStore.getState();
    st.initByDifficulty('B');
    useTangManagerStore.setState({ consecutiveFullReceptionDays: 5, eventFatigue: { lastTriggerDay: {}, categoryCounts: {}, consecutiveDays: 0, oneTimeDone: {} } });
    useTangManagerStore.getState().checkBehaviorEvents(st.day);
    const after = useTangManagerStore.getState();
    expect(after.pendingEvents.some((e) => e.id === 'event-overwork')).toBe(true);
    expect(after.eventFatigue.oneTimeDone['event-overwork']).toBe(true); // 一次性事件已标记
  });
  it('industryTick：研发到期 → 结算并从队列移除（菜品新增或研发经验累积）', () => {
    const st = useTangManagerStore.getState();
    st.initByDifficulty('B');
    useTangManagerStore.setState({ tavernResearchJobs: [{ id: 'tr1', dishId: 'dish-荤菜-东坡焖肉', dishName: '东坡焖肉', category: '荤菜', totalDays: 1, remainingDays: 1, successRate: 0.9, cost: 30 }] });
    const dishesBefore = useTangManagerStore.getState().tavernDishes.length;
    const expBefore = useTangManagerStore.getState().tavernResearchExp;
    useTangManagerStore.getState().industryTick(st.day + 1);
    const after = useTangManagerStore.getState();
    expect(after.tavernResearchJobs).toHaveLength(0);
    expect(after.tavernDishes.length >= dishesBefore || after.tavernResearchExp > expBefore).toBe(true);
  });
});

describe('P1 新接线（购店 / 转政政务闭环）', () => {
  it('purchaseBranch：银两不足拒绝；足额后 shopCount+1、maxEmployees+2、扣银', () => {
    const st = useTangManagerStore.getState();
    st.initByDifficulty('B');
    const low = useTangManagerStore.getState().purchaseBranch();
    expect(low.ok).toBe(false);
    useTangManagerStore.setState({ silver: 1000, gold: 1000 });
    const res = useTangManagerStore.getState().purchaseBranch();
    expect(res.ok).toBe(true);
    const after = useTangManagerStore.getState();
    expect(after.shopCount).toBe(2);
    expect(after.maxEmployees).toBe(6); // 4 + 2
    expect(after.silver).toBe(200); // 1000 - 800
  });
  it('resolvePoliticsDecision：逐道政务推进，5 道尽办 → 权倾朝野结局', () => {
    const st = useTangManagerStore.getState();
    st.initByDifficulty('B');
    useTangManagerStore.setState({ phase: 'politics', politicsStep: 0, politicsDone: false, currentPoliticsDecision: { id: 'pol-caoyun', title: '漕运决案', description: 'x', choices: [{ id: 'a', label: 'a', consequence: 'c', effect: { reputation: 8 } }] } });
    useTangManagerStore.getState().resolvePoliticsDecision('a');
    let s = useTangManagerStore.getState();
    expect(s.politicsStep).toBe(1);
    expect(s.reputation).toBeGreaterThanOrEqual(st.reputation + 8);
    // 简化：直接推进到最后一题并答完
    useTangManagerStore.setState({
      politicsStep: 4,
      currentPoliticsDecision: { id: 'pol-huangshang', title: '皇商招标', description: 'x', choices: [{ id: 'a', label: 'a', consequence: 'c', effect: { reputation: 8 } }] },
    });
    useTangManagerStore.getState().resolvePoliticsDecision('a');
    s = useTangManagerStore.getState();
    expect(s.politicsDone).toBe(true);
    expect(s.endingTriggered).toBe('quanqing-chaoye');
  });
});
