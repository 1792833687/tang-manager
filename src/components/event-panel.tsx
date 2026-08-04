/**
 * 事件面板（Step 3 3.1 / 3.8）— 古风卷轴卡片
 * - pendingEvents 非空时渲染：事件标题（大字）、描述（正文）、2-3 选项按钮；
 * - 按钮配色按 effect 性质：积极=primary 竹青 / 中立=gold 描金 / 消极=accent 朱砂；
 * - 选择后展示 consequence，点「继续」自动处理下一事件或回到经营（队列出队由 store 完成）。
 */
'use client';
import { useState } from 'react';
import { getShopType, shopDisplayName } from '@/config/tang-shop-types';
import { buildStoryNarrativeFallback } from '@/config/tang-story-templates';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { GameEventEffect, NarrationContext } from '@/types/tang-manager';
import { AiNarration } from './ai-narration';
import { AncientCard } from './ancient-card';
import { NpcPortrait, type NpcId } from './npc-portrait';

/** 选项配色：特殊效果按性质归类；数值合计 >0 积极 / <0 消极 / =0 中立 */
function choiceColor(effect: GameEventEffect): string {
  const special = effect.special;
  if (special === 'xiaoer_gone' || special === 'shen_debt' || special === 'pay_monthly_interest') {
    return ANCIENT.accent;
  }
  if (special === 'add_big_order_guest' || special === 'add_normal_guest' || special === 'shen_partner') {
    return ANCIENT.primary;
  }
  const sum =
    (effect.gold ?? 0) +
    (effect.debt !== undefined ? -effect.debt : 0) +
    (effect.score ?? 0) +
    (effect.reputation ?? 0) +
    (effect.xiaoerFavor ?? 0) +
    (effect.xiaoerSatisfaction ?? 0) +
    (effect.shenTinglanFavor ?? 0) +
    (effect.xieQiFavor ?? 0) +
    (effect.energy ?? 0);
  if (sum > 0) return ANCIENT.primary;
  if (sum < 0) return ANCIENT.accent;
  return ANCIENT.gold;
}

export function EventPanel(): React.ReactElement | null {
  const pendingEvents = useTangManagerStore((s) => s.pendingEvents);
  const player = useTangManagerStore((s) => s.player);
  const resolveEventChoice = useTangManagerStore((s) => s.resolveEventChoice);
  const showStoryNarrative = useTangManagerStore((s) => s.showStoryNarrative);
  const [resolved, setResolved] = useState<{ title: string; consequence: string; context: NarrationContext } | null>(null);
  const [narrationVisible, setNarrationVisible] = useState(true);

  const event = pendingEvents[0] ?? null;

  // 登场 NPC 立绘（按事件类型；其他事件无立绘）
  const npcId: NpcId | null =
    event?.type === 'shen_tinglan' ? 'shen-tinglan' : event?.type === 'xie_qi' ? 'xie-qi' : null;

  // 后果展示（事件已由 store 出队，本地持有 title/consequence）
  if (resolved) {
    return (
      <AncientCard accent={ANCIENT.primary} title={resolved.title}>
        <p className="text-sm leading-relaxed" style={{ color: ANCIENT.text }}>
          {resolved.consequence}
        </p>
        {narrationVisible && (
          <AiNarration context={resolved.context} onClose={() => setNarrationVisible(false)} />
        )}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setResolved(null)}
            className="min-h-11 rounded-lg px-6 py-2 text-sm font-bold tracking-[0.3em] transition-transform active:scale-[0.97]"
            style={{ backgroundColor: ANCIENT.gold, color: '#FFFFFF' }}
          >
            继续
          </button>
        </div>
      </AncientCard>
    );
  }

  if (!event) {
    return null;
  }

  const handleChoice = (choiceId: string): void => {
    const choice = event.choices.find((c) => c.id === choiceId);
    if (!choice) {
      return;
    }
    resolveEventChoice(event.id, choiceId);
    // 模块四 4.2：事件决策后弹出故事弹窗（叙事 + 数值变动；AI 不可用 → 模板兜底）
    showStoryNarrative(buildStoryNarrativeFallback(event.title, event.description, event.type, [choice.consequence]));
    // 构建叙事上下文（resolveEventChoice 已同步应用变更；AI 只读，不回写）
    const s = useTangManagerStore.getState();
    const shopType = s.shopType ?? 'jiulou';
    setNarrationVisible(true);
    setResolved({
      title: event.title,
      consequence: choice.consequence,
      context: {
        type: 'event',
        shopName: shopDisplayName(shopType),
        shopType: getShopType(shopType).name,
        playerName: s.player?.name ?? '掌柜',
        day: s.day,
        event: {
          title: event.title,
          description: event.description,
          choiceLabel: choice.label,
          consequence: choice.consequence,
        },
      },
    });
  };

  return (
    <AncientCard accent={ANCIENT.gold} title={event.title}>
      <div className="flex gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed tracking-wide" style={{ color: ANCIENT.text }}>
            {event.description}
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {event.choices.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleChoice(c.id)}
                className="min-h-11 rounded-lg px-4 py-2.5 text-sm font-bold tracking-[0.2em] transition-transform active:scale-[0.97] hover:opacity-85"
                style={{ backgroundColor: choiceColor(c.effect), color: '#FFFFFF' }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {/* 登场 NPC 立绘（桌面端展示；透明底 PNG 悬浮于描述旁） */}
        {npcId !== null && (
          <div className="hidden shrink-0 sm:block">
            <NpcPortrait
              npc={npcId}
              playerGender={player?.gender ?? 'male'}
              className="h-48 w-36 rounded-lg"
            />
          </div>
        )}
      </div>
    </AncientCard>
  );
}
