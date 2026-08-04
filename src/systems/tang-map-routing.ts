/**
 * 《我在唐朝当掌柜》地图路线规划与可视化纯函数（TANG-MIST-003 M3 · 2.2/2.5/2.6/2.7/2.8）
 * - planOptimalRoute：路线规划（最短=运输天数最少 / 最安全=风险最低优先绿通；Dijkstra）
 * - maybeRevealPathOnTravel：快速移动经过未探访节点 20% 自动揭示（复用 M1 revealRegion）
 * - routeLineTone：商路连线色调（绿=绿通 / 黄=普通 / 红=高风险）
 * - caravanProgress：在途镖队沿连线进度（0-1；骡车动画定位）
 * - routeUsageCounts / routeHeatTone：热力图（轻量：在途货物+镖队在途次数着色；
 *   繁忙路线安全性+10% 为注释级设定，未接入结算，避免改动经济核心）
 * - nodeMatchesFilter：图层筛选（未探访节点不受筛选影响，由调用方兜底）
 * - nodeInteractionLabel：快速移动到达后触发的交互类型文案
 * - buildMarkerNotices：每日清晨标记节点新动态提示（新事件 / 物价波动 >5%）
 * - isRouteWinterClosed：冬季山路封闭（2.8；❄️ 不可通行）
 * 铁律：古风措辞；纯函数可测；不持有游戏状态；凛冬要塞零触碰。
 */
import { MAP_NODE_MAP, TRADE_ROUTES, TRADE_ROUTE_MAP } from '@/config/tang-map-data';
import { calculateLogistics, findTradeRoute, type TradeContext } from '@/systems/tang-trade';
import { maybeRevealRegionOnTravel } from '@/systems/tang-fog';
import { seasonForDay } from '@/systems/tang-node-prosperity';
import type { FogState } from '@/types/tang-manager';
import type { Caravan } from '@/types/tang-caravan';
import type {
  MapEvent,
  MapNode,
  MapNodeType,
  MapRoutePlan,
  PlayerMarker,
  TradeRoute,
  TransportingGoods,
} from '@/types/tang-map';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 快速移动精力消耗（TANG-MIST-003 M3 · 2.5：10 精力瞬间到达） */
export const QUICK_TRAVEL_ENERGY_COST = 10;

// ============================================================
// 2.6 路线规划（Dijkstra）
// ============================================================

export interface RoutePlanInput {
  from: string;
  to: string;
  mode: 'shortest' | 'safest';
  state: TradeContext;
}

/**
 * 路线规划：在 TRADE_ROUTES 无向图上 Dijkstra。
 * - shortest：边代价=运输天数（绿通/护卫经 calculateLogistics 修正）——运输天数最少
 * - safest：边代价=风险（绿通/护卫修正）——风险最低且天然优先绿通（绿通风险减半）
 * 返回途径节点/商路与总距离/天数/运费/风险；不可达返回 ok=false。
 */
export function planOptimalRoute(input: RoutePlanInput): { ok: boolean; reason?: string; plan?: MapRoutePlan } {
  const { from, to, mode } = input;
  if (from === to) return { ok: false, reason: '起止不可同在一处' };

  // 无向邻接表
  const adj = new Map<string, { node: string; routeId: string }[]>();
  for (const r of TRADE_ROUTES) {
    for (const [a, b] of [
      [r.from, r.to],
      [r.to, r.from],
    ] as const) {
      const list = adj.get(a) ?? [];
      list.push({ node: b, routeId: r.id });
      adj.set(a, list);
    }
  }
  if (!adj.has(from) || !adj.has(to)) return { ok: false, reason: '此路未通商，无可规划' };

  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { node: string; routeId: string }>();
  const visited = new Set<string>();

  for (;;) {
    let cur: string | null = null;
    let best = Infinity;
    for (const [node, d] of dist) {
      if (!visited.has(node) && d < best) {
        best = d;
        cur = node;
      }
    }
    if (cur === null) break;
    if (cur === to) break;
    visited.add(cur);
    for (const edge of adj.get(cur) ?? []) {
      if (visited.has(edge.node)) continue;
      // 2.8：冬季山路封闭不可通行（规划同样避让）
      if (isRouteWinterClosed(input.state.day, edge.routeId)) continue;
      const lg = calculateLogistics(cur, edge.node, input.state);
      const baseCost = mode === 'shortest' ? lg.transportDays : lg.risk;
      // 最安全模式同风险优先绿通（微扰 0.0001 仅作 tie-break，不改真实风险汇总）
      const cost = mode === 'safest' ? baseCost + (lg.green ? 0 : 0.0001) : baseCost;
      const nd = best + cost;
      if (nd < (dist.get(edge.node) ?? Infinity)) {
        dist.set(edge.node, nd);
        prev.set(edge.node, { node: cur, routeId: edge.routeId });
      }
    }
  }
  if (!dist.has(to)) return { ok: false, reason: '两地之间无路可达' };

  // 回溯路径
  const nodeIds: string[] = [];
  const routeIds: string[] = [];
  let cur: string | null = to;
  while (cur !== null) {
    nodeIds.unshift(cur);
    const p = prev.get(cur);
    if (p) {
      routeIds.unshift(p.routeId);
      cur = p.node;
    } else {
      cur = null;
    }
  }

  let totalDistance = 0;
  let totalDays = 0;
  let totalFreight = 0;
  let totalRisk = 0;
  for (const rid of routeIds) {
    const r = TRADE_ROUTE_MAP[rid];
    if (!r) continue;
    const lg = calculateLogistics(r.from, r.to, input.state);
    totalDistance += r.distance;
    totalDays += lg.transportDays;
    totalFreight += lg.freight;
    totalRisk += lg.risk;
  }

  return {
    ok: true,
    plan: {
      from,
      to,
      mode,
      nodeIds,
      routeIds,
      totalDistance: round2(totalDistance),
      totalDays,
      totalFreight: round2(totalFreight),
      totalRisk: round2(totalRisk),
    },
  };
}

