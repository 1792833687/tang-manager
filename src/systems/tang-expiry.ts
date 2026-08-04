/**
 * 《我在唐朝当掌柜》库存压力系统（Step 5b-1.5 模块一）
 * 纯函数（可测）：
 * - getItemVolume / getItemExpiry / getItemStatus：ShopItem 新字段兜底默认值
 * - updateExpiry：打烊调用，expiry-1；0→expired、≤1→near_expiry；返回更新列表 + 陈损列表
 * - removeExpiredGoods：移除 expired，返回 { remainingItems, expiredItems, totalLoss }（账本记「陈损」由 store）
 * - getExpiryLabel：陈损状态标签（-1 可久贮 / 0 已陈损红 / 1 今日到期红闪 / 2-3 即将到期橙 / 4-7 尚可绿 / 8+ 新货）
 * - calculateStorageCost：仓储费（超过 freeStorageLimit 部分每 10 单位每日 1 两；月初扣除）
 * - expandWarehouse 相关：费用/耗时/容量换算
 *
 * 月份约定（工程注释）：month = Math.ceil(day/30)；季节按自然月换算：
 * 1-3 春 / 4-6 夏 / 7-9 秋 / 10-12 冬（用于货架时令图标）。
 * 仓储费时令修正按用户模块一逐字：夏季（5-7月）食材费翻倍「暑热难贮，需加冰鉴」、
 * 冬季（11-1月）布匹费 +50%「冬湿需防潮，多加炭火烘烤」（注释：与模块三时令需求映射错开一月，均按规格逐字）。
 */
import type { ItemStatus, ShopItem, TangGameState } from '@/types/tang-manager';

/** 免费库容上限（TANG-S5B15-002 裁决：规格 50 与初始货架体积 170 冲突 → 取 170，开局零仓储费，囤货超限才收费） */
export const DEFAULT_FREE_STORAGE_LIMIT = 170;
/** 初始库房等级与容量（等级 1 → 200；TANG-S5B15-002 裁决：规格 100 与初始货架 170 冲突 → 取容纳值留余量 200） */
export const BASE_WAREHOUSE_LEVEL = 1;
export const BASE_MAX_STORAGE = 200;
/** 每级 +50 容量 */
export const WAREHOUSE_LEVEL_STEP = 50;
/** 仓储费单价：超出免费上限每 10 单位每日 1 两 */
export const STORAGE_FEE_PER_10_UNITS = 1;
/** 月初一次性扣除整月（30 日）仓储费 */
export const DAYS_PER_MONTH = 30;

/** 月份换算：month = ceil(day/30)（1 月 = day 1-30，2 月 = 31-60，以此类推） */
export function monthOf(day: number): number {
  return Math.max(1, Math.ceil((day ?? 1) / DAYS_PER_MONTH));
}

/** 季节（时令图标用）：1-3 春 / 4-6 夏 / 7-9 秋 / 10-12 冬 */
export function getSeason(day: number): { season: '春' | '夏' | '秋' | '冬'; icon: '🌱' | '☀️' | '🍁' | '❄️' } {
  const m = monthOf(day);
  if (m >= 1 && m <= 3) return { season: '春', icon: '🌱' };
  if (m >= 4 && m <= 6) return { season: '夏', icon: '☀️' };
  if (m >= 7 && m <= 9) return { season: '秋', icon: '🍁' };
  return { season: '冬', icon: '❄️' };
}

/** 体积兜底：缺省 1 */
export function getItemVolume(item: Pick<ShopItem, 'volume'>): number {
  return item.volume ?? 1;
}

/** 保质期兜底：缺省 -1（永不过期） */
export function getItemExpiry(item: Pick<ShopItem, 'expiry'>): number {
  return item.expiry ?? -1;
}

/** 库存状态：stock 0 → out_of_stock；否则按存储的 status（未存则按 expiry 推导） */
export function getItemStatus(item: ShopItem): ItemStatus {
  if ((item.stock ?? 0) <= 0) return 'out_of_stock';
  if (item.status && item.status !== 'normal') return item.status;
  const exp = getItemExpiry(item);
  if (exp === 0) return 'expired';
  if (exp === 1) return 'near_expiry';
  return 'normal';
}

