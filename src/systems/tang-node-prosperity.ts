/**
 * 《我在唐朝当掌柜》节点繁荣度系统（TANG-MIST-003 M3 · 2.1）
 * 纯函数（可测）：
 * - buildInitialNodeProsperity：开局全部节点 prosperity=50 / trend=stable / streak=0
 * - updateNodeProsperity：每日清晨批量结算——玩家该节点交易（采买/卖出/镖队到达）+1~3、
 *   商机事件 +2~5、威胁事件 -3~8、季节影响（秋季资源点 +5 / 冬季部分节点 -5）、
 *   clamp 0-100；连续升/降 3 天改 trend（streak 正=连续升、负=连续降）。
 * - getNodeStatusTag：节点状态小标签（有活跃威胁 动荡 > ≥80 火爆 > rising 上升 >
 *   declining 下滑 > <30 冷清；均无则 null）
 * - seasonForDay / monthForDay：季节换算（自然月 1-3 春 / 4-6 夏 / 7-9 秋 / 10-12 冬）
 * 铁律：古风措辞；纯函数可测；不持有游戏状态；凛冬要塞零触碰。
 */
import { MAP_NODES } from '@/config/tang-map-data';
import type { MapEvent, MapNode, NodeProsperity, ProsperityTrend } from '@/types/tang-map';

// ============================================================
// 季节（TANG-MIST-003 M3 · 2.8）
// 月份换算沿用 month = ceil(day/30)；季节按自然月。
// ⚠️ 口径说明：需求 2.8 视觉段落写「春（2-4）/夏（5-7）/秋（8-10）/冬（11-1）」，
//    但同段末明确「季节按自然月（1-3 春/4-6 夏/7-9 秋/10-12 冬——注意与其他系统月份
//    约定对齐）」。为与 MonthlyReview.month / day%30===1 月初钩子保持一致，本项目
//    统一采用自然月口径（1-3 春/4-6 夏/7-9 秋/10-12 冬），前述视觉措辞作废。
// ============================================================
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** 月份换算：month = ceil(day/30)（与 MonthlyReview / day%30===1 月初钩子对齐） */
export function monthForDay(day: number): number {
  return Math.max(1, Math.ceil(Math.max(1, day) / 30));
}

/** 季节按自然月：1-3 春 / 4-6 夏 / 7-9 秋 / 10-12 冬（见文件头口径说明） */
export function seasonForDay(day: number): Season {
  const m = monthForDay(day);
  if (m >= 1 && m <= 3) return 'spring';
  if (m >= 4 && m <= 6) return 'summer';
  if (m >= 7 && m <= 9) return 'autumn';
  return 'winter';
}

// ============================================================
// 繁荣度数值常量（用户 2.1 逐字区间）
// ============================================================

/** 玩家交易繁荣增量区间（+1~3：采买/卖出/镖队到达） */
export const TRADE_PROSPERITY_MIN = 1;
export const TRADE_PROSPERITY_MAX = 3;
/** 商机事件繁荣增量区间（+2~5） */
export const OPPORTUNITY_PROSPERITY_MIN = 2;
export const OPPORTUNITY_PROSPERITY_MAX = 5;
/** 威胁事件繁荣减量区间（-3~-8；内部按 3+floor(rng*6) 实现） */
export const THREAT_PROSPERITY_LOSS_MIN = 3;
export const THREAT_PROSPERITY_LOSS_MAX = 8;
/** 秋季资源点繁荣加成（+5） */
export const AUTUMN_RESOURCE_BONUS = 5;
/** 冬季萧条节点（城外资源点 + 码头仓库；-5；与 2.8 冬季封闭山路的口径呼应） */
export const WINTER_CHILL_NODES: readonly string[] = [
  'chengwai-sangyuan',
  'chengwai-chayuan',
  'chengwai-yaotian',
  'matou-cangku',
];
export const WINTER_CHILL_PENALTY = 5;
/** 连续升/降阈值：|streak|≥3 改 trend */
export const TREND_STREAK_THRESHOLD = 3;
/** 状态标签阈值：≥80 火爆；<30 冷清 */
export const BOOM_THRESHOLD = 80;
export const CHILL_THRESHOLD = 30;
/** 繁荣度默认值（开局/未知节点） */
export const DEFAULT_PROSPERITY = 50;

// ============================================================
// 初始态
// ============================================================

/** 开局全部节点繁荣度：50 / stable / streak=0 */
export function buildInitialNodeProsperity(): Record<string, NodeProsperity> {
  const out: Record<string, NodeProsperity> = {};
  for (const n of MAP_NODES) {
    out[n.id] = { prosperity: DEFAULT_PROSPERITY, trend: 'stable', streak: 0 };
  }
  return out;
}

// ============================================================
// 每日清晨批量结算
// ============================================================

export interface ProsperityUpdateInput {
  day: number;
  nodeProsperity: Record<string, NodeProsperity>;
  /** 玩家在该节点有交易的节点 id（采买/卖出/镖队到达；昨日累计，store 维护 todayTradedNodes） */
  tradedNodeIds?: readonly string[];
  /** active 地图事件（商机 +2~5 / 威胁 -3~8） */
  mapEvents?: readonly MapEvent[];
  /** 随机源（可注入；缺省 Math.random） */
  rng?: () => number;
}

