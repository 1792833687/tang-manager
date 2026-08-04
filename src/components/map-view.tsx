/**
 * 长安舆图渲染（Step 5b-2 模块二 map-view；TANG-MIST-003 M3 增强）
 * 内联 SVG：viewBox 0 0 100 100 百分比坐标、层级切换（缩放+显隐）、拖拽平移（鼠标）、
 * 滚轮缩放（移动端双指 pinch 为基础实现，注释见 onPointerDown 双指分支）、
 * 点位图标（shop★/resource●/npc◆/government■/residence▲/market◯）、
 * 势力半透明色块（InfluenceZone.color + fill-opacity）、物流虚线（绿=绿通/黄=普通/红=高风险）、
 * 点击点位回调。
 * TANG-MIST-003 M3 增强：
 * - 2.1 节点繁荣度状态小标签（火爆/上升/下滑/冷清/动荡）渲染在点位图标旁
 * - 2.2 物流连线交互（hover 详情 / 点击回调）+ 在途镖队骡车动画（animateMotion）+ 热力图叠加
 * - 2.3 图层筛选（未探访节点始终灰色问号，不受筛选影响）
 * - 2.4 玩家自定义标记（金色「标」图钉，区别于节点图标）
 * - 2.7 事件/标记跳转聚焦（requestFocusNodeId → 自动平移到中心）
 * - 2.8 季节性地图变化（背景色层 / 秋资源丰收角标 / 冬山路❄️封闭）
 * 组件 ≤200 行拆子函数。
 */
'use client';
import { useEffect, useRef, useState } from 'react';
import type { InfluenceZone, MapEvent, MapLayer, MapNode, NodeProsperity, PlayerMarker, TradeRoute } from '@/types/tang-map';
import type { RegionFog } from '@/types/tang-manager';
import type { Caravan } from '@/types/tang-caravan';
import { ANCIENT } from '@/theme/tokens';
import { nextZoomWheel, zoomAtAnchor } from '@/systems/tang-map-viewport';
import { getNodeStatusTag, seasonForDay, type Season } from '@/systems/tang-node-prosperity';
import {
  routeLineTone,
  isRouteWinterClosed,
  nodeMatchesFilter,
  type MapNodeFilter,
  type RouteHeatTone,
  type RouteLineTone,
} from '@/systems/tang-map-routing';

/** 层级基准缩放（工程定：层越大内容越疏 → 微缩） */
const LAYER_BASE_SCALE: Record<MapLayer, number> = { yongle: 1, east_west_market: 0.92, changan: 0.85 };

/** NPC 常驻标记动画（好感变化闪烁：绿升/红降；TANG-MIST-002 模块四）+ 路线告警闪烁（M3 · 2.2） */
const MAP_KEYFRAMES = `
@keyframes npc-flash-up {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; filter: drop-shadow(0 0 2px #2E8B57); }
}
@keyframes npc-flash-down {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; filter: drop-shadow(0 0 2px #C0392B); }
}
@keyframes route-alert {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
}
`;

/** 季节背景色层（2.8：春偏绿 / 夏暖黄 / 秋金 / 冬偏白；自然月口径见 tang-node-prosperity） */
const SEASON_TINT: Record<Season, string> = {
  spring: '#DCE8D0',
  summer: '#F2E3C0',
  autumn: '#EFD9A8',
  winter: '#EEF2F6',
};

const SEASON_LABEL: Record<Season, string> = {
  spring: '· 春日 ·',
  summer: '· 夏日 ·',
  autumn: '· 秋日 ·',
  winter: '· 冬日 ·',
};

/** NPC 常驻地图标记（TANG-MIST-002：已登场=金色头像小图标；未登场但可解锁=灰色问号） */
export interface NpcMapMarker {
  nodeId: string;
  npcId: string;
  /** 首字（头像徽标用） */
  char: string;
  status: 'active' | 'available';
  /** 点击直接触发拜访 */
  onClick?: () => void;
  /** 好感变化闪烁（绿升/红降；CSS animation） */
  flash?: 'up' | 'down';
}

const NODE_TYPE_SHAPE: Record<MapNode['type'], { label: string; fill: string; stroke: string }> = {
  shop: { label: '★', fill: ANCIENT.gold, stroke: ANCIENT.border },
  resource: { label: '●', fill: ANCIENT.primary, stroke: ANCIENT.border },
  npc: { label: '◆', fill: ANCIENT.accent, stroke: ANCIENT.border },
  government: { label: '■', fill: ANCIENT.border, stroke: '#FFF' },
  residence: { label: '▲', fill: ANCIENT.secondary, stroke: ANCIENT.border },
  market: { label: '◯', fill: 'none', stroke: ANCIENT.primary },
};

