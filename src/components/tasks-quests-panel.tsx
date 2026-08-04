/**
 * 要务与遗命面板（2026-08-06 补 UI）
 * 收拢 4 个此前「有数据无界面」的成瘾机制：
 * - 周间要务（weeklyTasks + weeklyTaskProgress）
 * - 陆家遗命（LEGACY_QUESTS + activeLegacyQuest + completedLegacyQuests）
 * - 谢七赌约（activeBet → 接受/拒绝）
 * - 市易务暗标（currentBlindAuction → 出价）
 * 全部 ANCIENT 令牌；挂载于手札录面板「要务与遗命」弹窗。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { LEGACY_QUESTS } from '@/config/tang-legacy-quests';
import { WEEKLY_TASKS } from '@/config/tang-daily-tasks';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { pushActionFeedback } from './action-feedback';

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
      <div className="text-xs font-bold tracking-[0.3em]" style={{ color: ANCIENT.secondary }}>{title}</div>
      <div className="mt-2 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

export function TasksQuestsPanel(): React.ReactElement {
  const s = useTangManagerStore();
  const [bid, setBid] = useState('');
  const weekly = s.weeklyTasks ?? [];
  const weeklyProgress = s.weeklyTaskProgress ?? {};
  const completedQuests = s.completedLegacyQuests ?? [];
  const activeQuest = s.activeLegacyQuest ?? null;
  const bet = s.activeBet ?? null;
  const auction = s.currentBlindAuction ?? null;

  return (
    <div className="flex flex-col gap-2.5">
      <Section title="周间要务">
        {weekly.length === 0 ? (
          <p className="text-xs" style={{ color: ANCIENT.secondary }}>本周暂无要务，下周开张再看。</p>
        ) : (
          weekly.map((t) => {
            const prog = weeklyProgress[t.id] ?? 0;
            const done = prog >= t.target;
            return (
              <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: done ? ANCIENT.border : ANCIENT.text, textDecoration: done ? 'line-through' : 'none' }}>{t.title}</span>
                    <span className="rounded px-1 py-px text-[10px]" style={{ backgroundColor: done ? ANCIENT.primary : ANCIENT.background, color: done ? '#FFF' : ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>{done ? (t.stampText || '周') : '未了'}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: ANCIENT.background }}>
                    <div style={{ width: `${Math.min(100, (prog / Math.max(1, t.target)) * 100)}%`, height: '100%', backgroundColor: ANCIENT.gold }} />
                  </div>
                </div>
                <span className="text-[10px]" style={{ color: ANCIENT.secondary }}>{prog}/{t.target}</span>
              </div>
            );
          })
        )}
      </Section>

      <Section title="陆家遗命">
        {WEEKLY_TASKS.length === 0 && LEGACY_QUESTS.length === 0 ? (
          <p className="text-xs" style={{ color: ANCIENT.secondary }}>先祖遗命尚未浮现。</p>
        ) : (
          LEGACY_QUESTS.map((q) => {
            const done = completedQuests.includes(q.id);
            const current = activeQuest?.id === q.id;
            return (
              <div key={q.id} className="rounded-lg px-2.5 py-2 text-xs leading-5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${current ? ANCIENT.gold : ANCIENT.border}` }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold" style={{ color: current ? ANCIENT.gold : ANCIENT.text }}>{q.title}</span>
                  <span className="rounded px-1.5 py-px text-[10px]" style={{ backgroundColor: done ? ANCIENT.primary : current ? ANCIENT.gold : ANCIENT.background, color: done || current ? '#FFF' : ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>{done ? '已了' : current ? '进行中' : '待启'}</span>
                </div>
                <div className="mt-1" style={{ color: ANCIENT.secondary }}>{q.goal}</div>
              </div>
            );
          })
        )}
      </Section>

      <Section title="谢七赌约">
        {!bet ? (
          <p className="text-xs" style={{ color: ANCIENT.secondary }}>谢七近来没来串门。</p>
        ) : (
          <div className="rounded-lg px-2.5 py-2 text-xs leading-5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
            <div className="font-bold" style={{ color: ANCIENT.text }}>{bet.title}</div>
            <div className="mt-1" style={{ color: ANCIENT.secondary }}>{bet.proposal}</div>
            <div className="mt-1 text-[11px]" style={{ color: ANCIENT.gold }}>赌注 {formatMoney(bet.stake)}</div>
            {s.betAccepted ? (
              <div className="mt-2 text-[11px]" style={{ color: ANCIENT.primary }}>已接下，打烊见分晓。</div>
            ) : (
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => s.acceptBet()} className="rounded px-3 py-1 text-[11px] font-bold" style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}>接下赌约</button>
                <button type="button" onClick={() => s.declineBet()} className="rounded px-3 py-1 text-[11px] font-bold" style={{ backgroundColor: ANCIENT.border, color: '#FFF' }}>婉拒</button>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="市易务暗标">
        {!auction ? (
          <p className="text-xs" style={{ color: ANCIENT.secondary }}>本月市易务尚未挂出暗标。</p>
        ) : s.blindAuctionResolved ? (
          <p className="text-xs" style={{ color: ANCIENT.secondary }}>本标已开，下月再瞧。</p>
        ) : (
          <div className="rounded-lg px-2.5 py-2 text-xs leading-5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
            <div className="font-bold" style={{ color: ANCIENT.text }}>{auction.category}</div>
            <div className="mt-1" style={{ color: ANCIENT.secondary }}>{auction.description}</div>
            <div className="mt-1 text-[11px]" style={{ color: ANCIENT.gold }}>起拍 {formatMoney(auction.startPrice)}</div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                value={bid}
                onChange={(e) => setBid(e.target.value)}
                placeholder={`≥ ${Math.ceil(auction.startPrice)}`}
                className="w-24 rounded border px-2 py-1 text-xs"
                style={{ borderColor: ANCIENT.border, backgroundColor: '#FFF' }}
              />
              <button
                type="button"
                onClick={() => {
                  const amount = Number(bid);
                  const r = s.placeBid(amount);
                  pushActionFeedback(r?.ok ? (r.won ? '一举中标！' : '差之毫厘，未曾中标') : (r?.reason ?? '出价失败'), r?.ok ? (r.won ? 'success' : 'warning') : 'warning');
                }}
                className="rounded px-3 py-1 text-[11px] font-bold"
                style={{ backgroundColor: ANCIENT.gold, color: '#FFF' }}
              >
                出价
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
