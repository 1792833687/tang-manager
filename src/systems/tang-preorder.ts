/**
 * 《我在唐朝当掌柜》大单预购系统（TANG-TRF-001 模块二）
 * - checkPreOrderTrigger：大单客 20% 触发预购（与现货互斥）；势力特殊事件（沈听澜/谢七/势力）触发；
 *   同时最多 5 个进行中（超出不触发）（用户 2.2）
 * - generatePreOrder：需求按客人等级（铜 1-2 种×3-10 / 银 2-3 种×5-15 / 金 3-4 种×10-25 / 玉 4-5 种×20-50）、
 *   总价=零售×溢价 1.1-1.3、定金 30%、期限 5-15 天（势力订单更紧）（用户 2.2 逐字）
 * - getPreOrderPenalty：违约惩罚分级（用户 2.3 逐字：random basic 退定金+客流失 /
 *   shen severe 退定金+1.5×违约金+沈-20+声望-20 / xie severe +谢-25+地下-15 / faction severe +势力-30+声望-30）
 * - reserveGoodsForOrder / getOrderProgress / getSuggestedPrepTime（用户 2.4 逐字）
 * - deliverOrder（用户 2.5 逐字：reserved≥required 才可、商品移库、尾款入账、声望+5~30、
 *   shen 好感+10 / xie+10 / faction 关系+10、新客入 knownGuests、status delivered）
 * - checkOverdueOrders（用户 2.5：每日清晨，accepted/ready 且 deadline≤day → 违约惩罚、解除预留）
 * - generateOrderNarrative（用户 2.7 逐字：三来源 offer 叙事 + delivered/overdue 自拟）
 * 铁律：纯函数；不直接调用 store。
 */
import { v4 as uuidv4 } from 'uuid';
import { preorderItemPool } from '@/systems/tang-dynamic-traffic';
import { levelForTotalSpent } from '@/config/tang-guest-book-content';
import type {
  Guest,
  GuestLevel,
  KnownGuestRecord,
  PreOrder,
  PreOrderItem,
  PreOrderPenaltyType,
  PreOrderSource,
  ShopItem,
  ShopType,
} from '@/types/tang-manager';

/** 进行中预购上限（超出不触发） */
export const MAX_ACTIVE_PREORDERS = 5;

/** 大单客随机变预购概率（与现货互斥：80% 现货 / 20% 预购） */
export const PREORDER_CHANCE = 0.2;

/** 势力相关预购（特殊事件）：高关系 + 大单/特殊客 10% */
export const FACTION_PREORDER_CHANCE = 0.1;

/** 势力关系阈值（≥40 视为「势力相关」触发条件） */
export const FACTION_PREORDER_THRESHOLD = 40;

/** 违约金基数（总价两成；势力订单 ×1.5） */
export const PENALTY_BASE_RATE = 0.2;

/** 等级 → 需求商品种类数区间（铜 1-2 / 银 2-3 / 金 3-4 / 玉 4-5） */
const GUEST_LEVEL_TYPE_RANGE: Record<GuestLevel, readonly [number, number]> = {
  bronze: [1, 2],
  silver: [2, 3],
  gold: [3, 4],
  diamond: [4, 5],
};

/** 等级 → 单种需求量区间（铜 3-10 / 银 5-15 / 金 10-25 / 玉 20-50） */
const GUEST_LEVEL_QTY_RANGE: Record<GuestLevel, readonly [number, number]> = {
  bronze: [3, 10],
  silver: [5, 15],
  gold: [10, 25],
  diamond: [20, 50],
};

/** checkPreOrderTrigger 所需上下文（只取用到的字段） */
export interface PreOrderContext {
  shopType?: ShopType;
  day?: number;
  /** 现有预购订单（进行中数量判定） */
  preOrders?: PreOrder[];
  /** 货架商品（需求条目商品池） */
  shopItems?: ShopItem[];
  /** 势力关系（faction 触发阈值判定；key=factionId → relationship） */
  factionRelationships?: Record<string, number>;
}

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 进行中预购数（pending 待应 / accepted 已接下 / ready 货已备齐） */
export function activePreOrderCount(preOrders: readonly PreOrder[] | undefined): number {
  return (preOrders ?? []).filter((o) => o.status === 'pending' || o.status === 'accepted' || o.status === 'ready').length;
}

