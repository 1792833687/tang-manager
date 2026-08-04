/**
 * 接待面板（TANG-RCP-001 模块五 重做）
 * 顶部状态条（当日进度/气氛图标/通晓人心/精力）+ 客人队列（耐心进度条、移动端横滑）+
 * 当前客人详情卡 + v1.1 对话式接待（DialoguePanel，右上可切传统六操作 OperationBar）+
 * 拼桌并单入口 + 已处理缩略 + 留言簿入口 + 打烊结算。
 */
'use client';
import { useState } from 'react';
import { withBase } from '@/lib/utils/base-path';
import { GUEST_LEVEL_LABEL } from '@/config/tang-guest-book-content';
import { GUEST_TYPE_LABEL } from '@/config/tang-guest-content';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { Guest, GuestType } from '@/types/tang-manager';
import { formatMoney } from '@/lib/format-money';
import { AncientCard } from './ancient-card';
import { ComplaintCard } from './complaint-card';
import { GuestBookPanel } from './guest-book-panel';
import { ModalContainer } from './modal-container';
import { DialoguePanel } from './tang-manager/dialogue-panel';
import { PreorderPanel } from './preorder-panel';
import { StrategySelector } from './strategy-selector';
import { triggerTutorial } from '@/systems/tang-tutorial-triggers';
import { TutorialHighlight } from './tutorial-highlight';

const TYPE_COLOR: Record<GuestType, string> = {
  normal: ANCIENT.primary,
  big_order: ANCIENT.accent,
  special: ANCIENT.gold,
  help: ANCIENT.secondary,
  observe: ANCIENT.border,
};

/** 气氛图标：😊绿 80-100 / 😐默认 50-79 / 😟橙 30-49 / 😤红 0-29 */
function AtmosphereBadge({ value }: { value: number }): React.ReactElement {
  const [icon, color] =
    value >= 80 ? ['😊', ANCIENT.primary] : value >= 50 ? ['😐', ANCIENT.border] : value >= 30 ? ['😟', '#C77B1E'] : ['😤', ANCIENT.accent];
  return (
    <span className="flex items-center gap-1 text-xs font-bold tracking-widest" style={{ color }}>
      {icon} 气氛 {value}
    </span>
  );
}

/** 耐心进度条（>50 绿 / 30-50 橙 / <30 红） */
function PatienceBar({ patience }: { patience: number }): React.ReactElement {
  const p = patience ?? 100;
  const color = p > 50 ? ANCIENT.primary : p > 30 ? '#C77B1E' : ANCIENT.accent;
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-14 overflow-hidden rounded-full" style={{ backgroundColor: ANCIENT.border }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, p))}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px]" style={{ color: ANCIENT.secondary }}>耐心 {Math.max(0, p)}</span>
    </div>
  );
}

/** 偏好标签：绿=已揭示 / 灰?=未揭示 */
function PreferenceChips({ guest }: { guest: Guest }): React.ReactElement {
  const prefs = guest.preferences ?? [];
  if (prefs.length === 0) return <span className="text-xs" style={{ color: ANCIENT.border }}>无偏好</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {prefs.map((p, i) => (
        <span
          key={i}
          className="rounded px-1.5 py-0.5 text-[11px]"
          style={{
            color: p.revealed ? '#FFFFFF' : ANCIENT.border,
            backgroundColor: p.revealed ? ANCIENT.primary : 'transparent',
            border: `1px solid ${p.revealed ? ANCIENT.primary : ANCIENT.border}`,
          }}
        >
          {p.revealed ? `偏好·${p.value}` : '偏好·?'}
        </span>
      ))}
    </span>
  );
}

