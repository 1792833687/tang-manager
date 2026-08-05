/**
 * 经营面板（2026-08-06 重新设计）
 * 独立固定面板，与接待面板职责分离：数据概况 + 经营策略 + 快捷功能跳转 + 午间自由行动 + 打烊。
 * 全部 ANCIENT 令牌；只读 store + 调 action。
 */
'use client';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { industryLevel } from '@/config/tang-industry-content';
import { totalVolumeOf } from '@/systems/tang-expiry';
import { triggerTutorial } from '@/systems/tang-tutorial-triggers';
import { StrategySelector } from './strategy-selector';
import { BusinessStrategySelector } from './business-strategy-selector';
import { AfternoonActions } from './afternoon-actions';
import { SectionTitle, ActionButton } from './ui-kit';
import { TANG_FEATURES } from '@/config/tang-feature-ids';
import { pushActionFeedback } from './action-feedback';

function StatCell({ label, value, color = ANCIENT.text }: { label: string; value: string; color?: string }): React.ReactElement {
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
      <div className="text-[10px]" style={{ color: ANCIENT.secondary }}>{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

const QUICK_LINKS: Array<{ key: string; label: string }> = [
  { key: 'shelf', label: '货架 · 库房' },
  { key: 'ledger', label: '账本' },
  { key: 'bank', label: '钱庄' },
  { key: 'shop', label: '店铺管理' },
  { key: 'journal', label: '手札录' },
  { key: 'map', label: '长安舆图' },
];

/** 未解锁提示（快捷跳转守卫：不跳转，弹解锁条件） */
function lockedHint(unlocked: Record<string, boolean> | undefined, key: string): string | null {
  const def = TANG_FEATURES.find((f) => f.id === key);
  if (!def || unlocked?.[key]) return null;
  return def.conditions.map((c) => c.hint).join('；');
}

export function OperationsPanel(): React.ReactElement {
  const s = useTangManagerStore();
  const handled = s.guests.filter((g) => g.handled).length;
  const todayIncome = s.guests.filter((g) => g.handled).reduce((sum, g) => sum + (g.incomeEarned ?? 0), 0);
  const used = totalVolumeOf(s.shopItems ?? []);
  const kind = s.shopType === 'buzhuang' ? 'clothier' : s.shopType === 'yaopu' ? 'herbalist' : 'tavern';
  const lv = industryLevel(kind, kind === 'tavern' ? s.tavernLevel : kind === 'clothier' ? s.clothierLevel : s.herbalistLevel);

  return (
    <div className="flex flex-col gap-3">
      {/* 数据概况 */}
      <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
        <SectionTitle>数据概况</SectionTitle>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCell label="现银" value={formatMoney(s.silver)} color={ANCIENT.gold} />
          <StatCell label="飞钱" value={formatMoney(s.feiqian)} />
          <StatCell label="负债" value={formatMoney(s.legacyDebt)} color={ANCIENT.accent} />
          <StatCell label="评分" value={s.score.toFixed(1)} color={ANCIENT.gold} />
          <StatCell label="声望" value={String(s.reputation)} color={ANCIENT.gold} />
          <StatCell label="气氛" value={String(s.shopAtmosphere ?? 50)} />
          <StatCell label="物价指数" value={(s.priceIndex ?? 1).toFixed(2)} />
          <StatCell label="今日客数" value={handled + '/' + s.guests.length} />
          <StatCell label="今日营收" value={formatMoney(todayIncome)} color={ANCIENT.primary} />
          <StatCell label="精力" value={s.energy + '%'} />
          <StatCell label="库容" value={used + '/' + s.maxStorage} />
          <StatCell label="门面" value={'Lv' + lv.level + ' ' + lv.name} color={ANCIENT.accent} />
        </div>
      </div>

      {/* 经营策略 */}
      <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
        <SectionTitle tone="gold">经营策略（当日生效）</SectionTitle>
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          <StrategySelector />
          <BusinessStrategySelector />
        </div>
      </div>

      {/* 快捷功能跳转 */}
      <div className="rounded-xl px-3 py-2.5" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
        <SectionTitle>快捷经营</SectionTitle>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {QUICK_LINKS.map((q) => (
            <button key={q.key} type="button" onClick={() => {
              const hint = lockedHint(s.unlockedFeatures, q.key);
              if (hint) { pushActionFeedback('尚未解锁：' + hint, 'warning'); return; }
              s.requestNavPanel(q.key);
            }} className="rounded-lg px-2 py-2 text-xs font-bold transition-transform active:scale-[0.97]" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}>{q.label}</button>
          ))}
        </div>
      </div>

      {/* 午间自由行动（重设计：点开二级确认弹窗再行动） */}
      <AfternoonActions />

      {/* 打烊结算 */}
      <div className="flex justify-end">
        <ActionButton label="打烊结算" variant="primary" onClick={() => { s.settleDay(); triggerTutorial('FIRST_SETTLE'); }} />
      </div>
    </div>
  );
}
