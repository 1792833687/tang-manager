/**
 * 《我在唐朝当掌柜》镖队系统（Step 5b-5 模块四）
 * 镖队："镖队：唐代商旅多结队而行，雇武师押运，以防盗匪。可自行组建镖队，设定路线，往来运货。"
 * 纯函数（可测）：
 * - setupCaravanRoute：设定路线（复用 Step 5b-2 TradeRoute/calculateLogistics）。
 * - loadCaravan：装货（库房减、镖队增）、置 in_transit、算到达日。
 * - triggerCaravanEvent：在途事件池 6 种逐字（劫匪/风雨/抄近道/商机/盘查/平安）。
 * - resolveCaravanArrival：到达按目的地物价卖出、利润=卖价-运费-损耗、返回需同天数。
 * - checkCaravanDaily：每日清晨推进在途镖队（触发事件 + 到达/返程结算）。
 * 铁律：古风措辞；不持有游戏状态。
 */
import { v4 as uuidv4 } from 'uuid';
import {
  calculateLogistics,
  categoryBasePrice,
  getNodePriceModifier,
  type TradeContext,
} from '@/systems/tang-trade';
import type { Caravan, CaravanGoods } from '@/types/tang-caravan';

/** 事件池（用户 4.1 逐字）：劫匪 40% / 风雨 +1-3 天 / 抄近道 -1 天风险+10% / 商机 提前卖 / 盘查 走私没收罚款 / 平安 领队+2 */
export type CaravanEventType = 'robbers' | 'storm' | 'shortcut' | 'opportunity' | 'inspection' | 'safe';

/** 在途事件结果（store 应用） */
export interface CaravanEventResult {
  eventType: CaravanEventType;
  description: string;
  /** 到达日偏移（风雨 +1~3；抄近道 -1） */
  arrivalDayDelta?: number;
  /** 银两变动（商机 + / 盘查罚款 -） */
  silverDelta?: number;
  /** 货损率（劫匪 30-70% 若未击退） */
  goodsLossRate?: number;
  /** 领队经验（平安 +2） */
  leaderExpGain?: number;
  /** 是否被护卫击退（劫匪事件：有护卫 60% 击退） */
  guardsRepelled?: boolean;
}

/** 镖队所需状态子集 */
export interface CaravanState {
  day: number;
  caravans: readonly Caravan[];
  trade: TradeContext;
}

/** 建队（store 调；返回新镖队，初始 idle） */
export function createCaravan(
  input: { name: string; leader: string; members: string[]; guards: number },
  day: number
): Caravan {
  return {
    id: uuidv4(),
    name: input.name,
    leader: input.leader,
    members: input.members,
    guards: Math.min(3, Math.max(0, input.guards)),
    route: null,
    status: 'idle',
    currentGoods: [],
    departureDay: day,
    arrivalDay: day,
    totalTrips: 0,
    totalValue: 0,
    eventLog: [],
    leaderExp: 0,
  };
}

export interface SetupRouteResult {
  ok: boolean;
  reason?: string;
  caravan?: Caravan;
}

/** 设定路线（from/to 为舆图点位 id；校验商路存在；置 status=loading） */
export function setupCaravanRoute(
  caravan: Caravan,
  from: string,
  to: string,
  state: CaravanState
): SetupRouteResult {
  if (caravan.status !== 'idle' && caravan.status !== 'loading') {
    return { ok: false, reason: '镖队已上路，须归队后再改路线', caravan };
  }
  if (from === to) {
    return { ok: false, reason: '起止不可同在一处', caravan };
  }
  const logistics = calculateLogistics(from, to, state.trade);
  if (!logistics.routeId) {
    return { ok: false, reason: '此路未通商，无可押运', caravan };
  }
  return {
    ok: true,
    caravan: {
      ...caravan,
      route: { from, to },
      status: 'loading',
      eventLog: pushEvent(caravan.eventLog, `设定路线：${from} → ${to}`),
    },
  };
}

export interface LoadResult {
  ok: boolean;
  reason?: string;
  caravan?: Caravan;
  /** 装货扣减后的库房商品（store 应用） */
  shopItems?: { itemName: string; quantity: number }[];
}