export function ReceptionPanel(): React.ReactElement {
  const state = useTangManagerStore();
  const [showGuestBook, setShowGuestBook] = useState(false);
  const [tab, setTab] = useState<'reception' | 'preorder'>('reception');

  return (
    <div className="flex flex-col gap-4">
      {showGuestBook && (
        <ModalContainer title="宾客留言簿" onClose={() => setShowGuestBook(false)} showConfirm={false}>
          <GuestBookPanel onBack={() => setShowGuestBook(false)} />
        </ModalContainer>
      )}

      {/* 投诉卡（3.4：接待触发投诉后优先处理；解决投诉 → 气氛+5） */}
      {(state.pendingComplaint ?? null) && <ComplaintCard />}

      {/* TANG-TRF-001：接待策略三档（亲力亲为/择要接待/全托伙计；当日生效） */}
      <TutorialHighlight guideId="FIRST_STRATEGY">
        <StrategySelector />
      </TutorialHighlight>

      {/* 今日要务（TANG-ADD-001 · 2026-08-06 补 UI：清晨生成但此前无展示） */}
      {(state.todayTasks ?? []).length > 0 && (
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
          <div className="text-xs font-bold tracking-[0.3em]" style={{ color: ANCIENT.secondary }}>今日要务</div>
          <div className="mt-1.5 flex flex-col gap-1">
            {(state.todayTasks ?? []).map((task) => {
              const done = (state.todayTasksCompleted ?? []).includes(task.id);
              return (
                <div key={task.id} className="flex items-center justify-between gap-2 text-xs">
                  <span style={{ color: done ? ANCIENT.border : ANCIENT.text, textDecoration: done ? 'line-through' : 'none' }}>{task.title}</span>
                  <span className="rounded px-1.5 py-px text-[10px] font-bold" style={{ backgroundColor: done ? ANCIENT.primary : ANCIENT.background, color: done ? '#FFFFFF' : ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>{done ? (task.stampText || '已了') : '未了'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 市井消息（2026-08-06 新增系统：每日清晨 1-2 条长安传闻，暗藏行情提示） */}
      {(state.streetNews ?? []).length > 0 && (
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
          <div className="text-xs font-bold tracking-[0.3em]" style={{ color: ANCIENT.gold }}>市井消息</div>
          <div className="mt-1.5 flex flex-col gap-1">
            {(state.streetNews ?? []).slice(-3).map((n, i) => (
              <p key={i} className="text-xs leading-5" style={{ color: ANCIENT.text }}>· {n}</p>
            ))}
          </div>
        </div>
      )}

      {/* TANG-TRF-001：接待 / 预购订单 双标签 */}
      <div className="flex gap-2 text-xs tracking-widest">
        <button
          type="button"
          onClick={() => setTab('reception')}
          className="rounded-lg px-4 py-1.5 font-bold"
          style={{
            backgroundColor: tab === 'reception' ? ANCIENT.primary : ANCIENT.card,
            color: tab === 'reception' ? '#FFFFFF' : ANCIENT.text,
            border: `1px solid ${ANCIENT.border}`,
          }}
        >
          接待来客
        </button>
        <TutorialHighlight guideId="FIRST_PREORDER">
          <button
            type="button"
            onClick={() => setTab('preorder')}
            className="rounded-lg px-4 py-1.5 font-bold"
            style={{
              backgroundColor: tab === 'preorder' ? ANCIENT.primary : ANCIENT.card,
              color: tab === 'preorder' ? '#FFFFFF' : ANCIENT.text,
              border: `1px solid ${ANCIENT.border}`,
            }}
          >
            预购订单（{(state.preOrders ?? []).length}）
          </button>
        </TutorialHighlight>
      </div>

      {tab === 'preorder' ? (
        <PreorderPanel />
      ) : (
        <ReceptionFlow state={state} />
      )}

      {/* 留言簿入口 + 打烊结算 */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowGuestBook(true)}
          className="rounded px-3 py-2 text-xs tracking-widest"
          style={{ backgroundColor: 'transparent', color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}
        >
          翻看宾客留言簿（{(state.guestBook ?? []).length}）
        </button>
        <button
          type="button"
          onClick={() => { state.settleDay(); triggerTutorial('FIRST_SETTLE'); }}
          className="rounded-lg px-6 py-2 text-sm font-bold tracking-[0.3em]"
          style={{ backgroundColor: ANCIENT.border, color: '#FFF', border: `1px solid ${ANCIENT.gold}` }}
        >
          打烊结算
        </button>
      </div>
    </div>
  );
}

/** 接待来客主流程（状态条 + 客人队列 + 当前客人详情 + 已处理缩略） */
function ReceptionFlow({ state }: { state: ReturnType<typeof useTangManagerStore.getState> }): React.ReactElement {
  const guests = state.guests;
  const handledCount = guests.filter((g) => g.handled).length;
  const current = guests.find((g) => !g.handled) ?? null;
  const partner = current
    ? guests.find((g) => g.id !== current.id && !g.handled && g.type === current.type && (g.patience ?? 100) > 50) ?? null
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部状态条 */}
      <div className="grid grid-cols-2 gap-2 rounded-xl p-3 text-xs sm:grid-cols-4" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
        <span style={{ color: ANCIENT.text }}>今日进度 {handledCount}/{guests.length}</span>
        <AtmosphereBadge value={state.shopAtmosphere ?? 50} />
        <span style={{ color: ANCIENT.text }}>通晓人心 ×{state.insightRemaining}</span>
        <span style={{ color: ANCIENT.text }}>精力 {state.energy}%</span>
      </div>

      {/* 客人队列（移动端横滑） */}
      <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap">
        {guests.map((g) => {
          const isCurrent = g.id === current?.id;
          return (
            <div
              key={g.id}
              className="min-w-[128px] rounded-lg px-3 py-2"
              style={{
                backgroundColor: isCurrent ? ANCIENT.background : ANCIENT.card,
                border: `1px solid ${isCurrent ? ANCIENT.gold : ANCIENT.border}`,
                opacity: g.handled ? 0.6 : 1,
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="rounded px-1 text-[10px] font-bold" style={{ color: '#FFF', backgroundColor: TYPE_COLOR[g.type] }}>
                  {GUEST_TYPE_LABEL[g.type]}
                </span>
                <span className="truncate text-xs font-semibold" style={{ color: ANCIENT.text }}>{g.name}</span>
                {g.handled && <span className="text-[10px]" style={{ color: ANCIENT.primary }}>✓</span>}
              </div>
              <div className="mt-1.5">
                <PatienceBar patience={g.patience ?? 100} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 当前客人详情卡 */}
      {current ? (
        <AncientCard accent={ANCIENT.gold} title={`${current.name} · ${GUEST_TYPE_LABEL[current.type]}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: ANCIENT.secondary }}>
            <PreferenceChips guest={current} />
            {current.storyTag && <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: '#F0E6D2', color: ANCIENT.border }}>{current.storyTag}</span>}
            <span>第 {current.visitCount ?? 1} 次光顾</span>
            <span className="flex items-center gap-1 rounded px-1.5 py-0.5" style={{ backgroundColor: ANCIENT.gold, color: '#FFF' }}>
              <img
                src={withBase(`/images/icons/guest-levels/${current.guestLevel ?? 'bronze'}.svg`)}
                alt={`${GUEST_LEVEL_LABEL[current.guestLevel ?? 'bronze']}标识`}
                aria-hidden
                className="h-3.5 w-3.5"
              />
              {GUEST_LEVEL_LABEL[current.guestLevel ?? 'bronze']}客
            </span>
            <span className="ml-auto">预估 {formatMoney(current.baseConsumption)}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: ANCIENT.text }}>{current.description}</p>
          <div className="mt-3">
            <DialoguePanel guest={current} />
          </div>
          {partner && (
            <button
              type="button"
              onClick={() => state.mergeGuests(current.id, partner.id)}
              className="mt-2 w-full rounded-lg px-3 py-2 text-xs tracking-widest"
              style={{ backgroundColor: ANCIENT.background, color: ANCIENT.secondary, border: `1px dashed ${ANCIENT.border}` }}
            >
              与「{partner.name}」拼桌并单（同席双客，各自八折）
            </button>
          )}
        </AncientCard>
      ) : (
        <AncientCard accent={ANCIENT.gold} title="今日接待完毕">
          <p className="py-2 text-sm tracking-widest" style={{ color: ANCIENT.secondary }}>
            今日 {guests.length} 位客人均已接待，可打烊结算。
          </p>
        </AncientCard>
      )}

      {/* 已处理客人缩略（方式+结果摘要） */}
      {guests.filter((g) => g.handled).length > 0 && (
        <div className="flex flex-col gap-1.5">
          {guests.filter((g) => g.handled).map((g) => (
            <div key={g.id} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}`, opacity: 0.85 }}>
              <span className="font-semibold" style={{ color: ANCIENT.text }}>{g.name}</span>
              <span style={{ color: ANCIENT.secondary }}>{g.handledNote ?? `${g.review === 'good' ? '好评' : '差评'} · ${formatMoney(g.incomeEarned ?? 0)}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
