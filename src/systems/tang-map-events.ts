/**
 * 《我在唐朝当掌柜》动态地图事件系统（Step 5b-2 模块三）
 * 纯函数（可测），store 只做「调用 + 应用变更」：
 * - generateMapEvents：每日清晨在已解锁层随机 1-2 个事件（持续 2-5 天；用户逐字部分按原文 1 天/当日）。
 * - handleMapEvent：respond 按类型耗精力/资金获正向效果；ignore 保持 active，自然过期承受负面。
 * - expireMapEvents：打烊清 expireDay≤day 的 active；忽略的施加一次性负面（ignoredEffects）。
 * - getActiveMapEventEffects / mapEventIncomeFactor：active 事件持续效果（priceChange 实时读取，
 *   被动 gold/reputation 每打烊结算应用——工程决策，见模块八接入）。
 * 铁律：数值裁决全部在此层完成，古风措辞。
 */
import { MAP_EVENT_POOL, MAP_EVENT_TEMPLATE_MAP, MAP_NODE_MAP } from '@/config/tang-map-data';
import type { MapEvent, MapEventEffect, MapLayer } from '@/types/tang-map';

/** 事件生成输入 */
export interface GenerateMapEventsInput {
  day: number;
  unlockedLayers: MapLayer[];
  /** 已存在的同模板事件 id（去重：不重复刷同款） */
  activeEventIds: string[];
  rng?: () => number;
}

/**
 * 每日清晨生成 1-2 个事件：模板点位须在已解锁层；避开已 active 的同模板；
 * spawnDay=day、expireDay=day+duration、status=active。
 */
export function generateMapEvents(input: GenerateMapEventsInput): MapEvent[] {
  const rng = input.rng ?? Math.random;
  const activeSet = new Set(input.activeEventIds);
  const unlockedSet = new Set(input.unlockedLayers);
  const candidates = MAP_EVENT_POOL.filter((tpl) => {
    if (activeSet.has(tpl.id)) return false;
    const node = MAP_NODE_MAP[tpl.nodeId];
    return !!node && unlockedSet.has(node.layer);
  });
  if (candidates.length === 0) return [];
  const count = rng() < 0.5 ? 1 : 2;
  const picked: typeof candidates = [];
  const pool = [...candidates];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return picked.map((tpl) => ({
    id: `${tpl.id}-${input.day}`,
    type: tpl.type,
    title: tpl.title,
    description: tpl.description,
    nodeId: tpl.nodeId,
    spawnDay: input.day,
    expireDay: input.day + tpl.duration,
    status: 'active' as const,
    effects: tpl.effects,
    ignoredEffects: tpl.ignoredEffects,
    passiveEffects: tpl.passiveEffects,
  }));
}

/** 事件应对上下文（store 传入） */
export interface MapEventHandleContext {
  energy: number;
  silver: number;
  hasGuard: boolean;
}

export interface MapEventHandleResult {
  ok: boolean;
  reason?: string;
  /** respond 成功后待应用的效果 */
  effects?: MapEventEffect[];
  updatedEvent?: MapEvent;
}

/**
 * 处理地图事件：
 * - ignore：保持 active（自然过期由 expireMapEvents 施加负面）；返回 ok=true 无效果。
 * - respond：校验代价（needGuard 需护卫 / energyCost 精力 / goldChange<0 现银）后应用 effects，置 resolved。
 */
export function handleMapEvent(
  event: MapEvent,
  action: 'respond' | 'ignore',
  ctx: MapEventHandleContext
): MapEventHandleResult {
  if (event.status !== 'active') {
    return { ok: false, reason: '事件已失效' };
  }
  if (action === 'ignore') {
    return { ok: true, updatedEvent: event };
  }
  const energyCost = event.effects.reduce((s, e) => s + (e.energyCost ?? 0), 0);
  const goldCost = event.effects.reduce((s, e) => s + Math.min(0, e.goldChange ?? 0), 0); // 负值
  const needGuard = event.effects.some((e) => e.needGuard);
  if (needGuard && !ctx.hasGuard) {
    return { ok: false, reason: '混混势众，须护卫弹压' };
  }
  if (energyCost > ctx.energy) {
    return { ok: false, reason: '精力不济，无暇处置' };
  }
  if (-goldCost > ctx.silver) {
    return { ok: false, reason: '现银不足，无力应对' };
  }
  return {
    ok: true,
    effects: event.effects,
    updatedEvent: { ...event, status: 'resolved' },
  };
}

export interface ExpireMapEventsResult {
  events: MapEvent[];
  /** 本次过期（忽略未应对）的事件 */
  expired: MapEvent[];
  /** 过期时施加的一次性负面效果（ignoredEffects 汇总） */
  negativeEffects: MapEventEffect[];
}

/** 打烊清理：expireDay ≤ day 的 active → expired，并汇总其 ignoredEffects（忽略的承受负面） */
export function expireMapEvents(state: { mapEvents: MapEvent[]; day: number }): ExpireMapEventsResult {
  const expired: MapEvent[] = [];
  const negativeEffects: MapEventEffect[] = [];
  const events = state.mapEvents.map((e) => {
    if (e.status === 'active' && e.expireDay <= state.day) {
      const expiredEvent: MapEvent = { ...e, status: 'expired' };
      expired.push(expiredEvent);
      negativeEffects.push(...(expiredEvent.ignoredEffects ?? []));
      return expiredEvent;
    }
    return e;
  });
  return { events, expired, negativeEffects };
}

/** 当前 active 事件的持续效果（passiveEffects 汇总；供结算/跑商读取） */
export function getActiveMapEventEffects(mapEvents: readonly MapEvent[]): MapEventEffect[] {
  return mapEvents.filter((e) => e.status === 'active').flatMap((e) => e.passiveEffects ?? []);
}

/**
 * 地图事件收益修正系数（模块八「priceChange → settleDay 收益修正」的合理接入点）：
 * 特价事件（mult<1）压低市价 → 本店采买更省 → 收益 ×(2-m)；涨价事件（mult>1）→ 收益 ×(1/m)。
 * 取所有 active priceChange 效果的乘积，clamp [0.5, 1.5]。工程近似，注释说明。
 */
export function mapEventIncomeFactor(mapEvents: readonly MapEvent[]): number {
  let factor = 1;
  for (const eff of getActiveMapEventEffects(mapEvents)) {
    if (!eff.priceChange) continue;
    const m = eff.priceChange.multiplier;
    const per = m < 1 ? 2 - m : 1 / m;
    factor *= per;
  }
  return Math.min(1.5, Math.max(0.5, factor));
}

/** 由模板 id 找模板（store 生成用） */
export function getMapEventTemplate(id: string) {
  return MAP_EVENT_TEMPLATE_MAP[id];
}
