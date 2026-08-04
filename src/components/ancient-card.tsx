/**
 * 古风卡片容器 — 剧本模块共享 UI
 * 米白底 + 深檀边框 + 描金内框点缀 + 如意纹 9-slice 边框装饰；
 * 所有颜色引用古风令牌，不硬编码。
 */
import type { ReactNode } from 'react';
import { withBase } from '@/lib/utils/base-path';
import { ANCIENT, ANCIENT_ASSETS } from '@/theme/tokens';

interface AncientCardProps {
  children: ReactNode;
  className?: string;
  /** 卡片标题（可选） */
  title?: string;
  /** 边框主题色（默认深檀） */
  accent?: string;
}

export function AncientCard({
  children,
  className = '',
  title,
  accent = ANCIENT.border,
}: AncientCardProps): React.ReactElement {
  return (
    <section
      className={`relative rounded-xl px-4 py-5 sm:px-6 ${className}`}
      style={{
        backgroundColor: ANCIENT.card,
        border: `2px solid ${accent}`,
        boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 8px 20px rgba(60,40,20,0.12)`,
      }}
    >
      {/* 描金如意纹 9-slice 边框装饰（中间透明；border-image 渲染异常时外层 accent 边框兜底） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          border: '1px solid transparent',
          borderImage: `url(${withBase(ANCIENT_ASSETS.panelBorder)}) 60 / 20px round`,
        }}
      />
      {title !== undefined && (
        <header className="mb-4 flex items-center gap-2">
          <span style={{ width: 4, height: 20, backgroundColor: ANCIENT.gold }} />
          <h3 className="text-lg font-bold tracking-[0.2em]" style={{ color: ANCIENT.text }}>
            {title}
          </h3>
        </header>
      )}
      {children}
    </section>
  );
}
