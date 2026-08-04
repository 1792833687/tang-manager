/**
 * 信用展示卡（Step 5b 模块三；从 me-panel 拆出，保持组件 ≤200 行）
 * 信用值 + 档位（颜色标识）+ 最近 5 条记录 + 可用特权。
 */
'use client';
import { useTangManagerStore } from '@/stores/tang-manager';
import { getCreditTier } from '@/systems/tang-credit';
import { ANCIENT } from '@/theme/tokens';
import { AncientCard } from './ancient-card';

export function CreditPanel(): React.ReactElement {
  const state = useTangManagerStore();
  const creditTier = getCreditTier(state.credit);
  const recentCredit = (state.creditHistory ?? []).slice(-5).reverse();

  return (
    <AncientCard className="lg:col-span-3" accent={ANCIENT.gold} title="信用">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg px-4 py-3" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          <div className="text-xs" style={{ color: ANCIENT.secondary }}>信用值</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: creditTier.min >= 700 ? ANCIENT.accent : ANCIENT.primary }}>
            {state.credit}
          </div>
          <div className="mt-1 text-sm font-semibold" style={{ color: ANCIENT.secondary }}>
            {creditTier.name} · {creditTier.min}~{creditTier.max}
          </div>
          {state.creditLocked > 0 && (
            <div className="mt-1 text-xs" style={{ color: ANCIENT.accent }}>锁定 {state.creditLocked}（还款后释放）</div>
          )}
          {state.creditBankruptDays > 0 && (
            <div className="mt-1 text-xs" style={{ color: ANCIENT.accent }}>信用破产恢复中（剩 {state.creditBankruptDays} 天）</div>
          )}
        </div>
        <div className="rounded-lg px-4 py-3" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          <div className="mb-2 text-xs" style={{ color: ANCIENT.secondary }}>可用特权</div>
          <ul className="flex flex-col gap-1 text-xs" style={{ color: ANCIENT.text }}>
            {creditTier.privileges.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg px-4 py-3" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          <div className="mb-2 text-xs" style={{ color: ANCIENT.secondary }}>最近记录</div>
          {recentCredit.length === 0 ? (
            <p className="text-xs" style={{ color: ANCIENT.secondary }}>暂无信用变动记录</p>
          ) : (
            <ul className="flex flex-col gap-1 text-xs" style={{ color: ANCIENT.text }}>
              {recentCredit.map((r, i) => (
                <li key={`${r.day}-${i}`} className="flex items-center justify-between">
                  <span style={{ color: ANCIENT.secondary }}>第 {r.day} 日 · {r.reason}</span>
                  <span style={{ color: r.amount >= 0 ? ANCIENT.primary : ANCIENT.accent }}>
                    {r.amount >= 0 ? `+${r.amount}` : r.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AncientCard>
  );
}
