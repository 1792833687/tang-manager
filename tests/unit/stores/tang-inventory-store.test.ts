/**
 * 库存交互接线集成测试（Step 5b-1.5 模块六：store 调用 + 应用变更）
 * 覆盖走查链路：陈损周期→仓储费→扩建；采买折扣→籴粜契→挂牌→次品；
 *               加工→组合→时令；4 库存事件；清晨钩子（籴粜契到货/挂牌/加工出库）；满仓拦截。
 * 注：TANG-S5B15-002 裁决后 maxStorage 初始 200、freeStorageLimit 170（= 初始货架体积），开局零仓储费、不超限；
 * 为测「正常入库」链路仍可临时抬高 maxStorage；测「超限收费/满仓拦截」则主动加库存或压低容量。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useTangManagerStore } from '@/stores/tang-manager';
import { getSeasonalDemand } from '@/systems/tang-processing';
import { checkInventoryEvents } from '@/systems/tang-events';

beforeEach(() => {
  useTangManagerStore.getState().resetGame();
});

describe('陈损周期（打烊钩子）', () => {
  it('settleDay 后 expiry 递减；expiry 0 陈损移除并记「陈损」支出', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState((s) => ({
      shopItems: s.shopItems.map((it) => (it.name === '时蔬' ? { ...it, expiry: 1 } : it)),
    }));
    useTangManagerStore.setState({ silver: 500, gold: 500 });
    useTangManagerStore.getState().settleDay();
    const after = useTangManagerStore.getState();
    const shicai = after.shopItems.find((it) => it.name === '时蔬');
    expect(shicai === undefined || shicai.stock === 0).toBe(true);
    expect(after.ledger.some((e) => e.project === '陈损' && e.amount < 0)).toBe(true);
  });
});

describe('仓储费（月初扣整月）与扩建', () => {
  it('超免费上限时月初扣仓储费并记账（day 30 → 31）', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 500, gold: 500, day: 30 });
    // 加库存使体积超 freeStorageLimit 170（羊肉 +30 → 60×3=180+米酒50+酱牛肉30+时蔬30 = 290）
    useTangManagerStore.setState((s) => ({
      shopItems: s.shopItems.map((it) => (it.name === '羊肉' ? { ...it, stock: 60 } : it)),
    }));
    const beforeSilver = useTangManagerStore.getState().silver;
    useTangManagerStore.getState().startNewDay(); // → 31（月初）
    const after = useTangManagerStore.getState();
    expect(after.day).toBe(31);
    expect(after.silver).toBeLessThan(beforeSilver);
    expect(after.ledger.some((e) => e.project === '仓储费' && e.amount < 0)).toBe(true);
  });

  it('扩建：扣费、进入扩建期（容量暂不增）；完工日生效', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 500, gold: 500 });
    const r = useTangManagerStore.getState().expandWarehouse();
    expect(r?.ok).toBe(true);
    let s = useTangManagerStore.getState();
    expect(s.warehouseExpansion?.targetLevel).toBe(2);
    expect(s.maxStorage).toBe(200); // 扩建期间容量暂不增（TANG-S5B15-002：初始 200）
    expect(s.silver).toBe(300); // 500 - 200
    useTangManagerStore.setState({ day: 3 });
    useTangManagerStore.getState().startNewDay(); // → 4（完工）
    s = useTangManagerStore.getState();
    expect(s.warehouseLevel).toBe(2);
    expect(s.maxStorage).toBe(250);
    expect(s.warehouseExpansion).toBeNull();
  });

  it('扩建中不可重复扩建；满级（5 级）不可再扩', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 5000, gold: 5000 });
    useTangManagerStore.getState().expandWarehouse();
    expect(useTangManagerStore.getState().expandWarehouse()?.ok).toBe(false);
    useTangManagerStore.setState({ warehouseLevel: 5, warehouseExpansion: null });
    expect(useTangManagerStore.getState().expandWarehouse()?.ok).toBe(false);
  });
});

describe('挂牌 / 籴粜契 / 加工出库（抬高容量测正常链路）', () => {
  it('挂牌：当日采买扣现银、扣 remainingToday、入库', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 500, gold: 500, maxStorage: 500 });
    useTangManagerStore.getState().startNewDay(); // → day 2，生成挂牌
    const s = useTangManagerStore.getState();
    if ((s.marketListings ?? []).length === 0) {
      useTangManagerStore.setState({ marketListings: [{ id: 'ml-test', itemName: '米酒', originalPrice: 1, listedPrice: 0.7, discount: 0.7, maxQuantity: 50, remainingToday: 50, day: 2 }] });
    }
    const listing = useTangManagerStore.getState().marketListings![0]!;
    const beforeSilver = useTangManagerStore.getState().silver;
    const r = useTangManagerStore.getState().purchaseListing(listing.id, 10);
    expect(r?.ok).toBe(true);
    const after = useTangManagerStore.getState();
    expect(after.silver).toBe(beforeSilver - r!.cost!);
    expect(after.marketListings!.find((l) => l.id === listing.id)!.remainingToday).toBe(listing.remainingToday - 10);
    expect(after.ledger.some((e) => e.project === '市易务采买')).toBe(true);
  });

  it('籴粜契：付定金、到期清晨自动入库（到货次品按难度）', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 500, gold: 500, maxStorage: 500 });
    const yangrou = useTangManagerStore.getState().shopItems.find((it) => it.name === '羊肉')!;
    const r = useTangManagerStore.getState().createForwardContract(yangrou.id, 10, 8);
    expect(r?.ok).toBe(true);
    expect(r!.contract!.deposit).toBe(6.3);
    let s = useTangManagerStore.getState();
    expect(s.silver).toBe(500 - 6.3);
    useTangManagerStore.setState({ day: 7 });
    useTangManagerStore.getState().startNewDay(); // → 8
    s = useTangManagerStore.getState();
    expect(s.forwardContracts![0]!.status).toBe('delivered');
    expect(s.ledger.some((e) => e.project === '籴粜契到货')).toBe(true);
    const yang = s.shopItems.find((it) => it.name === '羊肉')!;
    expect(yang.stock).toBeGreaterThanOrEqual(20);
    expect(yang.stock).toBeLessThanOrEqual(30);
  });

  it('加工开工：扣原料/扣费/入队；到期出库合并库存', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 500, gold: 500, maxStorage: 500 });
    const r = useTangManagerStore.getState().startProcessing('pao-chenniang');
    expect(r?.ok).toBe(true);
    let s = useTangManagerStore.getState();
    expect(s.shopItems.find((it) => it.name === '米酒')!.stock).toBe(45);
    expect(s.processingQueue).toHaveLength(1);
    useTangManagerStore.setState({ day: 4 });
    useTangManagerStore.getState().startNewDay(); // → 5 完工
    s = useTangManagerStore.getState();
    expect(s.shopItems.find((it) => it.name === '陈酿')).toBeDefined();
    expect(s.shopItems.find((it) => it.name === '陈酿')!.stock).toBe(1);
    expect(s.processingQueue![0]!.status).toBe('completed');
  });
});

describe('组合与满仓拦截', () => {
  it('组合：原料足生成食盒（体积/陈损/价格），原料不足拒绝', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 500, gold: 500, maxStorage: 500 });
    expect(useTangManagerStore.getState().createAssemble('asm-yaji')?.ok).toBe(false); // 陈酿不足
    const ok = useTangManagerStore.getState().createAssemble('asm-xichenyan');
    expect(ok?.ok).toBe(true);
    const s = useTangManagerStore.getState();
    const box = s.shopItems.find((it) => it.name === '洗尘宴食盒')!;
    expect(box.stock).toBe(1);
    expect(box.volume).toBe(11.2);
    expect(box.expiry).toBe(7);
    expect(s.shopItems.find((it) => it.name === '羊肉')!.stock).toBe(18);
  });

  it('满仓拦截：挂牌采买超容量 → 拒绝并旁白「库房堆得插不进脚」', () => {
    const store = useTangManagerStore.getState();
    store.initByDifficulty('B');
    useTangManagerStore.setState({ silver: 500, gold: 500, maxStorage: 100 });
    useTangManagerStore.setState({
      marketListings: [{ id: 'ml-full', itemName: '米酒', originalPrice: 1, listedPrice: 0.7, discount: 0.7, maxQuantity: 50, remainingToday: 50, day: useTangManagerStore.getState().day }],
    });
    const r = useTangManagerStore.getState().purchaseListing('ml-full', 10);
    expect(r?.ok).toBe(false);
    expect(useTangManagerStore.getState().inventoryNarratives?.some((n) => n.includes('库房'))).toBe(true);
  });
});

describe('库存事件接线', () => {
  it('checkInventoryEvents 纯函数门控；resolveEventChoice 应用窃贼损失', () => {
    const state = useTangManagerStore.getState();
    const evs = checkInventoryEvents({ shopItems: state.shopItems }, () => 0.01);
    expect(Array.isArray(evs)).toBe(true);
    useTangManagerStore.setState({
      pendingEvents: [{ id: 'inv-thief', type: 'random', title: '窃贼光顾', description: 'x', trigger: { type: 'day_range', minDay: 0, maxDay: 9999 }, choices: [{ id: 'loss', label: '自认倒霉', consequence: 'x', effect: { special: 'inv_thief_loss' } }] }],
    });
    const silverBefore = useTangManagerStore.getState().silver;
    useTangManagerStore.getState().resolveEventChoice('inv-thief', 'loss');
    const after = useTangManagerStore.getState();
    expect(after.pendingEvents.some((e) => e.id === 'inv-thief')).toBe(false);
    expect(after.silver).toBeLessThanOrEqual(silverBefore);
  });
});

describe('时令需求映射', () => {
  it('秋季人参/当归 +50%（纯函数）', () => {
    const d = getSeasonalDemand({ day: 240 });
    expect(d.season).toBe('秋');
    expect(d.boosts['人参']).toBe(1.5);
  });
});
