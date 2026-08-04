/**
 * 镖队面板（Step 5b-5 模块四；caravan-panel）
 * 「镖队：唐代商旅多结队而行，雇武师押运，以防盗匪。可自行组建镖队，设定路线，往来运货。」
 * 概览（名称/领队/护卫/累计价值）+ 路线可视化（简图+箭头+位置标记）+
 * 货物清单 + 倒计时 + 操作（组建/路线/装载/召回）+ 事件日志（最近 3 次）。
 * v1.0 面板统一化：由 overlay（portal）迁移为主内容区切面渲染
 * （tang-manager/page.tsx 12 面板映射，NavItemKey 'caravan'），不再依赖 store 开关。
 * 全部 ANCIENT 令牌 + 古风风格；不持有游戏状态。
 */
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { AncientCard } from './ancient-card';
import { TRADE_ROUTES } from '@/config/tang-map-data';
import { MAP_NODE_MAP } from '@/config/tang-map-data';
import type { Caravan, CaravanGoods } from '@/types/tang-caravan';
import { formatMoney } from '@/lib/format-money';

const STATUS_LABEL: Record<Caravan['status'], string> = {
  idle: '待命',
  loading: '装货中',
  in_transit: '在途',
  unloading: '卸货中',
};

function nodeName(id: string): string {
  return MAP_NODE_MAP[id]?.name ?? id;
}

/** 路线选择（from/to 均来自商路） */
function RouteSelect({ value, onChange }: { value: string; onChange: (v: string) => void }): React.ReactElement {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded px-2 py-1 text-xs"
      style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
    >
      <option value="">选择商路…</option>
      {TRADE_ROUTES.map((r) => (
        <option key={r.id} value={r.id}>
          {nodeName(r.from)} → {nodeName(r.to)}（{r.baseTime} 日 · 风险 {Math.round(r.risk * 100)}%）
        </option>
      ))}
    </select>
  );
}

