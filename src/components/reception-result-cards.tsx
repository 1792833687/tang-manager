/**
 * 接待结果 / 结算展示卡片（Step 2 需求 2.7；Step 5a 3.4 接待叙事）
 * 从 playing-actions.tsx 拆分，保证各组件 ≤200 行。
 */
'use client';
import { useState } from 'react';
import { ACHIEVEMENT_MAP } from '@/config/tang-achievements';
import { GUEST_TYPE_LABEL } from '@/config/tang-guest-content';
import { getShopType, shopDisplayName } from '@/config/tang-shop-types';
import { findStoryTag } from '@/config/tang-story-tags';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { DaySettlement, HandleGuestResult, NarrationContext } from '@/types/tang-manager';
import { formatMoney } from '@/lib/format-money';
import { AiNarration } from './ai-narration';
import { AncientCard } from './ancient-card';

function formatDelta(n: number): string {
  if (n === 0) return '0';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}`;
}

function Cell({ label, value, color = ANCIENT.text }: { label: string; value: string; color?: string }): React.ReactElement {
  return (
    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
      <div className="text-xs" style={{ color: ANCIENT.secondary }}>
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ResultRow({ label, value, color }: { label: string; value: string; color: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: ANCIENT.secondary }}>{label}</span>
      <span className="font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

/** 本单结果卡片（接待后展示；5a 3.4：若有故事标签则上方渲染接待叙事） */
export function ResultCard({ result }: { result: HandleGuestResult }): React.ReactElement {
  // 按 guestId 查当前客人（接待后仍留在 guests 数组，handled=true）
  const guest = useTangManagerStore((s) => s.guests.find((g) => g.id === result.guestId));
  const shopType = useTangManagerStore((s) => s.shopType);
  const playerName = useTangManagerStore((s) => s.player?.name);
  const day = useTangManagerStore((s) => s.day);
  const [receptionVisible, setReceptionVisible] = useState(true);

  // 接待叙事上下文（3.4）：guest.storyTag 存在时构建；AI 只读展示，不参与数值
  const tagDef = guest?.storyTag ? findStoryTag(guest.storyTag) : undefined;
  const shopTypeName = shopType ?? 'jiulou';
  const receptionContext: NarrationContext | null =
    guest && guest.storyTag
      ? {
          type: 'reception',
          shopName: shopDisplayName(shopTypeName),
          shopType: getShopType(shopTypeName).name,
          playerName: playerName ?? '掌柜',
          day,
          reception: {
            guestName: guest.name,
            guestTypeLabel: GUEST_TYPE_LABEL[guest.type],
            storyTag: guest.storyTag,
            sceneHint: tagDef?.sceneHint,
            clue: tagDef?.clue,
          },
        }
      : null;

  return (
    <AncientCard title="本单结果">
      {receptionVisible && receptionContext && (
        <AiNarration context={receptionContext} onClose={() => setReceptionVisible(false)} />
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cell label="收益" value={formatMoney(result.income)} color={result.income > 0 ? ANCIENT.primary : ANCIENT.text} />
        <Cell label="精力消耗" value={`-${result.energyConsumed}`} color={ANCIENT.secondary} />
        <Cell
          label="声望变动"
          value={result.reputationChange === 0 ? '0' : `${result.reputationChange > 0 ? '+' : ''}${result.reputationChange}`}
          color={result.reputationChange >= 0 ? ANCIENT.primary : ANCIENT.accent}
        />
        <Cell
          label="评分变动"
          value={result.scoreChange === 0 ? '0' : formatDelta(result.scoreChange)}
          color={result.scoreChange >= 0 ? ANCIENT.primary : ANCIENT.accent}
        />
      </div>
      {result.mentalOS && (
        <p className="mt-2 rounded-md px-3 py-2 text-xs leading-relaxed" style={{ backgroundColor: '#EAF3EA', color: ANCIENT.primary }}>
          心声：{result.mentalOS}
        </p>
      )}
      {result.review === 'bad' && (
        <p className="mt-2 text-xs" style={{ color: ANCIENT.accent }}>
          客人拂袖而去，此单记为差评（结算时评分 -0.02）。
        </p>
      )}
      <p className="mt-2 text-xs" style={{ color: ANCIENT.border }}>
        本单收益将随打烊结算统一入账。
      </p>
    </AncientCard>
  );
}

/** 结算面板（打烊后展示；次日已自动开张） */
export function SettlementCard({ settlement }: { settlement: DaySettlement }): React.ReactElement {
  // 成就叙事：已收起 id 集合（关闭即隐藏，仅隐藏叙事卡，不隐藏成就徽章）
  const [hiddenAch, setHiddenAch] = useState<string[]>([]);
  const shopType = useTangManagerStore((s) => s.shopType);
  const playerName = useTangManagerStore((s) => s.player?.name);
  const shopTypeName = shopType ?? 'jiulou';

  const achievementContexts = (settlement.newlyUnlocked ?? [])
    .filter((id) => !hiddenAch.includes(id))
    .map((id): { id: string; context: NarrationContext } | null => {
      const a = ACHIEVEMENT_MAP[id];
      if (!a) {
        return null;
      }
      return {
        id,
        context: {
          type: 'achievement',
          shopName: shopDisplayName(shopTypeName),
          shopType: getShopType(shopTypeName).name,
          playerName: playerName ?? '掌柜',
          day: settlement.day,
          achievement: { name: a.name, description: a.description },
        },
      };
    })
    .filter((x): x is { id: string; context: NarrationContext } => x !== null);

  return (
    <AncientCard accent={ANCIENT.primary} title={`第 ${settlement.day} 日结算`}>
      <div className="flex flex-col gap-1.5">
        <ResultRow label="基础收益" value={`+${formatMoney(settlement.baseIncome)}`} color={ANCIENT.primary} />
        <ResultRow label="客单消费" value={`+${formatMoney(settlement.guestIncome)}`} color={ANCIENT.primary} />
        <ResultRow label="当日支出" value={`-${formatMoney(settlement.expenses)}`} color={ANCIENT.accent} />
        <div className="my-1 border-t" style={{ borderColor: ANCIENT.border }} />
        <ResultRow
          label="净收益"
          value={`${settlement.netIncome >= 0 ? '+' : ''}${formatMoney(settlement.netIncome)}`}
          color={settlement.netIncome >= 0 ? ANCIENT.primary : ANCIENT.accent}
        />
        <ResultRow label="评分变动" value={formatDelta(settlement.scoreChange)} color={settlement.scoreChange >= 0 ? ANCIENT.primary : ANCIENT.accent} />
        <ResultRow label="声望变动" value={formatDelta(settlement.reputationChange)} color={settlement.reputationChange >= 0 ? ANCIENT.primary : ANCIENT.accent} />
        <ResultRow label="小二好感" value={formatDelta(settlement.xiaoerFavorChange)} color={settlement.xiaoerFavorChange >= 0 ? ANCIENT.primary : ANCIENT.accent} />
        <ResultRow label="精力消耗" value={`${settlement.energyConsumed}`} color={ANCIENT.secondary} />
      </div>
      {settlement.gamblingLine && (
        <p className="mt-2 rounded-md px-3 py-2 text-xs leading-relaxed" style={{ backgroundColor: '#F6EAE4', color: ANCIENT.accent }}>
          {settlement.gamblingLine}
        </p>
      )}
      {settlement.newlyUnlocked && settlement.newlyUnlocked.length > 0 && (
        <div className="mt-3 rounded-lg px-3 py-2" style={{ backgroundColor: '#EAF3EA', border: `1px solid ${ANCIENT.primary}` }}>
          <div className="text-xs font-bold tracking-widest" style={{ color: ANCIENT.primary }}>
            新成就解锁
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {settlement.newlyUnlocked.map((id) => {
              const a = ACHIEVEMENT_MAP[id];
              return (
                <span key={id} className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: ANCIENT.primary, color: '#FFFFFF' }}>
                  {a ? a.name : id}
                </span>
              );
            })}
          </div>
          {achievementContexts.map(({ id, context }) => (
            <AiNarration
              key={id}
              context={context}
              onClose={() => setHiddenAch((h) => [...h, id])}
            />
          ))}
        </div>
      )}
      <p className="mt-3 text-xs tracking-widest" style={{ color: ANCIENT.gold }}>
        —— 次日已自动开张，请接待新客 ——
      </p>
    </AncientCard>
  );
}