/**
 * 大单预购触发（用户 2.2）：
 * - 势力特殊事件：沈听澜 → shen / 谢七 → xie / 势力关系≥40 且大单或特殊客 10% → faction
 * - 普通大单随机：big_order 客 20% → random（与现货互斥）
 * - 进行中预购 ≥5 不触发
 */
export function checkPreOrderTrigger(guest: Guest, ctx: PreOrderContext, rng: () => number = Math.random): PreOrder | null {
  if (activePreOrderCount(ctx.preOrders) >= MAX_ACTIVE_PREORDERS) {
    return null;
  }
  // 势力特殊事件（按名）
  if (guest.name === '沈听澜') {
    return generatePreOrder(guest, 'shen', ctx, rng);
  }
  if (guest.name === '谢七') {
    return generatePreOrder(guest, 'xie', ctx, rng);
  }
  if (guest.type !== 'big_order' && guest.type !== 'special') {
    return null;
  }
  // 势力相关预购（特殊事件）：任一派系关系 ≥ 阈值
  const rels = ctx.factionRelationships ?? {};
  const strongFactionId = Object.keys(rels).find((fid) => (rels[fid] ?? 0) >= FACTION_PREORDER_THRESHOLD);
  if (strongFactionId && rng() < FACTION_PREORDER_CHANCE) {
    const order = generatePreOrder(guest, 'faction', ctx, rng);
    return { ...order, factionId: strongFactionId };
  }
  // 普通大单随机变预购（20%；与现货互斥）
  if (guest.type === 'big_order' && rng() < PREORDER_CHANCE) {
    return generatePreOrder(guest, 'random', ctx, rng);
  }
  return null;
}

/**
 * 生成预购订单（用户 2.2 逐字）：
 * 需求按客人等级；总价 = 零售 × 溢价 1.1~1.3；定金 30%；期限 5-15 天（势力订单更紧 3-7 天）。
 */
export function generatePreOrder(guest: Guest, source: PreOrderSource, ctx: PreOrderContext, rng: () => number = Math.random): PreOrder {
  const level = guest.guestLevel ?? 'bronze';
  const [minTypes, maxTypes] = GUEST_LEVEL_TYPE_RANGE[level];
  const [minQty, maxQty] = GUEST_LEVEL_QTY_RANGE[level];
  const typeCount = randInt(minTypes, maxTypes, rng);

  const pool = preorderItemPool(ctx.shopItems, ctx.shopType);
  const items: PreOrderItem[] = [];
  const used = new Set<string>();
  for (let i = 0; i < typeCount && pool.length > 0; i++) {
    const candidates = pool.filter((p) => !used.has(p.id));
    if (candidates.length === 0) break;
    const picked = candidates[Math.min(Math.floor(rng() * candidates.length), candidates.length - 1)]!;
    used.add(picked.id);
    items.push({
      itemId: picked.id,
      itemName: picked.name,
      quantity: randInt(minQty, maxQty, rng),
      reserved: 0,
    });
  }

  const premium = 1.1 + rng() * 0.2; // 1.1~1.3
  const retail = items.reduce((sum, it) => {
    const price = (ctx.shopItems ?? []).find((s) => s.id === it.itemId)?.price ?? 1;
    return sum + it.quantity * price;
  }, 0);
  const totalValue = round2(retail * premium);
  const deposit = round2(totalValue * 0.3);
  const finalPayment = round2(totalValue - deposit);

  // 期限：普通 5-15 天；势力订单更紧（3-7 天）
  const isFactionOrder = source === 'shen' || source === 'xie' || source === 'faction';
  const deadline = (ctx.day ?? 0) + (isFactionOrder ? randInt(3, 7, rng) : randInt(5, 15, rng));

  const penaltyType: PreOrderPenaltyType = source === 'random' ? 'basic' : 'severe';
  const order: PreOrder = {
    id: uuidv4(),
    guestName: guest.name,
    guestIdentity: guest.storyTag ?? guest.description ?? '',
    source,
    items,
    deposit,
    finalPayment,
    totalValue,
    deadline,
    acceptedDay: ctx.day ?? 0,
    status: 'pending',
    penaltyType,
    narrative: '',
  };
  order.narrative = generateOrderNarrative(order, 'offer');
  return order;
}

