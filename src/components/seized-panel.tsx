/**
 * 被查封面板（Step 5b 模块二：抵押物 shop 没收 → phase='seized'）
 * 「夺回老店」复仇剧情占位：本面板为 simple 占位（注释说明后续可扩展复仇剧情/重开经营线）。
 * 提供「重整旗鼓」按钮回到开局（resetGame），避免玩家卡死在被查封状态。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { AncientCard } from './ancient-card';
import { DangerConfirm } from './danger-confirm';

export function SeizedPanel(): React.ReactElement {
  const resetGame = useTangManagerStore((s) => s.resetGame);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <AncientCard accent={ANCIENT.accent} title="铺面查封">
      <div className="flex flex-col gap-3 text-sm leading-relaxed" style={{ color: ANCIENT.text }}>
        <p>
          钱庄的封条还贴在门楣上，昔日的招牌已被灰土蒙住。你站在老店对面，听着街坊的窃窃私语——
          这口气，你咽不下去。
        </p>
        <p className="text-xs" style={{ color: ANCIENT.secondary }}>
          （「夺回老店」复仇剧情占位：此处预留后续剧情——赎回抵押、寻回旧部、重振门面。）
        </p>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="rounded-md px-4 py-2 text-sm font-bold tracking-widest"
          style={{ backgroundColor: ANCIENT.accent, color: '#FFFFFF' }}
        >
          重整旗鼓，从头再来
        </button>
      </div>
      {confirmReset && (
        <DangerConfirm
          title="重整旗鼓"
          risk="将放弃当前被查封的店铺，重新从家传手札开始。已解锁成就与局外成长记录会保留，但本局进度全部清零，不可撤销。"
          confirmLabel="放弃本局，从头再来"
          onConfirm={() => resetGame()}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </AncientCard>
  );
}
