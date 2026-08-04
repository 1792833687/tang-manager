/**
 * 食盒锦匣药囊面板（Step 5b-1.5 模块五 assemble-panel）
 * 组合配方（古风命名 + 首次术语注释）；所含商品与原价组合价对比；「备料组合」。
 * 食盒：唐代富商宴请常用，提前数日向酒楼定制；锦匣：婚嫁生辰所用，以织锦包裹布匹绸缎；
 * 药囊：唐代入秋后有佩药囊之风，以锦囊盛装名贵药材。
 */
'use client';
import { useMemo, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { getAssembleRecipes, assembleMaterialValue, assembleSeasonalMultiplier } from '@/systems/tang-processing';
import { formatMoney } from '@/lib/format-money';
import { triggerTutorial } from '@/systems/tang-tutorial-triggers';
import { ModalContainer } from './modal-container';

export function AssemblePanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const shopType = useTangManagerStore((s) => s.shopType ?? 'jiulou');
  const shopItems = useTangManagerStore((s) => s.shopItems);
  const day = useTangManagerStore((s) => s.day);
  const createAssemble = useTangManagerStore((s) => s.createAssemble);
  const [msg, setMsg] = useState('');
  const recipes = useMemo(() => getAssembleRecipes(shopType), [shopType]);

  const enough = (name: string, qty: number): boolean => {
    const it = shopItems.find((x) => x.name === name);
    return !!it && it.stock >= qty;
  };

  const onAssemble = (id: string): void => {
    const r = createAssemble(id);
    // 新手引导（TANG-TUT-002）：首次组合（与加工同引导 FIRST_PROCESSING）
    if (r && r.ok) triggerTutorial('FIRST_PROCESSING');
    setMsg(r && r.ok ? `「${r.item?.name}」备料组合完成，已上货架。` : (r?.reason ?? '组合失败'));
  };

  return (
    <ModalContainer title="食盒 · 锦匣 · 药囊" onClose={onClose} showConfirm={false}>
      <div className="flex flex-col gap-2">
        {recipes.map((r) => {
          const value = assembleMaterialValue(r, shopItems);
          const price = Math.round(value * r.discount * 100) / 100;
          const seasonal = assembleSeasonalMultiplier(r, { day });
          const allEnough = r.inputs.every((i) => enough(i.itemName, i.quantity));
          return (
            <div key={r.id} className="rounded px-3 py-2 text-sm" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: ANCIENT.text }}>{r.kind} · {r.name}</span>
                <span className="text-xs" style={{ color: ANCIENT.secondary }}>{Math.round(r.discount * 100)} 折</span>
              </div>
              <div className="mt-1 text-xs" style={{ color: ANCIENT.secondary }}>
                原料：{r.inputs.map((i) => `${i.itemName}×${i.quantity}`).join('、')}
                {seasonal > 1 && <span style={{ color: ANCIENT.accent }}>（时令需求 ×{seasonal}）</span>}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span style={{ color: allEnough ? ANCIENT.primary : ANCIENT.accent }}>
                  {allEnough ? '原料充足' : '原料不足'} · 原价 {formatMoney(value)} → 组合价 {formatMoney(price)}
                </span>
                <button type="button" onClick={() => onAssemble(r.id)} disabled={!allEnough} className="rounded px-3 py-1 text-xs font-bold tracking-widest disabled:opacity-40" style={{ backgroundColor: ANCIENT.gold, color: '#2C2C2C' }}>
                  备料组合
                </button>
              </div>
              <div className="mt-1 text-xs" style={{ color: ANCIENT.secondary }}>{r.note}</div>
            </div>
          );
        })}
        {msg && <div className="rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.text }}>{msg}</div>}
      </div>
    </ModalContainer>
  );
}