/** 违约惩罚结果（getPreOrderPenalty；用户 2.3 逐字） */
export interface PreOrderPenalty {
  /** 退还定金（两；负向现金流） */
  depositRefund: number;
  /** 违约金（两；势力订单 1.5× 总价两成） */
  extraPenalty: number;
  /** 声望扣减（正数=扣） */
  reputationDelta: number;
  /** 沈听澜好感扣减（正数=扣） */
  shenDelta: number;
  /** 谢七好感扣减（正数=扣） */
  xieDelta: number;
  /** 势力关系扣减（正数=扣；factionId 指定势力） */
  factionDelta: number;
  /** 势力订单对应的势力 id（xie → underground；faction → 订单记录势力） */
  factionId?: string;
}

/**
 * 违约惩罚分级（用户 2.3 逐字）：
 * - random basic：退定金 + 客流失（声望-5 近似）
 * - shen severe：退定金 + 1.5×违约金 + 沈听澜-20 + 声望-20
 * - xie severe：退定金 + 1.5×违约金 + 谢七-25 + 地下势力-15
 * - faction severe：退定金 + 1.5×违约金 + 势力-30 + 声望-30
 */
export function getPreOrderPenalty(source: PreOrderSource, order: PreOrder): PreOrderPenalty {
  const depositRefund = order.deposit;
  const penaltyBase = round2(order.totalValue * PENALTY_BASE_RATE);
  switch (source) {
    case 'random':
      return { depositRefund, extraPenalty: 0, reputationDelta: 5, shenDelta: 0, xieDelta: 0, factionDelta: 0 };
    case 'shen':
      return { depositRefund, extraPenalty: round2(penaltyBase * 1.5), reputationDelta: 20, shenDelta: 20, xieDelta: 0, factionDelta: 0 };
    case 'xie':
      return { depositRefund, extraPenalty: round2(penaltyBase * 1.5), reputationDelta: 0, shenDelta: 0, xieDelta: 25, factionDelta: 15, factionId: 'underground' };
    case 'faction':
      return {
        depositRefund,
        extraPenalty: round2(penaltyBase * 1.5),
        reputationDelta: 30,
        shenDelta: 0,
        xieDelta: 0,
        factionDelta: 30,
        factionId: order.factionId,
      };
  }
}

/**
 * 为预购订单预留库房货品（用户 2.4：商品标记 reserved，不移库、不可售、照常陈损）。
 * 返回更新后的订单与 shopItems；货齐（全部 reserved ≥ quantity）置 ready。
 */
export function reserveGoodsForOrder(
  orderId: string,
  shopItems: readonly ShopItem[],
  preOrders: readonly PreOrder[]
): { ok: boolean; reason?: string; order?: PreOrder; shopItems?: ShopItem[] } {
  const order = preOrders.find((o) => o.id === orderId);
  if (!order) return { ok: false, reason: '订单不存在' };
  if (order.status !== 'accepted' && order.status !== 'ready') return { ok: false, reason: '订单未接下，不可备货' };

  let items = order.items.map((it) => ({ ...it }));
  const nextItems = shopItems.map((it) => ({ ...it }));
  for (let i = 0; i < items.length; i++) {
    const def = nextItems.find((s) => s.name === items[i]!.itemName);
    if (!def) continue;
    const remaining = items[i]!.quantity - items[i]!.reserved;
    const available = Math.max(0, (def.stock ?? 0) - (def.reserved ?? 0));
    const toReserve = Math.min(available, remaining);
    if (toReserve <= 0) continue;
    items[i] = { ...items[i]!, reserved: items[i]!.reserved + toReserve };
    def.reserved = (def.reserved ?? 0) + toReserve;
  }

  const ready = items.every((it) => it.reserved >= it.quantity);
  const updated: PreOrder = {
    ...order,
    items,
    status: ready ? ('ready' as const) : ('accepted' as const),
  };
  return { ok: true, order: updated, shopItems: nextItems };
}