/** 库容总量 = Σ(stock × volume) */
export function totalVolumeOf(shopItems: readonly ShopItem[] | undefined): number {
  return Math.round(((shopItems ?? []).reduce((s, it) => s + (it.stock ?? 0) * getItemVolume(it), 0)) * 100) / 100;
}

/** 库房货物总值（按成本估算；窃贼事件/满仓判断用） */
export function warehouseValue(shopItems: readonly ShopItem[] | undefined): number {
  return Math.round(((shopItems ?? []).reduce((s, it) => s + (it.stock ?? 0) * (it.cost ?? 0), 0)) * 100) / 100;
}

/** 某类目库存量（按体积；category 如 '食材'/'布匹'/'药材'） */
export function categoryVolume(shopItems: readonly ShopItem[] | undefined, category: string): number {
  return Math.round(
    ((shopItems ?? []).filter((it) => it.category === category).reduce((s, it) => s + (it.stock ?? 0) * getItemVolume(it), 0)) *
      100
  ) / 100;
}

export interface ExpiryUpdateResult {
  items: ShopItem[];
  /** 状态发生变化（新增 expired/near_expiry）的商品 */
  updated: { itemId: string; status: ItemStatus }[];
  /** 本次陈损（expiry 0）商品 id 列表 */
  expiredIds: string[];
  /** 临近陈损（expiry 1）商品 id 列表 */
  nearIds: string[];
}

/**
 * 每日打烊调用：expiry-1（-1 永不过期跳过）；0 → expired、1 → near_expiry。
 * 返回更新后的 items 与状态变化列表（store 应用 + 账本记「陈损」）。
 */
export function updateExpiry(shopItems: readonly ShopItem[] | undefined): ExpiryUpdateResult {
  const updated: ExpiryUpdateResult['updated'] = [];
  const expiredIds: string[] = [];
  const nearIds: string[] = [];
  const items = (shopItems ?? []).map((it): ShopItem => {
    const exp = getItemExpiry(it);
    if (exp < 0) return { ...it }; // 永不过期
    const nextExpiry = exp - 1;
    let status: ItemStatus = 'normal';
    if (nextExpiry <= 0) {
      status = 'expired';
      expiredIds.push(it.id);
    } else if (nextExpiry === 1) {
      status = 'near_expiry';
      nearIds.push(it.id);
    } else if (nextExpiry <= 3) {
      status = 'near_expiry';
    }
    if (status !== (it.status ?? 'normal')) {
      updated.push({ itemId: it.id, status });
    }
    return { ...it, expiry: nextExpiry, status };
  });
  return { items, updated, expiredIds, nearIds };
}

/** 移除已陈损（status='expired' 或 expiry===0）商品；返回剩余/陈损/总损失（成本×库存） */
export function removeExpiredGoods(
  shopItems: readonly ShopItem[] | undefined
): { remainingItems: ShopItem[]; expiredItems: ShopItem[]; totalLoss: number } {
  const expiredItems = (shopItems ?? []).filter((it) => getItemStatus(it) === 'expired' || getItemExpiry(it) === 0);
  const remainingItems = (shopItems ?? []).filter((it) => !(getItemStatus(it) === 'expired' || getItemExpiry(it) === 0));
  const totalLoss = Math.round(expiredItems.reduce((s, it) => s + (it.stock ?? 0) * (it.cost ?? 0), 0) * 100) / 100;
  return { remainingItems, expiredItems, totalLoss };
}

export interface ExpiryLabel {
  text: string;
  /** 展示色调：normal / red / orange / green / dim */
  tone: 'dim' | 'red' | 'orange' | 'green';
}

/** 陈损期标签（-1 可久贮 / 0 已陈损红 / 1 今日到期红闪 / 2-3 即将到期橙 / 4-7 尚可绿 / 8+ 新货） */
export function getExpiryLabel(expiry: number | undefined): ExpiryLabel {
  const e = expiry ?? -1;
  if (e < 0) return { text: '可久贮', tone: 'dim' };
  if (e <= 0) return { text: '已陈损', tone: 'red' };
  if (e === 1) return { text: '今日到期', tone: 'red' };
  if (e <= 3) return { text: `陈损期 ${e} 日`, tone: 'orange' };
  if (e <= 7) return { text: `尚可 ${e} 日`, tone: 'green' };
  return { text: `新货 ${e} 日`, tone: 'green' };
}

