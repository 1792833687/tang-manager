/**
 * 长安舆图面板（Step 5b-2 模块六 map-panel）
 * 层级切换标签（未解锁灰显+解锁条件；移动端横滑）、SVG 地图（MapView）、
 * 信息栏（桌面右/移动端底部抽屉——选中点位卡 + 活跃事件按剩余时间排序）、
 * 跑商操作区（买点=选中点位、卖点=连通商路、品类、数量；绿通解锁）、
 * 模块八联动：平准署→市易务挂牌 / 城外桑园茶园药田→籴粜契 / 钱庄飞钱→跨店调拨提示；
 * 底部运输状态栏（transportingGoods）。组件 ≤200 行拆子组件。
 */
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import {
  MAP_NODES,
  INFLUENCE_ZONES,
  TRADE_ROUTES,
  MAP_LAYER_UNLOCK_RULES,
  MAP_NODE_MAP,
  TRADE_ROUTE_MAP,
} from '@/config/tang-map-data';
import { TANG_NPC_LOCATION_NODE } from '@/config/tang-npcs';
import { npcVisitCooldownOk, NPC_VISIT_ENERGY_COST } from '@/systems/tang-npc-system';
import { calculateTradeProfit, getEffectiveGreenChannels } from '@/systems/tang-trade';
import { routeUsageCounts, QUICK_TRAVEL_ENERGY_COST, nodeInteractionLabel, type MapNodeFilter } from '@/systems/tang-map-routing';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { AncientCard } from './ancient-card';
import { MapView, type NpcMapMarker } from './map-view';
import { MapNodeCard } from './map-node-card';
import { FogCard } from './fog-card';
import { pushActionFeedback } from './action-feedback';
import type { MapLayer, MapNode } from '@/types/tang-map';

const CATEGORIES = ['食材', '布匹', '药材'] as const;

/** 层级切换标签（未解锁灰显+条件；移动端 overflow-x-auto 横滑） */
function LayerTabs({
  layer,
  setLayer,
}: {
  layer: MapLayer;
  setLayer: (l: MapLayer) => void;
}): React.ReactElement {
  const unlockedLayers = useTangManagerStore((s) => s.unlockedLayers);
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 text-xs" style={{ scrollbarWidth: 'thin' }}>
      {MAP_LAYER_UNLOCK_RULES.map((rule) => {
        const active = rule.layer === layer;
        const unlocked = unlockedLayers.includes(rule.layer);
        return (
          <button
            key={rule.layer}
            type="button"
            disabled={!unlocked}
            onClick={() => setLayer(rule.layer)}
            className="shrink-0 rounded-full px-3 py-1 tracking-[0.2em]"
            style={{
              backgroundColor: active ? ANCIENT.primary : ANCIENT.card,
              color: unlocked ? (active ? '#FFF' : ANCIENT.secondary) : '#B8A98C',
              border: `1px solid ${active ? ANCIENT.primary : ANCIENT.border}`,
              opacity: unlocked ? 1 : 0.75,
              fontFamily: 'var(--font-ancient-serif)',
            }}
          >
            {rule.label}
            {!unlocked && <span className="ml-1">（{rule.hint}）</span>}
          </button>
        );
      })}
    </div>
  );
}

/** 活跃事件列表（按剩余时间升序，最紧迫在前） */
function ActiveEventsList({ day }: { day: number }): React.ReactElement {
  const mapEvents = useTangManagerStore((s) => s.mapEvents);
  const handleMapEvent = useTangManagerStore((s) => s.handleMapEvent);
  const [msg, setMsg] = useState('');
  const active = useMemo(
    () =>
      mapEvents
        .filter((e) => e.status === 'active')
        .sort((a, b) => a.expireDay - b.expireDay),
    [mapEvents]
  );
  if (active.length === 0) {
    return <p className="py-2 text-center text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>今日城中并无异动。</p>;
  }
  const onRespond = (id: string): void => {
    const r = handleMapEvent(id, 'respond');
    setMsg(r && !r.ok ? (r.reason ?? '处置失败') : '已处置，城中安好。');
  };
  return (
    <div className="flex flex-col gap-1.5">
      {active.map((e) => (
        <div key={e.id} className="rounded px-2.5 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${e.type === 'threat' ? ANCIENT.accent : ANCIENT.primary}` }}>
          <div className="flex items-center justify-between">
            <span style={{ color: e.type === 'threat' ? ANCIENT.accent : ANCIENT.primary, fontWeight: 700 }}>{e.title}</span>
            <span style={{ color: ANCIENT.secondary }}>余 {Math.max(0, e.expireDay - day)} 日</span>
          </div>
          <div style={{ color: ANCIENT.text }}>{e.description}</div>
          <button
            type="button"
            onClick={() => onRespond(e.id)}
            className="mt-1 rounded px-2 py-0.5 text-[11px]"
            style={{ backgroundColor: e.type === 'threat' ? ANCIENT.accent : ANCIENT.primary, color: '#FFF' }}
          >
            {e.type === 'threat' ? '处置' : '应对'}
          </button>
        </div>
      ))}
      {msg && <div className="text-[11px]" style={{ color: ANCIENT.accent }}>{msg}</div>}
    </div>
  );
}

