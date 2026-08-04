/**
 * 《我在唐朝当掌柜》商品加工系统（Step 5b-1.5 模块三）
 * 纯函数（可测）：
 * - getProcessingRecipes：三店型各 3 配方（庖制/染织/炮制；用户 3.1 逐字）
 * - startProcessing：扣原料 + 扣加工费（原料总价 5%）+ 虚耗品耗银两；入加工队列
 * - checkProcessingQueue：每日清晨调用；到期自动入库（产出用 addShopItem 合并）
 * - getAssembleRecipes：组合池（食盒/锦匣/药囊；用户逐字）
 * - createAssemble：原料足才可；消耗原料、生成组合商品（1 商品位、体积=原料总和×0.8、陈损期=最短原料）
 * - getSeasonalDemand：时令需求（春 2-4 月丝绸/锦缎+30%、夏 5-7 月时蔬/米酒+20%且仓储费翻倍、
 *   秋 8-10 月人参/当归+50%、冬 11-1 月羊肉/棉布+30%；用 month = ceil(day/30) 换算，注释）
 *
 * 工程决策（注释）：柴火/染料/金线/棉花/药引为「虚耗品」——不作为库存商品，
 * 直接按固定银两（VIRTUAL_CONSUMABLE_COST）随加工耗银替代库存，避免额外商品位与满仓纠缠。
 */
import type { Difficulty, ProcessingJob, ShopItem, ShopType, TangGameState } from '@/types/tang-manager';
import { getItemExpiry, getItemVolume, monthOf } from '@/systems/tang-expiry';

/** 加工费比例（原料总价 5%） */
export const PROCESS_FEE_RATE = 0.05;

/** 虚耗品单价（工程定合理值，注释）：柴火 1 / 染料 2 / 金线 5 / 棉花 2 / 药引 3 */
export const VIRTUAL_CONSUMABLE_COST: Record<string, number> = {
  柴火: 1,
  染料: 2,
  金线: 5,
  棉花: 2,
  药引: 3,
};

export interface RecipeInput {
  itemName: string;
  quantity: number;
}

export interface ProcessingRecipe {
  id: string;
  /** 配方名（庖制/染织/炮制） */
  name: string;
  /** 术语注释（首次出现带游戏内注释；如「庖制：厨房加工制作」） */
  note: string;
  shopType: ShopType;
  /** 真实原料（从库存扣除） */
  inputs: RecipeInput[];
  /** 虚耗品（直接耗银两替代库存） */
  consumables: RecipeInput[];
  output: { name: string; quantity: number };
  /** 售价倍率：产出总价 = 原料总价 × multiplier */
  multiplier: number;
  /** 加工天数 */
  days: number;
  /** 产出体积（缺省按品类默认） */
  outputVolume?: number;
  /** 产出陈损期（缺省按品类默认；-1 永不过期） */
  outputExpiry?: number;
}

