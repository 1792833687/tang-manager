/**
 * 高风险操作二次确认（v1.0 打磨 TANG-POLISH-001 模块三；danger-confirm）
 * 甲方规格：古风卷轴卡 + 朱砂红风险提示 + 「照此办理」竹青 /「作罢」灰。
 * 覆盖 7 项高风险操作：抵押借贷 / 高利贷 / 三类投资 / 现银调拨 / 再开一局。
 * 与 modal-container 同风格（统一弹窗体系），但强调风险语义：
 * 顶部朱砂红「⚠ 慎重」章 + 风险说明 + 二次按钮（朱砂红确认替代竹青）。
 * 不持有游戏状态；由调用方传入 title/desc/onConfirm。
 */
'use client';
import type { ReactNode } from 'react';
import { ANCIENT } from '@/theme/tokens';

interface DangerConfirmProps {
  /** 弹窗标题（如「抵押借贷」） */
  title: string;
  /** 风险说明（朱砂红区；明确不可逆/代价） */
  risk: string;
  /** 确认按钮文案（默认「照此办理」） */
  confirmLabel?: string;
  /** 确认回调（执行真正操作） */
  onConfirm: () => void;
  /** 关闭 */
  onClose: () => void;
  /** 附加正文（可选，如操作参数摘要） */
  children?: ReactNode;
}

export function DangerConfirm({
  title,
  risk,
  confirmLabel = '照此办理',
  onConfirm,
  onClose,
  children,
}: DangerConfirmProps): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(44,44,44,0.5)', animation: 'fade-in 0.2s ease-out' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden"
        style={{
          backgroundColor: ANCIENT.card,
          border: `2px solid ${ANCIENT.accent}`,
          borderRadius: 8,
          boxShadow: `0 0 0 1px ${ANCIENT.gold} inset, 0 12px 28px rgba(60,40,20,0.35)`,
          animation: 'modal-slide-up 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题 + 朱砂红风险章 */}
        <header
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: `1px solid ${ANCIENT.border}` }}
        >
          <h4 className="text-base font-bold tracking-[0.2em]" style={{ color: ANCIENT.text, fontFamily: 'var(--font-ancient-serif)' }}>
            {title}
          </h4>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white"
            style={{ backgroundColor: ANCIENT.accent }}
          >
            ⚠ 慎重
          </span>
        </header>

        {/* 风险说明（朱砂红区） */}
        <div className="px-4 py-3">
          <div
            className="rounded-md px-3 py-2 text-xs leading-relaxed"
            style={{ backgroundColor: '#FBEAE6', border: `1px solid ${ANCIENT.accent}`, color: ANCIENT.accent }}
          >
            {risk}
          </div>
          {children && <div className="mt-2">{children}</div>}
        </div>

        {/* 底部：作罢灰 / 确认朱砂红 */}
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
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="rounded-md px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: ANCIENT.accent }}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