/** 模块八：点位专属联动（平准署→市易务挂牌 / 城外田园→籴粜契 / 钱庄飞钱→调拨提示 / 西市赌坊→赌坊入口） */
function NodeSpecificInfo({ node }: { node: MapNode }): React.ReactElement | null {
  const day = useTangManagerStore((s) => s.day);
  const marketListings = useTangManagerStore((s) => s.marketListings ?? []);
  const forwardContracts = useTangManagerStore((s) => s.forwardContracts ?? []);
  const shopCount = useTangManagerStore((s) => s.shopCount ?? 1);

  if (node.id === 'west_gambling_den') {
    const addictionDays = useTangManagerStore((s) => s.gamblingAddictionDays ?? 0);
    const luckLeft = useTangManagerStore((s) => s.luckRemaining);
    return (
      <div className="mt-2 rounded px-3 py-2 text-xs" style={{ backgroundColor: '#F3EAF7', border: `1px solid ${ANCIENT.gold}` }}>
        <div style={{ color: ANCIENT.secondary }}>西市赌坊（谢七地盘）：</div>
        <div style={{ color: ANCIENT.text }}>
          {addictionDays > 0
            ? `你已染上赌瘾，还有 ${addictionDays} 日才能戒断；赌坊图标闪烁示警。`
            : `福星高照剩 ${luckLeft} 次；骰盅一响，黄金万两，可也别忘了家业。`}
        </div>
        <div className="mt-1" style={{ color: ANCIENT.secondary }}>点击下方按钮进入赌坊。</div>
      </div>
    );
  }
  if (node.id === 'pingzhun-shu') {
    const today = marketListings.filter((l) => l.day === day);
    return (
      <div className="mt-2 rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }}>
        <div style={{ color: ANCIENT.secondary }}>市易务今日挂牌（平准署）：</div>
        {today.length === 0 ? (
          <div style={{ color: ANCIENT.text }}>今日并无挂牌发卖。</div>
        ) : (
          today.map((l) => (
            <div key={l.id} style={{ color: ANCIENT.text }}>
              {l.itemName} {Math.round(l.discount * 10)} 折 · {formatMoney(l.listedPrice)}（限 {l.remainingToday}）
            </div>
          ))
        )}
        <div className="mt-1" style={{ color: ANCIENT.secondary }}>采买详单请至「货架 → 市易务挂牌」。</div>
      </div>
    );
  }
  if (['chengwai-sangyuan', 'chengwai-chayuan', 'chengwai-yaotian'].includes(node.id)) {
    const pending = forwardContracts.filter((c) => c.status === 'pending');
    return (
      <div className="mt-2 rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }}>
        <div style={{ color: ANCIENT.secondary }}>此处可与农户立籴粜契（远期预购）：</div>
        {pending.length === 0 ? (
          <div style={{ color: ANCIENT.text }}>暂无在途契约；请至「货架 → 采买补货」订立。</div>
        ) : (
          pending.map((c) => (
            <div key={c.id} style={{ color: ANCIENT.text }}>
              {c.itemName} ×{c.quantity} · 约第 {c.deliveryDay} 日到
            </div>
          ))
        )}
      </div>
    );
  }
  if (node.id === 'dongshi-shanghui') {
    return (
      <div className="mt-2 rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }}>
        <div style={{ color: ANCIENT.secondary }}>
          钱庄飞钱可跨店调拨（现银 1-3 日到账、飞钱秒到 3% 费）；{shopCount < 2 ? '尚无分店，无法调拨。' : '详见「钱庄」面板。'}
        </div>
      </div>
    );
  }
  return null;
}

