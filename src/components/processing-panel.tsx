/**
 * 庖制染织炮制面板（Step 5b-1.5 模块五 processing-panel）
 * 三店型配方（古风命名 + 术语注释）；原料库存是否充足；耗时/费用；「开工」。
 * 虚耗品（柴火/染料/金线/棉花/药引）直接耗银两替代库存（工程决策，注释）。
 */
'use client';
import { useMemo, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { getProcessingRecipes, materialValue, processFee, VIRTUAL_CONSUMABLE_COST } from '@/systems/tang-processing';
import { formatMoney } from '@/lib/format-money';
import { triggerTutorial } from '@/systems/tang-tutorial-triggers';
import { ModalContainer } from './modal-container';

export function ProcessingPanel({ onClose }: { onClose: () => void }): React.ReactElement {
  const shopType = useTangManagerStore((s) => s.shopType ?? 'jiulou');
  const shopItems = useTangManagerStore((s) => s.shopItems);
  const silver = useTangManagerStore((s) => s.silver);
  const startProcessing = useTangManagerStore((s) => s.startProcessing);
  const [msg, setMsg] = useState('');
  const recipes = useMemo(() => getProcessingRecipes(shopType), [shopType]);

  const enough = (name: string, qty: number): boolean => {
    const it = shopItems.find((x) => x.name === name);
    return !!it && it.stock >= qty;
  };

  const onStart = (recipeId: string): void => {
    const r = startProcessing(recipeId);
    // 新手引导（TANG-TUT-002）：首次加工 → FIRST_PROCESSING
    if (r && r.ok) triggerTutorial('FIRST_PROCESSING');
    setMsg(r && r.ok ? '已开工，成品数日后入库。' : (r?.reason ?? '开工失败'));
  };

  return (
    <ModalContainer title="庖制 · 染织 · 炮制" onClose={onClose} showConfirm={false}>
      <div className="flex flex-col gap-2">
        {recipes.map((r) => {
          const value = materialValue(r, shopItems);
          const fee = processFee(r, shopItems);
          const consumCost = (r.consumables ?? []).reduce((s, c) => s + c.quantity * (VIRTUAL_CONSUMABLE_COST[c.itemName] ?? 0), 0);
          const allEnough = r.inputs.every((i) => enough(i.itemName, i.quantity));
          const totalDeduct = Math.round((fee + consumCost) * 100) / 100;
          return (
            <div key={r.id} className="rounded px-3 py-2 text-sm" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: ANCIENT.text }}>{r.name}</span>
                <span className="text-xs" style={{ color: ANCIENT.secondary }}>{r.note}</span>
              </div>
              <div className="mt-1 text-xs" style={{ color: ANCIENT.secondary }}>
                原料：{r.inputs.map((i) => `${i.itemName}×${i.quantity}`).join('、') || '无'}
                {r.consumables.length > 0 && <>（虚耗 {r.consumables.map((c) => `${c.itemName}×${c.quantity}`).join('、')}）</>}
                {' '}→ {r.output.name}×{r.output.quantity}
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span style={{ color: allEnough ? ANCIENT.primary : ANCIENT.accent }}>
                  {allEnough ? '原料充足' : '原料不足'} · 加工 {r.days} 日 · 费 {formatMoney(totalDeduct)}（原料价 {formatMoney(value)} × 5%）
                </span>
                <button type="button" onClick={() => onStart(r.id)} disabled={!allEnough || silver < totalDeduct} className="rounded px-3 py-1 text-xs font-bold tracking-widest disabled:opacity-40" style={{ backgroundColor: ANCIENT.primary, color: '#FFF' }}>
                  开工
                </button>
              </div>
            </div>
          );
        })}
        {msg && <div className="rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.text }}>{msg}</div>}
      </div>
    </ModalContainer>
  );
}