// ============================================================
// 2.5 快速移动 20% 自动揭示（复用 M1 revealRegion）
// ============================================================

export interface PathRevealInput {
  fogOfWar: FogState;
  /** 途经节点 id（含终点；中间未探访节点按 20% 逐点揭示） */
  nodeIds: readonly string[];
  rng?: () => number;
}

/** 快速移动经过未探访节点：20% 自动揭示（复用 tang-fog.maybeRevealRegionOnTravel，幂等） */
export function maybeRevealPathOnTravel(input: PathRevealInput): { fogOfWar: FogState; revealedNodeIds: string[] } {
  const rng = input.rng ?? Math.random;
  let fog = input.fogOfWar;
  const revealed: string[] = [];
  for (const id of input.nodeIds) {
    // maybeRevealRegionOnTravel 仅读取 fogOfWar.regions；势力/NPC/线索字段传空不影响揭示
    const res = maybeRevealRegionOnTravel({ fogOfWar: fog, factions: [], npcFavors: [], clues: [] }, id, rng);
    if (res.changed) {
      fog = res.fogOfWar;
      revealed.push(id);
    }
  }
  return { fogOfWar: fog, revealedNodeIds: revealed };
}

// ============================================================
// 2.2 商路可视化（连线色调 / 骡车进度 / 热力图）
// ============================================================

export type RouteLineTone = 'green' | 'normal' | 'high';

/** 连线色调：绿=绿色通道 / 黄=普通 / 红=高风险（risk>0.12） */
export function routeLineTone(route: TradeRoute, green: boolean): RouteLineTone {
  if (green) return 'green';
  return route.risk > 0.12 ? 'high' : 'normal';
}

/** 在途镖队沿连线进度（0-1；骡车动画定位；未出发 0 / 已抵 1） */
export function caravanProgress(caravan: Caravan, day: number): number {
  const span = caravan.arrivalDay - caravan.departureDay;
  if (span <= 0) return caravan.returning ? 1 : 0;
  return Math.min(1, Math.max(0, (day - caravan.departureDay) / span));
}

/**
 * 热力图使用计数（routeId → 在途次数）：
 * 跑商在途货物按 sellNodeId 关联商路（TransportingGoods 无起点字段，工程近似）；
 * 镖队在途按 route.from/to 精确计数。注释：繁忙路线安全性+10% 为设定级，未接入结算。
 */
export function routeUsageCounts(
  transportingGoods: readonly TransportingGoods[],
  caravans: readonly Caravan[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const g of transportingGoods) {
    if (g.status !== 'in_transit') continue;
    for (const r of TRADE_ROUTES) {
      if (r.from === g.sellNodeId || r.to === g.sellNodeId) {
        counts[r.id] = (counts[r.id] ?? 0) + 1;
      }
    }
  }
  for (const c of caravans) {
    if (c.status !== 'in_transit' || !c.route) continue;
    const rid = findTradeRoute(c.route.from, c.route.to)?.id;
    if (rid) counts[rid] = (counts[rid] ?? 0) + 1;
  }
  return counts;
}

