/**
 * 采买补货面板（Step 5b-1.5 模块五 procurement-panel）
 * 选商品/数量/实时批量折扣+总价+占用容量；「采买入库」确认。
 * 批量折扣阶梯：1-9 原价 / 10-29 九折 / 30-49 八折 / 50+ 七折（tang-procurement）。
 * 满仓/现银不足 → store 返回 reason，面板内旁白展示（不阻塞流程）。
 */
'use client';
import { useMemo, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { pushActionFeedback } from './action-feedback';
import { calculateBulkPrice, bulkDiscountFor } from '@/systems/tang-procurement';
import { totalVolumeOf } from '@/systems/tang-expiry';
import { ModalContainer } from './modal-container';

export function ProcurementPanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const shopItems = useTangManagerStore((s) => s.shopItems);
  const silver = useTangManagerStore((s) => s.silver);
  const maxStorage = useTangManagerStore((s) => s.maxStorage);
  const addShopItem = useTangManagerStore((s) => s.addShopItem);
  const updateSilver = useTangManagerStore((s) => s.updateSilver);
  const addLedgerEntry = useTangManagerStore((s) => s.addLedgerEntry);
  // 内容深化 TANG-CONT-D 模块八：赊账进货
  const credit = useTangManagerStore((s) => s.credit);
  const tradeCredit = useTangManagerStore((s) => s.tradeCredit ?? 0);
  const creditDueDay = useTangManagerStore((s) => s.creditDueDay ?? 0);
  const day = useTangManagerStore((s) => s.day);
  const takeTradeCreditPurchase = useTangManagerStore((s) => s.takeTradeCreditPurchase);
  const shenSchemeUntil = useTangManagerStore((s) => s.shenSchemeUntil ?? 0);
  const shenSchemeCategory = useTangManagerStore((s) => s.shenSchemeCategory);
  const [itemId, setItemId] = useState(shopItems[0]?.id ?? '');
  const [qty, setQty] = useState(10);
  const [msg, setMsg] = useState('');

  const item = shopItems.find((it) => it.id === itemId);
  const quote = useMemo(() => (item ? calculateBulkPrice(item.price, qty) : null), [item, qty]);
  const incomingVolume = item ? qty * (item.volume ?? 1) : 0;
  const usedVolume = totalVolumeOf(shopItems);
  // 赊账门槛（信用≥300、上限=信用×2、总额>信用×3 无法再赊）
  const creditOk = credit >= 300 && tradeCredit < credit * 3;
  const creditLimit = Math.max(0, Math.min(credit * 2, credit * 3 - tradeCredit));

  const onBuy = (): void => {
    if (!item || !quote) return;
    if (usedVolume + incomingVolume > maxStorage) {
      setMsg('库房堆得插不进脚，再多也放不下了！');
      return;
    }
    if (quote.totalCost > silver) {
      setMsg(`现银不足，需 ${formatMoney(quote.totalCost)}（现有 ${formatMoney(silver)}）。`);
      return;
    }
    addShopItem({ ...item, id: `buy-${item.id}-${Date.now()}`, stock: qty });
    updateSilver(-quote.totalCost);
    addLedgerEntry({ day: useTangManagerStore.getState().day, project: `采买${item.name}`, category: '支出', amount: -quote.totalCost });
    setMsg(`采买入库，货架渐丰：${item.name} ×${qty}，实付 ${formatMoney(quote.totalCost)}（${Math.round(quote.discount * 10)} 折）。`);
    pushActionFeedback('已采买', 'success');
  };

  // 内容深化 TANG-CONT-D 模块八：赊账进货（30 天无息；逾期月息 5% 可叠加）
  const onCredit = (): void => {
    if (!item || !quote) return;
    if (usedVolume + incomingVolume > maxStorage) {
      setMsg('库房堆得插不进脚，再多也放不下了！');
      return;
    }
    if (!creditOk) {
      setMsg(credit < 300 ? '信用不足 300，无法赊账进货。' : '赊账总额已达上限（信用×3），无法再赊。');
      return;
    }
    if (quote.totalCost > creditLimit) {
      setMsg(`单笔赊账上限 ${formatMoney(creditLimit)} 两（信用×2 约束）。`);
      return;
    }
    const r = takeTradeCreditPurchase(quote.totalCost);
    if (!r || !r.ok) {
      setMsg(r?.reason ?? '赊账失败');
      return;
    }
    addShopItem({ ...item, id: `credit-${item.id}-${Date.now()}`, stock: qty });
    addLedgerEntry({ day: useTangManagerStore.getState().day, project: `赊购${item.name}`, category: '支出', amount: 0 });
    setMsg(`赊账进货：${item.name} ×${qty}，赊 ${formatMoney(quote.totalCost)} 两，${formatMoney(Math.max(0, r.creditDueDay ?? 0) - day)} 日后须还（30 天无息）。`);
    pushActionFeedback('已赊账进货', 'success');
  };

  return (
    <ModalContainer title="采买补货" onClose={onClose} confirmLabel="采买入库" onConfirm={onBuy}>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span style={{ color: ANCIENT.secondary }}>商品：</span>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="flex-1 rounded px-2 py-1 text-sm" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}>
            {shopItems.map((it) => (
              <option key={it.id} value={it.id}>{it.name}（{formatMoney(it.price)}/份 · 库存 {it.stock}）</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: ANCIENT.secondary }}>数量：</span>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 0))} className="w-24 rounded px-2 py-1 text-sm" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }} />
        </div>
        {quote && (
          <div className="rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
            <div style={{ color: ANCIENT.secondary }}>
              批量折扣：{qty} 份 → {Math.round(quote.discount * 10)} 折（单价 {formatMoney(quote.unitPrice)}）
            </div>
            <div className="mt-1 flex justify-between" style={{ color: ANCIENT.text }}>
              <span>总价 {formatMoney(quote.totalCost)}</span>
              <span style={{ color: ANCIENT.primary }}>占用容量 {incomingVolume}（现用 {usedVolume} / {maxStorage}）</span>
            </div>
            {/* 内容深化 TANG-CONT-D 模块八：赊账可用额度 + 沈听澜使绊提示 */}
            <div className="mt-1" style={{ color: creditOk ? ANCIENT.primary : ANCIENT.accent }}>
              {creditOk
                ? `赊账可用：${formatMoney(creditLimit)}（信用 ${credit}，已赊 ${formatMoney(tradeCredit)}）`
                : `赊账不可用（${credit < 300 ? '信用不足 300' : '总额已达信用×3'}）`}
              {tradeCredit > 0 && creditDueDay > 0 && (
                <span style={{ color: ANCIENT.secondary }}> · {formatMoney(Math.max(0, creditDueDay - day))} 日后到期</span>
              )}
            </div>
            {shenSchemeUntil >= day && shenSchemeCategory && (
              <div className="mt-1" style={{ color: ANCIENT.accent }}>
                ⚠ 东市有人作梗：{shenSchemeCategory}进货价 +15%（余 {Math.max(0, shenSchemeUntil - day)} 日）。
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBuy} disabled={!item || qty <= 0} className="rounded px-4 py-1.5 text-sm font-bold tracking-widest disabled:opacity-40" style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}>
            采买入库
          </button>
          {/* 内容深化 TANG-CONT-D 模块八：赊账进货 */}
          <button type="button" onClick={onCredit} disabled={!item || qty <= 0 || !creditOk} className="rounded px-4 py-1.5 text-sm font-bold tracking-widest disabled:opacity-40" style={{ backgroundColor: ANCIENT.gold, color: '#2C2C2C' }}>
            赊账进货
          </button>
          <span className="text-xs" style={{ color: ANCIENT.secondary }}>现银 {formatMoney(silver)}</span>
        </div>
        {msg && <div className="rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.text }}>{msg}</div>}
      </div>
    </ModalContainer>
  );
}