/** 三店型加工配方（用户 3.1 逐字；倍率与虚耗品为工程定值，注释） */
export const PROCESSING_RECIPES: readonly ProcessingRecipe[] = [
  // ---- 庖制（酒楼；庖制：厨房加工制作，如将生肉制成酱肉）----
  {
    id: 'pao-jiangniurou',
    name: '庖制酱肉',
    note: '庖制：厨房加工制作，如将生肉制成酱肉。',
    shopType: 'jiulou',
    inputs: [{ itemName: '羊肉', quantity: 3 }],
    consumables: [{ itemName: '柴火', quantity: 1 }],
    output: { name: '酱牛肉', quantity: 1 },
    multiplier: 2,
    days: 2,
    outputVolume: 3,
    outputExpiry: 14,
  },
  {
    id: 'pao-chenniang',
    name: '庖制陈酿',
    note: '陈酿：久贮之酒，味厚而醇。',
    shopType: 'jiulou',
    inputs: [{ itemName: '米酒', quantity: 5 }],
    consumables: [],
    output: { name: '陈酿', quantity: 1 },
    multiplier: 1.8,
    days: 4,
    outputVolume: 1,
    outputExpiry: 365,
  },
  {
    id: 'pao-yancai',
    name: '庖制腌菜',
    note: '腌菜：以盐渍时蔬，可久藏（陈损期 60 日）。',
    shopType: 'jiulou',
    inputs: [{ itemName: '时蔬', quantity: 10 }],
    consumables: [],
    output: { name: '腌菜', quantity: 5 },
    multiplier: 1,
    days: 3,
    outputVolume: 1,
    outputExpiry: 60,
  },
  // ---- 染织（布庄；染织：染色与织造，如将粗布染为色布）----
  {
    id: 'ran-ransebu',
    name: '染织色布',
    note: '染织：染色与织造，如将粗布染为色布。',
    shopType: 'buzhuang',
    inputs: [{ itemName: '粗布', quantity: 5 }],
    consumables: [{ itemName: '染料', quantity: 1 }],
    output: { name: '染色布', quantity: 3 },
    multiplier: 1.5,
    days: 2,
    outputVolume: 2,
    outputExpiry: 90,
  },
  {
    id: 'ran-cixiusichou',
    name: '染织刺绣丝绸',
    note: '刺绣丝绸：以金线绣于丝绸之上，华贵非常。',
    shopType: 'buzhuang',
    inputs: [{ itemName: '丝绸', quantity: 2 }],
    consumables: [{ itemName: '金线', quantity: 1 }],
    output: { name: '刺绣丝绸', quantity: 1 },
    multiplier: 2.2,
    days: 4,
    outputVolume: 1,
    outputExpiry: 180,
  },
  {
    id: 'ran-jiamianbu',
    name: '染织夹棉布',
    note: '夹棉布：布中夹棉，厚实保暖。',
    shopType: 'buzhuang',
    inputs: [{ itemName: '棉布', quantity: 3 }],
    consumables: [{ itemName: '棉花', quantity: 2 }],
    output: { name: '夹棉布', quantity: 2 },
    multiplier: 1.4,
    days: 3,
    outputVolume: 3,
    outputExpiry: 180,
  },
  // ---- 炮制（药铺；炮制：药材的加工处理，如将人参切为参片）----
  {
    id: 'pao-shenpian',
    name: '炮制参片',
    note: '炮制：药材的加工处理，如将人参切为参片。',
    shopType: 'yaopu',
    inputs: [{ itemName: '人参', quantity: 2 }],
    consumables: [],
    output: { name: '参片', quantity: 5 },
    multiplier: 1.8,
    days: 2,
    outputVolume: 0.5,
    outputExpiry: 180,
  },
  {
    id: 'pao-chengyao',
    name: '炮制成药',
    note: '成药：草药配以药引，合制为成药。',
    shopType: 'yaopu',
    inputs: [{ itemName: '草药', quantity: 5 }],
    consumables: [{ itemName: '药引', quantity: 1 }],
    output: { name: '成药', quantity: 3 },
    multiplier: 2,
    days: 3,
    outputVolume: 1,
    outputExpiry: 180,
  },
  {
    id: 'pao-dangguiwan',
    name: '炮制当归丸',
    note: '当归丸：以当归炼丸，养血之用。',
    shopType: 'yaopu',
    inputs: [{ itemName: '当归', quantity: 3 }],
    consumables: [],
    output: { name: '当归丸', quantity: 10 },
    multiplier: 1.6,
    days: 2,
    outputVolume: 1,
    outputExpiry: 180,
  },
];

export function getProcessingRecipes(shopType: ShopType): ProcessingRecipe[] {
  return PROCESSING_RECIPES.filter((r) => r.shopType === shopType);
}

export function getProcessingRecipeById(recipeId: string): ProcessingRecipe | undefined {
  return PROCESSING_RECIPES.find((r) => r.id === recipeId);
}

/** 找商品（按名称） */
export function findItemByName(shopItems: readonly ShopItem[] | undefined, name: string): ShopItem | undefined {
  return (shopItems ?? []).find((it) => it.name === name);
}

/** 原料总价 = Σ(真实原料数量 × 商品售价) + Σ(虚耗品固定价) */
export function materialValue(
  recipe: Pick<ProcessingRecipe, 'inputs' | 'consumables'>,
  shopItems: readonly ShopItem[] | undefined
): number {
  const real = (recipe.inputs ?? []).reduce((s, inp) => {
    const item = findItemByName(shopItems, inp.itemName);
    return s + inp.quantity * (item?.price ?? 0);
  }, 0);
  const consum = (recipe.consumables ?? []).reduce((s, inp) => s + inp.quantity * (VIRTUAL_CONSUMABLE_COST[inp.itemName] ?? 0), 0);
  return Math.round((real + consum) * 100) / 100;
}

/** 加工费 = 原料总价 × 5% */
export function processFee(recipe: Pick<ProcessingRecipe, 'inputs' | 'consumables'>, shopItems: readonly ShopItem[] | undefined): number {
  return Math.round(materialValue(recipe, shopItems) * PROCESS_FEE_RATE * 10) / 10;
}

export interface StartProcessingInput {
  recipeId: string;
  shopItems: readonly ShopItem[];
  silver: number;
  day: number;
}

