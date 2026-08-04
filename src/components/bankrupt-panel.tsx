/**
 * 破产面板（Step 3 3.6）— phase='bankrupt' 时渲染
 * - 状态说明（街头小贩）+ 已坚持天数（复用 day：day - bankruptcyStartDay）；
 * - 每日小买卖按钮（+1-3 两、day+1；15% 概率「得罪过的人找麻烦」-1 两占位）；
 * - 坚持满 10 天出现「租新铺面重新开始」按钮（score=1.0、gold=难度初始、回 playing）。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { bankruptcyDaysSurvived } from '@/systems/tang-bankruptcy';
import { getDifficultyParams } from '@/config/tang-difficulty';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { AncientCard } from './ancient-card';
import { DangerConfirm } from './danger-confirm';

export function BankruptPanel(): React.ReactElement | null {
  const phase = useTangManagerStore((s) => s.phase);
  const day = useTangManagerStore((s) => s.day);
  const bankruptcyStartDay = useTangManagerStore((s) => s.bankruptcyStartDay);
  const gold = useTangManagerStore((s) => s.gold);
  const difficulty = useTangManagerStore((s) => s.difficulty);
  const xiaoerGone = useTangManagerStore((s) => s.xiaoerGone);
  const bankruptcyDailyHustle = useTangManagerStore((s) => s.bankruptcyDailyHustle);
  const restartAfterBankruptcy = useTangManagerStore((s) => s.restartAfterBankruptcy);
  const [confirmRestart, setConfirmRestart] = useState(false);

  if (phase !== 'bankrupt') {
    return null;
  }

  const survived = bankruptcyDaysSurvived({ day, bankruptcyStartDay });
  const canRestart = survived >= 10;
  const params = getDifficultyParams(difficulty);

  return (
    <div className="flex flex-col gap-4">
      <AncientCard accent={ANCIENT.accent} title="破产 · 街头小贩">
        <p className="text-sm leading-relaxed tracking-wide" style={{ color: ANCIENT.text }}>
          店铺倒闭，你如今只能在东市墙根摆个小摊糊口。
          {xiaoerGone ? '阿昭也已另寻出路。' : '阿昭不离不弃，每日帮你张罗。'}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
            <div className="text-xs" style={{ color: ANCIENT.secondary }}>现钱</div>
            <div className="mt-0.5 text-sm font-semibold" style={{ color: ANCIENT.text }}>{formatMoney(gold)}</div>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
            <div className="text-xs" style={{ color: ANCIENT.secondary }}>已坚持</div>
            <div className="mt-0.5 text-sm font-semibold" style={{ color: ANCIENT.text }}>{survived} 天</div>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
            <div className="text-xs" style={{ color: ANCIENT.secondary }}>难度</div>
            <div className="mt-0.5 text-sm font-semibold" style={{ color: ANCIENT.text }}>{params.label}</div>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
            <div className="text-xs" style={{ color: ANCIENT.secondary }}>重启进度</div>
            <div className="mt-0.5 text-sm font-semibold" style={{ color: canRestart ? ANCIENT.primary : ANCIENT.accent }}>
              {survived} / 10 天
            </div>
          </div>
        </div>
      </AncientCard>

      <AncientCard accent={ANCIENT.gold} title="每日小买卖">
        <p className="text-xs leading-relaxed" style={{ color: ANCIENT.secondary }}>
          摆摊挣个糊口钱（+1-3 两），日复一日，攒够了本钱再谈东山再起。
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => bankruptcyDailyHustle()}
            className="w-full min-h-11 rounded-lg px-4 py-2.5 text-sm font-bold tracking-[0.2em] transition-transform active:scale-[0.97] sm:flex-1"
            style={{ backgroundColor: ANCIENT.primary, color: '#FFFFFF' }}
          >
            做一日小买卖
          </button>
          {canRestart && (
            <button
              type="button"
              onClick={() => setConfirmRestart(true)}
              className="w-full min-h-11 rounded-lg px-4 py-2.5 text-sm font-bold tracking-[0.2em] transition-transform active:scale-[0.97] sm:flex-1"
              style={{ backgroundColor: ANCIENT.gold, color: '#FFFFFF' }}
            >
              租新铺面重新开始
            </button>
          )}
        </div>
        {!canRestart && (
          <p className="mt-3 text-xs tracking-widest" style={{ color: ANCIENT.border }}>
            坚持满 10 天，方可租回新铺面（还需 {10 - survived} 天）。
          </p>
        )}
      </AncientCard>

      {/* 租新铺面二次确认（不可逆：放弃当前小贩状态） */}
      {confirmRestart && (
        <DangerConfirm
          title="租新铺面重新开始"
          risk={`将放弃当前街头小贩状态（已坚持 ${survived} 天），以 ${params.label} 难度初始资金重开新铺。不可撤销，请慎重。`}
          confirmLabel="租铺重开"
          onConfirm={() => restartAfterBankruptcy()}
          onClose={() => setConfirmRestart(false)}
        />
      )}
    </div>
  );
}