/** 点位图标（文本 glyph 方案，跨平台稳定） */
function NodeGlyph({ node }: { node: MapNode }): React.ReactElement {
  const shape = NODE_TYPE_SHAPE[node.type];
  return (
    <text
      x={node.x}
      y={node.y + 2.2}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={node.type === 'market' ? 7 : 8}
      fill={shape.fill}
      stroke={shape.stroke}
      strokeWidth={node.type === 'market' ? 1 : 0.3}
      style={{ pointerEvents: 'none' }}
    >
      {shape.label}
    </text>
  );
}

/** 势力影响圈：覆盖点位包围盒 → 半透明圆角色块 */
function ZoneShape({ zone, nodes }: { zone: InfluenceZone; nodes: readonly MapNode[] }): React.ReactElement | null {
  const inZone = nodes.filter((n) => zone.nodes.includes(n.id));
  if (inZone.length === 0) return null;
  const xs = inZone.map((n) => n.x);
  const ys = inZone.map((n) => n.y);
  const minX = Math.min(...xs) - 6;
  const maxX = Math.max(...xs) + 6;
  const minY = Math.min(...ys) - 6;
  const maxY = Math.max(...ys) + 6;
  return (
    <rect
      x={Math.max(0, minX)}
      y={Math.max(0, minY)}
      width={Math.min(100, maxX) - Math.max(0, minX)}
      height={Math.min(100, maxY) - Math.max(0, minY)}
      rx={3}
      fill={zone.color}
      fillOpacity={0.12}
      stroke={zone.color}
      strokeOpacity={0.35}
      strokeDasharray="2 2"
    />
  );
}

/** 物流连线（TANG-MIST-003 M3 · 2.2：绿=绿通/黄=普通/红=高风险；hover 详情；点击回调；
 *  在途镖队骡车 animateMotion；热力图叠加；冬季❄️封闭） */
function RouteLine({
  route,
  nodes,
  green,
  tone,
  heatTone,
  winterClosed,
  day,
  caravans,
  showHeat,
  onSelect,
  onSelectCaravan,
}: {
  route: TradeRoute;
  nodes: readonly MapNode[];
  green: boolean;
  tone: RouteLineTone;
  heatTone?: RouteHeatTone;
  winterClosed: boolean;
  day: number;
  caravans: readonly Caravan[];
  showHeat: boolean;
  onSelect?: (routeId: string) => void;
  onSelectCaravan?: (caravanId: string) => void;
}): React.ReactElement | null {
  const a = nodes.find((n) => n.id === route.from);
  const b = nodes.find((n) => n.id === route.to);
  if (!a || !b) return null;
  const baseColor = winterClosed
    ? '#B8A98C'
    : tone === 'green'
      ? ANCIENT.primary
      : tone === 'high'
        ? ANCIENT.accent
        : ANCIENT.secondary;
  const heatColor = heatTone === 'busy' ? ANCIENT.accent : heatTone === 'cold' ? '#4A7C9E' : null;
  const stroke = showHeat && heatColor ? heatColor : baseColor;
  const strokeWidth = showHeat && heatTone === 'busy' ? 1.1 : winterClosed ? 0.35 : 0.6;
  const dash = winterClosed ? '1 2' : tone === 'green' ? '3 2' : '1.5 2';
  const freight = green ? Math.round(((route.distance * 0.5) / 2) * 100) / 100 : Math.round(route.distance * 0.5 * 100) / 100;
  const days = green ? Math.max(1, Math.ceil(route.baseTime / 2)) : route.baseTime;
  const risk = green ? Math.round((route.risk / 2) * 100) / 100 : route.risk;
  const onRoute = caravans.filter(
    (c) =>
      c.status === 'in_transit' &&
      ((c.route?.from === route.from && c.route?.to === route.to) ||
        (c.route?.from === route.to && c.route?.to === route.from))
  );
  const troubled = onRoute.some(
    (c) => c.eventLog.length > 0 && /劫|抢|盘查|风雨|延误/.test(c.eventLog[c.eventLog.length - 1] ?? '')
  );
  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(route.id);
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* 透明加宽命中线 */}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={3.5} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeOpacity={winterClosed ? 0.35 : 0.55} strokeWidth={strokeWidth} strokeDasharray={dash}>
        <title>{`${a.name} ↔ ${b.name}：距 ${route.distance} 里 · ${days} 日 · 运费 ${freight} 两 · 风险 ${Math.round(risk * 100)}%${green ? ' · 绿通' : ''}${winterClosed ? ' · 冬日封路❄️' : ''}${heatTone === 'busy' ? ' · 繁忙' : heatTone === 'cold' ? ' · 冷门' : ''}`}</title>
      </line>
      {/* 遭遇事件连线闪烁红色 */}
      {troubled && (
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ANCIENT.accent} strokeWidth={0.5} strokeDasharray="1.5 1" style={{ animation: 'route-alert 0.9s ease-in-out infinite' }} />
      )}
      {/* 冬季山路封闭 ❄️ */}
      {winterClosed && (
        <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2} textAnchor="middle" fontSize={2.8} fill="#5C6B7A" style={{ pointerEvents: 'none' }}>
          ❄
        </text>
      )}
      {/* 在途镖队骡车（animateMotion 沿连线移动；点击看镖队详情） */}
      {!winterClosed &&
        onRoute.map((c) => (
          <g key={c.id} onClick={(e) => { e.stopPropagation(); onSelectCaravan?.(c.id); }} style={{ cursor: 'pointer' }}>
            <g>
              <animateMotion
                dur={`${Math.max(3, Math.min(14, (c.arrivalDay - c.departureDay) * 1.2 + 3))}s`}
                repeatCount="indefinite"
                path={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
              />
              <circle r={1.3} fill={ANCIENT.secondary} stroke="#FFF" strokeWidth={0.2} />
              <text y={-1.8} textAnchor="middle" fontSize={2.2} fill={ANCIENT.text} style={{ pointerEvents: 'none' }}>
                骡
              </text>
            </g>
          </g>
        ))}
    </g>
  );
}

