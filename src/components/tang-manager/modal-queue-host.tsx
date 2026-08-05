/**
 * 弹窗队列宿主（2026-08-05 · 打烊结算修复规格书模块一）
 * 打烊结算流程：结算→事件→成就→月度→次日卦象→要务，按优先级逐一弹出，不堆叠。
 * 读 store.currentModal；关闭调 closeCurrentModal 弹出下一个。
 */
'use client';
import { useTangManagerStore } from '@/stores/tang-manager';
import { hexagramById } from '@/config/tang-hexagrams';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { ActionButton } from '@/components/ui-kit';

function ModalShell({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  const close = useTangManagerStore((s) => s.closeCurrentModal);
  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', animation: 'fade-in 0.2s ease-out' }}>
      <div className="w-full max-w-md rounded-2xl px-6 py-6" style={{ backgroundColor: ANCIENT.card, border: `2px solid ${ANCIENT.gold}`, boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 24px 48px rgba(60,40,20,0.3)` }}>
        <div className="text-center text-lg font-bold tracking-[0.3em]" style={{ color: ANCIENT.text }}>{title}</div>
        <div className="mx-auto mt-2 flex items-center justify-center gap-2">
          <span style={{ height: 1, width: 36, backgroundColor: ANCIENT.gold }} />
          <span style={{ color: ANCIENT.gold, fontSize: 11 }}>◆</span>
          <span style={{ height: 1, width: 36, backgroundColor: ANCIENT.gold }} />
        </div>
        <div className="mt-3">{children}</div>
        <div className="mt-5 flex justify-end">
          <ActionButton label="知道了" variant="primary" onClick={close} />
        </div>
      </div>
    </div>
  );
}

export function ModalQueueHost(): React.ReactElement | null {
  const s = useTangManagerStore();
  const cur = s.currentModal;
  const close = s.closeCurrentModal;
  if (!cur) return null;

  if (cur.type === 'settlement') {
    const settle = s.todaySettlement;
    if (!settle) return null;
    return (
      <ModalShell title={`打烊 · 第${settle.day}日`}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label="基础收益" value={formatMoney(settle.baseIncome)} color={ANCIENT.primary} />
          <Stat label="客单消费" value={formatMoney(settle.guestIncome)} color={ANCIENT.primary} />
          <Stat label="支出" value={'-' + formatMoney(settle.expenses)} color={ANCIENT.accent} />
          <Stat label="净收益" value={formatMoney(settle.netIncome)} color={settle.netIncome >= 0 ? ANCIENT.gold : ANCIENT.accent} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]" style={{ color: ANCIENT.secondary }}>
          <span>评分 {settle.scoreChange >= 0 ? '+' : ''}{settle.scoreChange.toFixed(2)}</span>
          <span>声望 {settle.reputationChange >= 0 ? '+' : ''}{settle.reputationChange}</span>
        </div>
      </ModalShell>
    );
  }

  if (cur.type === 'hexagram') {
    const todayId = s.todayHexagram?.id ?? null;
    const hex = todayId ? hexagramById(todayId) : null;
    if (!hex) return null;
    return (
      <ModalShell title="手札占候">
        <div className="text-center">
          <div className="text-4xl font-bold" style={{ color: hex.tagColor }}>{hex.name}</div>
          <div className="mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: hex.tagColor }}>{hex.judgment}</div>
          <p className="mt-3 text-sm leading-6" style={{ color: ANCIENT.text }}>{hex.description}</p>
        </div>
      </ModalShell>
    );
  }

  if (cur.type === 'event') {
    const story = s.storyNarrative;
    if (!story) return null;
    return (
      <ModalShell title={story.title ?? '长安事'}>
        <p className="text-sm leading-6" style={{ color: ANCIENT.text }}>{story.body}</p>
      </ModalShell>
    );
  }

  if (cur.type === 'daily_task') {
    const tasks = s.todayTasks ?? [];
    return (
      <ModalShell title="今日要务">
        <div className="flex flex-col gap-1.5">
          {tasks.length === 0 ? <p className="text-xs" style={{ color: ANCIENT.secondary }}>今日无特别要务。</p> : tasks.map((task) => (
            <div key={task.id} className="rounded-lg px-2.5 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
              <span style={{ color: ANCIENT.text }}>{task.title}</span>
              <span className="ml-2 text-[10px]" style={{ color: ANCIENT.secondary }}>{task.description}</span>
            </div>
          ))}
        </div>
      </ModalShell>
    );
  }

  // 兜底：直接关闭
  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <button type="button" onClick={close} className="rounded-lg px-8 py-2 text-sm font-bold" style={{ backgroundColor: ANCIENT.gold, color: '#FFF' }}>继续</button>
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