/** 装货（库房减、镖队增）：校验路线已设、货物足量；置 in_transit 并算到达日 */
export function loadCaravan(
  caravan: Caravan,
  goods: CaravanGoods[],
  state: CaravanState
): LoadResult {
  if (!caravan.route) {
    return { ok: false, reason: '尚未设定路线，无法装货', caravan };
  }
  if (caravan.status !== 'loading' && caravan.status !== 'idle') {
    return { ok: false, reason: '镖队不在装货状态', caravan };
  }
  const dedup = new Map<string, CaravanGoods>();
  for (const g of goods) {
    dedup.set(g.itemName, {
      itemName: g.itemName,
      quantity: (dedup.get(g.itemName)?.quantity ?? 0) + g.quantity,
      unitCost: g.unitCost,
    });
  }
  const merged = Array.from(dedup.values());
  if (merged.length === 0) {
    return { ok: false, reason: '未装任何货物', caravan };
  }
  // 库房足量校验由 store 按 itemName 精确执行（本函数只返回扣货清单，见 shopItems 字段）
  const logistics = calculateLogistics(caravan.route.from, caravan.route.to, state.trade);
  return {
    ok: true,
    caravan: {
      ...caravan,
      status: 'in_transit',
      currentGoods: merged,
      departureDay: state.day,
      arrivalDay: state.day + logistics.transportDays,
      eventLog: pushEvent(caravan.eventLog, `装货上路：${merged.map((g) => `${g.itemName}×${g.quantity}`).join('、')}`),
    },
    shopItems: merged.map((g) => ({ itemName: g.itemName, quantity: g.quantity })),
  };
}

/** 事件日志追加（最近 3 条） */
function pushEvent(log: string[], text: string): string[] {
  return [...log, text].slice(-3);
}

/**
 * 在途事件（用户 4.1 逐字）：
 * 劫匪 40%（有护卫 60% 击退；否则损 30-70% 货）/ 风雨 +1-3 天 /
 * 抄近道 -1 天 + 风险 10% / 商机 提前卖（银两 +）/ 盘查 走私没收罚款 /
 * 平安 领队 +2。
 */
export function triggerCaravanEvent(
  caravan: Caravan,
  _state: CaravanState,
  rng: () => number = Math.random
): CaravanEventResult {
  const roll = rng();
  if (roll < 0.4) {
    // 劫匪
    const hasGuard = caravan.guards > 0;
    const repelled = hasGuard && rng() < 0.6;
    if (repelled) {
      return {
        eventType: 'robbers',
        description: '道遇劫匪，护卫仗刀而立，贼人见势退去，货物分毫未损。',
        guardsRepelled: true,
      };
    }
    const lossRate = 0.3 + rng() * 0.4; // 30-70%
    return {
      eventType: 'robbers',
      description: `道遇劫匪，${hasGuard ? '护卫寡不敌众，' : '无人押运，'}货物被抢去${Math.round(lossRate * 100)}成。`,
      goodsLossRate: lossRate,
    };
  }
  if (roll < 0.55) {
    const days = 1 + Math.floor(rng() * 3); // +1-3
    return {
      eventType: 'storm',
      description: `风雨大作，官道泥泞，行程延误${days}日。`,
      arrivalDayDelta: days,
    };
  }
  if (roll < 0.68) {
    return {
      eventType: 'shortcut',
      description: '领队识得捷径，抄近道省去 1 日行程，然小道多险。',
      arrivalDayDelta: -1,
    };
  }
  if (roll < 0.78) {
    const gain = 5 + Math.floor(rng() * 16); // 5-20 两
    return {
      eventType: 'opportunity',
      description: `途遇商机，${caravan.leader}将余货转手，得银 ${gain} 两。`,
      silverDelta: gain,
    };
  }
  if (roll < 0.9) {
    const fine = 3 + Math.floor(rng() * 8); // 3-10 两
    return {
      eventType: 'inspection',
      description: `过关盘查，${caravan.leader}塞了 ${fine} 两孝敬，方得放行。`,
      silverDelta: -fine,
    };
  }
  return {
    eventType: 'safe',
    description: `一路平安，${caravan.leader}押运更添几分火候。`,
    leaderExpGain: 2,
  };
}

export interface ArrivalResult {
  ok: boolean;
  reason?: string;
  caravan?: Caravan;
  /** 本次卖货收入（两） */
  revenue: number;
  /** 利润 = 卖价 - 运费 - 损耗（工程近似） */
  profit: number;
  /** 是否返程开始 */
  returnStarted: boolean;
  description: string;
}

/** 到达结算：按目的地物价卖出；利润=卖价-运费-损耗；返回需同天数（returning=true） */
export function resolveCaravanArrival(caravan: Caravan, state: CaravanState): ArrivalResult {
  if (!caravan.route || caravan.status !== 'in_transit') {
    return { ok: false, reason: '镖队不在在途状态', revenue: 0, profit: 0, returnStarted: false, description: '' };
  }
  const logistics = calculateLogistics(caravan.route.from, caravan.route.to, state.trade);
  let revenue = 0;
  let cost = 0;
  for (const g of caravan.currentGoods) {
    const sellPrice = categoryBasePrice(g.itemName, state.trade) * getNodePriceModifier(caravan.route.to, undefined, state.trade);
    revenue += Math.round(sellPrice * g.quantity * 100) / 100;
    cost += g.unitCost * g.quantity;
  }
  const profit = Math.round((revenue - logistics.freight - cost) * 100) / 100;
  const description = `抵达目的地，货卖 ${Math.round(revenue * 100) / 100} 两，除运费与本金，得利 ${profit} 两。`;
  const returnStarted = true;
  const caravanAfter: Caravan = {
    ...caravan,
    status: 'in_transit',
    currentGoods: [],
    departureDay: state.day,
    arrivalDay: state.day + logistics.transportDays,
    returning: true,
    totalTrips: caravan.totalTrips + 1,
    totalValue: Math.round((caravan.totalValue + revenue) * 100) / 100,
    eventLog: pushEvent(caravan.eventLog, description),
  };
  return { ok: true, caravan: caravanAfter, revenue, profit, returnStarted, description };
}

