/**
 * 《我在唐朝当掌柜》跑商物流系统（Step 5b-2 模块四 / 五）
 * 纯函数（可测）：
 * - getNodePriceModifier：点位物价系数（0.8-1.5，每日 ±5%）× active 事件价格效果。
 * - calculateTradeProfit：买入价=基准×buyMod、卖出价=基准×sellMod、利润=(sell-buy)×qty-运费-风险损耗。
 * - calculateLogistics：天数=baseTime（绿通减半）/运费=distance×0.5（绿通减半）/风险=baseRisk（护卫减半+绿通减半）。
 * - executeTradeRun：扣商品/运费、入 transportingGoods（in_transit），到达日结算。
 * - checkTransportArrivals：每日清晨结算到达货物（rng<risk 被劫损失 30-70%）。
 * - 商路控制：unlockGreenChannel（东市线沈听澜≥60/西市线谢七≥50/官道声望≥500）+
 *   自动通道（沈听澜≥80 东市全绿、谢七≥70 西市码头风险 0、声望≥700 官道全解锁）。
 * 铁律：数值裁决前端纯函数；古风措辞。
 */
import { MAP_NODES, TRADE_ROUTES, TRADE_ROUTE_MAP } from '@/config/tang-map-data';
import { getActiveMapEventEffects } from '@/systems/tang-map-events';
import type { MapEvent, TradeRunResult, TransportArrivalResult, TransportingGoods } from '@/types/tang-map';

/** 跑商所需状态子集（解耦可测） */
export interface TradeContext {
  day: number;
  silver: number;
  nodePriceModifiers: Record<string, number>;
  greenChannels: string[];
  transportingGoods: TransportingGoods[];
  employees?: readonly { type: string; restToday?: boolean }[];
  shenTinglanFavor?: number;
  xieQiFavor?: number;
  reputation?: number;
  shopItems?: readonly { category: string; price: number }[];
  mapEvents?: readonly MapEvent[];
}

// ---- 势力点位（绿通判定）----
const EAST_NODES = ['dongshi-shanghui', 'shanghao-jia', 'pingzhun-shu', 'bosidian'];
const WEST_NODES = ['xishi-shangtuan', 'shanghao-yi', 'shanghao-bing', 'matou-cangku'];
const OFFICIAL_NODES = ['jingzhao-fu', 'huanggong', 'pingzhun-shu'];

/** 品类基准价兜底（无对应货架商品时；工程近似，注释） */
const CATEGORY_BASE_FALLBACK: Record<string, number> = { 食材: 3, 布匹: 6, 药材: 3 };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 品类基准价：优先取货架同品类首件售价，否则兜底表 */
export function categoryBasePrice(itemCategory: string, state: TradeContext): number {
  const item = (state.shopItems ?? []).find((it) => it.category === itemCategory);
  return item?.price ?? CATEGORY_BASE_FALLBACK[itemCategory] ?? 3;
}

/** 查直达商路（from/to 双向） */
export function findTradeRoute(from: string, to: string) {
  return TRADE_ROUTES.find((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from));
}

/**
 * 有效绿色通道集合：
 * 天然官道（greenChannel=true）+ 玩家手动解锁（greenChannels）+
 * 自动通道（沈听澜≥80 东市全绿 / 谢七≥70 西市全绿 / 声望≥700 官道全解锁）。
 */
export function getEffectiveGreenChannels(state: TradeContext): Set<string> {
  const set = new Set<string>();
  for (const r of TRADE_ROUTES) {
    if (r.greenChannel) set.add(r.id);
  }
  for (const id of state.greenChannels ?? []) {
    set.add(id);
  }
  const shen = state.shenTinglanFavor ?? 0;
  const xie = state.xieQiFavor ?? 0;
  const rep = state.reputation ?? 0;
  for (const r of TRADE_ROUTES) {
    if (shen >= 80 && (EAST_NODES.includes(r.from) || EAST_NODES.includes(r.to))) set.add(r.id);
    if (xie >= 70 && (WEST_NODES.includes(r.from) || WEST_NODES.includes(r.to))) set.add(r.id);
    if (rep >= 700 && (OFFICIAL_NODES.includes(r.from) || OFFICIAL_NODES.includes(r.to))) set.add(r.id);
  }
  return set;
}

