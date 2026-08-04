/**
 * 经营阶段（playing）面板调度器
 * 顶部游戏阶段提示（今日第 X 位客人 / 已接待完毕，可打烊）；
 * 八面板：我 / 账本 / 货架 / 伙计 / 接待 / 成就 / 钱庄 / 长安舆图
 * （Step 5b 第 7 项钱庄；Step 5b-2 第 8 项长安舆图，各自独立文件，≤200 行）。
 */
'use client';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { NavPanelKey } from './nav-sidebar';
import { AchievementPanel } from './achievement-panel';
import { BankPanel } from './bank-panel';
import { LedgerPanel } from './ledger-panel';
import { MapPanel } from './map-panel';
import { MePanel } from './me-panel';
import { ReceptionPanel } from './reception-panel';
import { ShelfPanel } from './shelf-panel';
import { StaffPanel } from './staff-panel';
import { GamblingPanel } from './gambling-panel';
import { NegativeEventOverlay } from './negative-event-overlay';

/** 顶部游戏阶段提示 */
function ReceptionHint(): React.ReactElement | null {
  const phase = useTangManagerStore((s) => s.phase);
  const guests = useTangManagerStore((s) => s.guests);
  const index = useTangManagerStore((s) => s.currentGuestIndex);

  if (phase !== 'playing' || guests.length === 0) {
    return null;
  }
  const allHandled = guests.every((g) => g.handled);
  const label = allHandled
    ? '今日已接待完毕，可打烊结算'
    : `今日第 ${Math.min(index + 1, guests.length)} 位客人`;

  return (
    <div
      className="rounded-lg px-4 py-2 text-sm tracking-widest"
      style={{
        backgroundColor: ANCIENT.card,
        border: `1px solid ${allHandled ? ANCIENT.gold : ANCIENT.border}`,
        color: allHandled ? ANCIENT.accent : ANCIENT.secondary,
      }}
    >
      {label}
    </div>
  );
}

const PANEL_CONTENT: Record<NavPanelKey, React.ReactElement> = {
  me: <MePanel />,
  ledger: <LedgerPanel />,
  shelf: <ShelfPanel />,
  staff: <StaffPanel />,
  reception: <ReceptionPanel />,
  achievement: <AchievementPanel />,
  bank: <BankPanel />,
  map: <MapPanel />,
};

export function PlayingPanel({ activePanel }: { activePanel: NavPanelKey }): React.ReactElement {
  // 内容深化 TANG-CONT-D：负反馈事件浮层（含被栽赃/人情债；渲染在面板内容之上）
  const gamblingPanelOpen = useTangManagerStore((s) => s.gamblingPanelOpen);
  const closeGamblingPanel = useTangManagerStore((s) => s.closeGamblingPanel);
  return (
    <div className="flex flex-col gap-3">
      <ReceptionHint />
      {PANEL_CONTENT[activePanel]}
      <NegativeEventOverlay />
      {gamblingPanelOpen && <GamblingPanel onClose={closeGamblingPanel} />}
    </div>
  );
}
