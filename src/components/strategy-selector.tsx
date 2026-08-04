/**
 * 接待策略选择器（TANG-TRF-001 模块一）
 * 三档古风按钮（用户 1.2 逐字）：
 * - 亲力亲为（all）：一律亲接（默认）
 * - 择要接待（priority）：只亲接大单/特殊，其余指派伙计
 * - 全托伙计（delegate）：一律指派伙计（收益 ×0.7~0.8、无精力消耗、不走偏好匹配）
 * 每日预设，当日生效（setReceptionStrategy）；纯展示 + store action 调用，不持有游戏状态。
 */
'use client';
import { useTangManagerStore } from '@/stores/tang-manager';
import { triggerTutorial } from '@/systems/tang-tutorial-triggers';
import { ANCIENT } from '@/theme/tokens';
import type { ReceptionStrategy } from '@/types/tang-manager';

const OPTIONS: { key: ReceptionStrategy; label: string; desc: string; color: string }[] = [
  { key: 'all', label: '亲力亲为', desc: '一律亲自接待', color: ANCIENT.primary },
  { key: 'priority', label: '择要接待', desc: '大单特殊亲接，其余指派', color: ANCIENT.gold },
  { key: 'delegate', label: '全托伙计', desc: '伙计代劳，收益七至八成', color: ANCIENT.secondary },
];

export function StrategySelector(): React.ReactElement {
  const strategy = useTangManagerStore((s) => s.receptionStrategy ?? 'all');
  const setReceptionStrategy = useTangManagerStore((s) => s.setReceptionStrategy);

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs tracking-widest" style={{ color: ANCIENT.secondary }}>
        今日接待策略（预设当日生效）
      </p>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const active = strategy === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                setReceptionStrategy(o.key);
                // 新手引导（TANG-TUT-002）：首次切换接待策略 → FIRST_STRATEGY
                triggerTutorial('FIRST_STRATEGY');
              }}
              className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-xs tracking-widest transition-transform active:scale-[0.97]"
              style={{
                backgroundColor: active ? o.color : ANCIENT.card,
                color: active ? '#FFFFFF' : ANCIENT.text,
                border: `1px solid ${active ? o.color : ANCIENT.border}`,
                boxShadow: active ? `0 0 0 1px ${ANCIENT.gold} inset` : 'none',
              }}
            >
              <span className="font-bold">{o.label}</span>
              <span className="text-[10px] opacity-80">{o.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
