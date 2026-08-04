/**
 * 宴席菜单定制面板（2026-08-06 · 规格书模块三）
 * 展示菜单（含菜品/成本）、组合评分、档位；确认进入筹备。
 * AI 生成入口预留（模块三 3.2 prompt）；当前以预设菜单 + 纯函数评分落地。
 */
'use client';
import { useMemo, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { scoreBanquetMenu, banquetTier, type MenuDish } from '@/systems/tang-banquet-scoring';
import { BANQUET_TYPES } from '@/config/tang-industry-content';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { pushActionFeedback } from '@/components/action-feedback';

const KIND_LABEL: Record<MenuDish['kind'], string> = { meat: '荤', veg: '素', soup: '汤', wine: '酒', dessert: '甜' };

export function BanquetMenuPanel(): React.ReactElement {
  const s = useTangManagerStore();
  const [type, setType] = useState('shou_yan');
  const [budget, setBudget] = useState(30);
  const [dishes, setDishes] = useState<MenuDish[]>([
    { id: 'm1', name: '红烧羊肉', kind: 'meat', cost: 6, signature: true },
    { id: 'm2', name: '糖醋鲤鱼', kind: 'meat', cost: 5 },
    { id: 'v1', name: '清炒时蔬', kind: 'veg', cost: 2 },
    { id: 's1', name: '长寿面', kind: 'veg', cost: 2 },
    { id: 'w1', name: '西市春酿', kind: 'wine', cost: 3 },
    { id: 'd1', name: '桂花糕', kind: 'dessert', cost: 1 },
  ]);
  const score = useMemo(() => scoreBanquetMenu({ dishes, banquetType: type, budget }), [dishes, type, budget]);
  const tier = banquetTier(score);
  const totalCost = dishes.reduce((sum, d) => sum + d.cost, 0);
  const tierText: Record<'great' | 'ok' | 'flawed', { text: string; color: string }> = {
    great: { text: '大获成功（声望+10）', color: ANCIENT.primary },
    ok: { text: '顺利结算', color: ANCIENT.secondary },
    flawed: { text: '有瑕疵（收益-20%）', color: ANCIENT.accent },
  };

  const toggleDish = (d: MenuDish): void => {
    setDishes((prev) => (prev.some((x) => x.id === d.id) ? prev.filter((x) => x.id !== d.id) : [...prev, d]));
  };

  const pool: MenuDish[] = [
    { id: 'p1', name: '八宝烤鸭', kind: 'meat', cost: 8, signature: true },
    { id: 'p2', name: '四喜丸子', kind: 'meat', cost: 6 },
    { id: 'p3', name: '玉带虾仁', kind: 'meat', cost: 7 },
    { id: 'p4', name: '素烧鹅', kind: 'veg', cost: 3 },
    { id: 'p5', name: '蜜汁藕片', kind: 'veg', cost: 2 },
    { id: 'p6', name: '双喜拼盘', kind: 'veg', cost: 3 },
    { id: 'p7', name: '当归老鸭汤', kind: 'soup', cost: 5 },
    { id: 'p8', name: '桂花米酒', kind: 'wine', cost: 2 },
    { id: 'p9', name: '胡麻饼', kind: 'dessert', cost: 2 },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
        <span className="text-xs" style={{ color: ANCIENT.secondary }}>宴席类型</span>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          {BANQUET_TYPES.map((b) => (<option key={b.type} value={b.type}>{b.name}</option>))}
        </select>
        <span className="text-xs" style={{ color: ANCIENT.secondary }}>预算</span>
        <input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="w-16 rounded px-1.5 py-0.5 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }} />
      </div>

      <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}` }}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold tracking-widest" style={{ color: ANCIENT.gold }}>菜单组合评分 {score}</span>
          <span className="font-bold" style={{ color: tierText[tier].color }}>{tierText[tier].text}</span>
        </div>
        <div className="mt-1 text-[11px]" style={{ color: ANCIENT.secondary }}>总成本 {formatMoney(totalCost)} / 预算 {formatMoney(budget)}（建议成本为预算 50-70%）</div>
      </div>

      <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
        <div className="text-xs font-bold tracking-[0.3em]" style={{ color: ANCIENT.secondary }}>已选菜品</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {dishes.map((d) => (
            <button key={d.id} type="button" onClick={() => toggleDish(d)} className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}>{KIND_LABEL[d.kind]}·{d.name}{d.signature ? '·招牌' : ''}</button>
          ))}
        </div>
      </div>

      <div className="rounded-xl px-3 py-2" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.border}` }}>
        <div className="text-xs font-bold tracking-[0.3em]" style={{ color: ANCIENT.secondary }}>可选菜品（点击增减）</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {pool.map((d) => (
            <button key={d.id} type="button" onClick={() => toggleDish(d)} className="rounded px-2 py-1 text-[11px]" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.text, border: `1px solid ${ANCIENT.border}` }}>{KIND_LABEL[d.kind]}·{d.name}{d.signature ? '·招牌' : ''}</button>
          ))}
        </div>
      </div>

      <button type="button" onClick={() => {
    const r = s.settleBanquetMenu({ banquetType: type, budget, score });
    pushActionFeedback('宴席开席：入账 ' + r.silverDelta + ' 两' + (r.reputationDelta ? '，声望+' + r.reputationDelta : ''), r.silverDelta >= 0 ? 'success' : 'warning');
  }} className="rounded-lg px-5 py-2 text-xs font-bold tracking-widest" style={{ backgroundColor: ANCIENT.gold, color: '#FFF' }}>确认菜单 · 开席</button>
    </div>
  );
}
