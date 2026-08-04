/**
 * 《我在唐朝当掌柜》进货策略系统（Step 5b-1.5 模块二）
 * 纯函数（可测）：
 * - calculateBulkPrice：批量折扣阶梯（1-9 原价 / 10-29 九折 / 30-49 八折 / 50+ 七折）
 * - createForwardContract：籴粜契（预付三成定金、预购价=市价×0.7、deliveryDay=day+5~10、不可取消退定金）
 * - checkForwardContracts：每日清晨调用；到期自动入库（到货次品风险按 checkDefectiveGoods）
 * - generateMarketListings：每日清晨生成 1-2 个挂牌（优先库存低商品、五至八折、限购 20-100、仅当日）
 * - purchaseListing：采买挂牌（扣现银、入库、扣 remainingToday；次品概率按难度 + 一成）
 * - checkDefectiveGoods：次品检测（A 半成概率半成至一成 / B 二成概率一成至三成 / C 三成五概率二成至五成；
 *   籴粜契/挂牌 extraChance+0.1；「辨货」技能 good_eye 次品率减半）
 */
import type { Difficulty, ForwardContract, MarketListing, ShopItem, ShopType, TangGameState } from '@/types/tang-manager';
import { getItemVolume } from '@/systems/tang-expiry';

// ============================================================
// 批量折扣
// ============================================================

export interface BulkPriceResult {
  totalCost: number;
  discount: number;
  unitPrice: number;
}

/** 批量折扣阶梯：1-9 原价 / 10-29 九折 / 30-49 八折 / 50+ 七折 */
export function bulkDiscountFor(quantity: number): number {
  if (quantity >= 50) return 0.7;
  if (quantity >= 30) return 0.8;
  if (quantity >= 10) return 0.9;
  return 1;
}

/** 批量采购总价（单价 = 原价 × 折扣；总价 = 单价 × 数量，四舍五入到分） */
export function calculateBulkPrice(basePrice: number, quantity: number): BulkPriceResult {
  const q = Math.max(1, Math.floor(quantity));
  const discount = bulkDiscountFor(q);
  const unitPrice = Math.round(basePrice * discount * 100) / 100;
  const totalCost = Math.round(unitPrice * q * 100) / 100;
  return { totalCost, discount, unitPrice };
}

// ============================================================
// 次品检测
// ============================================================

export interface DefectiveGoodsResult {
  isDefective: boolean;
  defectiveRate: number;
  actualGoodQuantity: number;
  loss: number;
}

/** 次品触发基础概率与次品率区间（按难度；籴粜契/挂牌 extraChance + 0.1） */
const DEFECTIVE_CHANCE: Record<Difficulty, number> = { A: 0.05, B: 0.2, C: 0.35 };
const DEFECTIVE_RATE_RANGE: Record<Difficulty, readonly [number, number]> = {
  A: [0.05, 0.1], // 半成至一成
  B: [0.1, 0.3], // 一成至三成
  C: [0.2, 0.5], // 二成至五成
};

/**
 * 次品检测：按难度触发概率与次品率；extraChance 为籴粜契/挂牌额外 +0.1；
 * hasGoodEye（「辨货」技能员工）次品率减半。
 */
export function checkDefectiveGoods(
  quantity: number,
  difficulty: Difficulty,
  extraChance = 0,
  hasGoodEye = false,
  rng: () => number = Math.random
): DefectiveGoodsResult {
  const chance = Math.min(1, (DEFECTIVE_CHANCE[difficulty] ?? 0.2) + extraChance);
  if (quantity <= 0 || rng() >= chance) {
    return { isDefective: false, defectiveRate: 0, actualGoodQuantity: quantity, loss: 0 };
  }
  const range = DEFECTIVE_RATE_RANGE[difficulty] ?? [0.1, 0.3];
  let rate = range[0]! + rng() * (range[1]! - range[0]!);
  if (hasGoodEye) {
    rate = rate / 2; // 辨货：次品率减半
  }
  const loss = Math.max(0, Math.floor(quantity * rate));
  return {
    isDefective: true,
    defectiveRate: Math.round(rate * 100) / 100,
    actualGoodQuantity: quantity - loss,
    loss,
  };
}

/** 是否有「辨货」技能员工（good_eye；按 skills 匹配） */
export function hasGoodEyeEmployee(employees: readonly { skills: { id: string }[] }[] | undefined): boolean {
  return (employees ?? []).some((e) => e.skills.some((sk) => sk.id === 'good_eye'));
}

// ============================================================
// 籴粜契（远期收购契约）
// ============================================================

/** 籴粜契预购价折扣（市价 × 0.7） */
export const FORWARD_CONTRACT_PRICE_RATE = 0.7;
/** 定金比例（三成） */
export const FORWARD_CONTRACT_DEPOSIT_RATE = 0.3;
/** 籴粜契到货窗口（deliveryDay 在 day+5 ~ day+10） */
export const FORWARD_CONTRACT_MIN_DAYS = 5;
export const FORWARD_CONTRACT_MAX_DAYS = 10;

export interface CreateForwardContractInput {
  item: ShopItem;
  quantity: number;
  basePrice: number;
  deliveryDay: number;
  day: number;
}

