/**
 * 市易务挂牌面板（Step 5b-1.5 模块五 market-listing-panel）
 * 今日挂牌列表（官府平准特价发卖）：原价/特价/折扣/限购/剩余；
 * 「今日余两个时辰」倒计时（当日有效）；一键采买（purchaseListing，含次品风险）。
 * 市易务：唐代管理市场物价的官署；挂牌：市易务按市场供需公布的特价发卖。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { pushActionFeedback } from './action-feedback';
import { ModalContainer } from './modal-container';

export function MarketListingPanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const listings = useTangManagerStore((s) => s.marketListings ?? []);
  const day = useTangManagerStore((s) => s.day);
  const purchaseListing = useTangManagerStore((s) => s.purchaseListing);
  const [msg, setMsg] = useState('');

  const onBuy = (listingId: string, maxQty: number): void => {
    const r = purchaseListing(listingId, Math.min(10, maxQty));
    if (!r) return;
    setMsg(
      r.ok
        ? `采买入库：得 ${r.actualGoodQuantity} 份，实付 ${formatMoney(r.cost ?? 0)}${(r.loss ?? 0) > 0 ? `（次品 ${r.loss} 份）` : ''}。`
        : (r.reason ?? '采买失败')
    );
    if (r.ok) pushActionFeedback('已采买', 'success');
  };

  const todayList = listings.filter((l) => l.day === day);

  return (
    <ModalContainer title="市易务挂牌" onClose={onClose} showConfirm={false}>
      <div className="mb-2 text-xs" style={{ color: ANCIENT.secondary }}>
        今日余两个时辰（挂牌仅当日有效）。市易务：唐代管理市场物价的官署。
      </div>
      {todayList.length === 0 ? (
        <p className="py-6 text-center text-sm tracking-widest" style={{ color: ANCIENT.secondary }}>今日市易务无挂牌发卖。</p>
      ) : (
        <div className="flex flex-col gap-2">
          {todayList.map((l) => (
            <div key={l.id} className="rounded px-3 py-2 text-sm" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
              <div className="flex items-center justify-between">
                <span style={{ color: ANCIENT.text }}>{l.itemName}</span>
                <span style={{ color: ANCIENT.accent }}>{Math.round(l.discount * 10)} 折</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs" style={{ color: ANCIENT.secondary }}>
                <span>原价 {formatMoney(l.originalPrice)} → 特价 {formatMoney(l.listedPrice)}</span>
                <span>限购 {l.maxQuantity} · 剩 {l.remainingToday}</span>
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => onBuy(l.id, l.remainingToday)}
                  disabled={l.remainingToday <= 0}
                  className="rounded px-3 py-1 text-xs font-bold tracking-widest disabled:opacity-40"
                  style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}
                >
                  采买 10 份
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <div className="mt-2 rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.text }}>{msg}</div>}
    </ModalContainer>
  );
}