/** 单支镖队卡片 */
function CaravanCard({ caravan }: { caravan: Caravan }): React.ReactElement {
  const loadCaravan = useTangManagerStore((s) => s.loadCaravan);
  const setupCaravanRoute = useTangManagerStore((s) => s.setupCaravanRoute);
  const [routeId, setRouteId] = useState('');
  const [goodsText, setGoodsText] = useState('');

  const selectedRoute = TRADE_ROUTES.find((r) => r.id === routeId);
  const canSetup = caravan.status === 'idle' || caravan.status === 'loading';
  const canLoad = canSetup && caravan.route !== null;
  const daysLeft = caravan.status === 'in_transit' ? Math.max(0, caravan.arrivalDay - useTangManagerStore.getState().day) : 0;

  return (
    <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-bold tracking-widest" style={{ color: ANCIENT.text }}>{caravan.name}</span>
        <span className="rounded px-1.5 text-[10px] text-white" style={{ backgroundColor: caravan.status === 'in_transit' ? ANCIENT.accent : ANCIENT.primary }}>
          {STATUS_LABEL[caravan.status]}
        </span>
        <span className="ml-auto text-[10px]" style={{ color: ANCIENT.secondary }}>
          领队 {caravan.leader} · 护卫 {caravan.guards} · 累计 {formatMoney(caravan.totalValue)} · {caravan.totalTrips} 趟
        </span>
      </div>

      {/* 路线可视化：简图 + 箭头 + 位置标记 */}
      {caravan.route ? (
        <div className="mt-2 flex items-center gap-2 rounded px-2 py-1.5 text-[11px]" style={{ backgroundColor: ANCIENT.background }}>
          <span style={{ color: ANCIENT.primary }}>{nodeName(caravan.route.from)}</span>
          <span style={{ color: ANCIENT.secondary }}>
            {caravan.returning ? '← 返程' : '→ 押运'} {daysLeft > 0 ? `（余 ${daysLeft} 日）` : '（已抵）'}
          </span>
          <span style={{ color: ANCIENT.accent }}>{nodeName(caravan.route.to)}</span>
          {caravan.members.length > 0 && (
            <span className="ml-auto text-[9px]" style={{ color: ANCIENT.secondary }}>随行 {caravan.members.join('、')}</span>
          )}
        </div>
      ) : (
        <div className="mt-2 text-[11px]" style={{ color: ANCIENT.secondary }}>尚未设定路线。</div>
      )}

      {/* 货物清单 */}
      {caravan.currentGoods.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {caravan.currentGoods.map((g) => (
            <span key={g.itemName} className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}>
              {g.itemName} ×{g.quantity}
            </span>
          ))}
        </div>
      )}

      {/* 操作：路线 / 装载 */}
      {(canSetup || canLoad) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="min-w-[180px] flex-1">
            <RouteSelect value={routeId} onChange={setRouteId} />
          </div>
          <button
            type="button"
            disabled={!selectedRoute || !canSetup}
            onClick={() => {
              if (selectedRoute) setupCaravanRoute(caravan.id, selectedRoute.from, selectedRoute.to);
            }}
            className="rounded px-2.5 py-1 text-[10px] tracking-wider disabled:opacity-40"
            style={{ backgroundColor: ANCIENT.secondary, color: '#FFFFFF' }}
          >
            定路线
          </button>
          <input
            value={goodsText}
            onChange={(e) => setGoodsText(e.target.value)}
            placeholder="货名×数量，如 羊肉×5"
            className="w-36 rounded px-2 py-1 text-[10px]"
            style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
          />
          <button
            type="button"
            disabled={!canLoad || !goodsText.trim()}
            onClick={() => {
              const parsed = parseGoodsText(goodsText, useTangManagerStore.getState().shopItems);
              if (parsed.length > 0) loadCaravan(caravan.id, parsed);
            }}
            className="rounded px-2.5 py-1 text-[10px] tracking-wider disabled:opacity-40"
            style={{ backgroundColor: ANCIENT.primary, color: '#FFFFFF' }}
          >
            装货发车
          </button>
        </div>
      )}

      {/* 事件日志（最近 3 次） */}
      {caravan.eventLog.length > 0 && (
        <div className="mt-2 border-t pt-1.5" style={{ borderColor: ANCIENT.border }}>
          <div className="text-[9px] tracking-widest" style={{ color: ANCIENT.secondary }}>行路日志</div>
          {caravan.eventLog.map((line, i) => (
            <div key={i} className="text-[10px] leading-snug" style={{ color: ANCIENT.secondary }}>· {line}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 解析「货名×数量」文本（按库房商品成本价记；找不到的商品跳过） */
function parseGoodsText(text: string, shopItems: CaravanPanelShopItem[]): CaravanGoods[] {
  const goods: CaravanGoods[] = [];
  for (const part of text.split(/[,，;；]/)) {
    const m = part.trim().match(/^(.+?)[x×X*](\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const itemName = m[1]!.trim();
    const quantity = Number(m[2]);
    const item = shopItems.find((it) => it.name === itemName);
    if (!item || quantity <= 0) continue;
    goods.push({ itemName, quantity, unitCost: item.cost ?? item.price });
  }
  return goods;
}

/** 库房商品最小结构（解析用） */
interface CaravanPanelShopItem {
  name: string;
  cost?: number;
  price: number;
}

export function CaravanPanel(): React.ReactElement {
  const caravans = useTangManagerStore((s) => s.caravans ?? []);
  const setupCaravan = useTangManagerStore((s) => s.setupCaravan);
  const [newName, setNewName] = useState('');
  const [newLeader, setNewLeader] = useState('');
  const [newGuards, setNewGuards] = useState(1);
  const [newRouteId, setNewRouteId] = useState('');

  // TANG-MIST-003 M3 · 2.6：路线规划「组建镖队走此路线」→ 预填新镖队商路（消费后清空）
  const mapCaravanPrefill = useTangManagerStore((s) => s.mapCaravanPrefill);
  const consumeMapCaravanPrefill = useTangManagerStore((s) => s.consumeMapCaravanPrefill);
  useEffect(() => {
    if (mapCaravanPrefill) {
      if (mapCaravanPrefill.routeId) setNewRouteId(mapCaravanPrefill.routeId);
      consumeMapCaravanPrefill();
    }
  }, [mapCaravanPrefill, consumeMapCaravanPrefill]);

  const selectedRoute = TRADE_ROUTES.find((r) => r.id === newRouteId);
  const shopItems = useTangManagerStore((s) => s.shopItems);
  // 货物名称补全（简化：显示库房货名提示）
  const goodNames = useMemo(() => shopItems.map((it) => it.name).join('、'), [shopItems]);

  return (
    <AncientCard title="镖队 · 商旅往来" accent={ANCIENT.gold}>
      {/* 组建镖队 */}
      <div className="mb-3 rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="镖队名（如 陆记镖队）"
            className="w-32 rounded px-2 py-1 text-xs"
            style={{ backgroundColor: ANCIENT.card, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
          />
          <input
            value={newLeader}
            onChange={(e) => setNewLeader(e.target.value)}
            placeholder="领队名"
            className="w-28 rounded px-2 py-1 text-xs"
            style={{ backgroundColor: ANCIENT.card, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
          />
          <select
            value={newGuards}
            onChange={(e) => setNewGuards(Number(e.target.value))}
            className="rounded px-2 py-1 text-xs"
            style={{ backgroundColor: ANCIENT.card, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}
          >
            <option value={0}>无护卫</option>
            <option value={1}>护卫 1</option>
            <option value={2}>护卫 2</option>
            <option value={3}>护卫 3</option>
          </select>
          <div className="min-w-[200px] flex-1">
            <RouteSelect value={newRouteId} onChange={setNewRouteId} />
          </div>
          <button
            type="button"
            disabled={!newName.trim() || !newLeader.trim() || !selectedRoute}
            onClick={() => {
              if (!selectedRoute) return;
              setupCaravan({
                name: newName.trim(),
                leader: newLeader.trim(),
                members: [],
                guards: newGuards,
                from: selectedRoute.from,
                to: selectedRoute.to,
              });
              setNewName('');
              setNewLeader('');
              setNewRouteId('');
            }}
            className="rounded px-3 py-1 text-xs tracking-[0.3em] disabled:opacity-40"
            style={{ backgroundColor: ANCIENT.primary, color: '#FFFFFF' }}
          >
            组建镖队
          </button>
        </div>
        {goodNames && <p className="mt-1 text-[10px] tracking-wider" style={{ color: ANCIENT.secondary }}>库房现有货：{goodNames}</p>}
      </div>

      {caravans.length === 0 ? (
        <p className="py-8 text-center text-sm tracking-[0.4em]" style={{ color: ANCIENT.border }}>
          尚无镖队。组建一支，往来运货。
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {caravans.map((c) => (
            <CaravanCard key={c.id} caravan={c} />
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] tracking-widest" style={{ color: ANCIENT.secondary }}>
        唐代商旅多结队而行，雇武师押运，以防盗匪。护卫可退劫匪、减风险。
      </p>
    </AncientCard>
  );
}
