/**
 * 商品加工系统单测（tang-processing · Step 5b-1.5 模块三）
 * 覆盖：三店型配方、加工消耗/产出/加工费、队列到期入库、组合商品体积与陈损、时令需求。
 */
import { describe, expect, it } from 'vitest';
import {
  ASSEMBLE_RECIPES,
  PROCESSING_RECIPES,
  assembleMaterialValue,
  assembleSeasonalMultiplier,
  checkProcessingQueue,
  createAssemble,
  getAssembleRecipes,
  getProcessingRecipes,
  getSeasonalDemand,
  materialValue,
  processFee,
  startProcessing,
} from '@/systems/tang-processing';
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

const JIOU_ITEMS: ShopItem[] = [
  makeItem({ id: 'yang', name: '羊肉', stock: 10 }),
  makeItem({ id: 'mijiu', name: '米酒', price: 1, cost: 0.6, stock: 20, volume: 1, expiry: 90 }),
  makeItem({ id: 'shicai', name: '时蔬', price: 0.5, cost: 0.3, stock: 30, volume: 1, expiry: 7 }),
  makeItem({ id: 'jiangniurou', name: '酱牛肉', price: 5, cost: 3, stock: 5 }),
];

function makeState(overrides: Partial<TangGameState> = {}): Partial<TangGameState> {
  return {
    shopItems: JIOU_ITEMS,
    day: 1,
    processingQueue: [],
    ...overrides,
  };
}

describe('三店型配方', () => {
  it('每店型 3 配方（庖制/染织/炮制），总 9 个', () => {
    expect(PROCESSING_RECIPES).toHaveLength(9);
    expect(getProcessingRecipes('jiulou')).toHaveLength(3);
    expect(getProcessingRecipes('buzhuang')).toHaveLength(3);
    expect(getProcessingRecipes('yaopu')).toHaveLength(3);
  });

  it('用户 3.1 逐字：生羊肉×3+柴火×1→酱牛肉×1（2 倍）；米酒×5→陈酿×1（1.8 倍）；时蔬×10→腌菜×5（陈损期 60）', () => {
    const pao = getProcessingRecipes('jiulou');
    const jiang = pao.find((r) => r.id === 'pao-jiangniurou')!;
    expect(jiang.inputs).toEqual([{ itemName: '羊肉', quantity: 3 }]);
    expect(jiang.consumables).toEqual([{ itemName: '柴火', quantity: 1 }]);
    expect(jiang.output).toEqual({ name: '酱牛肉', quantity: 1 });
    expect(jiang.multiplier).toBe(2);
    const chen = pao.find((r) => r.id === 'pao-chenniang')!;
    expect(chen.output.name).toBe('陈酿');
    expect(chen.multiplier).toBe(1.8);
    const yan = pao.find((r) => r.id === 'pao-yancai')!;
    expect(yan.outputExpiry).toBe(60);
  });
});

describe('原料价值与加工费', () => {
  it('原料总价 = Σ(真实原料数量×售价) + Σ(虚耗品固定价)；加工费 = 5%', () => {
    const recipe = getProcessingRecipes('jiulou').find((r) => r.id === 'pao-jiangniurou')!;
    // 羊肉 3×3 + 柴火 1 = 10
    expect(materialValue(recipe, JIOU_ITEMS)).toBe(10);
    expect(processFee(recipe, JIOU_ITEMS)).toBe(0.5);
  });

  it('虚耗品固定价：柴火 1 / 染料 2 / 金线 5 / 棉花 2 / 药引 3', () => {
    const ran = getProcessingRecipes('buzhuang').find((r) => r.id === 'ran-cixiusichou')!;
    // 丝绸 2×8 + 金线 5 = 21
    const items = JIOU_ITEMS.map((i) => (i.name === '羊肉' ? { ...i, id: 'si', name: '丝绸', price: 8, category: '布匹' } : i));
    expect(materialValue(ran, items)).toBe(21);
  });
});

describe('startProcessing · 加工开始', () => {
  it('原料足且银两足：扣原料、扣加工费+虚耗品、入队（completionDay = day + days）', () => {
    const r = startProcessing({ recipeId: 'pao-jiangniurou', shopItems: JIOU_ITEMS, silver: 50, day: 1 });
    expect(r.ok).toBe(true);
    expect(r.job!.completionDay).toBe(3); // days=2
    expect(r.job!.status).toBe('processing');
    expect(r.consumablesCost).toBe(1); // 柴火
    expect(r.processFee).toBe(0.5); // 10 × 5%
    // 产出单价 = 原料总价 10 × 2 ÷ 1 = 20
    expect(r.job!.outputPrice).toBe(20);
  });

  it('原料不足拒绝；银两不足拒绝', () => {
    const noStock = startProcessing({ recipeId: 'pao-jiangniurou', shopItems: [makeItem({ stock: 1 })], silver: 50, day: 1 });
    expect(noStock.ok).toBe(false);
    expect(noStock.reason).toContain('不足');
    const poor = startProcessing({ recipeId: 'pao-jiangniurou', shopItems: JIOU_ITEMS, silver: 0, day: 1 });
    expect(poor.ok).toBe(false);
  });
});