export interface UnlockGreenChannelResult {
  ok: boolean;
  reason?: string;
}

/** 手动解锁绿色通道：东市线沈听澜≥60 / 西市线谢七≥50 / 官道声望≥500 */
export function unlockGreenChannel(routeId: string, state: TradeContext): UnlockGreenChannelResult {
  const route = TRADE_ROUTE_MAP[routeId];
  if (!route) return { ok: false, reason: '商路不存在' };
  if ((state.greenChannels ?? []).includes(routeId)) return { ok: false, reason: '此路已是绿色通道' };
  const east = EAST_NODES.includes(route.from) || EAST_NODES.includes(route.to);
  const west = WEST_NODES.includes(route.from) || WEST_NODES.includes(route.to);
  const official = OFFICIAL_NODES.includes(route.from) || OFFICIAL_NODES.includes(route.to);
  if (east && (state.shenTinglanFavor ?? 0) < 60) return { ok: false, reason: '东市商路须得沈听澜青眼（好感≥60）' };
  if (west && (state.xieQiFavor ?? 0) < 50) return { ok: false, reason: '西市商路须得谢七应允（好感≥50）' };
  if (official && (state.reputation ?? 0) < 500) return { ok: false, reason: '官道须声望≥500' };
  if (!east && !west && !official) return { ok: false, reason: '此路无需开通' };
  return { ok: true };
}

/** 每日物价微调（±5%，clamp 0.8-1.5）；新节点按 1 起步 */
export function updateNodePriceModifiers(
  modifiers: Record<string, number> | undefined,
  _day: number,
  rng: () => number = Math.random
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const n of MAP_NODES) {
    const cur = modifiers?.[n.id] ?? 1;
    const drift = 0.95 + rng() * 0.1; // 0.95-1.05（±5%）
    next[n.id] = Math.min(1.5, Math.max(0.8, round2(cur * drift)));
  }
  return next;
}

/** 点位物价系数 = 每日系数 × active 事件价格效果（点位命中或品类命中），clamp [0.5, 2] */
export function getNodePriceModifier(nodeId: string, itemCategory: string | undefined, state: TradeContext): number {
  const base = state.nodePriceModifiers?.[nodeId] ?? 1;
  let factor = 1;
  for (const eff of getActiveMapEventEffects(state.mapEvents ?? [])) {
    if (!eff.priceChange) continue;
    const pc = eff.priceChange;
    if (pc.nodeId === nodeId || (itemCategory && pc.itemCategory === itemCategory)) {
      factor *= pc.multiplier;
    }
  }
  return Math.min(2, Math.max(0.5, round2(base * factor)));
}

export interface LogisticsResult {
  transportDays: number;
  freight: number;
  risk: number;
  routeId?: string;
  green: boolean;
}

/** 物流：天数=baseTime（绿通减半）/运费=distance×0.5（绿通减半）/风险=baseRisk（护卫减半+绿通减半） */
export function calculateLogistics(from: string, to: string, state: TradeContext): LogisticsResult {
  const route = findTradeRoute(from, to);
  if (!route) {
    // 无直达商路兜底（工程近似：距 6 里 / 2 日 / 风险 0.12），注释说明
    return { transportDays: 2, freight: 3, risk: 0.12, green: false };
  }
  const green = getEffectiveGreenChannels(state).has(route.id);
  const hasGuard = (state.employees ?? []).some((e) => e.type === 'guard' && !e.restToday);
  let days = route.baseTime;
  let freight = round2(route.distance * 0.5);
  let risk = route.risk;
  if (green) {
    days = Math.max(1, Math.ceil(days / 2));
    freight = round2(freight / 2);
  }
  if (hasGuard) {
    risk = round2(risk / 2);
  }
  // 谢七≥70：西市码头沿线风险归零
  if ((state.xieQiFavor ?? 0) >= 70 && (WEST_NODES.includes(from) || WEST_NODES.includes(to))) {
    risk = 0;
  }
  return { transportDays: days, freight, risk, routeId: route.id, green };
}

export interface TradeProfitResult {
  buyPrice: number;
  sellPrice: number;
  profit: number;
  transportDays: number;
  risk: number;
  freight: number;
  riskLoss: number;
  basePrice: number;
}

