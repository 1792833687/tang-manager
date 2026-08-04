/**
 * 福星高照面板（Step 3 3.3）— 放在经营操作区
 * - 按钮消耗 1 次 luckRemaining，调用 store.playLuckyStar（纯函数 useLuckyStar 接线）；
 * - 展示结果卡：赢钱/负面文案/扣钱/净赢；netGain 更新 maxGamblingWin（成就「赌神在世」）；
 * - 累计达阈值（B5/C3）触发赌瘾（gamblingAddictionDays=7，打烊递减并展示剧情行）。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { LuckResult } from '@/types/tang-manager';
import { formatMoney } from '@/lib/format-money';
import { AncientCard } from './ancient-card';

export function LuckPanel(): React.ReactElement {
  const luckRemaining = useTangManagerStore((s) => s.luckRemaining);
  const playLuckyStar = useTangManagerStore((s) => s.playLuckyStar);
  const [last, setLast] = useState<LuckResult | null>(null);

  const handle = (): void => {
    const result = playLuckyStar();
    setLast(result);
  };

  return (
    <AncientCard accent={ANCIENT.gold} title="福星高照">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" style={{ color: ANCIENT.secondary }}>
          剩余 {luckRemaining} 次 · 赌一把赢 20-300 两（也可能栽跟头）
        </p>
        <button
          type="button"
          onClick={handle}
          disabled={luckRemaining <= 0}
          className="w-full min-h-11 shrink-0 rounded-lg px-5 py-2 text-sm font-bold tracking-[0.2em] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          style={{ backgroundColor: ANCIENT.accent, color: '#FFFFFF' }}
        >
          赌一把
        </button>
      </div>
      {last && (
        <div
          className="mt-3 grid grid-cols-2 gap-2 rounded-lg px-3 py-2 sm:grid-cols-4"
          style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}
        >
          <div>
            <div className="text-xs" style={{ color: ANCIENT.secondary }}>赢钱</div>
            <div className="mt-0.5 text-sm font-semibold" style={{ color: ANCIENT.primary }}>+{formatMoney(last.gain)}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: ANCIENT.secondary }}>负面</div>
            <div className="mt-0.5 text-sm font-semibold" style={{ color: ANCIENT.text }}>{last.penalty}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: ANCIENT.secondary }}>扣钱</div>
            <div className="mt-0.5 text-sm font-semibold" style={{ color: last.penaltyAmount > 0 ? ANCIENT.accent : ANCIENT.secondary }}>
              {last.penaltyAmount > 0 ? `-${formatMoney(last.penaltyAmount)}` : '0'}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: ANCIENT.secondary }}>净赢</div>
            <div className="mt-0.5 text-sm font-semibold" style={{ color: ANCIENT.primary }}>+{formatMoney(last.netGain)}</div>
          </div>
        </div>
      )}
    </AncientCard>
  );
}