/** 跑商操作区：买点=选中点位、卖点=连通商路；绿通解锁 */
function TradeZone({ node }: { node: MapNode }): React.ReactElement {
  const silver = useTangManagerStore((s) => s.silver);
  const day = useTangManagerStore((s) => s.day);
  const shenTinglanFavor = useTangManagerStore((s) => s.shenTinglanFavor);
  const xieQiFavor = useTangManagerStore((s) => s.xieQiFavor);
  const reputation = useTangManagerStore((s) => s.reputation);
  const greenChannels = useTangManagerStore((s) => s.greenChannels);
  const nodePriceModifiers = useTangManagerStore((s) => s.nodePriceModifiers);
  const shopItems = useTangManagerStore((s) => s.shopItems);
  const employees = useTangManagerStore((s) => s.employees);
  const mapEvents = useTangManagerStore((s) => s.mapEvents);
  const executeTradeRun = useTangManagerStore((s) => s.executeTradeRun);
  const unlockGreenChannel = useTangManagerStore((s) => s.unlockGreenChannel);
  const [sellId, setSellId] = useState('');
  const [category, setCategory] = useState<string>('食材');
  const [qty, setQty] = useState('10');
  const [msg, setMsg] = useState('');

  const tradeCtx = useMemo(
    () => ({
      day,
      silver,
      nodePriceModifiers,
      greenChannels,
      transportingGoods: [] as never[],
      employees,
      shenTinglanFavor,
      xieQiFavor,
      reputation,
      shopItems,
      mapEvents,
    }),
    [day, silver, nodePriceModifiers, greenChannels, employees, shenTinglanFavor, xieQiFavor, reputation, shopItems, mapEvents]
  );
  const greenRoutes = getEffectiveGreenChannels(tradeCtx);

  const sellTargets = useMemo(() => {
    const ids = TRADE_ROUTES.filter((r) => r.from === node.id).map((r) => r.to).concat(
      TRADE_ROUTES.filter((r) => r.to === node.id).map((r) => r.from)
    );
    return [...new Set(ids)].map((id) => MAP_NODE_MAP[id]).filter((n): n is MapNode => !!n);
  }, [node.id]);

  const preview = useMemo(() => {
    if (!sellId || sellId === node.id) return null;
    return calculateTradeProfit(node.id, sellId, category, Number(qty) || 1, tradeCtx);
  }, [node.id, sellId, category, qty, tradeCtx]);

  const onTrade = (): void => {
    const r = executeTradeRun(node.id, sellId, category, Number(qty) || 1);
    setMsg(r && r.ok ? `已发车：${r.transportDays} 日抵埠，预估利 ${formatMoney(r.profit ?? 0)}。` : (r?.reason ?? '跑商失败'));
  };
  const onGreen = (): void => {
    const route = TRADE_ROUTES.find((r) => (r.from === node.id && r.to === sellId) || (r.from === sellId && r.to === node.id));
    if (!route) {
      setMsg('请先选定卖点商路');
      return;
    }
    const r = unlockGreenChannel(route.id);
    setMsg(r && r.ok ? `「${MAP_NODE_MAP[route.to]?.name ?? ''}」一线已开绿色通道。` : (r?.reason ?? '开通失败'));
  };

  const route = sellId ? TRADE_ROUTES.find((r) => (r.from === node.id && r.to === sellId) || (r.from === sellId && r.to === node.id)) : undefined;

  return (
    <div className="mt-3 rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
      <div className="mb-1 flex flex-wrap items-center gap-2" style={{ color: ANCIENT.secondary }}>
        <span>跑商（买点·{MAP_NODE_MAP[node.id]?.name}）</span>
        <select value={sellId} onChange={(e) => setSellId(e.target.value)} className="rounded px-1 py-0.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}>
          <option value="">选卖点</option>
          {sellTargets.map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded px-1 py-0.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className="w-14 rounded px-1 py-0.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }} />
        <span>份</span>
      </div>
      {preview && (
        <div className="mb-1" style={{ color: ANCIENT.text }}>
          买 {formatMoney(preview.buyPrice)} / 卖 {formatMoney(preview.sellPrice)} · 运费 {formatMoney(preview.freight)} · {preview.transportDays} 日到 · 风险 {Math.round(preview.risk * 100)}%
          {route && greenRoutes.has(route.id) && <span style={{ color: ANCIENT.primary }}> · 绿色通道</span>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onTrade} className="rounded px-2 py-1" style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}>发车跑商</button>
        <button type="button" onClick={onGreen} className="rounded px-2 py-1" style={{ backgroundColor: ANCIENT.gold, color: '#2C2C2C' }}>开通绿通</button>
        {msg && <span style={{ color: ANCIENT.accent }}>{msg}</span>}
      </div>
    </div>
  );
}

/** 底部运输状态栏 */
function TransportBar(): React.ReactElement {
  const transportingGoods = useTangManagerStore((s) => s.transportingGoods ?? []);
  const day = useTangManagerStore((s) => s.day);
  if (transportingGoods.length === 0) {
    return <div className="text-xs" style={{ color: ANCIENT.secondary }}>商路无货在途。</div>;
  }
  return (
    <div className="flex flex-col gap-1 text-xs">
      {transportingGoods.map((g) => (
        <div key={g.id} className="flex justify-between" style={{ color: ANCIENT.text }}>
          <span>{g.itemCategory} ×{g.quantity}（购 {formatMoney(g.buyPrice)}）</span>
          <span style={{ color: g.status === 'in_transit' ? ANCIENT.accent : ANCIENT.primary }}>
            {g.status === 'in_transit' ? `约第 ${g.arrivalDay} 日抵 ${MAP_NODE_MAP[g.sellNodeId]?.name ?? ''}` : g.status === 'arrived' ? '已抵埠' : '途中被劫'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// TANG-MIST-003 M3：地图功能增强（图层筛选 / 路线操作 / 标记 / 快速移动 / 事件速览）
// ============================================================

/** 图层筛选按钮组（2.3：全部/商业/资源/官府/人物/事件；未探访节点不受筛选影响） */
const FILTER_OPTIONS: Array<{ key: MapNodeFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'business', label: '商业' },
  { key: 'resource', label: '资源' },
  { key: 'government', label: '官府' },
  { key: 'npc', label: '人物' },
  { key: 'event', label: '事件' },
];

function NodeFilterBar({ value, onChange }: { value: MapNodeFilter; onChange: (v: MapNodeFilter) => void }): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1.5 pb-1">
      {FILTER_OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className="rounded-full px-2.5 py-0.5 text-[11px] tracking-widest"
          style={{
            backgroundColor: value === o.key ? ANCIENT.primary : ANCIENT.background,
            color: value === o.key ? '#FFF' : ANCIENT.secondary,
            border: `1px solid ${value === o.key ? ANCIENT.primary : ANCIENT.border}`,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 商路操作面板（2.2：点击连线弹出；组建镖队走此路线 → 预填镖队面板） */
function RouteActionPanel({
  routeId,
  green,
  onAssemble,
  onClose,
}: {
  routeId: string;
  green: boolean;
  onAssemble: (from: string, to: string, routeIdHint?: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const route = TRADE_ROUTE_MAP[routeId];
  if (!route) return <></>;
  const from = MAP_NODE_MAP[route.from];
  const to = MAP_NODE_MAP[route.to];
  const freight = green ? Math.round(((route.distance * 0.5) / 2) * 100) / 100 : Math.round(route.distance * 0.5 * 100) / 100;
  const days = green ? Math.max(1, Math.ceil(route.baseTime / 2)) : route.baseTime;
  const risk = green ? Math.round((route.risk / 2) * 100) / 100 : route.risk;
  return (
    <div className="rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }}>
      <div className="flex items-center justify-between" style={{ color: ANCIENT.text }}>
        <span className="font-bold tracking-widest">商路 · {from?.name ?? route.from} → {to?.name ?? route.to}</span>
        <button type="button" onClick={onClose} style={{ color: ANCIENT.secondary }}>✕</button>
      </div>
      <div className="mt-1" style={{ color: ANCIENT.secondary }}>
        距 {route.distance} 里 · {days} 日 · 运费 {formatMoney(freight)} · 风险 {Math.round(risk * 100)}%
        {green && <span style={{ color: ANCIENT.primary }}> · 绿通</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onAssemble(route.from, route.to, route.id)}
          className="rounded px-2.5 py-1 text-[11px] tracking-wider"
          style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}
        >
          组建镖队走此路线
        </button>
      </div>
    </div>
  );
}

/** 自定义标记管理（2.4：已探访节点「放置标记」/ 撤旗；最多 5 个） */
function MarkerManager({ node }: { node: MapNode }): React.ReactElement {
  const visitedNodes = useTangManagerStore((s) => s.visitedNodes);
  const playerMarkers = useTangManagerStore((s) => s.playerMarkers ?? []);
  const placeMarker = useTangManagerStore((s) => s.placeMarker);
  const removeMarker = useTangManagerStore((s) => s.removeMarker);
  const [label, setLabel] = useState('');
  const [open, setOpen] = useState(false);
  const existing = playerMarkers.find((m) => m.nodeId === node.id);
  const canPlace = visitedNodes.includes(node.id) && playerMarkers.length < 5 && !existing;
  if (existing) {
    return (
      <div className="mt-2 flex items-center justify-between rounded px-2.5 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }}>
        <span style={{ color: ANCIENT.text }}>📍 标记「{existing.label}」（第 {existing.placedDay} 日立）</span>
        <button type="button" onClick={() => removeMarker(existing.id)} className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: ANCIENT.accent, color: '#FFF' }}>撤旗</button>
      </div>
    );
  }
  if (!canPlace) return <></>;
  return (
    <div className="mt-2 flex flex-col gap-1 rounded px-2.5 py-1.5 text-[11px]" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded px-2 py-0.5 tracking-wider"
          style={{ backgroundColor: ANCIENT.gold, color: '#2C2C2C' }}
        >
          {open ? '收起' : '放置标记'}
        </button>
        <span style={{ color: ANCIENT.secondary }}>（{playerMarkers.length}/5）</span>
      </div>
      {open && (
        <>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`默认：${node.name}`}
            maxLength={12}
            className="w-full rounded px-2 py-0.5"
            style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}
          />
          <button
            type="button"
            onClick={() => {
              const r = placeMarker(node.id, label);
              pushActionFeedback(r.ok ? `已立标记「${label.trim() || node.name}」` : (r.reason ?? '立标失败'), r.ok ? 'success' : 'warning');
              setOpen(false);
              setLabel('');
            }}
            className="rounded px-2 py-0.5"
            style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}
          >
            立标
          </button>
        </>
      )}
    </div>
  );
}

/** 快速移动（2.5：消耗 10 精力瞬间到达已探访节点；路径未探访节点 20% 自动揭示） */
function QuickTravelButton({ node }: { node: MapNode }): React.ReactElement {
  const energy = useTangManagerStore((s) => s.energy);
  const visitedNodes = useTangManagerStore((s) => s.visitedNodes);
  const quickTravelTo = useTangManagerStore((s) => s.quickTravelTo);
  if (!visitedNodes.includes(node.id)) return <></>;
  const disabled = energy < QUICK_TRAVEL_ENERGY_COST;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const r = quickTravelTo(node.id);
        if (!r) return;
        if (!r.ok) {
          pushActionFeedback(r.reason ?? '出行失败', 'warning');
          return;
        }
        pushActionFeedback(
          `已瞬抵${node.name}（${nodeInteractionLabel(node)}）${r.revealedNodeIds && r.revealedNodeIds.length > 0 ? `；沿途探明 ${r.revealedNodeIds.length} 处` : ''}`,
          'success'
        );
      }}
      className="mt-2 w-full rounded px-3 py-1.5 text-xs font-bold tracking-widest disabled:opacity-40"
      style={{ backgroundColor: ANCIENT.secondary, color: '#FFF' }}
    >
      前往（{QUICK_TRAVEL_ENERGY_COST} 精力）{disabled ? ' · 精力不足' : ''}
    </button>
  );
}

/** 地图事件速览徽章（2.7：右上角数字=活跃事件数；点击弹出按剩余时间排序的小列表；点击跳转节点） */
function EventBadge({ day, onJump }: { day: number; onJump: (nodeId: string) => void }): React.ReactElement {
  const mapEvents = useTangManagerStore((s) => s.mapEvents);
  const [open, setOpen] = useState(false);
  const active = useMemo(
    () => mapEvents.filter((e) => e.status === 'active').sort((a, b) => a.expireDay - b.expireDay),
    [mapEvents]
  );
  if (active.length === 0) return <></>;
  return (
    <div className="absolute right-1 top-1 z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full px-2.5 py-1 text-[11px] font-bold"
        style={{ backgroundColor: ANCIENT.accent, color: '#FFF', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
      >
        事 {active.length}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-60 rounded-md px-2 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <div className="mb-1 text-[10px] tracking-widest" style={{ color: ANCIENT.secondary }}>城中异动（按紧迫排序）</div>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {active.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  onJump(e.nodeId);
                  setOpen(false);
                }}
                className="rounded px-1.5 py-1 text-left text-[11px]"
                style={{ backgroundColor: ANCIENT.background, border: `1px solid ${e.type === 'threat' ? ANCIENT.accent : ANCIENT.primary}`, color: ANCIENT.text }}
              >
                <span style={{ color: e.type === 'threat' ? ANCIENT.accent : ANCIENT.primary, fontWeight: 700 }}>
                  {e.type === 'threat' ? '⚠' : '◆'} {e.title}
                </span>
                <span className="ml-1" style={{ color: ANCIENT.secondary }}>（余 {Math.max(0, e.expireDay - day)} 日）</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MapPanel(): React.ReactElement {
  const day = useTangManagerStore((s) => s.day);
  const unlockedLayers = useTangManagerStore((s) => s.unlockedLayers);
  const visitedNodes = useTangManagerStore((s) => s.visitedNodes);
  const mapEvents = useTangManagerStore((s) => s.mapEvents);
  const nodePriceModifiers = useTangManagerStore((s) => s.nodePriceModifiers);
  const greenChannels = useTangManagerStore((s) => s.greenChannels);
  const shopItems = useTangManagerStore((s) => s.shopItems);
  const employees = useTangManagerStore((s) => s.employees);
  const shenTinglanFavor = useTangManagerStore((s) => s.shenTinglanFavor);
  const xieQiFavor = useTangManagerStore((s) => s.xieQiFavor);
  const reputation = useTangManagerStore((s) => s.reputation);
  const silver = useTangManagerStore((s) => s.silver);
  const visitNode = useTangManagerStore((s) => s.visitNode);
  const openGamblingPanel = useTangManagerStore((s) => s.openGamblingPanel);
  const gamblingAddictionDays = useTangManagerStore((s) => s.gamblingAddictionDays ?? 0);
  const fogOfWar = useTangManagerStore((s) => s.fogOfWar);
  // TANG-MIST-002：长安故人 NPC 常驻标记（已登场=金色头像；available=灰色问号；点击直接拜访）
  const gameNPCs = useTangManagerStore((s) => s.gameNPCs);
  const npcVisitCooldowns = useTangManagerStore((s) => s.npcVisitCooldowns ?? {});
  const afternoonActions = useTangManagerStore((s) => s.afternoonActions);
  const dailyActionsRemaining = useTangManagerStore((s) => s.dailyActionsRemaining);
  const energy = useTangManagerStore((s) => s.energy);
  const visitNpc = useTangManagerStore((s) => s.visitNpc);
  const mapLocateNodeId = useTangManagerStore((s) => s.mapLocateNodeId ?? null);
  const setMapLocateNode = useTangManagerStore((s) => s.setMapLocateNode);
  const [layer, setLayer] = useState<MapLayer>('yongle');
  const [selectedId, setSelectedId] = useState<string | null>(mapLocateNodeId ?? 'luji-laodian');
  // ---- TANG-MIST-003 M3：地图功能增强（图层筛选 / 路线操作 / 热力图 / 路线规划 / 事件跳转）----
  const nodeProsperity = useTangManagerStore((s) => s.nodeProsperity ?? {});
  const playerMarkers = useTangManagerStore((s) => s.playerMarkers ?? []);
  const caravans = useTangManagerStore((s) => s.caravans ?? []);
  const transportingGoods = useTangManagerStore((s) => s.transportingGoods ?? []);
  const mapRoutePlan = useTangManagerStore((s) => s.mapRoutePlan);
  const setRoutePlan = useTangManagerStore((s) => s.setRoutePlan);
  const clearRoutePlan = useTangManagerStore((s) => s.clearRoutePlan);
  const prefillCaravanRoute = useTangManagerStore((s) => s.prefillCaravanRoute);
  const mapMarkerNotices = useTangManagerStore((s) => s.mapMarkerNotices ?? []);
  const consumeMapMarkerNotices = useTangManagerStore((s) => s.consumeMapMarkerNotices);
  const [nodeFilter, setNodeFilter] = useState<MapNodeFilter>('all');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [planModeSelect, setPlanModeSelect] = useState<'shortest' | 'safest'>('shortest');
  const [planFrom, setPlanFrom] = useState<string | null>(null);
  const heatUsage = useMemo(() => routeUsageCounts(transportingGoods, caravans), [transportingGoods, caravans]);

  // 2.4 标记节点新动态提示（每日清晨 store 写入；本面板挂载展示并清空）
  useEffect(() => {
    if (mapMarkerNotices.length > 0) {
      for (const n of mapMarkerNotices) pushActionFeedback(n, 'warning');
      consumeMapMarkerNotices();
    }
  }, [mapMarkerNotices, consumeMapMarkerNotices]);

  // 2.7 事件跳转：切到事件所在层 + 选中 + 聚焦平移
  const onJumpEvent = (nodeId: string): void => {
    const node = MAP_NODE_MAP[nodeId];
    if (node) {
      setLayer(node.layer);
      setSelectedId(nodeId);
      visitNode(nodeId);
      setFocusNodeId(nodeId);
    }
  };

  // 地图定位请求（NPC 详情「在地图上查看」→ 本面板挂载时自动聚焦该节点并清空）
  useEffect(() => {
    if (mapLocateNodeId) {
      setSelectedId(mapLocateNodeId);
      visitNode(mapLocateNodeId);
      setMapLocateNode(null);
    }
  }, [mapLocateNodeId, setMapLocateNode, visitNode]);

  // NPC 好感变化闪烁（绿升/红降；CSS animation；对比上次渲染 favor）
  const prevFavorRef = useRef<Record<string, number>>({});
  const [favorFlash, setFavorFlash] = useState<Record<string, 'up' | 'down'>>({});
  useEffect(() => {
    const flashes: Record<string, 'up' | 'down'> = {};
    for (const id of Object.keys(gameNPCs)) {
      const prev = prevFavorRef.current[id];
      const cur = gameNPCs[id]?.favor ?? 0;
      if (prev !== undefined && cur > prev) flashes[id] = 'up';
      else if (prev !== undefined && cur < prev) flashes[id] = 'down';
    }
    if (Object.keys(flashes).length > 0) {
      setFavorFlash(flashes);
      const t = window.setTimeout(() => setFavorFlash({}), 1200);
      return () => window.clearTimeout(t);
    }
    prevFavorRef.current = Object.fromEntries(Object.entries(gameNPCs).map(([k, v]) => [k, v.favor]));
    return undefined;
  }, [gameNPCs]);

  // 常驻标记：active → 金色头像；available → 灰色问号；locked/无节点 → 不渲染
  const npcMarkers: NpcMapMarker[] = useMemo(() => {
    const out: NpcMapMarker[] = [];
    for (const npc of Object.values(gameNPCs)) {
      const nodeId = TANG_NPC_LOCATION_NODE[npc.id];
      if (!nodeId) continue;
      if (npc.status === 'active') {
        const canVisit = npcVisitCooldownOk(day, npcVisitCooldowns[npc.id]) && !afternoonActions.includes('visit_npc') && dailyActionsRemaining > 0 && energy >= NPC_VISIT_ENERGY_COST;
        out.push({
          nodeId,
          npcId: npc.id,
          char: npc.name.charAt(0),
          status: 'active',
          flash: favorFlash[npc.id],
          onClick: () => {
            if (!canVisit) {
              pushActionFeedback(`${npc.name} 三日内已拜访或今日行动已尽`, 'warning');
              return;
            }
            const res = visitNpc(npc.id);
            pushActionFeedback(res ? `已拜访 ${npc.name}` : '今日已拜访过故人，或行动次数/精力不足', res ? 'success' : 'warning');
          },
        });
      } else if (npc.status === 'available') {
        out.push({ nodeId, npcId: npc.id, char: npc.name.charAt(0), status: 'available' });
      }
    }
    return out;
  }, [gameNPCs, day, npcVisitCooldowns, afternoonActions, dailyActionsRemaining, energy, favorFlash, visitNpc]);

  const greenRoutes = getEffectiveGreenChannels({
    day,
    silver,
    nodePriceModifiers,
    greenChannels,
    transportingGoods: [],
    employees,
    shenTinglanFavor,
    xieQiFavor,
    reputation,
    shopItems,
    mapEvents,
  });
  const activeEvents = mapEvents.filter((e) => e.status === 'active');
  const selectedNode = selectedId ? MAP_NODE_MAP[selectedId] : undefined;

  const onSelectNode = (id: string): void => {
    // 2.6 路线规划模式：依次点起点、终点 → 自动计算最优路线
    if (planMode) {
      if (!planFrom) {
        setPlanFrom(id);
        pushActionFeedback(`已选起点：${MAP_NODE_MAP[id]?.name ?? id}，再点终点`, 'success');
        return;
      }
      if (planFrom === id) {
        pushActionFeedback('起止不可同在一处，请重选起点', 'warning');
        return;
      }
      const r = setRoutePlan(planFrom, id, planModeSelect);
      if (r.ok && r.plan) {
        pushActionFeedback(`路线已规划：${r.plan.totalDays} 日 · 运费 ${formatMoney(r.plan.totalFreight)}`, 'success');
      } else {
        pushActionFeedback(r.reason ?? '规划失败', 'warning');
      }
      setPlanFrom(null);
      setPlanMode(false);
      return;
    }
    setSelectedId(id);
    visitNode(id);
  };

  // 2.2 连线点击 → 路线操作面板；镖队点击 → 详情浮层
  const onSelectRoute = (routeId: string): void => {
    setSelectedRouteId(routeId);
  };
  const onSelectCaravan = (caravanId: string): void => {
    const c = caravans.find((x) => x.id === caravanId);
    if (!c) return;
    const statusText = c.status === 'in_transit' ? `在途（余 ${Math.max(0, c.arrivalDay - day)} 日抵 ${MAP_NODE_MAP[c.route?.to ?? '']?.name ?? ''}）` : c.status;
    pushActionFeedback(`${c.name} · ${statusText}`, 'warning');
  };

  // 内容深化 TANG-CONT-D 模块四：西市赌坊节点操作 → 打开赌坊弹窗（其余节点占位）
  const onNodeAction = (node: MapNode): void => {
    if (node.id === 'west_gambling_den') {
      openGamblingPanel();
    }
  };

  return (
    <AncientCard title="长安舆图">
      <LayerTabs layer={layer} setLayer={setLayer} />
      {/* TANG-MIST-003 M3 · 2.3 图层筛选 + 2.6 路线规划入口 */}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <NodeFilterBar value={nodeFilter} onChange={setNodeFilter} />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPlanMode((v) => !v);
              setPlanFrom(null);
            }}
            className="rounded-full px-2.5 py-0.5 text-[11px] tracking-widest"
            style={{
              backgroundColor: planMode ? ANCIENT.accent : ANCIENT.background,
              color: planMode ? '#FFF' : ANCIENT.secondary,
              border: `1px solid ${planMode ? ANCIENT.accent : ANCIENT.border}`,
            }}
          >
            {planMode ? '退出规划' : '规划路线'}
          </button>
          {planMode && (
            <>
              <select
                value={planModeSelect}
                onChange={(e) => setPlanModeSelect(e.target.value as 'shortest' | 'safest')}
                className="rounded px-1.5 py-0.5 text-[11px]"
                style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}
              >
                <option value="shortest">最短·天数少</option>
                <option value="safest">最安全·风险低</option>
              </select>
              <span className="text-[11px]" style={{ color: ANCIENT.accent }}>
                {planFrom ? `起点：${MAP_NODE_MAP[planFrom]?.name}，请点终点` : '请点起点'}
              </span>
            </>
          )}
        </div>
      </div>
      {/* 2.6 路线规划结果卡 */}
      {mapRoutePlan && (
        <div className="mt-2 rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }}>
          <div className="flex items-center justify-between">
            <span style={{ color: ANCIENT.text, fontWeight: 700 }}>
              {MAP_NODE_MAP[mapRoutePlan.from]?.name} → {MAP_NODE_MAP[mapRoutePlan.to]?.name}（{mapRoutePlan.mode === 'shortest' ? '最短' : '最安全'}）
            </span>
            <button type="button" onClick={() => { clearRoutePlan(); setPlanMode(false); }} style={{ color: ANCIENT.secondary }}>✕</button>
          </div>
          <div style={{ color: ANCIENT.secondary }}>
            总距 {mapRoutePlan.totalDistance} 里 · 预计 {mapRoutePlan.totalDays} 日 · 运费 {formatMoney(mapRoutePlan.totalFreight)} · 总风险 {Math.round(mapRoutePlan.totalRisk * 100)}%
          </div>
          <div className="mt-1 truncate" style={{ color: ANCIENT.text }}>{mapRoutePlan.nodeIds.map((id) => MAP_NODE_MAP[id]?.name ?? id).join(' → ')}</div>
          <button
            type="button"
            onClick={() => prefillCaravanRoute(mapRoutePlan.from, mapRoutePlan.to, mapRoutePlan.routeIds[0])}
            className="mt-2 rounded px-2.5 py-1 text-[11px] tracking-wider"
            style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}
          >
            组建镖队走此路线
          </button>
        </div>
      )}
      <div className="mt-2 grid gap-3 lg:grid-cols-[1fr_260px]">
        {/* SVG 舆图（右上角：热力图开关 + 事件速览徽章） */}
        <div className="relative h-[320px] overflow-hidden rounded-lg sm:h-[380px]" style={{ border: `1px solid ${ANCIENT.border}` }}>
          <div className="absolute right-1 top-1 z-10 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setHeatmap((v) => !v)}
              className="rounded-full px-2 py-1 text-[10px] tracking-widest"
              style={{ backgroundColor: heatmap ? ANCIENT.gold : 'rgba(0,0,0,0.55)', color: heatmap ? '#2C2C2C' : '#FFF', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
            >
              热力图
            </button>
            <EventBadge day={day} onJump={onJumpEvent} />
          </div>
          <MapView
            layer={layer}
            unlockedLayers={unlockedLayers}
            nodes={MAP_NODES}
            zones={INFLUENCE_ZONES}
            routes={TRADE_ROUTES}
            greenRoutes={greenRoutes}
            activeEvents={activeEvents}
            visitedNodes={visitedNodes}
            fogRegions={fogOfWar.regions}
            npcMarkers={npcMarkers}
            selectedNodeId={selectedId}
            onSelectNode={onSelectNode}
            gamblingAddictionDays={gamblingAddictionDays}
            nodeProsperity={nodeProsperity}
            playerMarkers={playerMarkers}
            caravans={caravans}
            nodeFilter={nodeFilter}
            requestFocusNodeId={focusNodeId}
            onFocusConsumed={() => setFocusNodeId(null)}
            day={day}
            onSelectRoute={onSelectRoute}
            onSelectCaravan={onSelectCaravan}
            heatmap={heatmap}
            heatRouteUsage={heatUsage}
          />
        </div>
        {/* 2.2 商路操作面板（点击连线弹出；组建镖队走此路线） */}
        {selectedRouteId && (
          <RouteActionPanel
            routeId={selectedRouteId}
            green={greenRoutes.has(selectedRouteId)}
            onAssemble={(from, to, routeIdHint) => {
              prefillCaravanRoute(from, to, routeIdHint);
              setSelectedRouteId(null);
            }}
            onClose={() => setSelectedRouteId(null)}
          />
        )}
        {/* 信息栏：选中点位 + 活跃事件（移动端自动沉底，桌面在右） */}
        <div className="flex flex-col gap-2">
          {selectedNode ? (
            (() => {
              // TANG-MIST-001：区域迷雾——未探明点位只显示问号 + 坊间传言 + 揭示条件
              const regionFog = fogOfWar.regions[selectedNode.id];
              if (regionFog && !regionFog.revealed) {
                return (
                  <>
                    <FogCard
                      revealed={false}
                      condition={regionFog.revealCondition}
                      hint={regionFog.hint}
                      onClick={() => visitNode(selectedNode.id)}
                    />
                    <div className="rounded px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
                      <div className="mb-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>城中动向</div>
                      <ActiveEventsList day={day} />
                    </div>
                    <div className="rounded px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
                      <div className="mb-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>运输在途</div>
                      <TransportBar />
                    </div>
                  </>
                );
              }
              return (
                <>
                  <MapNodeCard node={selectedNode} day={day} activeEvents={activeEvents} onAction={onNodeAction} />
                  {/* TANG-MIST-003 M3 · 2.5 快速移动 + 2.4 自定义标记（已探访节点） */}
                  <QuickTravelButton node={selectedNode} />
                  <MarkerManager node={selectedNode} />
                  <NodeSpecificInfo node={selectedNode} />
                  <TradeZone node={selectedNode} />
                  <div className="rounded px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
                    <div className="mb-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>城中动向</div>
                    <ActiveEventsList day={day} />
                  </div>
                  <div className="rounded px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
                    <div className="mb-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>运输在途</div>
                    <TransportBar />
                  </div>
                </>
              );
            })()
          ) : (
            <p className="py-4 text-center text-xs" style={{ color: ANCIENT.secondary }}>点击舆图点位以查看详情</p>
          )}
        </div>
      </div>
    </AncientCard>
  );
}
