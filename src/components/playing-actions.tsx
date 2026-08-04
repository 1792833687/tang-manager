/**
 * 经营操作区（Step 2 需求 2.7）— playing 阶段底部操作：
 * - 接待中：当前客人卡片 + 三个处理按钮（正常接待/通晓人心/拒绝接待）；
 *   通晓人心显示剩余次数，0 次禁用；点击后调用 handleCurrentGuest 并展示本单结果卡片。
 * - 接待完 5 位显示「已接待完毕」提示。
 * - 打烊按钮：调用 settleDay()，展示结算面板（古风卡片）；
 *   settleDay 内部已自动 startNewDay，次日回到接待首位客人。
 * 拆自 page.tsx；结果/结算卡片见 reception-result-cards.tsx（保证 ≤200 行）。
 */
'use client';
import { useState } from 'react';
import { GUEST_TYPE_LABEL } from '@/config/tang-guest-content';
import { getShopType, shopDisplayName } from '@/config/tang-shop-types';
import { withBase } from '@/lib/utils/base-path';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT, ANCIENT_ASSETS } from '@/theme/tokens';
import type { DaySettlement, Guest, HandleGuestResult, HandleMethod, NarrationContext } from '@/types/tang-manager';
import { formatMoney } from '@/lib/format-money';
import { triggerTutorial } from '@/systems/tang-tutorial-triggers';
import { AiNarration } from './ai-narration';
import { AncientCard } from './ancient-card';
import { ComplaintCard } from './complaint-card';
import { LuckPanel } from './luck-panel';
import { ResultCard, SettlementCard } from './reception-result-cards';
import { TutorialHighlight } from './tutorial-highlight';

/** 操作按钮公共样式 */
function ActionButton({
  label,
  onClick,
  disabled = false,
  color = ANCIENT.primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full min-h-11 rounded-lg py-2.5 text-sm font-bold tracking-[0.2em] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 md:flex-1"
      style={{
        backgroundColor: color,
        color: '#FFFFFF',
        // 竹青主按钮叠加丝绸纹理（btn-bg.svg）
        ...(color === ANCIENT.primary
          ? { backgroundImage: `url(${withBase(ANCIENT_ASSETS.btnBg)})`, backgroundSize: 'cover' }
          : null),
      }}
    >
      {label}
    </button>
  );
}

export function PlayingActions(): React.ReactElement | null {
  const phase = useTangManagerStore((s) => s.phase);
  const guests = useTangManagerStore((s) => s.guests);
  const currentGuestIndex = useTangManagerStore((s) => s.currentGuestIndex);
  const insightRemaining = useTangManagerStore((s) => s.insightRemaining);
  const pendingComplaint = useTangManagerStore((s) => s.pendingComplaint);
  const handleCurrentGuest = useTangManagerStore((s) => s.handleCurrentGuest);
  const settleDay = useTangManagerStore((s) => s.settleDay);

  const [lastResult, setLastResult] = useState<HandleGuestResult | null>(null);
  const [lastSettlement, setLastSettlement] = useState<DaySettlement | null>(null);
  const [settlementContext, setSettlementContext] = useState<NarrationContext | null>(null);

  if (phase !== 'playing') {
    return null;
  }

  const currentGuest = guests[currentGuestIndex] ?? null;
  const allHandled = guests.length > 0 && guests.every((g) => g.handled);

  const handleAction = (method: HandleMethod): void => {
    const result = handleCurrentGuest(method);
    // 新手引导（TANG-TUT-002）：首次通晓人心 → FIRST_MIND_READ（排队/防重由 triggerTutorial 处理）
    if (method === 'mind_read') triggerTutorial('FIRST_MIND_READ');
    setLastResult(result);
    setLastSettlement(null);
    setSettlementContext(null);
  };

  const handleSettle = (): void => {
    // 先捕获「当日」客人（settleDay 内部会 startNewDay 替换为次日客人）
    const dayGuests = useTangManagerStore.getState().guests;
    const settlement = settleDay();
    // 新手引导（TANG-TUT-002）：首次打烊结算 → FIRST_SETTLE（防重/排队由 triggerTutorial 处理）
    if (settlement) triggerTutorial('FIRST_SETTLE');
    setLastSettlement(settlement);
    setLastResult(null);
    setSettlementContext(null);
    if (settlement) {
      const s = useTangManagerStore.getState();
      const shopType = s.shopType ?? 'jiulou';
      const highlights = dayGuests
        .filter((g) => g.handled)
        .slice(0, 3)
        .map((g: Guest) => `${g.name}（${GUEST_TYPE_LABEL[g.type]}）消费 ${formatMoney(g.incomeEarned ?? 0)}`);
      setSettlementContext({
        type: 'settlement',
        shopName: shopDisplayName(shopType),
        shopType: getShopType(shopType).name,
        playerName: s.player?.name ?? '掌柜',
        day: settlement.day,
        settlement: {
          netIncome: settlement.netIncome,
          guestHighlights: highlights,
          scoreChange: settlement.scoreChange,
          reputationChange: settlement.reputationChange,
        },
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {pendingComplaint && <ComplaintCard />}
      {!pendingComplaint && !allHandled && currentGuest && (
        <TutorialHighlight guideId="FIRST_GUEST">
          <AncientCard accent={ANCIENT.gold} title={`当前客人 · ${GUEST_TYPE_LABEL[currentGuest.type]} ${currentGuest.name}`}>
            <p className="text-sm leading-relaxed" style={{ color: ANCIENT.text }}>
              {currentGuest.description}
            </p>
            <p className="mt-1 text-xs" style={{ color: ANCIENT.secondary }}>
              预估消费 {formatMoney(currentGuest.baseConsumption)} · 通晓人心剩余 {insightRemaining} 次
            </p>
            <div className="mt-3 flex flex-col gap-2 md:flex-row md:gap-3">
              <ActionButton label="正常接待" onClick={() => handleAction('normal')} />
              <TutorialHighlight guideId="FIRST_MIND_READ">
                <ActionButton
                  label={`通晓人心（${insightRemaining}）`}
                  onClick={() => handleAction('mind_read')}
                  disabled={insightRemaining <= 0}
                  color={ANCIENT.secondary}
                />
              </TutorialHighlight>
              <ActionButton label="拒绝接待" onClick={() => handleAction('reject')} color={ANCIENT.accent} />
            </div>
          </AncientCard>
        </TutorialHighlight>
      )}

      {!pendingComplaint && allHandled && guests.length > 0 && (
        <AncientCard accent={ANCIENT.gold} title="今日接待完毕">
          <p className="py-1 text-sm tracking-widest" style={{ color: ANCIENT.secondary }}>
            今日 {guests.length} 位客人均已接待，可打烊结算进入第二天。
          </p>
        </AncientCard>
      )}

      {lastResult && <ResultCard result={lastResult} />}
      {lastSettlement && <SettlementCard settlement={lastSettlement} />}
      {settlementContext && (
        <AiNarration context={settlementContext} onClose={() => setSettlementContext(null)} />
      )}

      {!pendingComplaint && <LuckPanel />}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSettle}
          className="w-full min-h-11 rounded-lg px-8 py-2.5 text-base font-bold tracking-[0.4em] transition-transform active:scale-[0.97] hover:opacity-80 md:w-auto"
          style={{ backgroundColor: ANCIENT.border, color: '#FFFFFF', border: `1px solid ${ANCIENT.gold}` }}
        >
          打烊结算
        </button>
      </div>
    </div>
  );
}