/** 跑商利润：买入=基准×buyMod、卖出=基准×sellMod、利润=(sell-buy)×qty-运费-风险损耗 */
export function calculateTradeProfit(
  buyNodeId: string,
  sellNodeId: string,
  itemCategory: string,
  quantity: number,
  state: TradeContext
): TradeProfitResult {
  const basePrice = categoryBasePrice(itemCategory, state);
  const buyPrice = round2(basePrice * getNodePriceModifier(buyNodeId, itemCategory, state));
  const sellPrice = round2(basePrice * getNodePriceModifier(sellNodeId, itemCategory, state));
  const logistics = calculateLogistics(buyNodeId, sellNodeId, state);
  const qty = Math.max(1, Math.floor(quantity));
  const gross = round2((sellPrice - buyPrice) * qty);
  const riskLoss = round2(qty * sellPrice * logistics.risk * 0.3); // 被劫期望损失（工程近似）
  const profit = round2(gross - logistics.freight - riskLoss);
  return {
    buyPrice,
    sellPrice,
    profit,
    transportDays: logistics.transportDays,
    risk: logistics.risk,
    freight: logistics.freight,
    riskLoss,
    basePrice,
  };
}

/** 执行跑商：校验现银 → 扣商品与运费 → 入在途队列（到达日结算由 checkTransportArrivals） */
export function executeTradeRun(
  buyNodeId: string,
  sellNodeId: string,
  itemCategory: string,
  quantity: number,
  state: TradeContext
): TradeRunResult {
  if (buyNodeId === sellNodeId) {
    return { ok: false, reason: '买卖不可同在一处' };
  }
  const qty = Math.max(1, Math.floor(quantity));
  const estimate = calculateTradeProfit(buyNodeId, sellNodeId, itemCategory, qty, state);
  const cost = round2(estimate.buyPrice * qty + estimate.freight);
  if (cost > state.silver) {
    return { ok: false, reason: `现银不足，需 ${cost} 两` };
  }
  const goods: TransportingGoods = {
    id: `tg-${state.day}-${buyNodeId}-${sellNodeId}-${Math.random().toString(36).slice(2, 8)}`,
    itemCategory,
    quantity: qty,
    buyPrice: estimate.buyPrice,
    sellNodeId,
    departureDay: state.day,
    arrivalDay: state.day + estimate.transportDays,
    risk: estimate.risk,
    status: 'in_transit',
  };
  return {
    ok: true,
    buyPrice: estimate.buyPrice,
    sellPrice: estimate.sellPrice,
    profit: estimate.profit,
    transportDays: estimate.transportDays,
    risk: estimate.risk,
    freight: estimate.freight,
    goods,
  };
}

/** 每日清晨结算到达货物：rng<risk 被劫损失 30-70%，否则按到达日市价入库售得 */
export function checkTransportArrivals(
  state: TradeContext,
  rng: () => number = Math.random
): TransportArrivalResult[] {
  const results: TransportArrivalResult[] = [];
  for (const g of state.transportingGoods ?? []) {
    if (g.status !== 'in_transit' || g.arrivalDay > state.day) continue;
    const sellPrice = round2(
      categoryBasePrice(g.itemCategory, state) * getNodePriceModifier(g.sellNodeId, g.itemCategory, state)
    );
    const gross = round2(sellPrice * g.quantity);
    if (rng() < g.risk) {
      const lossRate = 0.3 + rng() * 0.4; // 30-70%
      const robbedLoss = round2(gross * lossRate);
      results.push({
        goodsId: g.id,
        itemCategory: g.itemCategory,
        quantity: g.quantity,
        sellPrice,
        gross: round2(gross - robbedLoss),
        robbedLoss,
        status: 'robbed',
        note: `途中遇劫，损失 ${robbedLoss} 两，仅存 ${round2(gross - robbedLoss)} 两`,
      });
    } else {
      results.push({
        goodsId: g.id,
        itemCategory: g.itemCategory,
        quantity: g.quantity,
        sellPrice,
        gross,
        robbedLoss: 0,
        status: 'arrived',
        note: `货物抵埠，售得 ${gross} 两`,
      });
    }
  }
  return results;
}
