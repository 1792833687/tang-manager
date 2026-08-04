/**
 * 投资到期弹窗（Step 5b 模块四）
 * 读取 store.lastInvestmentResults（checkInvestments / settleDay 打烊写入），
 * 展示每笔到期投资的金额/回报率/实际收益：
 * - 亏损（gain<0）：朱砂红 + 安抚文案
 * - 暴赚（gain≥本金 30%）：描金 + 欣喜文案
 * - 本金全损（lost）：红底警示
 * 关闭按钮调用 dismissInvestmentResults 清空（瞬时展示，不持久化）。
 */
'use client';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { AncientCard } from './ancient-card';

const TYPE_LABEL: Record<string, string> = {
  guild: '商会基金',
  shen: '沈听澜合作',
  underground: '地下钱庄',
};

function ResultRow({
  type,
  amount,
  actualReturn,
  gain,
  note,
  lost,
}: {
  type: string;
  amount: number;
  actualReturn: number;
  gain: number;
  note?: string;
  lost?: boolean;
}): React.ReactElement {
  const isLoss = gain < 0;
  const isBigWin = !isLoss && gain >= amount * 0.3;
  const color = lost ? ANCIENT.accent : isLoss ? ANCIENT.accent : isBigWin ? ANCIENT.gold : ANCIENT.primary;
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ backgroundColor: ANCIENT.background, border: `1px solid ${color}`, borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color: ANCIENT.text }}>
          {TYPE_LABEL[type] ?? type} · {formatMoney(amount)}
        </span>
        <span className="text-sm font-bold" style={{ color }}>
          {gain >= 0 ? `+${formatMoney(gain)}` : formatMoney(gain)}（回报 {(actualReturn * 100).toFixed(1)}%）
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: ANCIENT.secondary }}>
        {lost
          ? '本金全数折损。夜路走多了，终会遇见鬼——往后的账，更要当心。'
          : isLoss
            ? `${note ?? '这笔投资蚀了本。'}生意场上有盈有亏，留得青山在，不怕没柴烧。`
            : isBigWin
              ? `${note ?? '这笔投资赚得盆满钵满。'}手气正旺，掌柜的合不拢嘴。`
              : `${note ?? '投资如期分红。'}细水长流，稳扎稳打。`}
      </p>
    </div>
  );
}

export function InvestmentResult(): React.ReactElement | null {
  const results = useTangManagerStore((s) => s.lastInvestmentResults);
  const dismiss = useTangManagerStore((s) => s.dismissInvestmentResults);
  if (!results || results.length === 0) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={dismiss}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <AncientCard accent={ANCIENT.gold} title="投资到期">
          <div className="flex flex-col gap-2">
            {results.map((r) => (
              <ResultRow
                key={r.id}
                type={r.type}
                amount={r.amount}
                actualReturn={r.actualReturn}
                gain={r.gain}
                note={r.note}
                lost={r.lost}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="mt-4 w-full rounded-md py-2 text-sm font-bold tracking-widest"
            style={{ backgroundColor: ANCIENT.primary, color: '#FFFFFF' }}
          >
            收下账目
          </button>
        </AncientCard>
      </div>
    </div>
  );
}