interface MapViewProps {
  layer: MapLayer;
  unlockedLayers: MapLayer[];
  nodes: readonly MapNode[];
  zones: readonly InfluenceZone[];
  routes: readonly TradeRoute[];
  greenRoutes: Set<string>;
  activeEvents: readonly MapEvent[];
  visitedNodes: string[];
  /** 迷雾状态（TANG-MIST-001；未探明点位渲染为灰色问号，仅显示区域轮廓） */
  fogRegions?: Record<string, RegionFog>;
  /** NPC 常驻标记（TANG-MIST-002：已登场=金色头像小图标；available=灰色问号；点击直接触发拜访） */
  npcMarkers?: readonly NpcMapMarker[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  /** 赌瘾剩余天数（>0 时西市赌坊图标 pulse 闪烁示警；内容深化 TANG-CONT-D 模块四） */
  gamblingAddictionDays?: number;
  // ---- TANG-MIST-003 M3：地图功能增强 ----
  /** 2.1 节点繁荣度运行时表（key=点位 id） */
  nodeProsperity?: Record<string, NodeProsperity>;
  /** 2.4 玩家自定义标记 */
  playerMarkers?: readonly PlayerMarker[];
  /** 2.2 在途镖队（骡车动画；点击看详情） */
  caravans?: readonly Caravan[];
  /** 2.3 图层筛选（未探访节点始终灰色问号，不受筛选影响） */
  nodeFilter?: MapNodeFilter;
  /** 2.7 事件/标记跳转聚焦请求（节点 id；自动平移到中心并回调消费） */
  requestFocusNodeId?: string | null;
  onFocusConsumed?: () => void;
  /** 2.8 当前经营日（季节/冬季封闭计算） */
  day?: number;
  /** 2.2 连线点击回调（路线操作面板） */
  onSelectRoute?: (routeId: string) => void;
  /** 2.2 镖队点击回调（镖队详情） */
  onSelectCaravan?: (caravanId: string) => void;
  /** 2.2 热力图开关 */
  heatmap?: boolean;
  /** 2.2 热力图使用计数（routeId → 次数） */
  heatRouteUsage?: Record<string, number>;
}

export function MapView({
  layer,
  unlockedLayers,
  nodes,
  zones,
  routes,
  greenRoutes,
  activeEvents,
  visitedNodes,
  fogRegions,
  npcMarkers,
  selectedNodeId,
  onSelectNode,
  gamblingAddictionDays = 0,
  nodeProsperity,
  playerMarkers,
  caravans = [],
  nodeFilter = 'all',
  requestFocusNodeId,
  onFocusConsumed,
  day = 1,
  onSelectRoute,
  onSelectCaravan,
  heatmap = false,
  heatRouteUsage,
}: MapViewProps): React.ReactElement {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number; active: boolean; pointers: Map<number, { x: number; y: number }> }>({
    x: 0,
    y: 0,
    active: false,
    pointers: new Map(),
  });
  const scale = LAYER_BASE_SCALE[layer] * zoom;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const season = seasonForDay(day);
  const layerNodes = nodes.filter((n) => n.layer === layer);
  const eventNodeIds = new Set(activeEvents.map((e) => e.nodeId));
  const activeThreatIds = new Set(activeEvents.filter((e) => e.type === 'threat').map((e) => e.nodeId));

