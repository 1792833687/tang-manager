/**
 * AI 对话选项面板（2026-08-06 · 规格书模块一 6.1）
 * 展示 AI 需求分析 + 3 个策略选项（品质金/性价比绿/冒险紫），点击回传选择。
 * 纯展示组件；选项由上层调用 generateDialogueOptions 生成（AI 或兜底模板）。
 */
'use client';
import { ANCIENT } from '@/theme/tokens';
import type { AIDialogueOptions } from '@/systems/tang-ai-dialogue';

const STRATEGY_COLOR: Record<string, string> = {
  以质取胜: '#D4A843',
  以实相待: '#4A7C59',
  投其所好: '#7C5CBF',
};

export function DialogueOptionsPanel({ data, onPick, disabled }: { data: AIDialogueOptions; onPick: (idx: number) => void; disabled?: boolean }): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-xl px-3 py-2 text-xs leading-5" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${ANCIENT.gold}` }}>
        客情分析：{data.guestAnalysis}
      </p>
      <div className="flex flex-col gap-1.5">
        {data.options.map((o, i) => (
          <button key={i} type="button" disabled={disabled} onClick={() => onPick(i)} className="rounded-xl px-3 py-2 text-left text-xs transition-transform active:scale-[0.98] disabled:opacity-50" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${STRATEGY_COLOR[o.strategy] ?? ANCIENT.border}`, borderLeft: `4px solid ${STRATEGY_COLOR[o.strategy] ?? ANCIENT.border}` }}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold" style={{ color: STRATEGY_COLOR[o.strategy] ?? ANCIENT.text }}>{o.strategy}</span>
              <span style={{ color: ANCIENT.secondary }}>估 {o.estimatedPrice}两 · 成 {o.estimatedSuccessRate}%</span>
            </div>
            <div className="mt-1 leading-5" style={{ color: ANCIENT.text }}>{o.text}</div>
            <div className="mt-0.5 text-[10px]" style={{ color: ANCIENT.accent }}>风险：{o.risk}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