/** 免费上限缺省 */
function freeLimit(state: Pick<TangGameState, 'freeStorageLimit'>): number {
  return state.freeStorageLimit ?? DEFAULT_FREE_STORAGE_LIMIT;
}

/** 仓储费明细（UI 展示用）：返回体积/超限/日费/月费与时令修正 */
export function getStorageFeeDetail(
  state: Pick<TangGameState, 'shopItems' | 'freeStorageLimit' | 'day'>
): {
  totalVolume: number;
  freeStorageLimit: number;
  over: number;
  dailyFee: number;
  monthlyFee: number;
  isSummer: boolean;
  isWinter: boolean;
} {
  const totalVolume = totalVolumeOf(state.shopItems);
  const limit = freeLimit(state);
  const over = Math.max(0, totalVolume - limit);
  const month = monthOf(state.day);
  const isSummer = month >= 5 && month <= 7;
  const isWinter = month === 11 || month === 12 || month === 1;
  let dailyFee = over <= 0 ? 0 : Math.ceil(over / 10) * STORAGE_FEE_PER_10_UNITS;
  if (dailyFee > 0) {
    const foodVol = categoryVolume(state.shopItems, '食材');
    const clothVol = categoryVolume(state.shopItems, '布匹');
    if (isSummer && foodVol > 0) {
      const foodOver = Math.min(over, foodVol);
      dailyFee += Math.ceil(foodOver / 10); // 食材费翻倍 → 再加一倍
    }
    if (isWinter && clothVol > 0) {
      const clothOver = Math.min(over, clothVol);
      dailyFee += Math.ceil((clothOver / 10) * 0.5); // 布匹费 +50%
    }
  }
  return {
    totalVolume,
    freeStorageLimit: limit,
    over,
    dailyFee,
    monthlyFee: dailyFee * DAYS_PER_MONTH,
    isSummer,
    isWinter,
  };
}

/**
 * 仓储费（模块一，TANG-S5B15-002 统一口径）：超过 freeStorageLimit（初始 170）部分每 10 单位每日 1 两；
 * 夏季（5-7月）食材费翻倍「暑热难贮，需加冰鉴」、冬季（11-1月）布匹费 +50%「冬湿需防潮，多加炭火烘烤」；
 * 月初一次性扣除整月（每日费 × 30）并记账（store 接线）。
 * 注释：settlement 旧「超出 maxStorage 每日 1 两」日扣已移除（tang-inflation.calculateStorageCost 标记 deprecated，
 * 不再被调用），本函数为唯一仓储费口径，避免双计。
 */
export function calculateStorageCost(
  state: Pick<TangGameState, 'shopItems' | 'freeStorageLimit' | 'day'>
): number {
  return getStorageFeeDetail(state).monthlyFee;
}

/** 库房容量换算：等级 1 → 100，每级 +50 */
export function maxStorageForLevel(level: number): number {
  return BASE_MAX_STORAGE + Math.max(0, (level ?? BASE_WAREHOUSE_LEVEL) - BASE_WAREHOUSE_LEVEL) * WAREHOUSE_LEVEL_STEP;
}

/** 扩建费用 = 等级 × 200（两；等级为当前等级） */
export function expandWarehouseCost(level: number): number {
  return level * 200;
}

/** 扩建耗时 = 等级 × 3（天；期间容量暂不增） */
export function expandWarehouseDuration(level: number): number {
  return level * 3;
}

/** 库房健康度 0-100：按占用率（超过免费上限开始下降；满仓 0） */
export function warehouseHealth(state: Pick<TangGameState, 'shopItems' | 'maxStorage' | 'freeStorageLimit'>): number {
  const cap = state.maxStorage ?? BASE_MAX_STORAGE;
  const used = totalVolumeOf(state.shopItems);
  if (cap <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(100 - (used / cap) * 100)));
}