  // 2.7 事件/标记跳转聚焦：请求节点 → 平移到视口中心（保持当前缩放）
  useEffect(() => {
    if (!requestFocusNodeId) return;
    const target = nodes.find((n) => n.id === requestFocusNodeId);
    if (target) {
      setPan({ x: 50 - target.x * scaleRef.current, y: 50 - target.y * scaleRef.current });
    }
    onFocusConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestFocusNodeId]);

  // v1.0 模块四：视口裁剪——仅渲染当前视口内点位（viewBox 0-100 百分比坐标）
  // 屏幕坐标 = pan + world*scale；可见范围 = 视口 0-100 反解 world ∈ [(-pan)/scale, (100-pan)/scale]
  // 向外扩 5 单位余量避免边缘闪烁；节点数 >20 时才启用裁剪（小地图全量渲染零开销）
  const worldMinX = (0 - pan.x) / scale - 5;
  const worldMaxX = (100 - pan.x) / scale + 5;
  const worldMinY = (0 - pan.y) / scale - 5;
  const worldMaxY = (100 - pan.y) / scale + 5;
  const cull = layerNodes.length > 20;
  const visibleNodes = cull
    ? layerNodes.filter(
        (n) => n.x >= worldMinX && n.x <= worldMaxX && n.y >= worldMinY && n.y <= worldMaxY
      )
    : layerNodes;

  // 2.3 图层筛选：未探访节点始终显示（灰色问号不受筛选影响）
  const isNodeVisible = (n?: MapNode): boolean => !n || !visitedNodes.includes(n.id) || nodeMatchesFilter(n, nodeFilter, eventNodeIds);
  const renderedNodes = visibleNodes.filter(isNodeVisible);
  // 对应连线同步显隐：两端点均可见才画
  const renderedRoutes = routes.filter((r) => {
    if (nodeFilter === 'all') return true;
    const a = nodes.find((n) => n.id === r.from);
    const b = nodes.find((n) => n.id === r.to);
    return isNodeVisible(a) && isNodeVisible(b);
  });