describe('checkProcessingQueue · 队列到期', () => {
  it('到期自动完成并产出商品（outputPrice/outputCost 锁定）；未到期仍在队列', () => {
    const job = {
      id: 'pj-1', recipeId: 'pao-jiangniurou', outputName: '酱牛肉', outputQuantity: 1,
      completionDay: 3, status: 'processing' as const, outputPrice: 20, outputCost: 10,
    };
    const before = checkProcessingQueue(makeState({ processingQueue: [job], day: 2 }), JIOU_ITEMS);
    expect(before.completed).toHaveLength(0);
    expect(before.remainingJobs).toHaveLength(1);
    const due = checkProcessingQueue(makeState({ processingQueue: [job], day: 3 }), JIOU_ITEMS);
    expect(due.completed).toHaveLength(1);
    expect(due.completed[0]!.outputItem.price).toBe(20);
    expect(due.completed[0]!.outputItem.stock).toBe(1);
    expect(due.completed[0]!.outputItem.category).toBe('食材');
    expect(due.completed[0]!.outputItem.expiry).toBe(14);
    expect(due.remainingJobs[0]!.status).toBe('completed');
  });
});

describe('createAssemble · 组合商品', () => {
  it('原料足：消耗原料、生成组合商品（体积=原料总和×0.8、陈损期=最短原料、价=原料总价×折扣）', () => {
    const r = createAssemble({ assembleId: 'asm-xichenyan', shopItems: JIOU_ITEMS, day: 5 });
    expect(r.ok).toBe(true);
    const item = r.item!;
    expect(item.name).toBe('洗尘宴食盒');
    expect(item.stock).toBe(1);
    // 原料总价 = 羊肉2×3 + 米酒3×1 + 时蔬5×0.5 = 6+3+2.5 = 11.5；九折 → 10.35
    expect(r.materialValue).toBe(11.5);
    expect(r.combinedPrice).toBe(10.35);
    // 体积 = (2×3 + 3×1 + 5×1) × 0.8 = 14×0.8 = 11.2
    expect(item.volume).toBe(11.2);
    // 陈损期 = min(羊肉10, 米酒90, 时蔬7) = 7
    expect(item.expiry).toBe(7);
  });

  it('原料不足拒绝（陈酿不在库存）', () => {
    const r = createAssemble({ assembleId: 'asm-yaji', shopItems: JIOU_ITEMS, day: 5 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('不足');
  });

  it('食盒/锦匣/药囊配方齐全（酒楼 2、布庄 2、药铺 2）', () => {
    expect(ASSEMBLE_RECIPES).toHaveLength(6);
    expect(getAssembleRecipes('jiulou')).toHaveLength(2);
    expect(getAssembleRecipes('buzhuang')).toHaveLength(2);
    expect(getAssembleRecipes('yaopu')).toHaveLength(2);
  });
});

describe('时令需求', () => {
  it('春（2-4 月）丝绸/锦缎 +30%', () => {
    const d = getSeasonalDemand({ day: 60 }); // 2 月
    expect(d.season).toBe('春');
    expect(d.boosts['丝绸']).toBe(1.3);
    expect(d.boosts['锦缎']).toBe(1.3);
  });

  it('夏（5-7 月）时蔬/米酒 +20% 且仓储费翻倍', () => {
    const d = getSeasonalDemand({ day: 150 }); // 5 月
    expect(d.season).toBe('夏');
    expect(d.boosts['时蔬']).toBe(1.2);
    expect(d.boosts['米酒']).toBe(1.2);
    expect(d.storageSurcharge).toBe(true);
  });

  it('秋（8-10 月）人参/当归 +50%；冬（11-1 月）羊肉/棉布 +30%', () => {
    const autumn = getSeasonalDemand({ day: 240 }); // 8 月
    expect(autumn.season).toBe('秋');
    expect(autumn.boosts['人参']).toBe(1.5);
    const winter = getSeasonalDemand({ day: 330 }); // 11 月
    expect(winter.season).toBe('冬');
    expect(winter.boosts['羊肉']).toBe(1.3);
    expect(winter.boosts['棉布']).toBe(1.3);
  });

  it('组合商品时令翻倍：秋补药囊入秋翻倍、他季不翻倍', () => {
    const autumn = ASSEMBLE_RECIPES.find((r) => r.id === 'asm-qiubu')!;
    expect(assembleSeasonalMultiplier(autumn, { day: 240 })).toBe(2); // 8 月秋
    expect(assembleSeasonalMultiplier(autumn, { day: 30 })).toBe(1); // 1 月冬
  });
});
