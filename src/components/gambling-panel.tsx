/**
 * 西市赌坊弹窗（内容深化 TANG-CONT-D 模块四；gambling-panel）
 * 复用 modal-container：暗紫调（赌坊专属）、标题「西市赌坊」；
 * 内容：当前福星高照剩余 / 下注金额输入（1-100）/ 预估赔率 /
 * 福星高照×1.5 但反噬概率翻倍说明 / 谢七互动叙事 / 「下注」按钮。
 * 胜率：基础 45%、用福星高照 65%；被老板盯上后赢利抽水 10%（store 字段 gamblingSuspicion）。
 * 纯展示 + 调 store 纯函数接线；不持有游戏状态。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { pushActionFeedback } from './action-feedback';
import { ModalContainer } from './modal-container';
import { GAMBLING_MIN_BET, GAMBLING_MAX_BET } from '@/systems/tang-gambling';

/** 赌坊专属暗紫调（内联；古风令牌之外的点缀色，注释） */
const DEN_PURPLE = '#5B3A6E';
const DEN_PURPLE_DARK = '#3D2350';

export function GamblingPanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const state = useTangManagerStore();
  const placeGamblingBet = useTangManagerStore((s) => s.placeGamblingBet);
  const [amount, setAmount] = useState(10);
  const [useLuckyStar, setUseLuckyStar] = useState(false);
  const [msg, setMsg] = useState('');

  const odds = state.gamblingOdds ?? 2;
  const luckLeft = state.luckRemaining;
  const winRate = (useLuckyStar ? 0.65 : 0.45) + (state.gamblingLuckyTable ? 0.1 : 0);

  const onBet = (): void => {
    const r = placeGamblingBet(amount, useLuckyStar);
    if (!r) {
      setMsg('下注失败');
      return;
    }
    if (!r.ok) {
      setMsg(r.reason ?? '下注失败');
      pushActionFeedback(r.reason ?? '下注失败', 'warning');
      return;
    }
    setMsg(r.message);
    pushActionFeedback(r.win ? `赢 ${formatMoney(r.silverDelta)}` : `输 ${formatMoney(-r.silverDelta)}`, r.win ? 'success' : 'warning');
  };

  return (
    <ModalContainer title="西市赌坊" onClose={onClose} confirmLabel="下注" onConfirm={onBet}>
      <div className="flex flex-col gap-3 text-sm">
        {/* 谢七互动叙事 */}
        {state.gamblingEncounterMsg && (
          <div
            className="rounded px-3 py-2 text-xs leading-relaxed"
            style={{ backgroundColor: '#F3EAF7', border: `1px solid ${DEN_PURPLE}`, color: ANCIENT.text }}
          >
            {state.gamblingEncounterMsg}
          </div>
        )}
        {/* 当前赔率 + 福星高照剩余 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded px-3 py-2" style={{ backgroundColor: '#F3EAF7', border: `1px solid ${DEN_PURPLE}` }}>
            <div style={{ color: ANCIENT.secondary }}>今日赔率</div>
            <div className="mt-0.5 text-base font-bold" style={{ color: DEN_PURPLE_DARK }}>
              ×{odds.toFixed(1)}
            </div>
          </div>
          <div className="rounded px-3 py-2" style={{ backgroundColor: '#F3EAF7', border: `1px solid ${DEN_PURPLE}` }}>
            <div style={{ color: ANCIENT.secondary }}>福星高照</div>
            <div className="mt-0.5 text-base font-bold" style={{ color: ANCIENT.text }}>
              剩 {luckLeft} 次
            </div>
          </div>
        </div>
        {/* 下注金额 */}
        <div className="flex items-center gap-2">
          <span style={{ color: ANCIENT.secondary }}>下注</span>
          <input
            type="number"
            min={GAMBLING_MIN_BET}
            max={GAMBLING_MAX_BET}
            value={amount}
            onChange={(e) => setAmount(Math.max(GAMBLING_MIN_BET, Math.min(GAMBLING_MAX_BET, Number(e.target.value) || GAMBLING_MIN_BET)))}
            className="w-28 rounded px-2 py-1 text-sm"
            style={{ backgroundColor: ANCIENT.background, border: `1px solid ${DEN_PURPLE}`, color: ANCIENT.text }}
          />
          <span style={{ color: ANCIENT.secondary }}>两（{GAMBLING_MIN_BET}-{GAMBLING_MAX_BET}）</span>
        </div>
        {/* 福星高照 ×1.5 但反噬概率翻倍 */}
        <label className="flex items-center gap-2 rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          <input type="checkbox" checked={useLuckyStar} onChange={(e) => setUseLuckyStar(e.target.checked)} />
          <span style={{ color: ANCIENT.text }}>
            用福星高照（胜率 45%→65%，约 ×1.5；但被赌坊老板盯上的概率翻倍）
          </span>
        </label>
        {/* 预估 */}
        <div className="rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          <div style={{ color: ANCIENT.secondary }}>
            预估：胜率 {Math.round(winRate * 100)}%
            {state.gamblingLuckyTable && <span style={{ color: ANCIENT.accent }}>（谢七手气台 +10%）</span>}
          </div>
          <div className="mt-1 flex justify-between" style={{ color: ANCIENT.text }}>
            <span>胜得 {formatMoney(amount * odds)}</span>
            <span style={{ color: ANCIENT.accent }}>负输 {formatMoney(amount)}</span>
          </div>
          {state.gamblingSuspicion && (
            <div className="mt-1" style={{ color: ANCIENT.accent }}>
              ⚠ 赌坊老板正盯着你——赢利将被抽水 10%。
            </div>
          )}
        </div>
        {msg && <div className="rounded px-3 py-2 text-xs leading-relaxed" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.text }}>{msg}</div>}
      </div>
    </ModalContainer>
  );
}
