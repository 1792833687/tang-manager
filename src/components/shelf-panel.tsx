/**
 * 货架面板（Step 2 2.6；Step 5b-1.5 重做为经营中枢；体验优化模块四紧凑化）
 * 布局：标题+筛选同行；容量条（40px 紧凑区）；商品密排行（行高 ≤48px：品名加粗/库存/
 * 陈损小彩点/小号快捷调价/补货/下架）；快捷区（市易务挂牌/采买/庖制染织炮制/食盒锦匣药囊）；
 * 加工队列；库房健康度+陈损预警+旁白。
 * 铁律：只调 store 纯函数 action；操作反馈用旁白叙事，不用系统弹窗。
 */
'use client';
import { useMemo, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { pushActionFeedback } from './action-feedback';
import { AncientCard } from './ancient-card';
import { getExpiryLabel, getSeason, getStorageFeeDetail, totalVolumeOf, warehouseHealth } from '@/systems/tang-expiry';
import { ProcurementPanel } from './procurement-panel';
import { MarketListingPanel } from './market-listing-panel';
import { MarketReportPanel } from './market-report-panel';
import { ModalContainer } from './modal-container';
import { ProcessingPanel } from './processing-panel';
import { AssemblePanel } from './assemble-panel';
import { ForwardContractPanel } from './forward-contract-panel';
import { TutorialHighlight } from './tutorial-highlight';

type FilterKey = '全部' | '食材' | '布匹' | '药材';
type SortKey = 'expiry' | 'stock';
type PanelKey = 'procurement' | 'market' | 'forward' | 'processing' | 'assemble' | 'report' | null;

const CATEGORY_ICON: Record<string, string> = { 食材: '🥩', 布匹: '🧵', 药材: '🌿' };
const FILTERS: readonly FilterKey[] = ['全部', '食材', '布匹', '药材'];
const TONE: Record<string, string> = { red: '#C0392B', orange: '#D97706', green: '#4A7C59', dim: '#8B6F47' };

/** 商品密排行（行高 ≤48px：品名/库存/陈损彩点/小号快捷调价/补货/下架） */
function GoodsRow({ itemId }: { itemId: string }): React.ReactElement {
  const item = useTangManagerStore((s) => s.shopItems.find((it) => it.id === itemId));
  const silver = useTangManagerStore((s) => s.silver);
  const updateShopItem = useTangManagerStore((s) => s.updateShopItem);
  const removeShopItem = useTangManagerStore((s) => s.removeShopItem);
  const updateSilver = useTangManagerStore((s) => s.updateSilver);
  const addLedgerEntry = useTangManagerStore((s) => s.addLedgerEntry);
  const [priceMode, setPriceMode] = useState(false);
  const [price, setPrice] = useState('');
  if (!item) return <></>;
  const label = getExpiryLabel(item.expiry);

  const handleRestock = (): void => {
    const cost = Math.round(item.cost * 5 * 100) / 100;
    if (silver < cost) return;
    updateShopItem(itemId, { stock: item.stock + 5 });
    // 走 updateSilver action（silver+gold 兼容同步），不直接 setState
    updateSilver(-cost);
    addLedgerEntry({ day: useTangManagerStore.getState().day, project: `补货${item.name}`, category: '支出', amount: -cost });
  };

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1" style={{ minHeight: 36, backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: ANCIENT.text }}>
        {CATEGORY_ICON[item.category] ?? '📦'} {item.name}
      </span>
      <span className="shrink-0 text-xs font-semibold" style={{ color: ANCIENT.gold }}>售 {formatMoney(item.price ?? 0)}</span>
      <span className="shrink-0 text-[10px]" style={{ color: ANCIENT.secondary }}>本 {formatMoney(item.cost ?? 0)}</span>
      <span className="shrink-0 text-xs" style={{ color: ANCIENT.secondary }}>库存 {item.stock}</span>
      <span title={label.text} className="shrink-0 rounded-full" style={{ width: 8, height: 8, backgroundColor: TONE[label.tone] ?? ANCIENT.secondary }} />
      {!priceMode ? (
        <button type="button" onClick={() => setPriceMode(true)} className="shrink-0 rounded px-1.5 py-0.5 text-[11px]" style={{ backgroundColor: ANCIENT.border, color: '#FFF' }}>调价</button>
      ) : (
        <span className="flex shrink-0 items-center gap-1">
          <input type="number" min={0.1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={String(item.price)} className="w-14 rounded px-1 py-0.5 text-[11px]" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }} />
          <button type="button" onClick={() => { const p = Number(price); if (p > 0) { updateShopItem(itemId, { price: p }); setPriceMode(false); } }} className="rounded px-1.5 py-0.5 text-[11px]" style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}>定</button>
        </span>
      )}
      <button type="button" onClick={handleRestock} className="shrink-0 rounded px-1.5 py-0.5 text-[11px]" style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}>补货</button>
      {/* 下架 = 变卖/出售等效动作（无独立变卖按钮）；操作完成给浮层反馈 */}
      <button type="button" onClick={() => { removeShopItem(itemId); pushActionFeedback('已下架', 'success'); }} className="shrink-0 rounded px-1.5 py-0.5 text-[11px]" style={{ backgroundColor: ANCIENT.accent, color: '#FFF' }}>下架</button>
    </div>
  );
}

