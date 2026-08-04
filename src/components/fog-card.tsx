/**
 * 迷雾覆盖卡（TANG-MIST-001 模块一；fog-card）
 * 适用于势力卡片 / NPC 信息区 / 地图点位：
 * - revealed=false：灰色遮罩 + 金色问号（呼吸动画）；hover 显示解锁条件提示；点击由父级处理。
 * - revealed=true：children 正常渲染，并带 400ms 从中心向外扩散的揭示动画（fog-reveal，clip-path）。
 * 不持有游戏状态、不参与数值裁决；纯展示。
 */
'use client';
import { ANCIENT } from '@/theme/tokens';

/** 揭示动画（中心向外扩散 400ms）与问号呼吸动画（组件内联注入，避免改全局 CSS） */
const FOG_KEYFRAMES = `
@keyframes fog-reveal {
  from { clip-path: circle(0% at 50% 50%); opacity: 0; }
  to { clip-path: circle(120% at 50% 50%); opacity: 1; }
}
@keyframes fog-question-breathe {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}
`;

interface FogCardProps {
  /** 是否已揭示；false 时渲染灰色遮罩 + 金色问号 */
  revealed: boolean;
  /** 未揭示时展示的解锁条件（hover title + 遮罩下小字） */
  condition: string;
  /** 未揭示时点击回调（可选；如选中点位/尝试探访） */
  onClick?: () => void;
  /** 已揭示时渲染的内容（未揭示时不渲染；可选） */
  children?: React.ReactNode;
  /** 未揭示时的坊间传言/悬念文案（可选；地图点位展示 hint） */
  hint?: string;
}

export function FogCard({ revealed, condition, onClick, children, hint }: FogCardProps): React.ReactElement {
  if (revealed) {
    return (
      <>
        <style>{FOG_KEYFRAMES}</style>
        <div style={{ animation: 'fog-reveal 0.4s ease-out', position: 'relative' }}>{children}</div>
      </>
    );
  }
  return (
    <>
      <style>{FOG_KEYFRAMES}</style>
      <button
        type="button"
        onClick={onClick}
        title={condition}
        className="flex w-full flex-col items-center justify-center gap-1 rounded-lg px-4 py-5 transition-transform active:scale-[0.99]"
        style={{
          backgroundColor: 'rgba(0,0,0,0.07)',
          border: `1px dashed ${ANCIENT.border}`,
          color: ANCIENT.secondary,
          cursor: onClick ? 'pointer' : 'default',
        }}
      >
        <span
          style={{
            fontSize: 26,
            lineHeight: 1,
            color: ANCIENT.gold,
            animation: 'fog-question-breathe 2s ease-in-out infinite',
          }}
        >
          ？
        </span>
        <span className="text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>
          迷雾未散
        </span>
        {hint && (
          <span className="text-[11px] leading-relaxed" style={{ color: ANCIENT.secondary }}>
            {hint}
          </span>
        )}
        <span className="text-[10px]" style={{ color: ANCIENT.secondary }}>
          {condition}
        </span>
      </button>
    </>
  );
}
