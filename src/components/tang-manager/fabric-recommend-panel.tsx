/**
 * 布庄面料推荐面板（2026-08-06 · 规格书模块四）
 * 身份/季节/场合 → 面料匹配度（三维加权）+ 量体加成；AI 推荐入口预留。
 */
'use client';
import { useState } from 'react';
import { fabricMatchScore, fabricTier, type FabricContext } from '@/systems/tang-fabric-matching';
import { ANCIENT } from '@/theme/tokens';
import { pushActionFeedback } from '@/components/action-feedback';

const IDENTITY: Array<{ value: FabricContext['identity']; label: string }> = [
  { value: 'official', label: '官员' }, { value: 'noble', label: '贵人' }, { value: 'commoner', label: '平民' }, { value: 'merchant', label: '商贾' },
];
const SEASON: Array<{ value: string; label: string }> = [
  { value: 'spring', label: '春' }, { value: 'summer', label: '夏' }, { value: 'autumn', label: '秋' }, { value: 'winter', label: '冬' },
];
const OCCASION: Array<{ value: FabricContext['occasion']; label: string }> = [
  { value: 'wedding', label: '婚宴' }, { value: 'labor', label: '劳作' }, { value: 'formal', label: '官场' }, { value: 'casual', label: '日常' },
];
const FABRICS = ['粗布', '棉布', '丝绸', '锦缎'];

export function FabricRecommendPanel(): React.ReactElement {
  const [ctx, setCtx] = useState<FabricContext>({ identity: 'commoner', season: 'spring', occasion: 'casual', fabric: '棉布', measured: false });
  const score = fabricMatchScore(ctx);
  const tier = fabricTier(score);
  const tierText: Record<'satisfied' | 'normal' | 'refund', { text: string; color: string }> = {
    satisfied: { text: '非常满意（或触发路人围观）', color: ANCIENT.primary },
    normal: { text: '尚可', color: ANCIENT.secondary },
    refund: { text: '客人或要求重做/退款', color: ANCIENT.accent },
  };
  const set = (patch: Partial<FabricContext>): void => setCtx((prev) => ({ ...prev, ...patch }));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
          <div className="mb-1" style={{ color: ANCIENT.secondary }}>客人身份</div>
          <div className="flex flex-wrap gap-1">{IDENTITY.map((i) => (<button key={i.value} type="button" onClick={() => set({ identity: i.value })} className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ctx.identity === i.value ? ANCIENT.primary : ANCIENT.background, color: ctx.identity === i.value ? '#FFF' : ANCIENT.text }}>{i.label}</button>))}</div>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
          <div className="mb-1" style={{ color: ANCIENT.secondary }}>季节</div>
          <div className="flex flex-wrap gap-1">{SEASON.map((i) => (<button key={i.value} type="button" onClick={() => set({ season: i.value })} className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ctx.season === i.value ? ANCIENT.primary : ANCIENT.background, color: ctx.season === i.value ? '#FFF' : ANCIENT.text }}>{i.label}</button>))}</div>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
          <div className="mb-1" style={{ color: ANCIENT.secondary }}>场合</div>
          <div className="flex flex-wrap gap-1">{OCCASION.map((i) => (<button key={i.value} type="button" onClick={() => set({ occasion: i.value })} className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ctx.occasion === i.value ? ANCIENT.primary : ANCIENT.background, color: ctx.occasion === i.value ? '#FFF' : ANCIENT.text }}>{i.label}</button>))}</div>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
          <div className="mb-1" style={{ color: ANCIENT.secondary }}>面料</div>
          <div className="flex flex-wrap gap-1">{FABRICS.map((i) => (<button key={i} type="button" onClick={() => set({ fabric: i })} className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ctx.fabric === i ? ANCIENT.gold : ANCIENT.background, color: ctx.fabric === i ? '#FFF' : ANCIENT.text }}>{i}</button>))}</div>
        </div>
      </div>

      <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold" style={{ color: ANCIENT.gold }}>匹配度 {score}%</span>
          <span className="text-xs font-bold" style={{ color: tierText[tier].color }}>{tierText[tier].text}</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: ANCIENT.background }}>
          <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: score >= 80 ? ANCIENT.primary : score >= 50 ? ANCIENT.secondary : ANCIENT.accent }} />
        </div>
        <button type="button" onClick={() => { set({ measured: !ctx.measured }); pushActionFeedback(ctx.measured ? '已免去量体' : '量体完毕，合身度大增（+20%）', 'success'); }} className="mt-2 rounded px-3 py-1 text-[11px] font-bold" style={{ backgroundColor: ctx.measured ? ANCIENT.primary : ANCIENT.border, color: '#FFF' }}>{ctx.measured ? '已量体 ✓' : '量体（+20%）'}</button>
      </div>

      <button type="button" onClick={() => pushActionFeedback('已确认定制，织工即刻动工', 'success')} className="rounded-lg px-5 py-2 text-xs font-bold tracking-widest" style={{ backgroundColor: ANCIENT.gold, color: '#FFF' }}>确认定制</button>
    </div>
  );
}