export interface StartProcessingResult {
  ok: boolean;
  reason?: string;
  job?: ProcessingJob;
  consumed: RecipeInput[];
  consumablesCost: number;
  processFee: number;
  materialValue: number;
}

/** 开始加工：校验原料/现银；扣原料、扣加工费与虚耗品银两；入加工队列 */
export function startProcessing(input: StartProcessingInput): StartProcessingResult {
  const recipe = getProcessingRecipeById(input.recipeId);
  if (!recipe) return { ok: false, reason: '配方不存在', consumed: [], consumablesCost: 0, processFee: 0, materialValue: 0 };
  const shopItems = input.shopItems ?? [];
  // 原料充足校验
  for (const inp of recipe.inputs) {
    const item = findItemByName(shopItems, inp.itemName);
    if (!item || (item.stock ?? 0) < inp.quantity) {
      return { ok: false, reason: `原料「${inp.itemName}」不足`, consumed: [], consumablesCost: 0, processFee: 0, materialValue: 0 };
    }
  }
  const value = materialValue(recipe, shopItems);
  const fee = processFee(recipe, shopItems);
  const consumablesCost = (recipe.consumables ?? []).reduce((s, inp) => s + inp.quantity * (VIRTUAL_CONSUMABLE_COST[inp.itemName] ?? 0), 0);
  const totalDeduct = Math.round((fee + consumablesCost) * 100) / 100;
  if (totalDeduct > input.silver) {
    return { ok: false, reason: '现银不足，付不起加工费', consumed: [], consumablesCost, processFee: fee, materialValue: value };
  }
  const job: ProcessingJob = {
    id: `pj-${input.day}-${recipe.id}-${Math.random().toString(36).slice(2, 8)}`,
    recipeId: recipe.id,
    outputName: recipe.output.name,
    outputQuantity: recipe.output.quantity,
    completionDay: input.day + recipe.days,
    status: 'processing',
    // 产出单价 = 原料总价 × 倍率 ÷ 数量（开工时锁定，防到货时市价波动影响加工价值）
    outputPrice: Math.round(((value * recipe.multiplier) / recipe.output.quantity) * 100) / 100,
    outputCost: Math.round((value / recipe.output.quantity) * 100) / 100,
  };
  return {
    ok: true,
    job,
    consumed: recipe.inputs,
    consumablesCost,
    processFee: fee,
    materialValue: value,
  };
}

export interface CompletedJob {
  job: ProcessingJob;
  outputItem: ShopItem;
}

/** 每日清晨：到期加工自动入库（产出用 addShopItem 合并；体积/陈损按配方或品类默认） */
export function checkProcessingQueue(
  state: Pick<TangGameState, 'processingQueue' | 'day'>,
  shopItems: readonly ShopItem[]
): { completed: CompletedJob[]; remainingJobs: ProcessingJob[] } {
  const queue = state.processingQueue ?? [];
  const completed: CompletedJob[] = [];
  const remainingJobs: ProcessingJob[] = [];
  for (const job of queue) {
    if (job.status === 'processing' && job.completionDay <= (state.day ?? 1)) {
      const recipe = getProcessingRecipeById(job.recipeId);
      const outputItem = buildOutputItem(job, recipe);
      completed.push({ job: { ...job, status: 'completed' }, outputItem });
      remainingJobs.push({ ...job, status: 'completed' });
    } else {
      remainingJobs.push(job);
    }
  }
  return { completed, remainingJobs };
}

/** 产出商品构造：价格 = 开工时锁定的 outputPrice/outputCost；体积/陈损按配方或品类默认 */
function buildOutputItem(job: ProcessingJob, recipe: ProcessingRecipe | undefined): ShopItem {
  const category = recipe?.shopType === 'jiulou' ? '食材' : recipe?.shopType === 'buzhuang' ? '布匹' : '药材';
  const volume = recipe?.outputVolume ?? 1;
  const expiry = recipe?.outputExpiry ?? 180;
  return {
    id: `out-${job.id}`,
    name: job.outputName,
    price: job.outputPrice ?? recipe?.multiplier ?? 1,
    cost: job.outputCost ?? recipe?.multiplier ?? 1,
    stock: job.outputQuantity,
    category,
    volume,
    expiry,
    status: 'normal',
  };
}

// ============================================================
// 组合商品（食盒 / 锦匣 / 药囊）
// ============================================================

export interface AssembleRecipe {
  id: string;
  name: string;
  kind: '食盒' | '锦匣' | '药囊';
  shopType: ShopType;
  inputs: RecipeInput[];
  discount: number;
  /** 组合商品名（入库用） */
  outputName: string;
  /** 引用与首次术语注释 */
  note: string;
  /** 时令需求翻倍（可选） */
  seasonalBonus?: { season: 'spring' | 'summer' | 'autumn' | 'winter'; multiplier: number };
}

