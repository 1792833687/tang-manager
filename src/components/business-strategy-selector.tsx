/**
 * 经营策略选择器（内容深化 TANG-CONT-B 模块六·1）
 * 三档古风按钮（薄利多销 / 奇货可居 / 稳健经营）：
 * - 薄利多销（thin）：基础收益 ×0.8、客人数 +30%
 * - 奇货可居（rare）：基础收益 ×1.3、客人数 -30%
 * - 稳健经营（steady）：无修正
 * 当日生效（setBusinessStrategy）；结算接线见 systems/tang-settlement.ts，
 * 客流接线见 stores/tang-manager.ts startNewDay。
 * 纯展示 + store action 调用，不持有游戏状态。
 */
'use client';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { BUSINESS_STRATEGY_LABEL, BUSINESS_STRATEGY_DESC } from '@/systems/tang-business-strategy';
import type { BusinessStrategy } from '@/types/tang-manager';

const OPTIONS: { key: BusinessStrategy; color: string }[] = [
  { key: 'thin', color: ANCIENT.primary },
  { key: 'rare', color: ANCIENT.accent },
  { key: 'steady', color: ANCIENT.secondary },
];

export function BusinessStrategySelector(): React.ReactElement {
  const strategy = useTangManagerStore((s) => s.businessStrategy ?? 'steady');
  const setBusinessStrategy = useTangManagerStore((s) => s.setBusinessStrategy);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>
        经营策略（预设当日生效）
      </p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const active = strategy === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setBusinessStrategy(o.key)}
              className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-xs tracking-widest transition-transform active:scale-[0.97]"
              style={{
                backgroundColor: active ? o.color : ANCIENT.card,
                color: active ? '#FFFFFF' : ANCIENT.text,
                border: `1px solid ${active ? o.color : ANCIENT.border}`,
                boxShadow: active ? `0 0 0 1px ${ANCIENT.gold} inset` : 'none',
              }}
            >
              <span className="font-bold">{BUSINESS_STRATEGY_LABEL[o.key]}</span>
              <span className="text-[10px] opacity-80">{BUSINESS_STRATEGY_DESC[o.key]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
