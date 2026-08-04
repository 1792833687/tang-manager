/**
 * 钱庄面板共享 UI（Step 5b；ActionButton / SectionLabel / AmountInput）
 * 供 bank-panel / bank-loan-section / bank-invest-section 复用。
 */
'use client';
import { ANCIENT } from '@/theme/tokens';

/** 操作按钮（竹青主色 + 丝绸纹理） */
export function ActionButton({
  label,
  disabled,
  onClick,
  subtle = false,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  subtle?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md px-3 py-1.5 text-xs font-bold tracking-widest transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      style={{ backgroundColor: subtle ? ANCIENT.border : ANCIENT.primary, color: '#FFFFFF' }}
    >
      {label}
    </button>
  );
}

/** 小节标题 */
export function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-2 text-sm font-bold tracking-[0.2em]" style={{ color: ANCIENT.secondary }}>
      {children}
    </div>
  );
}

/** 数量输入框 */
export function AmountInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}): React.ReactElement {
  return (
    <input
      type="number"
      min={1}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-24 rounded-md px-2 py-1 text-sm"
      style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}`, color: ANCIENT.text }}
    />
  );
}
