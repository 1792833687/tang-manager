/**
 * 市场调查报告面板（2026-08-06 新增系统）
 * 基于 priceIndex/inflationModifier + 各品类参考价，展示当前行情判断与采买建议。
 * 全部 ANCIENT 令牌；只读 store。
 */
'use client';
import { useTangManagerStore } from '@/stores/tang-manager';
import { MARKET_CATEGORY_REFERENCE, marketOutlook, categoryAdvice } from '@/config/tang-market-report';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';

export function MarketReportPanel(): React.ReactElement {
  const s = useTangManagerStore();
  const priceIndex = s.priceIndex ?? 1;
  const outlook = marketOutlook(priceIndex);
  const items = s.shopItems ?? [];
  const categories = ['食材', '布匹', '药材'];

  return (
    <div className="flex flex-col gap-2.5">
      {/* 物价总览 */}
      <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
        <div className="text-xs font-bold tracking-[0.3em]" style={{ color: ANCIENT.secondary }}>物价总览</div>
        <div className="mt-1.5 flex items-center justify-between text-sm">
          <span className="font-bold" style={{ color: outlook.color }}>{outlook.label}</span>
          <span style={{ color: ANCIENT.secondary }}>物价指数 {priceIndex.toFixed(2)}</span>
        </div>
        <p className="mt-1 text-xs leading-5" style={{ color: ANCIENT.text }}>{outlook.advice}</p>
      </div>

      {/* 各品类行情 */}
      {categories.map((cat) => {
        const ref = MARKET_CATEGORY_REFERENCE[cat];
        const catItems = items.filter((it) => it.category === cat);
        const avg = catItems.length ? catItems.reduce((sum, it) => sum + (it.price ?? 0), 0) / catItems.length : 0;
        const refMin = Math.round(((ref?.min ?? 1) * priceIndex) * 100) / 100;
        const refMax = Math.round(((ref?.max ?? 5) * priceIndex) * 100) / 100;
        return (
          <div key={cat} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold" style={{ color: ANCIENT.text }}>{cat}</span>
              <span style={{ color: ANCIENT.secondary }}>市价 {formatMoney(refMin)} ~ {formatMoney(refMax)}</span>
            </div>
            <p className="mt-1 text-[11px]" style={{ color: ANCIENT.secondary }}>{ref?.note}</p>
            <p className="mt-1 text-[11px]" style={{ color: ANCIENT.text }}>
              本店均价 {catItems.length ? formatMoney(Math.round(avg * 100) / 100) : '—'} · {categoryAdvice(catItems.length, avg, refMin, refMax)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
