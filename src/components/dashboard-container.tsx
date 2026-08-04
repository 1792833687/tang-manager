/**
 * 经营看板容器（体验优化 · 模块二双视图分离）
 * 固定高 calc(100vh-200px) + overflow-y-auto 只渲染当前面板；
 * 顶部面板标题 + 底部「返回经营」（竹青边框小号）。
 * 面板切换时子组件卸载重挂 → 各面板内部 useState 天然清空（无需额外处理，注释说明）。
 */
'use client';
import type { ReactNode } from 'react';
import { ANCIENT } from '@/theme/tokens';

interface DashboardContainerProps {
  /** 顶部面板标题（如「货架 · 陆记酒楼」） */
  title: string;
  /** 返回经营（切回 operations 视图） */
  onBack: () => void;
  children: ReactNode;
}

export function DashboardContainer({
  title,
  onBack,
  children,
}: DashboardContainerProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-3">
      {/* 顶部面板标题 */}
      <div
        className="flex items-center justify-between rounded-lg px-4 py-2"
        style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}
      >
        <h2 className="text-base font-bold tracking-[0.25em]" style={{ color: ANCIENT.text, fontFamily: 'var(--font-ancient-serif)' }}>
          {title}
        </h2>
        <span className="text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>
          经营看板
        </span>
      </div>

      {/* 固定高滚动区：只渲染当前面板（v1.0 面板切换淡入 200ms；key 驱动重挂清空子状态） */}
      <div
        className="overflow-y-auto rounded-xl px-1 py-1"
        style={{ height: 'calc(100vh - 200px)', minHeight: 240, scrollbarWidth: 'thin' }}
      >
        <div key={title} style={{ animation: 'fade-in 0.2s ease-out' }}>
          {children}
        </div>
      </div>

      {/* 底部返回经营 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md px-4 py-1.5 text-xs font-bold tracking-[0.3em] transition-opacity hover:opacity-80"
          style={{ color: ANCIENT.primary, border: `1px solid ${ANCIENT.primary}` }}
        >
          返回经营
        </button>
      </div>
    </div>
  );
}
