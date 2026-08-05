/**
 * 打烊结算面板（2026-08-05 体验优化）
 * 打烊后弹出：今日结算（收益/支出/净收益/评分/声望）+ 今日之事（事件回顾）+ 伙计禀报。
 * 全部 ANCIENT 令牌；只读 store。
 */
'use client';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';

export function SettlementSummaryModal(): React.ReactElement | null {
  const open = useTangManagerStore((s) => s.settlementPopupOpen);
  const queueActive = useTangManagerStore((s) => s.currentModal !== null);
  const settle = useTangManagerStore((s) => s.todaySettlement);
  const eventLog = useTangManagerStore((s) => s.eventLog ?? []);
  const report = useTangManagerStore((s) => s.dailyStaffReport);
  const dismiss = useTangManagerStore((s) => s.dismissSettlementPopup);
  if (queueActive || !open || !settle) return null;
  const day = settle.day;
  const todayEvents = eventLog.filter((e) => e.startsWith('[第' + day + '日]'));
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', animation: 'fade-in 0.2s ease-out' }} onClick={dismiss}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl px-6 py-6"
        style={{ backgroundColor: ANCIENT.card, border: `2px solid ${ANCIENT.border}`, boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 24px 48px rgba(60,40,20,0.3)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center text-xl font-bold tracking-[0.3em]" style={{ color: ANCIENT.text }}>打烊 · 第{day}日</h2>
        <div className="mx-auto mt-2 flex items-center justify-center gap-2">
          <span style={{ height: 1, width: 40, backgroundColor: ANCIENT.gold }} />
          <span style={{ color: ANCIENT.gold, fontSize: 12 }}>◆</span>
          <span style={{ height: 1, width: 40, backgroundColor: ANCIENT.gold }} />
        </div>

        {/* 今日结算 */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="基础收益" value={formatMoney(settle.baseIncome)} color={ANCIENT.primary} />
          <Stat label="客单消费" value={formatMoney(settle.guestIncome)} color={ANCIENT.primary} />
          <Stat label="支出" value={'-' + formatMoney(settle.expenses)} color={ANCIENT.accent} />
          <Stat label="净收益" value={formatMoney(settle.netIncome)} color={settle.netIncome >= 0 ? ANCIENT.gold : ANCIENT.accent} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded px-2 py-0.5" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
            评分 {settle.scoreChange >= 0 ? '+' : ''}{settle.scoreChange.toFixed(2)}
          </span>
          <span className="rounded px-2 py-0.5" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
            声望 {settle.reputationChange >= 0 ? '+' : ''}{settle.reputationChange}
          </span>
          <span className="rounded px-2 py-0.5" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
            精力消耗 {settle.energyConsumed}
          </span>
        </div>

        {/* 今日之事 */}
        <div className="mt-4">
          <div className="text-xs font-bold tracking-[0.3em]" style={{ color: ANCIENT.secondary }}>今日之事</div>
          <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
            {todayEvents.length > 0 ? (
              todayEvents.map((e, i) => (
                <p key={i} className="rounded-lg px-2.5 py-1.5 text-xs leading-5" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}>
                  {e.replace('[第' + day + '日] ', '')}
                </p>
              ))
            ) : (
              <p className="text-xs" style={{ color: ANCIENT.secondary }}>今日风平浪静，无甚大事。</p>
            )}
          </div>
        </div>

        {/* 伙计禀报 */}
        {report && (
          <div className="mt-4 rounded-xl px-3 py-2 text-xs leading-5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }}>
            <span className="font-bold tracking-widest" style={{ color: ANCIENT.gold }}>{report.staffName} · 禀报：</span>
            <span style={{ color: ANCIENT.text }}>{report.content}</span>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={dismiss} className="min-h-10 rounded-lg px-8 py-2 text-sm font-bold tracking-[0.3em]" style={{ backgroundColor: ANCIENT.gold, color: '#FFFFFF' }}>
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }): React.ReactElement {
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
      <div className="text-[10px]" style={{ color: ANCIENT.secondary }}>{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
