/**
 * 统一二级弹窗容器（v1.0 打磨 TANG-POLISH-001；modal-container）
 * 甲方规格：半透明遮罩 + 中央卷轴卡（#FDF6F0 米白 + #4A7C59 竹青边框、圆角 8px）+
 * 顶部标题 + 右上圆关钮 + 正文 max-h 60vh 滚动 + 底部「照此办理」竹青 /「作罢」灰 + 动画 200ms。
 * 用途：货架（采买/市易务/籴粜契/加工/组合）、伙计（排班/学艺/交情图）、
 *       钱庄（兑换/存取款/抵押借贷/投资）、接待（留言簿）、门路（势力详情）、手札录（蛛丝马迹）等二级操作。
 * onConfirm 缺省时「照此办理」等同关闭（多数子面板内部已有具体提交按钮，注释说明）。
 * 全部 ANCIENT 令牌；不持有游戏状态。
 */
'use client';
import type { ReactNode } from 'react';
import { ANCIENT } from '@/theme/tokens';

interface ModalContainerProps {
  /** 弹窗标题（顶部） */
  title: string;
  /** 关闭（遮罩点击 / 圆关钮 / 作罢） */
  onClose: () => void;
  /** 确认按钮文案（默认「照此办理」） */
  confirmLabel?: string;
  /** 确认回调；缺省时点击等同关闭 */
  onConfirm?: () => void;
  /** 隐藏底部「照此办理」：子面板自带明确提交按钮时传 false（如加工/组合每行独立按钮） */
  showConfirm?: boolean;
  children: ReactNode;
}

export function ModalContainer({
  title,
  onClose,
  confirmLabel = '照此办理',
  onConfirm,
  showConfirm = true,
  children,
}: ModalContainerProps): React.ReactElement {
  const handleConfirm = (): void => {
    if (onConfirm) onConfirm();
    else onClose();
  };
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(44,44,44,0.45)', animation: 'fade-in 0.2s ease-out' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden"
        style={{
          backgroundColor: ANCIENT.card,
          border: `2px solid ${ANCIENT.primary}`,
          borderRadius: 8,
          boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 12px 28px rgba(60,40,20,0.3)`,
          animation: 'modal-slide-up 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题 + 右上圆关钮 */}
        <header
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: `1px solid ${ANCIENT.border}` }}
        >
          <h4
            className="text-base font-bold tracking-[0.2em]"
            style={{ color: ANCIENT.text, fontFamily: 'var(--font-ancient-serif)' }}
          >
            {title}
          </h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: ANCIENT.border }}
          >
            ×
          </button>
        </header>

        {/* 正文：max-h 60vh 滚动 */}
        <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: '60vh', scrollbarWidth: 'thin' }}>
          {children}
        </div>

        {/* 底部：作罢灰 / 照此办理竹青 */}
        <footer
          className="flex justify-end gap-2 px-4 py-2.5"
          style={{ borderTop: `1px solid ${ANCIENT.border}` }}
        >
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-1.5 text-xs font-bold tracking-widest"
            style={{ backgroundColor: ANCIENT.border, color: '#FFF' }}
          >
            作罢
          </button>
          {showConfirm && (
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-md px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: ANCIENT.primary }}
            >
              {confirmLabel}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