/** 组合池（用户逐字）：食盒（食盒：唐代富商宴请常用，提前数日向酒楼定制）、
 *  锦匣（锦匣：婚嫁生辰所用，以织锦包裹布匹绸缎）、药囊（药囊：唐代入秋后有佩药囊之风） */
export const ASSEMBLE_RECIPES: readonly AssembleRecipe[] = [
  // ---- 食盒（酒楼）----
  {
    id: 'asm-xichenyan',
    name: '洗尘宴食盒',
    kind: '食盒',
    shopType: 'jiulou',
    inputs: [
      { itemName: '羊肉', quantity: 2 },
      { itemName: '米酒', quantity: 3 },
      { itemName: '时蔬', quantity: 5 },
    ],
    discount: 0.9,
    outputName: '洗尘宴食盒',
    note: '食盒：唐代富商宴请常用，提前数日向酒楼定制，内盛酒肉时蔬，以漆木盒盛装。此盒引「送别酒」「接风宴」之典。',
  },
  {
    id: 'asm-yaji',
    name: '雅集食盒',
    kind: '食盒',
    shopType: 'jiulou',
    inputs: [
      { itemName: '陈酿', quantity: 1 },
      { itemName: '酱牛肉', quantity: 1 },
      { itemName: '时蔬', quantity: 3 },
    ],
    discount: 0.85,
    outputName: '雅集食盒',
    note: '食盒：以漆木盒盛装酒肉时蔬。此盒引「怀旧」「心事」之典。',
  },
  // ---- 锦匣（布庄）----
  {
    id: 'asm-nazheng',
    name: '纳征锦匣',
    kind: '锦匣',
    shopType: 'buzhuang',
    inputs: [
      { itemName: '丝绸', quantity: 3 },
      { itemName: '锦缎', quantity: 1 },
      { itemName: '棉布', quantity: 5 },
    ],
    discount: 0.9,
    outputName: '纳征锦匣',
    note: '锦匣：婚嫁生辰所用，以织锦包裹布匹绸缎，置于红漆木匣中，多为纳征、贺寿之礼。此匣引「做嫁衣」之典。',
  },
  {
    id: 'asm-shoudan',
    name: '寿诞锦匣',
    kind: '锦匣',
    shopType: 'buzhuang',
    inputs: [
      { itemName: '锦缎', quantity: 2 },
      { itemName: '丝绸', quantity: 2 },
      { itemName: '棉布', quantity: 3 },
    ],
    discount: 0.9,
    outputName: '寿诞锦匣',
    note: '锦匣：以织锦包裹绸缎布匹。此匣引「摆寿宴」之典。',
  },
  // ---- 药囊（药铺）----
  {
    id: 'asm-qiubu',
    name: '秋补药囊',
    kind: '药囊',
    shopType: 'yaopu',
    inputs: [
      { itemName: '人参', quantity: 2 },
      { itemName: '当归', quantity: 3 },
      { itemName: '枸杞', quantity: 5 },
    ],
    discount: 0.9,
    outputName: '秋补药囊',
    note: '药囊：唐代入秋后有佩药囊之风，富户向药铺定制补药囊，以锦囊盛装名贵药材。入秋（8-10 月）需求翻倍。',
    seasonalBonus: { season: 'autumn', multiplier: 2 },
  },
  {
    id: 'asm-fenghan',
    name: '风寒药囊',
    kind: '药囊',
    shopType: 'yaopu',
    inputs: [
      { itemName: '草药', quantity: 3 },
      { itemName: '药引', quantity: 1 },
    ],
    discount: 0.85,
    outputName: '风寒药囊',
    note: '药囊：以锦囊盛装药材，随身佩戴。入冬（11-1 月）需求翻倍。',
    seasonalBonus: { season: 'winter', multiplier: 2 },
  },
];

export function getAssembleRecipes(shopType: ShopType): AssembleRecipe[] {
  return ASSEMBLE_RECIPES.filter((r) => r.shopType === shopType);
}

export function getAssembleRecipeById(assembleId: string): AssembleRecipe | undefined {
  return ASSEMBLE_RECIPES.find((r) => r.id === assembleId);
}

/** 组合原料总价（按商品售价） */
export function assembleMaterialValue(recipe: AssembleRecipe, shopItems: readonly ShopItem[] | undefined): number {
  return Math.round(
    (recipe.inputs ?? []).reduce((s, inp) => {
      const item = findItemByName(shopItems, inp.itemName);
      return s + inp.quantity * (item?.price ?? 0);
    }, 0) * 100
  ) / 100;
}