/** 订单整体备货进度（required/reserved/remaining） */
export function getOrderProgress(order: PreOrder): { required: number; reserved: number; remaining: number } {
  const required = order.items.reduce((s, it) => s + it.quantity, 0);
  const reserved = order.items.reduce((s, it) => s + it.reserved, 0);
  return { required, reserved, remaining: Math.max(0, required - reserved) };
}

/** 是否货已备齐（全部条目 reserved ≥ quantity） */
export function isOrderReady(order: PreOrder): boolean {
  return order.items.every((it) => it.reserved >= it.quantity);
}

/**
 * 建议备货时间（用户 2.4 逐字：食材建议交货前 1-2 天备齐/布匹药材可提前）。
 */
export function getSuggestedPrepTime(order: PreOrder, item: PreOrderItem, shopItems: readonly ShopItem[]): string {
  const def = shopItems.find((it) => it.id === item.itemId);
  const category = def?.category ?? '';
  if (category === '食材') {
    const suggestedDay = Math.max(order.acceptedDay + 1, order.deadline - 2);
    return `${item.itemName}：食材宜在交货前 1-2 日备齐，建议第 ${suggestedDay} 日前到货`;
  }
  return `${item.itemName}：布匹药材可提前备货，第 ${order.deadline} 日前齐备即可`;
}

/** 交货结果（deliverOrder 产出；store 应用变更） */
export interface DeliverOrderResult {
  ok: boolean;
  reason?: string;
  order?: PreOrder;
  shopItems?: ShopItem[];
  /** 尾款入账（两） */
  silverDelta?: number;
  /** 声望增加（5~30） */
  reputationDelta?: number;
  /** 沈听澜好感增加（shen 来源 +10） */
  shenDelta?: number;
  /** 谢七好感增加（xie 来源 +10） */
  xieDelta?: number;
  /** 势力关系增加（faction 来源 +10） */
  factionDelta?: number;
  factionId?: string;
  /** 新客入回头客池记录 */
  knownGuest?: KnownGuestRecord;
}

/**
 * 交货（用户 2.5 逐字）：reserved≥required 才可、商品移库、尾款入账、声望+5~30、
 * shen 好感+10 / xie+10 / faction 关系+10、新客入 knownGuests、status delivered。
 */
export function deliverOrder(
  orderId: string,
  state: {
    preOrders: PreOrder[];
    shopItems: ShopItem[];
    silver: number;
    reputation: number;
    shenTinglanFavor: number;
    xieQiFavor: number;
    factions: { id: string; relationship: number }[];
    knownGuests: Record<string, KnownGuestRecord>;
    day: number;
  },
  rng: () => number = Math.random
): DeliverOrderResult {
  const order = state.preOrders.find((o) => o.id === orderId);
  if (!order) return { ok: false, reason: '订单不存在' };
  if (!isOrderReady(order)) return { ok: false, reason: '货未备齐，不可交货' };

  // 商品移库（扣真实库存与预留）
  const shopItems = state.shopItems.map((it) => {
    const ordered = order.items.find((oi) => oi.itemName === it.name);
    if (!ordered) return it;
    const nextStock = Math.max(0, (it.stock ?? 0) - ordered.quantity);
    return {
      ...it,
      stock: nextStock,
      reserved: Math.max(0, (it.reserved ?? 0) - ordered.reserved),
      status: nextStock <= 0 ? ('out_of_stock' as const) : it.status,
    };
  });

  const reputationDelta = 5 + randInt(0, 25, rng); // 5~30
  const shenDelta = order.source === 'shen' ? 10 : 0;
  const xieDelta = order.source === 'xie' ? 10 : 0;
  const factionDelta = order.source === 'faction' ? 10 : 0;
  const factionId = order.source === 'faction' ? order.factionId : undefined;

  // 新客入 knownGuests（key=guestName；等级按累计消费=总价）
  const knownGuest: KnownGuestRecord = {
    level: levelForTotalSpent(order.totalValue),
    totalSpent: order.totalValue,
    visitCount: 1,
    preferences: [],
    lastVisit: state.day,
    satisfaction: 90,
  };

  return {
    ok: true,
    order: { ...order, status: 'delivered' },
    shopItems,
    silverDelta: order.finalPayment,
    reputationDelta,
    shenDelta,
    xieDelta,
    factionDelta,
    factionId,
    knownGuest,
  };
}

