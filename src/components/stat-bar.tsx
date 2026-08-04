/**
 * 顶部信息栏 — 资金 / 负债 / 声望 / 精力 / 物价 卡片式展示
 * 数值全部来自 tang-manager store，颜色引用古风令牌。
 * Step 5b：新增物价指数（priceIndex + 箭头 ↑/↓/→）。
 */
'use client';
import { withBase } from '@/lib/utils/base-path';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';

interface StatItemProps {
  /** 图标文件名（public/images/icons/ 下，可选） */
  icon?: string;
  label: string;
  value: string;
  valueColor?: string;
  /** 0-100 的迷你进度条（可选，如精力） */
  ratio?: number;
  barColor?: string;
}

function StatItem({
  icon,
  label,
  value,
  valueColor = ANCIENT.text,
  ratio,
  barColor = ANCIENT.primary,
}: StatItemProps): React.ReactElement {
  return (
    <div
      className="flex-1 rounded-lg px-3 py-2 md:px-4"
      style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}
    >
      <div className="flex items-center gap-1.5 text-xs tracking-[0.25em]" style={{ color: ANCIENT.secondary }}>
        {icon !== undefined && (
          <img src={withBase(`/images/icons/${icon}.svg`)} alt="" aria-hidden loading="lazy" decoding="async" className="h-4 w-4" />
        )}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-base font-bold md:text-lg" style={{ color: valueColor }}>
        {value}
      </div>
      {ratio !== undefined && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: ANCIENT.background }}>
          <div
            style={{
              width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
              height: '100%',
              backgroundColor: barColor,
            }}
          />
        </div>
      )}
    </div>
  );
}

export function StatBar(): React.ReactElement {
  const silver = useTangManagerStore((s) => s.silver);
  const debt = useTangManagerStore((s) => s.legacyDebt);
  const reputation = useTangManagerStore((s) => s.reputation);
  const energy = useTangManagerStore((s) => s.energy);
  const priceIndex = useTangManagerStore((s) => s.priceIndex);

  // 物价档位文案与箭头（相对 1.0 基准）
  const priceLabel =
    priceIndex < 0.95 ? '物价下跌' : priceIndex > 1.05 ? '物价上涨' : '物价平稳';
  const priceArrow = priceIndex < 0.95 ? '↓' : priceIndex > 1.05 ? '↑' : '→';

  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:gap-3">
      <StatItem icon="coin" label="资金" value={formatMoney(silver)} valueColor={ANCIENT.primary} />
      <StatItem label="负债" value={formatMoney(debt)} valueColor={ANCIENT.accent} />
      <StatItem label="声望" value={`${reputation}`} valueColor={ANCIENT.secondary} />
      <StatItem icon="energy" label="精力" value={`${energy}%`} ratio={energy / 100} barColor={ANCIENT.secondary} />
      <StatItem
        label="物价"
        value={`${priceLabel} ${priceIndex.toFixed(2)} ${priceArrow}`}
        valueColor={priceIndex < 0.95 ? ANCIENT.primary : priceIndex > 1.05 ? ANCIENT.accent : ANCIENT.secondary}
      />
    </div>
  );
}