export interface CreateAssembleInput {
  assembleId: string;
  shopItems: readonly ShopItem[];
  day: number;
}

export interface CreateAssembleResult {
  ok: boolean;
  reason?: string;
  item?: ShopItem;
  materialValue: number;
  combinedPrice: number;
}

/** 备料组合：原料足才可；消耗原料、生成组合商品（体积 = 原料总和×0.8、陈损期 = 最短原料） */
export function createAssemble(input: CreateAssembleInput): CreateAssembleResult {
  const recipe = getAssembleRecipeById(input.assembleId);
  if (!recipe) return { ok: false, reason: '配方不存在', materialValue: 0, combinedPrice: 0 };
  const shopItems = input.shopItems ?? [];
  for (const inp of recipe.inputs) {
    const item = findItemByName(shopItems, inp.itemName);
    if (!item || (item.stock ?? 0) < inp.quantity) {
      return { ok: false, reason: `原料「${inp.itemName}」不足`, materialValue: 0, combinedPrice: 0 };
    }
  }
  const value = assembleMaterialValue(recipe, shopItems);
  const combinedPrice = Math.round(value * recipe.discount * 100) / 100;
  const volume = Math.round(
    (recipe.inputs ?? []).reduce((s, inp) => {
      const item = findItemByName(shopItems, inp.itemName);
      return s + inp.quantity * getItemVolume(item ?? {});
    }, 0) * 0.8 * 100
  ) / 100;
  const expiries = (recipe.inputs ?? [])
    .map((inp) => getItemExpiry(findItemByName(shopItems, inp.itemName) ?? {}))
    .filter((e) => e >= 0);
  const expiry = expiries.length > 0 ? Math.min(...expiries) : 180;
  const category = recipe.kind === '食盒' ? '食材' : recipe.kind === '锦匣' ? '布匹' : '药材';
  const item: ShopItem = {
    id: `asm-${recipe.id}-${input.day}`,
    name: recipe.outputName,
    price: combinedPrice,
    cost: value,
    stock: 1,
    category,
    volume: Math.max(0.5, volume),
    expiry,
    status: 'normal',
  };
  return { ok: true, item, materialValue: value, combinedPrice };
}

// ============================================================
// 时令需求
// ============================================================

export interface SeasonalDemand {
  season: '春' | '夏' | '秋' | '冬';
  /** 需求翻倍商品（itemName → multiplier） */
  boosts: Record<string, number>;
  /** 夏季仓储费翻倍提示（模块一已实装） */
  storageSurcharge: boolean;
}

/**
 * 时令需求（模块三）：春（2-4 月）丝绸/锦缎 +30%、夏（5-7 月）时蔬/米酒 +20% 且仓储费翻倍、
 * 秋（8-10 月）人参/当归 +50%、冬（11-1 月）羊肉/棉布 +30%。
 * 用 month = ceil(day/30) 换算（注释：与模块一仓储费时令映射错开一月，均按用户规格逐字）。
 */
export function getSeasonalDemand(state: Pick<TangGameState, 'day'>): SeasonalDemand {
  const month = monthOf(state.day);
  if (month >= 2 && month <= 4) return { season: '春', boosts: { 丝绸: 1.3, 锦缎: 1.3 }, storageSurcharge: false };
  if (month >= 5 && month <= 7) return { season: '夏', boosts: { 时蔬: 1.2, 米酒: 1.2 }, storageSurcharge: true };
  if (month >= 8 && month <= 10) return { season: '秋', boosts: { 人参: 1.5, 当归: 1.5 }, storageSurcharge: false };
  return { season: '冬', boosts: { 羊肉: 1.3, 棉布: 1.3 }, storageSurcharge: false };
}

/** 组合商品的时令翻倍检查（秋补药囊秋季、风寒药囊冬季需求翻倍） */
export function assembleSeasonalMultiplier(
  recipe: AssembleRecipe,
  state: Pick<TangGameState, 'day'>
): number {
  if (!recipe.seasonalBonus) return 1;
  const month = monthOf(state.day);
  const isSeason =
    (recipe.seasonalBonus.season === 'spring' && month >= 2 && month <= 4) ||
    (recipe.seasonalBonus.season === 'summer' && month >= 5 && month <= 7) ||
    (recipe.seasonalBonus.season === 'autumn' && month >= 8 && month <= 10) ||
    (recipe.seasonalBonus.season === 'winter' && (month === 11 || month === 12 || month === 1));
  return isSeason ? recipe.seasonalBonus.multiplier : 1;
}
