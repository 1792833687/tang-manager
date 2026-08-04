/**
 * Step 5b 金融链路走查（store 接线层端到端）
 * 兑换 → 存款 → 借贷 → 投资 → 到期结算 → 通胀 → 还款 → 取款；gold 兼容字段始终同步。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useTangManagerStore } from '@/stores/tang-manager';

beforeEach(() => {
  useTangManagerStore.getState().resetGame();
});

describe('Step 5b 金融链路走查', () => {
  it('兑换→存款→借贷→投资→到期→通胀→还款→取款 全链路不炸且数值可追踪', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('A'); // silver 80 / credit 100 / legacyDebt 100
    useTangManagerStore.setState({ silver: 500, gold: 500 });

    // 1. 兑换：现银→飞钱（5% 手续费，到账 ×0.95）
    const ex = store.exchangeCurrency('silver_to_feiqian', 100);
    expect(ex?.ok).toBe(true);
    expect(ex?.actualAmount).toBe(95);

    // 2. 存款：存 200（月息 0.5%）
    const dep = store.depositToBank(200);
    expect(dep?.ok).toBe(true);
    const depId = dep!.deposit!.id;

    // 3. 借贷：抵押 300（shop，月息 2%）
    const loan = store.takeMortgageLoan(300, 'shop');
    expect(loan?.ok).toBe(true);
    const loanId = loan!.loan!.id;
    expect(useTangManagerStore.getState().loans).toHaveLength(1);

    // 4. 投资：商会基金 100（day 1）
    const inv = store.invest('guild', 100);
    expect(inv?.ok).toBe(true);
    const invId = inv!.investment!.id;
    expect(useTangManagerStore.getState().investments).toHaveLength(1);

    // 5. 到期结算：day 31（31-1=30 到期）
    useTangManagerStore.setState({ day: 31 });
    const invResult = store.checkInvestments();
    expect(invResult).toHaveLength(1);
    expect(invResult[0]!.id).toBe(invId);
    expect(useTangManagerStore.getState().lastInvestmentResults).toHaveLength(1);

    // 6. 通胀：推进到月初（day 60 → 61）触发 updatePriceIndex
    useTangManagerStore.setState({ day: 60 });
    useTangManagerStore.getState().startNewDay(); // 60 → 61（月初）
    const s61 = useTangManagerStore.getState();
    expect(s61.day).toBe(61);
    expect(s61.lastPriceUpdate).toBe(61);

    // 7. 还款：抵押本金 + 当月利息 300 + 6 = 306
    useTangManagerStore.setState({ silver: 1000, gold: 1000 });
    const repay = store.repayLoan(loanId);
    expect(repay?.ok).toBe(true);
    expect(repay?.total).toBe(306);
    expect(useTangManagerStore.getState().loans.find((l) => l.id === loanId)?.status).toBe('paid');

    // 8. 取款：满 2 个月（day 61，depositDay=1）计息
    const wd = store.withdrawFromBank(depId);
    expect(wd?.ok).toBe(true);
    expect(wd!.interest).toBe(2); // 200 × 0.005 × 2
    expect(wd!.total).toBe(202);

    // 兼容字段：全程 gold === silver / debt === legacyDebt
    const fin = useTangManagerStore.getState();
    expect(fin.gold).toBe(fin.silver);
    expect(fin.debt).toBe(fin.legacyDebt);
  });

  it('高利贷链路：谢七登场后借款 → 月初逐级逾期 → 官府查封（phase=seized）', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 500, gold: 500, xieQiFavor: 40, xieQiIdentityRevealed: true });
    const u = store.takeUsuryLoan(200);
    expect(u?.ok).toBe(true);
    const uid = u!.loan!.id;
    // 连推 3 个月初：61 / 91 / 121（每月先扣息失败 → 逾期 +1）
    useTangManagerStore.setState({ silver: 0, gold: 0, day: 60 });
    useTangManagerStore.getState().startNewDay(); // 61 月初：逾期 1 → 好感 -30
    let s = useTangManagerStore.getState();
    expect(s.xieQiFavor).toBe(10); // 40 - 30
    expect(s.credit).toBe(0); // 50 - 50（逾期信用惩罚，下限 0）
    useTangManagerStore.setState({ day: 90 });
    useTangManagerStore.getState().startNewDay(); // 91 月初：逾期 2（赌场剧情占位）
    useTangManagerStore.setState({ day: 120 });
    useTangManagerStore.getState().startNewDay(); // 121 月初：逾期 3 → 官府查封 phase=seized
    s = useTangManagerStore.getState();
    expect(s.phase).toBe('seized');
    expect(s.eventLog).toContain('usury-seized');
  });
});