export interface ProsperityUpdateResult {
  nodeProsperity: Record<string, NodeProsperity>;
  /** 本次变动明细（节点 id → 净增减；0 不记） */
  deltas: Record<string, number>;
}

/** 区间随机增减（含端点；rng∈[0,1) 常态，rng=1 注入时 clamp 到 max，避免越界） */
function randDelta(min: number, max: number, rng: () => number): number {
  return Math.min(max, min + Math.floor(rng() * (max - min + 1)));
}

/**
 * 每日清晨批量结算节点繁荣度（纯函数）：
 * 交易 +1~3 / 商机事件 +2~5 / 威胁事件 -3~8 / 季节（秋资源 +5、冬部分 -5）；
 * clamp 0-100；连续升/降 3 天改 trend（零变动日 streak 归零，视为中断）。
 */
export function updateNodeProsperity(input: ProsperityUpdateInput): ProsperityUpdateResult {
  const rng = input.rng ?? Math.random;
  const season = seasonForDay(input.day);
  const traded = new Set(input.tradedNodeIds ?? []);
  const activeEvents = (input.mapEvents ?? []).filter((e) => e.status === 'active');
  const nodeProsperity: Record<string, NodeProsperity> = {};
  const deltas: Record<string, number> = {};

  for (const n of MAP_NODES) {
    const cur = input.nodeProsperity[n.id] ?? { prosperity: DEFAULT_PROSPERITY, trend: 'stable' as const, streak: 0 };
    let delta = 0;
    // 玩家交易 +1~3
    if (traded.has(n.id)) {
      delta += randDelta(TRADE_PROSPERITY_MIN, TRADE_PROSPERITY_MAX, rng);
    }
    // 事件：商机 +2~5 / 威胁 -3~8（同节点多个事件叠加）
    for (const e of activeEvents) {
      if (e.nodeId !== n.id) continue;
      if (e.type === 'opportunity') {
        delta += randDelta(OPPORTUNITY_PROSPERITY_MIN, OPPORTUNITY_PROSPERITY_MAX, rng);
      } else {
        delta -= randDelta(THREAT_PROSPERITY_LOSS_MIN, THREAT_PROSPERITY_LOSS_MAX, rng);
      }
    }
    // 季节：秋季资源点 +5 / 冬季部分节点 -5
    if (season === 'autumn' && n.type === 'resource') delta += AUTUMN_RESOURCE_BONUS;
    if (season === 'winter' && WINTER_CHILL_NODES.includes(n.id)) delta -= WINTER_CHILL_PENALTY;

    const prosperity = Math.min(100, Math.max(0, cur.prosperity + delta));
    // 连续升降计数：delta>0 续升（负值翻正）、delta<0 续降、delta=0 中断归零
    let streak = cur.streak;
    if (delta > 0) streak = streak > 0 ? streak + 1 : 1;
    else if (delta < 0) streak = streak < 0 ? streak - 1 : -1;
    else streak = 0;
    const trend: ProsperityTrend =
      streak >= TREND_STREAK_THRESHOLD ? 'rising' : streak <= -TREND_STREAK_THRESHOLD ? 'declining' : 'stable';

    nodeProsperity[n.id] = { prosperity, trend, streak };
    if (delta !== 0) deltas[n.id] = delta;
  }
  return { nodeProsperity, deltas };
}

// ============================================================
// 状态小标签（2.1）
// ============================================================

/** 节点状态小标签（渲染在地图节点图标旁） */
export interface NodeStatusTag {
  label: string;
  /** 图符（跨平台文本 glyph） */
  icon: string;
  /** 色值（红火焰/绿箭头/红箭头/灰/橙警告） */
  color: string;
}

/**
 * 节点状态小标签（纯函数）：
 * 优先级——有活跃威胁 动荡（橙警告）> ≥80 火爆（红火焰）> rising 上升（绿箭头）
 * > declining 下滑（红箭头）> <30 冷清（灰）；否则 null。
 */
export function getNodeStatusTag(
  node: MapNode,
  prosperity: NodeProsperity | undefined,
  activeThreatNodeIds: ReadonlySet<string> = new Set()
): NodeStatusTag | null {
  if (activeThreatNodeIds.has(node.id)) {
    return { label: '动荡', icon: '⚠', color: '#D97706' };
  }
  const p = prosperity?.prosperity ?? node.prosperity ?? DEFAULT_PROSPERITY;
  const trend = prosperity?.trend ?? node.prosperityTrend ?? 'stable';
  if (p >= BOOM_THRESHOLD) return { label: '火爆', icon: '🔥', color: '#C0392B' };
  if (trend === 'rising') return { label: '上升', icon: '↑', color: '#2E8B57' };
  if (trend === 'declining') return { label: '下滑', icon: '↓', color: '#C0392B' };
  if (p < CHILL_THRESHOLD) return { label: '冷清', icon: '·', color: '#8B8B8B' };
  return null;
}
