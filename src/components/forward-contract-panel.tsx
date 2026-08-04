/**
 * 籴粜契面板（v1.0 打磨 TANG-POLISH-001；forward-contract-panel）
 * 「籴粜契：唐代向农户预付定金、约定日后收购的远期契约。籴（dí）买入、粜（tiào）卖出。」
 * 订立远期预购：选商品 → 数量 → 到货日（day+5~10）→ 预购价=市价×0.7、预付三成定金；
 * 下方展示在途契约（pending：到货日/数量/定金）。
 * 原地图文案「城外田园→籴粜契」入口指向「货架 → 采买补货」，本轮补全为独立二级操作（modal-container 接入）。
 * 全部 ANCIENT 令牌；不持有游戏状态。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { triggerTutorial } from '@/systems/tang-tutorial-triggers';
import { ModalContainer } from './modal-container';

export function ForwardContractPanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const shopItems = useTangManagerStore((s) => s.shopItems);
  const forwardContracts = useTangManagerStore((s) => s.forwardContracts ?? []);
  const day = useTangManagerStore((s) => s.day);
  const createForwardContract = useTangManagerStore((s) => s.createForwardContract);
  const [itemId, setItemId] = useState(shopItems[0]?.id ?? '');
  const [qty, setQty] = useState(10);
  const [deliveryDay, setDeliveryDay] = useState(day + 7);
  const [msg, setMsg] = useState('');

  const item = shopItems.find((it) => it.id === itemId);
  const unitPrice = item ? Math.round(item.price * 0.7 * 100) / 100 : 0;
  const totalPrice = Math.round(unitPrice * qty * 100) / 100;
  const deposit = Math.round(totalPrice * 0.3 * 100) / 100;

  const onCreate = (): void => {
    if (!item || qty <= 0) return;
    const r = createForwardContract(item.id, qty, deliveryDay);
    // 新手引导（TANG-TUT-002）：首次籴粜契 → FIRST_FORWARD_CONTRACT
    if (r && r.ok) triggerTutorial('FIRST_FORWARD_CONTRACT');
    setMsg(r && r.ok ? `已与农户立契：${r.contract?.itemName} ${r.contract?.quantity} 份，约第 ${r.contract?.deliveryDay} 日送到。` : (r?.reason ?? '立契失败'));
  };

  const pending = forwardContracts.filter((c) => c.status === 'pending');

  return (
    <ModalContainer title="籴粜契 · 远期预购" onClose={onClose} confirmLabel="订立契约" onConfirm={onCreate}>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-xs" style={{ color: ANCIENT.secondary }}>
          预付三成定金，预购价 = 市价×0.7；到期自动入库，不可取消退定金。契约须在五日后、十日内送到。
        </p>
        <div className="flex items-center gap-2">
          <span className="shrink-0" style={{ color: ANCIENT.secondary }}>商品：</span>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="flex-1 rounded px-2 py-1 text-sm"
            style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}
          >
            {shopItems.map((it) => (
              <option key={it.id} value={it.id}>{it.name}（{formatMoney(it.price)}/份 · 库存 {it.stock}）</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0" style={{ color: ANCIENT.secondary }}>数量：</span>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 0))}
            className="w-24 rounded px-2 py-1 text-sm"
            style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}
          />
          <span className="ml-auto shrink-0" style={{ color: ANCIENT.secondary }}>到货日：</span>
          <select
            value={deliveryDay}
            onChange={(e) => setDeliveryDay(Number(e.target.value))}
            className="rounded px-2 py-1 text-sm"
            style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}
          >
            {Array.from({ length: 6 }, (_, i) => day + 5 + i).map((d) => (
              <option key={d} value={d}>第 {d} 日</option>
            ))}
          </select>
        </div>
        {item && (
          <div className="rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
            <div className="flex justify-between" style={{ color: ANCIENT.secondary }}>
              <span>预购价 {formatMoney(unitPrice)}/份（市价×0.7）</span>
              <span>总价 {formatMoney(totalPrice)}</span>
            </div>
            <div className="mt-1 flex justify-between" style={{ color: ANCIENT.text }}>
              <span>预付定金 {formatMoney(deposit)}</span>
              <span style={{ color: ANCIENT.primary }}>第 {deliveryDay} 日送到</span>
            </div>
          </div>
        )}
        {msg && (
          <div className="rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.text }}>
            {msg}
          </div>
        )}

        {/* 在途契约 */}
        <div className="border-t pt-2" style={{ borderColor: ANCIENT.border }}>
          <div className="mb-1 text-xs font-bold tracking-widest" style={{ color: ANCIENT.secondary }}>在途契约</div>
          {pending.length === 0 ? (
            <p className="text-xs" style={{ color: ANCIENT.border }}>暂无在途契约。</p>
          ) : (
            <div className="flex flex-col gap-1">
              {pending.map((c) => (
                <div key={c.id} className="flex justify-between rounded px-2 py-1 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
                  <span style={{ color: ANCIENT.text }}>{c.itemName} ×{c.quantity}</span>
                  <span style={{ color: ANCIENT.secondary }}>定金 {formatMoney(c.deposit)} · 第 {c.deliveryDay} 日到</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalContainer>
  );
}
