/**
 * 账本面板（Step 2 需求 2.6；体验优化模块四紧凑化）
 * 顶部概览四栏横排紧凑卡：今日收益 / 本月收益 / 总资产 / 负债余额。
 * 明细：最近 5 条紧凑表（行高缩小、去多余边框、金额右对齐，正绿负红）。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { LedgerEntry } from '@/types/tang-manager';
import { formatMoney } from '@/lib/format-money';
import { AncientCard } from './ancient-card';

/** 收入类目（本月收益口径：经营/接待/事件 正收入之和） */
const INCOME_CATEGORIES = new Set(['经营', '接待', '事件']);

function StatCell({ label, value, color, note }: { label: string; value: string; color: string; note: string }): React.ReactElement {
  return (
    <div className="rounded-md px-2 py-1.5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
      <div className="text-[11px] tracking-[0.15em]" style={{ color: ANCIENT.secondary }}>{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px]" style={{ color: ANCIENT.border }}>{note}</div>
    </div>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }): React.ReactElement {
  const positive = entry.amount >= 0;
  return (
    <tr>
      <td className="py-0.5 pr-1 text-[11px]" style={{ color: ANCIENT.secondary }}>{entry.day}</td>
      <td className="py-0.5 pr-1 text-xs" style={{ color: ANCIENT.text }}>{entry.project}</td>
      <td className="py-0.5 pr-1 text-[11px]" style={{ color: ANCIENT.secondary }}>{entry.category}</td>
      <td className="py-0.5 text-right text-xs font-semibold" style={{ color: positive ? ANCIENT.primary : ANCIENT.accent }}>
        {positive ? '+' : ''}{formatMoney(entry.amount)}
      </td>
    </tr>
  );
}

export function LedgerPanel(): React.ReactElement {
  const state = useTangManagerStore();
  const ledger = state.ledger;
  // v1.0 模块四：账本明细分页（每页 20 + 查看更多；ledger 上限 50 条由 appendLedger 保证）
  const [visibleCount, setVisibleCount] = useState(20);

  // 今日收益：当日已接待收入之和（结算统一入账前的当日预估）
  const todayIncome = state.guests
    .filter((g) => g.handled)
    .reduce((sum, g) => sum + (g.incomeEarned ?? 0), 0);

  // 本月收益：当前月（Math.ceil(day/30)）账本中 经营|接待|事件 正收入之和
  const currentMonth = Math.ceil(state.day / 30);
  const monthIncome = ledger
    .filter((e) => Math.ceil(e.day / 30) === currentMonth && INCOME_CATEGORIES.has(e.category) && e.amount > 0)
    .reduce((sum, e) => sum + e.amount, 0);

  // 总资产 = 资金 + 库存估值（按成本估算）
  const inventoryValue = state.shopItems.reduce((sum, it) => sum + it.cost * it.stock, 0);
  const totalAssets = state.gold + inventoryValue;

  // 明细：倒序展示（新在前），分页取 visibleCount 条
  const sorted = [...ledger].reverse();
  const rows = sorted.slice(0, Math.min(visibleCount, sorted.length));
  const hasMore = sorted.length > visibleCount;

  return (
    <div className="flex flex-col gap-2">
      <AncientCard title="账本总览">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <StatCell label="今日收益" value={formatMoney(todayIncome)} color={ANCIENT.primary} note="当日已接待收入" />
          <StatCell label="本月收益" value={formatMoney(monthIncome)} color={ANCIENT.primary} note={`第 ${currentMonth} 月`} />
          <StatCell label="总资产" value={formatMoney(totalAssets)} color={ANCIENT.text} note="资金+库存(按成本)" />
          <StatCell label="负债余额" value={formatMoney(state.debt)} color={ANCIENT.accent} note="月息另计" />
        </div>
      </AncientCard>

      <AncientCard title={`最近明细（${ledger.length} 条）`}>
        {rows.length === 0 ? (
          <p className="py-4 text-center tracking-widest" style={{ color: ANCIENT.border }}>账册空白，打烊结算后逐笔记之。</p>
        ) : (
          <>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: ANCIENT.secondary }}>
                  <th className="py-0.5 pr-1 text-left font-normal">日</th>
                  <th className="py-0.5 pr-1 text-left font-normal">事项</th>
                  <th className="py-0.5 pr-1 text-left font-normal">类目</th>
                  <th className="py-0.5 text-right font-normal">金额</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => (
                  <LedgerRow key={`${e.day}-${e.project}-${i}`} entry={e} />
                ))}
              </tbody>
            </table>
            {/* v1.0 模块四：查看更多（每页 20） */}
            {hasMore && (
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + 20)}
                  className="rounded px-3 py-1 text-xs tracking-widest"
                  style={{ backgroundColor: ANCIENT.background, color: ANCIENT.primary, border: `1px solid ${ANCIENT.primary}` }}
                >
                  查看更多（{sorted.length - visibleCount} 条）
                </button>
              </div>
            )}
          </>
        )}
      </AncientCard>
    </div>
  );
}