export type RouteHeatTone = 'busy' | 'normal' | 'cold';

/** 热力图色调：≥2 次 繁忙（红） / 0 次 冷门（蓝） / 其余 普通 */
export function routeHeatTone(count: number): RouteHeatTone {
  if (count <= 0) return 'cold';
  if (count >= 2) return 'busy';
  return 'normal';
}

// ============================================================
// 2.3 图层筛选（未探访节点不受筛选影响由调用方兜底）
// ============================================================

export type MapNodeFilter = 'all' | 'business' | 'resource' | 'government' | 'npc' | 'event';

/** 节点是否匹配筛选（event=有活跃事件；business=商铺+市集） */
export function nodeMatchesFilter(
  node: MapNode,
  filter: MapNodeFilter,
  eventNodeIds: ReadonlySet<string>
): boolean {
  if (filter === 'all') return true;
  if (filter === 'event') return eventNodeIds.has(node.id);
  if (filter === 'business') return node.type === 'shop' || node.type === 'market';
  return node.type === (filter as MapNodeType);
}

// ============================================================
// 2.5 快速移动交互文案
// ============================================================

/** 快速移动到达后触发的交互类型（商业→交易面板 / NPC→拜访 / 资源→采买 / 官府→政令） */
export function nodeInteractionLabel(node: MapNode): string {
  switch (node.type) {
    case 'shop':
    case 'market':
      return '交易面板';
    case 'npc':
      return '拜访';
    case 'resource':
      return '采买';
    case 'government':
      return '政令';
    case 'residence':
      return '闲谈';
  }
}

// ============================================================
// 2.4 每日清晨标记节点新动态提示
// ============================================================

export interface MarkerNoticeInput {
  markers: readonly PlayerMarker[];
  activeEvents: readonly MapEvent[];
  /** 昨日点位物价系数 */
  prevModifiers: Record<string, number>;
  /** 今日点位物价系数 */
  nextModifiers: Record<string, number>;
  day: number;
}

/** 标记节点新动态：今日新 active 事件 或 点位物价波动 >5% → 古风提示文案 */
export function buildMarkerNotices(input: MarkerNoticeInput): string[] {
  const notices: string[] = [];
  for (const m of input.markers) {
    const nodeName = MAP_NODE_MAP[m.nodeId]?.name ?? m.nodeId;
    const freshEvent = input.activeEvents.find((e) => e.nodeId === m.nodeId && e.spawnDay === input.day);
    if (freshEvent) {
      notices.push(
        `标记「${m.label}」· ${nodeName}：${freshEvent.type === 'threat' ? '惊闻' : '喜闻'}${freshEvent.title}，速去定夺。`
      );
      continue;
    }
    const prev = input.prevModifiers[m.nodeId] ?? 1;
    const next = input.nextModifiers[m.nodeId] ?? 1;
    if (prev > 0 && Math.abs(next - prev) / prev > 0.05) {
      notices.push(`标记「${m.label}」· ${nodeName}：物价${next > prev ? '腾贵' : '走低'}，宜早定夺。`);
    }
  }
  return notices;
}

// ============================================================
// 2.8 季节性地图变化（冬季山路封闭）
// ============================================================

/** 冬季封闭山路（❄️ 不可通行）：城外桑园/茶园/药田/五洋巷 相关的山道 */
export const WINTER_CLOSED_ROUTE_IDS: readonly string[] = [
  'r-matou-chayuan',
  'r-matou-yaotian',
  'r-jingzhao-sangyuan',
  'r-sangyuan-chayuan',
  'r-chayuan-yaotian',
  'r-wuyang-chayuan',
];

/** 冬季该商路是否封闭（❄️ 不可通行） */
export function isRouteWinterClosed(day: number, routeId: string): boolean {
  return seasonForDay(day) === 'winter' && WINTER_CLOSED_ROUTE_IDS.includes(routeId);
}

/** 冬季封闭商路的端点节点 id（UI 展示 ❄️ 标记用） */
export function winterClosedRouteNodeIds(day: number): string[] {
  if (seasonForDay(day) !== 'winter') return [];
  const out = new Set<string>();
  for (const rid of WINTER_CLOSED_ROUTE_IDS) {
    const r = TRADE_ROUTE_MAP[rid];
    if (r) {
      out.add(r.from);
      out.add(r.to);
    }
  }
  return [...out];
}