export function ShelfPanel(): React.ReactElement {
  const shopItems = useTangManagerStore((s) => s.shopItems);
  const maxStorage = useTangManagerStore((s) => s.maxStorage);
  const freeStorageLimit = useTangManagerStore((s) => s.freeStorageLimit ?? 170);
  const day = useTangManagerStore((s) => s.day);
  const silver = useTangManagerStore((s) => s.silver);
  const processingQueue = useTangManagerStore((s) => s.processingQueue ?? []);
  const narratives = useTangManagerStore((s) => s.inventoryNarratives ?? []);
  const dismissNarratives = useTangManagerStore((s) => s.dismissInventoryNarratives);
  const warehouseLevel = useTangManagerStore((s) => s.warehouseLevel ?? 1);
  const warehouseExpansion = useTangManagerStore((s) => s.warehouseExpansion);
  const expandWarehouse = useTangManagerStore((s) => s.expandWarehouse);
  const listingCount = useTangManagerStore((s) => (s.marketListings ?? []).length);
  const [filter, setFilter] = useState<FilterKey>('全部');
  const [sort, setSort] = useState<SortKey>('expiry');
  const [panel, setPanel] = useState<PanelKey>(null);
  const [notice, setNotice] = useState('');

  const fee = useMemo(() => getStorageFeeDetail({ shopItems, freeStorageLimit, day }), [shopItems, freeStorageLimit, day]);
  const season = getSeason(day);
  const used = totalVolumeOf(shopItems);
  const health = warehouseHealth({ shopItems, maxStorage, freeStorageLimit });
  const visible = useMemo(() => {
    const list = shopItems.filter((it) => filter === '全部' || it.category === filter);
    return [...list].sort((a, b) => (sort === 'expiry' ? (a.expiry ?? -1) - (b.expiry ?? -1) : (a.stock ?? 0) - (b.stock ?? 0)));
  }, [shopItems, filter, sort]);
  const nearExpiryCount = shopItems.filter((it) => (it.expiry ?? -1) >= 0 && (it.expiry ?? -1) <= 1).length;

  const onExpand = (): void => {
    const r = expandWarehouse();
    setNotice(r && !r.ok ? (r.reason ?? '') : '库房动工扩建，数日后竣工。');
  };

  return (
    <AncientCard>
      {/* 标题 + 筛选同行 */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold tracking-[0.2em]" style={{ color: ANCIENT.text, fontFamily: 'var(--font-ancient-serif)' }}>货架 · 库房</h3>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className="rounded px-1.5 py-0.5" style={{ backgroundColor: filter === f ? ANCIENT.primary : ANCIENT.card, color: filter === f ? '#FFF' : ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>{f}</button>
          ))}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded px-1 py-0.5 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}>
            <option value="expiry">按陈损期</option>
            <option value="stock">按库存</option>
          </select>
        </div>
      </div>

      {/* 容量条（40px 紧凑区） */}
      <div className="mb-1 flex items-center justify-between text-xs" style={{ color: ANCIENT.secondary }}>
        <span>{season.icon} {season.season} · 库容 {used} / {maxStorage}（仓 {warehouseLevel} 级）</span>
        <span>仓储费 {formatMoney(fee.monthlyFee)}/月</span>
      </div>
      <div className="mb-2 h-2 w-full overflow-hidden rounded" style={{ backgroundColor: ANCIENT.background }}>
        <div className="h-full rounded" style={{ width: `${Math.min(100, (used / Math.max(1, maxStorage)) * 100)}%`, backgroundColor: used > maxStorage ? ANCIENT.accent : ANCIENT.primary }} />
      </div>
      {warehouseExpansion && (
        <div className="mb-1 text-xs" style={{ color: ANCIENT.accent }}>库房扩建中，约第 {warehouseExpansion.completionDay} 日竣工（现容量不增）</div>
      )}

      {/* 商品密排列表 */}
      <div className="flex flex-col gap-1">
        {visible.map((it) => <GoodsRow key={it.id} itemId={it.id} />)}
        {visible.length === 0 && <p className="py-4 text-center text-sm tracking-widest" style={{ color: ANCIENT.secondary }}>货架空空，待进货后陈列。</p>}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-6">
        <button type="button" onClick={() => setPanel('market')} className="rounded px-1.5 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.secondary }}>市易务挂牌（{listingCount}）</button>
        <button type="button" onClick={() => setPanel('report')} className="rounded px-1.5 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.secondary }}>市场调查</button>
        <button type="button" onClick={() => setPanel('procurement')} className="rounded px-1.5 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.secondary }}>采买补货</button>
        <TutorialHighlight guideId="FIRST_FORWARD_CONTRACT">
          <button type="button" onClick={() => setPanel('forward')} className="w-full rounded px-1.5 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.secondary }}>籴粜契</button>
        </TutorialHighlight>
        <TutorialHighlight guideId="FIRST_PROCESSING">
          <button type="button" onClick={() => setPanel('processing')} className="w-full rounded px-1.5 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.secondary }}>庖制染织炮制</button>
        </TutorialHighlight>
        <button type="button" onClick={() => setPanel('assemble')} className="rounded px-1.5 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.secondary }}>食盒锦匣药囊</button>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" onClick={onExpand} className="rounded px-2 py-0.5 text-xs" style={{ backgroundColor: ANCIENT.border, color: '#FFF' }}>扩建库房（费 {formatMoney(200 * warehouseLevel)}）</button>
        {notice && <span className="text-xs" style={{ color: ANCIENT.accent }}>{notice}</span>}
      </div>

      {processingQueue.some((j) => j.status === 'processing') && (
        <div className="mt-2 rounded px-2 py-1 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          <div style={{ color: ANCIENT.secondary }}>加工队列</div>
          {processingQueue.filter((j) => j.status === 'processing').map((j) => (
            <div key={j.id} className="flex justify-between" style={{ color: ANCIENT.text }}>
              <span>{j.outputName} ×{j.outputQuantity}</span>
              <span style={{ color: ANCIENT.accent }}>{Math.max(0, j.completionDay - day)} 日后完成</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs" style={{ color: ANCIENT.secondary }}>
        <span>库房健康度 {health}%</span>
        {nearExpiryCount > 0 ? <span style={{ color: ANCIENT.accent }}>⚠ 陈损预警（{nearExpiryCount} 种临期）</span> : <span>库房安稳</span>}
      </div>
      {narratives.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1 rounded px-2 py-1 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
          {narratives.map((n, i) => <div key={i} style={{ color: ANCIENT.text }}>「{n}」</div>)}
          <button type="button" onClick={dismissNarratives} className="self-end text-xs" style={{ color: ANCIENT.secondary }}>阅毕收起</button>
        </div>
      )}

      {panel === 'procurement' && <ProcurementPanel onClose={() => setPanel(null)} />}
      {panel === 'report' && (
        <ModalContainer title="市场调查报告" onClose={() => setPanel(null)} showConfirm={false}>
          <MarketReportPanel />
        </ModalContainer>
      )}
      {panel === 'market' && <MarketListingPanel onClose={() => setPanel(null)} />}
      {panel === 'forward' && <ForwardContractPanel onClose={() => setPanel(null)} />}
      {panel === 'processing' && <ProcessingPanel onClose={() => setPanel(null)} />}
      {panel === 'assemble' && <AssemblePanel onClose={() => setPanel(null)} />}
    </AncientCard>
  );
}
