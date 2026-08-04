/**
 * 货架子面板通用弹窗（Step 5b-1.5 模块五）
 * 弹窗式（fixed overlay + 居中卡片），含标题与「作罢」关闭按钮；
 * 子面板：采买补货 / 市易务挂牌 / 庖制染织炮制 / 食盒锦匣药囊。
 */
'use client';
import type { ReactNode } from 'react';
import { ANCIENT } from '@/theme/tokens';

export function ShelfModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(44,44,44,0.45)' }}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl px-5 py-4"
        style={{ backgroundColor: ANCIENT.card, border: `2px solid ${ANCIENT.border}`, boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 12px 28px rgba(60,40,20,0.3)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <h4 className="text-base font-bold tracking-[0.2em]" style={{ color: ANCIENT.text }}>{title}</h4>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-xs" style={{ backgroundColor: ANCIENT.border, color: '#FFF' }}>作罢</button>
        </header>
        {children}
      </div>
    </div>
  );
}