/** 返程到达：回店 → idle（可再装货） */
export function caravanReturned(caravan: Caravan, state: CaravanState): Caravan {
  return {
    ...caravan,
    status: 'idle',
    returning: false,
    arrivalDay: state.day,
    eventLog: pushEvent(caravan.eventLog, `镖队归店，${caravan.name}整装待发。`),
  };
}

export interface CaravanDailyItem {
  caravanId: string;
  caravanName: string;
  event?: CaravanEventResult;
  arrival?: ArrivalResult;
  returned?: boolean;
  description: string;
}

/**
 * 每日清晨推进在途镖队：
 * 1. 在途期间每日 30% 概率触发在途事件（应用 arrivalDayDelta/silverDelta/货损/领队经验）。
 * 2. 到达日结算：未返程 → resolveCaravanArrival（卖货+开始返程）；已返程 → 回店 idle。
 * 返回更新后的镖队列表 + 本日事件明细（store 应用银两/事件日志）。
 */
export function checkCaravanDaily(
  state: CaravanState,
  rng: () => number = Math.random
): { caravans: Caravan[]; events: CaravanDailyItem[]; silverDelta: number } {
  let caravans = state.caravans.map((c) => ({ ...c }));
  const events: CaravanDailyItem[] = [];
  let silverDelta = 0;
  for (let i = 0; i < caravans.length; i++) {
    const c = caravans[i]!;
    if (c.status !== 'in_transit') continue;
    // 在途事件（30%）
    if (rng() < 0.3) {
      const ev = triggerCaravanEvent(c, state, rng);
      let updated: Caravan = { ...c };
      if (ev.arrivalDayDelta) updated.arrivalDay += ev.arrivalDayDelta;
      if (ev.silverDelta) silverDelta += ev.silverDelta;
      if (ev.goodsLossRate) {
        updated.currentGoods = updated.currentGoods.map((g) => ({
          ...g,
          quantity: Math.max(0, Math.round(g.quantity * (1 - ev.goodsLossRate!))),
        }));
      }
      if (ev.leaderExpGain) updated.leaderExp = (updated.leaderExp ?? 0) + ev.leaderExpGain;
      updated.eventLog = pushEvent(updated.eventLog, ev.description);
      caravans[i] = updated;
      events.push({ caravanId: c.id, caravanName: c.name, event: ev, description: ev.description });
      if (updated.arrivalDay <= state.day) {
        // 事件导致提前到达：直接结算到达
        const arrived = caravans[i]!;
        if (arrived.returning) {
          caravans[i] = caravanReturned(arrived, state);
          events.push({ caravanId: arrived.id, caravanName: arrived.name, returned: true, description: '镖队已返程归店。' });
        } else {
          const arr = resolveCaravanArrival(arrived, state);
          if (arr.ok && arr.caravan) {
            caravans[i] = arr.caravan;
            // 到达结算入银（内容深化 TANG-CONT-B 模块六·4 修复：原实现只记事件不落账，
            // 货卖出后银两从未入账；货物为库房已购资产，故入卖价 revenue——与跑商 gross 口径一致）
            silverDelta += arr.revenue;
            events.push({ caravanId: arrived.id, caravanName: arrived.name, arrival: arr, description: arr.description });
          }
        }
        continue;
      }
      continue;
    }
    // 到达判定（无事件）
    if (c.arrivalDay <= state.day) {
      if (c.returning) {
        caravans[i] = caravanReturned(c, state);
        events.push({ caravanId: c.id, caravanName: c.name, returned: true, description: '镖队已返程归店。' });
      } else {
        const arr = resolveCaravanArrival(c, state);
        if (arr.ok && arr.caravan) {
          caravans[i] = arr.caravan;
          // 到达结算入银（同事件提前到达分支）
          silverDelta += arr.revenue;
          events.push({ caravanId: c.id, caravanName: c.name, arrival: arr, description: arr.description });
        }
      }
    }
  }
  return { caravans, events, silverDelta };
}
