/**
 * 投诉处理卡（Step 3 3.4）— 正常接待触发投诉后渲染
 * - 普通不满 2 选项：A 道歉并补偿（退该单收入、评分+0.01）/ B 强硬处理（评分额外-0.03、保持收益）；
 * - 差评师 3 选项：A 赔钱了事（扣 5-20 两）/ B 拒绝并报官（50% 官府支持带走 / 50% 不支持评分-0.3）/
 *                  C 私下威胁（需谢七登场 xieQiFavor>0，无额外人情成本）；
 * - 选择后展示 outcomeText，点「继续」回到经营（投诉基础后果消费减半/评分-0.02 已由 handleGuest 应用）。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import type { ComplaintChoice } from '@/types/tang-manager';
import { AncientCard } from './ancient-card';

function ChoiceButton({
  label,
  onClick,
  color = ANCIENT.secondary,
}: {
  label: string;
  onClick: () => void;
  color?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-11 rounded-lg px-3 py-2.5 text-sm font-bold tracking-[0.2em] transition-transform active:scale-[0.97] hover:opacity-85 md:flex-1"
      style={{ backgroundColor: color, color: '#FFFFFF' }}
    >
      {label}
    </button>
  );
}

export function ComplaintCard(): React.ReactElement | null {
  const pendingComplaint = useTangManagerStore((s) => s.pendingComplaint);
  const xieQiFavor = useTangManagerStore((s) => s.xieQiFavor);
  const resolveComplaint = useTangManagerStore((s) => s.resolveComplaint);
  const [outcome, setOutcome] = useState<{ title: string; text: string } | null>(null);

  // 处理结果展示（投诉已由 store 清除）
  if (outcome) {
    return (
      <AncientCard accent={ANCIENT.gold} title={outcome.title}>
        <p className="text-sm leading-relaxed" style={{ color: ANCIENT.text }}>
          {outcome.text}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setOutcome(null)}
            className="min-h-11 rounded-lg px-6 py-2 text-sm font-bold tracking-[0.3em] transition-transform active:scale-[0.97]"
            style={{ backgroundColor: ANCIENT.gold, color: '#FFFFFF' }}
          >
            继续
          </button>
        </div>
      </AncientCard>
    );
  }

  if (!pendingComplaint) {
    return null;
  }

  const isBad = pendingComplaint.isBadReviewer;

  const handle = (choice: ComplaintChoice): void => {
    const result = resolveComplaint(choice);
    if (result) {
      setOutcome({ title: isBad ? '差评师处理' : '投诉处理', text: result.outcomeText });
    }
  };

  return (
    <AncientCard accent={isBad ? ANCIENT.accent : ANCIENT.gold} title={isBad ? '差评师闹事' : '客人似有不满'}>
      <p className="text-sm leading-relaxed" style={{ color: ANCIENT.text }}>
        {isBad
          ? `${pendingComplaint.guestName}拍着桌子，一口咬定你的货有问题，扬言要砸了招牌——分明是惯犯。`
          : `${pendingComplaint.guestName}皱着眉头，说你这单货不地道，要讨个说法。`}
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {!isBad && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <ChoiceButton label="道歉并补偿" onClick={() => handle('apologize')} color={ANCIENT.primary} />
              <ChoiceButton label="强硬处理" onClick={() => handle('tough')} color={ANCIENT.accent} />
            </div>
            <p className="text-xs" style={{ color: ANCIENT.secondary }}>
              道歉：退本单收入、评分+0.01；强硬：评分额外-0.03、保留收益。
            </p>
          </>
        )}
        {isBad && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <ChoiceButton label="赔钱了事" onClick={() => handle('payoff')} color={ANCIENT.accent} />
              <ChoiceButton label="拒绝并报官" onClick={() => handle('report')} color={ANCIENT.secondary} />
              <ChoiceButton
                label="私下威胁"
                onClick={() => handle('threaten')}
                color={ANCIENT.primary}
              />
            </div>
            <p className="text-xs" style={{ color: ANCIENT.secondary }}>
              赔钱：扣 5-20 两；报官：50% 官府带走；私下威胁：需谢七登场{xieQiFavor > 0 ? '（可用）' : '（谢七尚未登场）'}。
            </p>
          </>
        )}
      </div>
    </AncientCard>
  );
}