  /** 滚轮缩放以鼠标为锚点（P0 修复 TANG-POLISH-001 模块三）：缩放后调整 pan，使鼠标所指地图坐标不变。
   *  viewBox 0-100 百分比坐标；SVG 实际渲染宽高由容器决定，鼠标 client 坐标需按「视口内偏移」换算。
   *  换算用 getBoundingClientRect：mouse 相对 svg 左上角 ÷ rect 宽高 → 0-100 百分比坐标。
   */
  const svgRef = useRef<SVGSVGElement>(null);
  const onWheel = (e: React.WheelEvent): void => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    const next = nextZoomWheel(zoom, e.deltaY);
    if (!rect || rect.width === 0 || rect.height === 0) {
      // 容器不可测（罕见）：退化为中心缩放
      setZoom(next);
      return;
    }
    // 鼠标在视口内的 0-100 坐标
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    // 锚点缩放：保持鼠标所指世界坐标不变（纯函数 tang-map-viewport）
    const { panX, panY } = zoomAtAnchor(pan.x, pan.y, mx, my, next, zoom);
    setPan({ x: panX, y: panY });
    setZoom(next);
  };

  const onPointerDown = (e: React.PointerEvent): void => {
    drag.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (drag.current.pointers.size === 1) {
      drag.current.active = true;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
    }
    // 移动端双指 pinch：基础实现（跟踪两指距离，缩放用）
    if (drag.current.pointers.size === 2) {
      drag.current.active = false;
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent): void => {
    if (!drag.current.pointers.has(e.pointerId)) return;
    drag.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (drag.current.pointers.size === 2) {
      const [p1, p2] = [...drag.current.pointers.values()];
      if (p1 && p2) {
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const prev = drag.current.x;
        if (prev > 0) {
          const next = Math.min(2.5, Math.max(0.6, zoom * (dist / prev)));
          // 双指 pinch：以两指中点为锚点缩放（P0 修复，与滚轮锚点同公式，纯函数 tang-map-viewport）
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect && rect.width > 0 && rect.height > 0) {
            const cx = ((p1.x + p2.x) / 2 - rect.left) / rect.width * 100;
            const cy = ((p1.y + p2.y) / 2 - rect.top) / rect.height * 100;
            const { panX, panY } = zoomAtAnchor(pan.x, pan.y, cx, cy, next, zoom);
            setPan({ x: panX, y: panY });
          }
          setZoom(Math.round(next * 100) / 100);
        }
        drag.current.x = dist;
      }
      return;
    }
    if (!drag.current.active) return;
    setPan((p) => ({ x: p.x + (e.clientX - drag.current.x), y: p.y + (e.clientY - drag.current.y) }));
    drag.current.x = e.clientX;
    drag.current.y = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent): void => {
    drag.current.pointers.delete(e.pointerId);
    if (drag.current.pointers.size === 0) drag.current.active = false;
  };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
      role="img"
      aria-label={`长安舆图·${layer}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <style>{MAP_KEYFRAMES}</style>
      {/* 宣纸底 */}
      <rect x="0" y="0" width="100" height="100" fill={ANCIENT.background} />
      {/* 2.8 季节背景色层（半透明；春偏绿/夏暖黄/秋金/冬偏白） */}
      <rect x="0" y="0" width="100" height="100" fill={SEASON_TINT[season]} fillOpacity={0.22} style={{ pointerEvents: 'none' }} />
      {/* 势力色块（仅已解锁层） */}
      {unlockedLayers.includes(layer) && zones.map((z) => <ZoneShape key={z.id} zone={z} nodes={nodes} />)}
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
        {/* 物流虚线（M3：hover 详情 / 点击回调 / 骡车 / 热力图 / 冬季封闭） */}
        {renderedRoutes.map((r) => {
          const green = greenRoutes.has(r.id);
          const closed = isRouteWinterClosed(day, r.id);
          const usage = heatRouteUsage?.[r.id] ?? 0;
          const heatTone: RouteHeatTone | undefined = heatmap ? (usage <= 0 ? 'cold' : usage >= 2 ? 'busy' : 'normal') : undefined;
          return (
            <RouteLine
              key={r.id}
              route={r}
              nodes={nodes}
              green={green}
              tone={routeLineTone(r, green)}
              heatTone={heatTone}
              winterClosed={closed}
              day={day}
              caravans={caravans}
              showHeat={heatmap}
              onSelect={onSelectRoute}
              onSelectCaravan={onSelectCaravan}
            />
          );
        })}
        {/* 点位（v1.0 视口裁剪 + M3 图层筛选：仅渲染可见节点） */}
        {renderedNodes.map((n) => {
          const isSelected = selectedNodeId === n.id;
          const hasEvent = eventNodeIds.has(n.id);
          const visited = visitedNodes.includes(n.id);
          // TANG-MIST-001：区域迷雾——未探明点位渲染灰色问号（仍可点击查看坊间传言）
          const regionFog = fogRegions?.[n.id];
          const regionRevealed = regionFog ? regionFog.revealed : true;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(n.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* 事件标记（朱砂晕圈） */}
              {hasEvent && <circle r={5.5} fill={ANCIENT.accent} fillOpacity={0.18} />}
              {/* 赌瘾 debuff：西市赌坊图标 pulse 闪烁（内容深化 TANG-CONT-D 模块四） */}
              {gamblingAddictionDays > 0 && n.id === 'west_gambling_den' && (
                <circle r={6} fill="none" stroke={ANCIENT.accent} strokeWidth={0.8} style={{ animation: 'gambling-pulse 1.2s ease-in-out infinite' }} />
              )}
              {/* 选中光环 */}
              {isSelected && <circle r={5} fill="none" stroke={ANCIENT.gold} strokeWidth={0.8} />}
              {/* 未访问暗角 */}
              {!visited && <circle r={4.2} fill="#000" fillOpacity={0.08} />}
              {regionRevealed ? (
                <NodeGlyph node={n} />
              ) : (
                <text
                  x={n.x}
                  y={n.y + 2.2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={8}
                  fill={ANCIENT.secondary}
                  style={{ pointerEvents: 'none' }}
                >
                  ？
                </text>
              )}
              <text
                y={11}
                textAnchor="middle"
                fontSize={3.2}
                fill={regionRevealed ? ANCIENT.text : ANCIENT.secondary}
                style={{ pointerEvents: 'none', fontFamily: 'var(--font-ancient-serif)' }}
              >
                {n.name}
              </text>
              {/* TANG-MIST-003 M3 · 2.1：节点繁荣度状态小标签（火爆/上升/下滑/冷清/动荡） */}
              {regionRevealed &&
                (() => {
                  const tag = getNodeStatusTag(n, nodeProsperity?.[n.id], activeThreatIds);
                  return tag ? (
                    <text x={4.5} y={1.5} fontSize={2.8} fill={tag.color} style={{ pointerEvents: 'none', fontWeight: 700 }}>
                      {tag.icon}{tag.label}
                    </text>
                  ) : null;
                })()}
              {/* TANG-MIST-003 M3 · 2.4：玩家自定义标记（金色「标」图钉） */}
              {(playerMarkers ?? []).filter((m) => m.nodeId === n.id).map((m) => (
                <g key={m.id} transform="translate(3.4, -2.6)" style={{ pointerEvents: 'none' }}>
                  <circle r={1.7} fill={ANCIENT.gold} stroke={ANCIENT.border} strokeWidth={0.25} />
                  <text y={0.8} textAnchor="middle" fontSize={2.3} fill="#2C2C2C" style={{ pointerEvents: 'none', fontWeight: 700 }}>
                    标
                  </text>
                </g>
              ))}
              {/* TANG-MIST-003 M3 · 2.8：秋季资源点丰收角标（产出 +20% 为注释级设定，未接入结算） */}
              {season === 'autumn' && regionRevealed && n.type === 'resource' && (
                <g transform="translate(-4.6, -2.6)" style={{ pointerEvents: 'none' }}>
                  <circle r={1.7} fill={ANCIENT.gold} stroke={ANCIENT.border} strokeWidth={0.25} />
                  <text y={0.8} textAnchor="middle" fontSize={2.3} fill="#2C2C2C" style={{ pointerEvents: 'none', fontWeight: 700 }}>
                    丰
                  </text>
                </g>
              )}
              {/* TANG-MIST-002：NPC 常驻标记（已登场=金色头像小图标；available=灰色问号；点击直接拜访） */}
              {(npcMarkers ?? []).filter((m) => m.nodeId === n.id).map((m) => (
                <g
                  key={m.npcId}
                  transform={`translate(0, -9)`}
                  onClick={(e) => {
                    e.stopPropagation();
                    m.onClick?.();
                  }}
                  style={{ cursor: 'pointer', animation: m.flash === 'down' ? 'npc-flash-down 1.2s ease-in-out' : m.flash === 'up' ? 'npc-flash-up 1.2s ease-in-out' : undefined }}
                >
                  {m.status === 'active' ? (
                    <>
                      <rect x={-4} y={-4} width={8} height={8} rx={1.5} fill={ANCIENT.gold} stroke={ANCIENT.border} strokeWidth={0.3} />
                      <text y={0.9} textAnchor="middle" dominantBaseline="middle" fontSize={4.5} fill="#FFF" style={{ pointerEvents: 'none', fontWeight: 700 }}>
                        {m.char}
                      </text>
                    </>
                  ) : (
                    <>
                      <circle r={4} fill="#999" fillOpacity={0.35} stroke={ANCIENT.secondary} strokeWidth={0.3} />
                      <text y={0.9} textAnchor="middle" dominantBaseline="middle" fontSize={4.5} fill={ANCIENT.secondary} style={{ pointerEvents: 'none' }}>
                        ？
                      </text>
                    </>
                  )}
                </g>
              ))}
            </g>
          );
        })}
      </g>
      {/* 层级角标 + 季节角标（2.8） */}
      <text x={4} y={8} fontSize={5} fill={ANCIENT.secondary} style={{ fontFamily: 'var(--font-ancient-serif)' }}>
        {layer === 'yongle' ? '· 永乐坊 ·' : layer === 'east_west_market' ? '· 东市西市 ·' : '· 长安京畿 ·'}
      </text>
      <text x={96} y={8} textAnchor="end" fontSize={4.5} fill={ANCIENT.secondary} style={{ fontFamily: 'var(--font-ancient-serif)' }}>
        {SEASON_LABEL[season]}
      </text>
    </svg>
  );
}