/**
 * 每日清晨检查逾期（用户 2.5）：accepted/ready 且 deadline ≤ day → 置 overdue、解除预留；
 * pending 未接下且已过期限 → 作废移除（婉拒默认）。
 * 返回更新后的 preOrders/shopItems 与逾期列表（经济惩罚由 store 按 getPreOrderPenalty 应用）。
 */
export function checkOverdueOrders(
  preOrders: readonly PreOrder[],
  shopItems: readonly ShopItem[],
  day: number
): { preOrders: PreOrder[]; shopItems: ShopItem[]; overdue: PreOrder[] } {
  const overdue: PreOrder[] = [];
  let nextItems = shopItems.map((it) => ({ ...it }));
  const nextOrders: (PreOrder | null)[] = preOrders.map((o) => {
    if ((o.status === 'accepted' || o.status === 'ready') && o.deadline <= day) {
      // 解除预留
      for (const it of o.items) {
        const def = nextItems.find((s) => s.name === it.itemName);
        if (def) {
          def.reserved = Math.max(0, (def.reserved ?? 0) - it.reserved);
        }
      }
      const updated: PreOrder = { ...o, status: 'overdue' };
      overdue.push(updated);
      return updated;
    }
    if (o.status === 'pending' && o.deadline < day) {
      return null; // 待应超期未接下 → 作废移除
    }
    return o;
  });
  return { preOrders: nextOrders.filter((o): o is PreOrder => o !== null), shopItems: nextItems, overdue };
}

/**
 * 预购订单叙事（用户 2.7）：三来源 offer 逐字 + delivered/overdue 自拟。
 */
export function generateOrderNarrative(
  order: Pick<PreOrder, 'source' | 'guestName' | 'items' | 'totalValue' | 'deadline'>,
  kind: 'offer' | 'delivered' | 'overdue'
): string {
  const summary = order.items.map((it) => `${it.itemName}${it.quantity} 份`).join('、');
  if (kind === 'delivered') {
    return `${order.guestName}如期收到${summary}，抚掌而笑：「陆掌柜言而有信，这笔买卖做得值！」`;
  }
  if (kind === 'overdue') {
    return `期限已至，${order.guestName}却未能等到${summary}。店中伙计低头赔罪，一笔买卖就此毁约。`;
  }
  switch (order.source) {
    case 'shen':
      return '沈听澜遣人送来一封书信，字迹清峻：「吾东市行会需备一批货，烦请陆掌柜照单预留，届时自有人来取。」';
    case 'xie':
      return '谢七压低声音，目光闪动：「陆掌柜，这批货你替我留好，别声张。西市那边要用。」';
    case 'faction':
      return '一位势力中人登门，拱手道：「奉上头之命，来贵店下订一批货物，望掌柜按期备妥，莫误了时辰。」';
    default:
      return `${order.guestName}打量店中货架，道：「掌柜的，这批货我全要了，你替我预留，到日子我来取。」`;
  }
}
