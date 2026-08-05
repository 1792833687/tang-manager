/**
 * 共享视觉层级组件（2026-08-05 视觉优化）
 * 目的：打破「千篇一律」——让主操作/关键数字/区块标题一眼可辨。
 * - ActionButton：主按钮（描金·大·投影）/ 次按钮（竹青）/ 弱按钮（描边）/ 危险（朱砂）
 * - SectionTitle：区块标题（带描金分隔线；gold 用于主区块）
 * - KeyStat：关键数字强调（金色大字）
 * 全部 ANCIENT 令牌；纯展示。
 */
'use client';
import { ANCIENT } from '@/theme/tokens';

export type ActionVariant = 'primary' | 'secondary' | 'subtle' | 'danger';

const VARIANT_STYLE: Record<ActionVariant, { bg: string; color: string; shadow: boolean; size: 'md' | 'lg' }> = {
  primary: { bg: ANCIENT.gold, color: '#FFFFFF', shadow: true, size: 'lg' },
  secondary: { bg: ANCIENT.primary, color: '#FFFFFF', shadow: false, size: 'md' },
  subtle: { bg: 'transparent', color: ANCIENT.secondary, shadow: false, size: 'md' },
  danger: { bg: ANCIENT.accent, color: '#FFFFFF', shadow: false, size: 'md' },
};

/** 主操作按钮（层级：主按钮最醒目） */
export function ActionButton({
  label,
  onClick,
  disabled = false,
  variant = 'secondary',
  fullWidth = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: ActionVariant;
  fullWidth?: boolean;
}): React.ReactElement {
  const v = VARIANT_STYLE[variant];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        'rounded-lg font-bold tracking-[0.25em] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ' +
        (v.size === 'lg' ? 'min-h-11 px-8 py-2.5 text-sm' : 'min-h-9 px-5 py-1.5 text-xs') +
        (fullWidth ? ' w-full' : '')
      }
      style={{
        backgroundColor: v.bg,
        color: v.color,
        border: variant === 'subtle' ? `1px solid ${ANCIENT.border}` : 'none',
        boxShadow: v.shadow ? `0 4px 12px rgba(212,168,67,0.45), 0 0 0 1px #8B5E3C inset` : 'none',
      }}
    >
      {label}
    </button>
  );
}

/** 区块标题（带描金分隔线；gold 用于主区块，secondary 用于次级） */
export function SectionTitle({
  children,
  tone = 'secondary',
}: {
  children: React.ReactNode;
  tone?: 'secondary' | 'gold' | 'primary';
}): React.ReactElement {
  const color = tone === 'gold' ? ANCIENT.gold : tone === 'primary' ? ANCIENT.primary : ANCIENT.secondary;
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-sm font-bold tracking-[0.25em]" style={{ color }}>{children}</span>
      <span style={{ height: 1, flex: 1, backgroundColor: color, opacity: 0.4 }} />
    </div>
  );
}

/** 关键数字强调（金色大字） */
export function KeyStat({ label, value, color = ANCIENT.gold }: { label: string; value: string; color?: string }): React.ReactElement {
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
      <div className="text-[10px] tracking-widest" style={{ color: ANCIENT.secondary }}>{label}</div>
      <div className="text-base font-extrabold" style={{ color }}>{value}</div>
    </div>
  );
}
