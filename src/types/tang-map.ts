/**
 * 《我在唐朝当掌柜》商业地图系统类型（Step 5b-2）
 * 把长安城从背景文本变成可交互的商业版图：三层舆图（永乐坊 → 东市西市 → 长安京畿）、
 * 动态地图事件、跑商物流、绿色通道。
 * @module types/tang-map
 */

/** 地图层：L1 永乐坊 / L2 东市西市 / L3 长安京畿 */
export type MapLayer = 'yongle' | 'east_west_market' | 'changan';

/** 点位类型 */
export type MapNodeType = 'shop' | 'resource' | 'npc' | 'market' | 'government' | 'residence';

/** 地图点位（x/y 为 0-100 百分比坐标，供内联 SVG viewBox 0 0 100 100 渲染） */
export interface MapNode {
  id: string;
  name: string;
  layer: MapLayer;
  /** 横向百分比坐标（0-100） */
  x: number;
  /** 纵向百分比坐标（0-100） */
  y: number;
  type: MapNodeType;
  unlocked: boolean;
  description: string;
  /** 连通点位 id（构成 TRADE_ROUTES 的端点） */
  connectedTo: string[];
  // ---- TANG-MIST-003 M3 · 2.1 节点繁荣度（类型扩展；配置层不设值，运行时由 store.nodeProsperity 驱动）----
  /** 繁荣度默认值（0-100；缺省 50；UI 读取运行时表失败时兜底） */
  prosperity?: number;
  /** 繁荣度趋势（缺省 stable） */
  prosperityTrend?: ProsperityTrend;
}

/** 节点繁荣度趋势（TANG-MIST-003 M3 · 2.1：上升/平稳/下滑） */
export type ProsperityTrend = 'rising' | 'stable' | 'declining';

/** 节点繁荣度运行时状态（key=点位 id；开局全 50/stable） */
export interface NodeProsperity {
  /** 繁荣度（0-100） */
  prosperity: number;
  trend: ProsperityTrend;
  /** 连续升降计数（正=连续升天数、负=连续降天数；|streak|≥3 改 trend） */
  streak: number;
}

/** 玩家自定义标记（TANG-MIST-003 M3 · 2.4；最多 5 个） */
export interface PlayerMarker {
  id: string;
  nodeId: string;
  /** 标记名（默认=节点名；可输入，≤12 字） */
  label: string;
  /** 放置日 */
  placedDay: number;
}

/** 镖队路线预填（TANG-MIST-003 M3 · 2.6：路线规划「组建镖队走此路线」→ 镖队面板预选商路） */
export interface MapCaravanPrefill {
  from: string;
  to: string;
  /** 预选商路 id（直达商路；多跳规划取首段） */
  routeId?: string;
}

/** 路线规划结果（TANG-MIST-003 M3 · 2.6；最短=运输天数最少 / 最安全=风险最低优先绿通） */
export interface MapRoutePlan {
  from: string;
  to: string;
  mode: 'shortest' | 'safest';
  /** 途径节点 id（含起止） */
  nodeIds: string[];
  /** 途经商路 id（依次；相邻起止时为空数组） */
  routeIds: string[];
  totalDistance: number;
  /** 预计运输天数（各段绿通/护卫修正后累加） */
  totalDays: number;
  totalFreight: number;
  totalRisk: number;
}

/** 势力影响圈（三势力：东市商会 / 西市商团 / 京兆府） */
export interface InfluenceZone {
  id: string;
  name: string;
  color: string;
  /** 覆盖点位 id */
  nodes: string[];
  /** 好感（0-100）：东市商会沈听澜 30 / 西市商团谢七 0 / 京兆府官府 20 */
  relationship: number;
}

/** 地图事件状态：active 生效中 / resolved 已应对 / expired 已过期（忽略的过期时施加负面） */
export type MapEventStatus = 'active' | 'resolved' | 'expired';

/** 地图事件效果（商机 respond 正向 / 威胁 ignore 过期负面共用结构） */
export interface MapEventEffect {
  /** 物价变动：itemCategory 目标品类、multiplier 倍率（0.7=-30% / 1.3=+30%）、nodeId 指定点位（可选） */
  priceChange?: { itemCategory: string; multiplier: number; nodeId?: string };
  reputationChange?: number;
  goldChange?: number;
  /** 解锁点位（respond 成功后可解锁新点位） */
  unlockNode?: string;
  /** 精力消耗（respond 代价；正数=消耗） */
  energyCost?: number;
  /** 威胁应对所需护卫标记（混混闹事：有护卫才能 respond） */
  needGuard?: boolean;
}

/** 动态地图事件（每日清晨在已解锁层随机 1-2 个，持续 2-5 天） */
export interface MapEvent {
  id: string;
  type: 'opportunity' | 'threat';
  title: string;
  description: string;
  /** 关联点位（事件发生在哪） */
  nodeId: string;
  /** 出现日 */
  spawnDay: number;
  /** 过期日（打烊清 expireDay ≤ day 的 active；忽略的施加负面） */
  expireDay: number;
  status: MapEventStatus;
  /** respond 正向效果（威胁 respond 需按 energyCost/needGuard 代价）；
   *  商机 respond 即「抢购/赴宴」兑现收益；威胁 respond 即「处置化解」获得声望/化解被动。 */
  effects: MapEventEffect[];
  /** ignore/自然过期的负面效果（一次性；威胁为主；商机忽略则错失无负面） */
  ignoredEffects: MapEventEffect[];
  /** active 期间持续效果（工程决策：每打烊结算应用一次；priceChange 由跑商/结算实时读取） */
  passiveEffects?: MapEventEffect[];
}

/** 商路（跑商物流）：from/to 为点位 id */
export interface TradeRoute {
  id: string;
  from: string;
  to: string;
  /** 距离（里） */
  distance: number;
  /** 基础运输天数 */
  baseTime: number;
  /** 基础风险（0-1；被劫概率） */
  risk: number;
  /** 是否天然绿色通道（true 则运费/时间减半） */
  greenChannel: boolean;
}

/** 在途货物（跑商执行时入队，到达日结算） */
export interface TransportingGoods {
  id: string;
  itemCategory: string;
  quantity: number;
  /** 购入单价（两） */
  buyPrice: number;
  /** 卖出点位 id */
  sellNodeId: string;
  departureDay: number;
  arrivalDay: number;
  risk: number;
  status: 'in_transit' | 'arrived' | 'robbed';
}

/** 地图层解锁规则 */
export interface MapLayerUnlockRule {
  layer: MapLayer;
  label: string;
  /** 解锁条件文案（未解锁灰显展示） */
  hint: string;
  /** 校验：是否已解锁 */
  isUnlocked: (ctx: { reputation: number; shopCount: number; stage: number }) => boolean;
}

/** 跑商执行结果 */
export interface TradeRunResult {
  ok: boolean;
  reason?: string;
  buyPrice?: number;
  sellPrice?: number;
  profit?: number;
  transportDays?: number;
  risk?: number;
  freight?: number;
  goods?: TransportingGoods;
}

/** 到达结算结果（checkTransportArrivals 产出） */
export interface TransportArrivalResult {
  goodsId: string;
  itemCategory: string;
  quantity: number;
  sellPrice: number;
  /** 毛收入 = 卖出价 × 数量 */
  gross: number;
  /** 被劫损失（两；被劫时扣 30-70% 货值） */
  robbedLoss: number;
  status: 'arrived' | 'robbed';
  note: string;
}
