/**
 * 手札占候卡片（TANG-ADD-001 模块一 · 2026-08-06 补 UI）
 * 每日清晨 drawDailyHexagram 置 hexagramCardOpen=true，此卡展示当日卦象
 * （卦名/占断/判词/当日效果）。此前仅 store 字段、无任何组件渲染（K1）。
 * 全部 ANCIENT 令牌；只读 store；点「知道了」或遮罩 dismissHexagramCard。
 */
'use client';
import { useTangManagerStore } from '@/stores/tang-manager';
import { hexagramById } from '@/config/tang-hexagrams';
import { ANCIENT } from '@/theme/tokens';
import type { HexagramEffect } from '@/types/tang-manager';

/** 卦象效果 → 古风一句（占候卡片小字） */
function effectText(effect: HexagramEffect): string {
  switch (effect.type) {
    case 'income_multiplier':
      return '今日进账 ×' + effect.value;
    case 'none':
      return '今日无惊无喜，守成即福';
    case 'guest_random':
      return '客单消费 ±' + Math.round(effect.value * 100) + '%';
    case 'cost_reduction':
      return '采买进货价 ×' + effect.value;
    case 'event_double':
      return '奇事怪闻概率 ×' + effect.value;
    case 'big_order_bonus':
      return '大单收入 +' + Math.round(effect.value * 100) + '%';
    case 'patience_decay_double':
      return '客人耐心消磨 ×' + effect.value;
    case 'praise_bonus':
      return '夸奖之声 +' + Math.round(effect.value * 100) + '%';
    default:
      return '';
  }
}

export function HexagramCard(): React.ReactElement | null {
  const open = useTangManagerStore((s) => s.hexagramCardOpen);
  const queueActive = useTangManagerStore((s) => s.currentModal !== null);
  const todayId = useTangManagerStore((s) => s.todayHexagram?.id ?? null);
  const dismiss = useTangManagerStore((s) => s.dismissHexagramCard);
  if (queueActive || !open) return null;
  const hex = todayId ? hexagramById(todayId) : null;
  if (!hex) return null;
  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', animation: 'fade-in 0.2s ease-out' }}
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl px-6 py-6 text-center"
        style={{ backgroundColor: ANCIENT.card, border: `2px solid ${ANCIENT.border}`, boxShadow: `0 0 0 1px ${hex.tagColor} inset, 0 24px 48px rgba(60,40,20,0.3)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs tracking-[0.4em]" style={{ color: ANCIENT.secondary }}>手札占候</div>
        <div className="mt-3 text-5xl font-bold" style={{ color: hex.tagColor }}>{hex.name}</div>
        <div className="mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: hex.tagColor }}>{hex.judgment}</div>
        <p className="mt-4 text-sm leading-6" style={{ color: ANCIENT.text }}>{hex.description}</p>
        <p className="mt-2 text-xs" style={{ color: ANCIENT.secondary }}>{effectText(hex.effect)}</p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-5 min-h-10 rounded-lg px-8 py-2 text-sm font-bold tracking-[0.3em]"
          style={{ backgroundColor: ANCIENT.gold, color: '#FFFFFF' }}
        >
          知道了
        </button>
      </div>
    </div>
  );
}
