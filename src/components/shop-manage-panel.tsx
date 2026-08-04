/**
 * 店铺管理面板（2026-08-05 体验优化：整合同类型功能）
 * 家业（主店/分店/购店/变卖）+ 经营策略 + 店铺配置·资产 + 产业·经营之道。
 * 由 me 面板迁出，聚合为独立面板（NavItemKey 'shop'，侧栏点击进入）。
 * 全部 ANCIENT 令牌。
 */
'use client';
import { useState } from 'react';
const BRANCH_LABELS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
import { BusinessStrategySelector } from '@/components/business-strategy-selector';
import { DangerConfirm } from '@/components/danger-confirm';
import { AncientCard } from '@/components/ancient-card';
import { IndustryPanel } from '@/components/tang-manager/industry-panel';
import { pushActionFeedback } from '@/components/action-feedback';
import { SHOP_ASSETS } from '@/config/tang-shop-assets';
import { estimateShopValue } from '@/systems/tang-shop-sale';
import { formatMoney } from '@/lib/format-money';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';

export function ShopManagePanel(): React.ReactElement {
  const state = useTangManagerStore();
  const [sellOpen, setSellOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const branchCount = Math.max(0, (state.shopCount ?? 1) - 1);
  const branchValuation = estimateShopValue();
  const branchCost = 800 * Math.max(1, state.shopCount ?? 1);

  const handleSellConfirm = (): void => {
    const res = state.sellShop();
    if (res.ok) {
      pushActionFeedback('变卖完成', 'success');
      if ((res.laidOffNames ?? []).length > 0) pushActionFeedback('伙计' + res.laidOffNames!.join('、') + '已离店', 'warning');
    } else {
      pushActionFeedback(res.reason ?? '变卖失败', 'warning');
    }
    setSellOpen(false);
  };

  return (
    <div className="grid gap-3">
      <AncientCard accent={ANCIENT.gold} title="店铺 · 家业">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold tracking-widest" style={{ color: ANCIENT.text }}>祖传老店</span>
              <span className="rounded px-1.5 py-0.5 text-[10px] text-white" style={{ backgroundColor: ANCIENT.gold }}>本店</span>
            </div>
            <p className="mt-1 text-[11px]" style={{ color: ANCIENT.secondary }}>长安东市 · 永乐坊。立足之本，不可变卖。</p>
          </div>
          {branchCount > 0 &&
            Array.from({ length: branchCount }, (_, i) => (
              <div key={i} className="rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold" style={{ color: ANCIENT.text }}>分店 · {BRANCH_LABELS[i] ?? `${i + 1}号`}</span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] text-white" style={{ backgroundColor: ANCIENT.secondary }}>分号</span>
                </div>
                <p className="mt-1 text-[11px]" style={{ color: ANCIENT.secondary }}>估值约 {formatMoney(branchValuation)} 两。</p>
                <button type="button" onClick={() => setSellOpen(true)} className="mt-1.5 rounded px-2.5 py-1 text-[10px] tracking-widest text-white" style={{ backgroundColor: ANCIENT.accent }}>
                  变卖
                </button>
              </div>
            ))}
        </div>
        <button
          type="button"
          onClick={() => setBuyOpen(true)}
          disabled={state.silver < branchCost}
          className="mt-2 w-full rounded-lg px-3 py-2 text-xs font-bold tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: ANCIENT.primary, color: '#FFFFFF' }}
        >
          购置分店（{formatMoney(branchCost)} 两，可雇佣伙计 +2）
        </button>
        <div className="mt-3 border-t pt-2" style={{ borderColor: ANCIENT.border }}>
          <BusinessStrategySelector />
        </div>
      </AncientCard>

      <AncientCard accent={ANCIENT.secondary} title="店铺配置 · 资产">
        <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
          {SHOP_ASSETS.map((a) => {
            const owned = (state.shopAssets ?? []).includes(a.id);
            const afford = state.silver >= a.price;
            return (
              <div key={a.id} className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: owned ? '#F0E6D2' : ANCIENT.background, border: `1px solid ${owned ? ANCIENT.gold : ANCIENT.border}` }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold" style={{ color: ANCIENT.text }}>{a.name}</span>
                  <span className="text-[11px]" style={{ color: ANCIENT.secondary }}>{formatMoney(a.price)} 两</span>
                </div>
                <p className="mt-0.5 text-[11px]" style={{ color: ANCIENT.secondary }}>{a.desc}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: ANCIENT.gold }}>{a.feature}</span>
                  {owned ? (
                    <span className="text-[10px] font-bold" style={{ color: ANCIENT.primary }}>已购置</span>
                  ) : (
                    <button type="button" disabled={!afford} onClick={() => { const res = state.purchaseShopAsset(a.id); pushActionFeedback(res.ok ? '已购置「' + a.name + '」' : (res.reason ?? '购置失败'), res.ok ? 'success' : 'warning'); }} className="rounded px-2 py-0.5 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" style={{ backgroundColor: afford ? ANCIENT.primary : ANCIENT.border }}>
                      购置
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AncientCard>

      <IndustryPanel />

      {sellOpen && (
        <DangerConfirm title="变卖分店" risk={`店铺估值约${formatMoney(branchValuation)}两。变卖后此店不复存在。`} confirmLabel="确认变卖" onConfirm={handleSellConfirm} onClose={() => setSellOpen(false)} />
      )}
      {buyOpen && (
        <DangerConfirm title="购置分店" risk={`耗银 ${formatMoney(branchCost)} 两另置一铺，伙计名额 +2。是否继续？`} confirmLabel={`购置（${formatMoney(branchCost)} 两）`} onConfirm={() => { const res = state.purchaseBranch(); pushActionFeedback(res.ok ? '新店开张' : (res.reason ?? '购置失败'), res.ok ? 'success' : 'warning'); setBuyOpen(false); }} onClose={() => setBuyOpen(false)} />
      )}
    </div>
  );
}