/** 订立籴粜契：预购价 = 市价×0.7；定金 = 总价×0.3；不可取消退定金（交付违约不入场） */
export function createForwardContract(input: CreateForwardContractInput): ForwardContract {
  const unitPrice = Math.round(input.basePrice * FORWARD_CONTRACT_PRICE_RATE * 100) / 100;
  const totalPrice = Math.round(unitPrice * input.quantity * 100) / 100;
  const deposit = Math.round(totalPrice * FORWARD_CONTRACT_DEPOSIT_RATE * 100) / 100;
  return {
    id: `fc-${input.deliveryDay}-${input.item.id}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: input.item.id,
    itemName: input.item.name,
    quantity: input.quantity,
    unitPrice,
    totalPrice,
    deposit,
    deliveryDay: input.deliveryDay,
    status: 'pending',
  };
}

export interface ContractDelivery {
  contract: ForwardContract;
  actualQuantity: number;
  defectiveRate: number;
  loss: number;
}

/**
 * 每日清晨调用：deliveryDay = 当天 → 自动入库（到货次品检测，籴粜契 extraChance + 0.1）。
 * 返回到货列表与更新后的契约列表；store 负责把 actualQuantity 加入 shopItems 并记账。
 */
export function checkForwardContracts(
  state: Pick<TangGameState, 'forwardContracts' | 'day' | 'difficulty' | 'employees'>,
  rng: () => number = Math.random
): { delivered: ContractDelivery[]; contracts: ForwardContract[] } {
  const contracts = state.forwardContracts ?? [];
  const delivered: ContractDelivery[] = [];
  const next: ForwardContract[] = [];
  for (const c of contracts) {
    if (c.status === 'pending' && c.deliveryDay <= state.day) {
      const def = checkDefectiveGoods(c.quantity, state.difficulty ?? 'B', 0.1, hasGoodEyeEmployee(state.employees), rng);
      delivered.push({
        contract: { ...c, status: 'delivered' },
        actualQuantity: def.actualGoodQuantity,
        defectiveRate: def.defectiveRate,
        loss: def.loss,
      });
      next.push({ ...c, status: 'delivered' });
    } else {
      next.push(c);
    }
  }
  return { delivered, contracts: next };
}

// ============================================================
// 市易务挂牌（官府平准特价发卖）
// ============================================================

export interface MarketListingInput {
  shopItems: readonly ShopItem[];
  day: number;
  rng?: () => number;
}

/** 生成每日挂牌（1-2 个；优先库存低商品；五至八折；限购 20-100；仅当日） */
export function generateMarketListings(state: MarketListingInput): MarketListing[] {
  const rng = state.rng ?? Math.random;
  const candidates = (state.shopItems ?? [])
    .filter((it) => (it.stock ?? 0) > 0)
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
  if (candidates.length === 0) return [];
  const count = rng() < 0.5 ? 1 : 2;
  const listings: MarketListing[] = [];
  for (let i = 0; i < count && i < candidates.length; i++) {
    const item = candidates[i]!;
    const discount = Math.round((0.5 + rng() * 0.3) * 100) / 100; // 五至八折
    const listedPrice = Math.round(item.price * discount * 100) / 100;
    listings.push({
      id: `ml-${state.day}-${item.id}-${i}`,
      itemName: item.name,
      originalPrice: item.price,
      listedPrice,
      discount,
      maxQuantity: 20 + Math.floor(rng() * 81), // 20-100
      remainingToday: 20 + Math.floor(rng() * 81),
      day: state.day,
    });
  }
  return listings;
}

export interface PurchaseListingInput {
  listing: MarketListing;
  quantity: number;
  silver: number;
  difficulty: Difficulty;
  employees?: readonly { skills: { id: string }[] }[];
  rng?: () => number;
}

export interface PurchaseListingResult {
  ok: boolean;
  reason?: string;
  actualGoodQuantity: number;
  cost: number;
  loss: number;
  listing: MarketListing;
}

/** 采买挂牌：校验剩余/现银；扣现银（按挂牌价×数量）、入库 actualGoodQuantity、扣 remainingToday；
 *  次品概率按难度 + 一成（挂牌）。 */
export function purchaseListing(input: PurchaseListingInput): PurchaseListingResult {
  const rng = input.rng ?? Math.random;
  const q = Math.max(1, Math.floor(input.quantity));
  if (q > input.listing.remainingToday) {
    return { ok: false, reason: '超过今日限购', actualGoodQuantity: 0, cost: 0, loss: 0, listing: input.listing };
  }
  const cost = Math.round(input.listing.listedPrice * q * 100) / 100;
  if (cost > input.silver) {
    return { ok: false, reason: '现银不足', actualGoodQuantity: 0, cost: 0, loss: 0, listing: input.listing };
  }
  const def = checkDefectiveGoods(q, input.difficulty, 0.1, hasGoodEyeEmployee(input.employees), rng);
  return {
    ok: true,
    actualGoodQuantity: def.actualGoodQuantity,
    cost,
    loss: def.loss,
    listing: { ...input.listing, remainingToday: Math.max(0, input.listing.remainingToday - q) },
  };
}

// ============================================================
// 普通采买（补货）辅助
// ============================================================

/**
 * 补货入库：同商品合并加库存（保留原售价/陈损/status），否则新增。
 * 供采买/挂牌/到货/加工产出共用；status 由陈损系统（getItemStatus）推导，不在此覆盖。
 */
export function mergeGoods(shopItems: readonly ShopItem[] | undefined, incoming: ShopItem): ShopItem[] {
  const existing = (shopItems ?? []).find((it) => it.name === incoming.name);
  if (existing) {
    return (shopItems ?? []).map((it) =>
      it.name === incoming.name ? { ...it, stock: Math.round((it.stock + incoming.stock) * 100) / 100 } : it
    );
  }
  return [...(shopItems ?? []), incoming];
}
