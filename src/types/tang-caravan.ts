/**
 * 《我在唐朝当掌柜》镖队类型（Step 5b-5 模块四）
 * 镖队："镖队：唐代商旅多结队而行，雇武师押运，以防盗匪。可自行组建镖队，设定路线，往来运货。"
 * Caravan 字段（用户 4.1 逐字）：id/name/leader/members/guards/route/status/currentGoods/
 * departureDay/arrivalDay/totalTrips/totalValue；CaravanGoods 见下。
 * 系统纯函数见 systems/tang-caravan.ts（复用 Step 5b-2 的 TradeRoute/calculateLogistics/绿通）。
 * @module types/tang-caravan
 */

/** 镖队状态：待命 / 装货 / 在途 / 卸货 */
export type CaravanStatus = 'idle' | 'loading' | 'in_transit' | 'unloading';

/** 镖队所载货物（用户 4.1 逐字） */
export interface CaravanGoods {
  /** 货名（与库房商品同名，装货时按名扣库房） */
  itemName: string;
  /** 数量（份） */
  quantity: number;
  /** 单位成本（两；装货时按库房成本价记） */
  unitCost: number;
}

/** 镖队（用户 4.1 逐字） */
export interface Caravan {
  id: string;
  /** 镖队名（古风；组建时由玩家/系统命名） */
  name: string;
  /** 领队名 */
  leader: string;
  /** 随行伙计名列表（最多 3 人） */
  members: string[];
  /** 护卫数（雇武师押运；0-3，护卫生效见 systems/tang-caravan.ts） */
  guards: number;
  /** 设定路线（from/to 为舆图点位 id；未设定 null） */
  route: { from: string; to: string } | null;
  status: CaravanStatus;
  /** 本次所载货物（装货后非空；返程卸货后清空） */
  currentGoods: CaravanGoods[];
  /** 出发日（装货完成后置 day；返程出发日 = 到达日） */
  departureDay: number;
  /** 到达日（在途推进结算；返程到达即回店 idle） */
  arrivalDay: number;
  /** 累计跑商趟数 */
  totalTrips: number;
  /** 累计货值（两；到达卖出总价累计） */
  totalValue: number;
  /** 事件日志（最近 3 次；触发事件/到达结算写入） */
  eventLog: string[];
  /** 返程标记（true = 正在返程；到达结算后置 true，返程到达后回 idle） */
  returning?: boolean;
  /** 领队经验（触发平安事件 +2；展示用） */
  leaderExp?: number;
}
