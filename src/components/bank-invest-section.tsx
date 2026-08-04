/**
 * 钱庄面板 — 投资区 + 跨店调拨（Step 5b 模块四/一）
 * 投资三选（商会基金/沈听澜合作/地下钱庄，按解锁条件灰显）+ 持有投资列表 + 跨店调拨（需 2 店）。
 */
'use client';
import { useMemo, useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { pushActionFeedback } from './action-feedback';
import { AncientCard } from './ancient-card';
import { ActionButton, AmountInput, SectionLabel } from './bank-ui';
import { DangerConfirm } from './danger-confirm';

const PERIOD_LABEL: Record<'guild' | 'shen' | 'underground', string> = {
  guild: '30 天',
  shen: '45 天',
  underground: '15 天',
};

const INVEST_LABEL: Record<'guild' | 'shen' | 'underground', string> = {
  guild: '商会基金',
  shen: '沈听澜合作',
  underground: '地下钱庄',
};

const INVEST_RISK: Record<'guild' | 'shen' | 'underground', string> = {
  guild: '本金投入商会基金，30 天到期；若商会经营不善，本金可能受损。期间不可取出。',
  shen: '本金投入沈听澜合作，45 天到期；合作收益波动较大，本金存在风险。期间不可取出。',
  underground: '本金投入地下钱庄，15 天到期；地下钱庄风险极高，本金可能血本无归。',
};

export function BankInvestSection({ onNote }: { onNote: (text: string) => void }): React.ReactElement {
  const state = useTangManagerStore();
  const [investAmount, setInvestAmount] = useState(100);
  const [confirmInvest, setConfirmInvest] = useState<'guild' | 'shen' | 'underground' | null>(null);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const shenOk = state.shenTinglanFavor >= 40;
  const xieOk = state.xieQiFavor > 0;
  const transferOk = (state.shopCount ?? 1) >= 2;
  const investments = useMemo(() => (state.investments ?? []).filter((i) => i.status === 'active'), [state.investments]);

  return (
    <>
      <AncientCard title="投资">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <AmountInput value={investAmount} onChange={setInvestAmount} />
            <ActionButton
              label="商会基金（≥100，30天）"
              disabled={investAmount < 100 || state.silver < investAmount}
              onClick={() => setConfirmInvest('guild')}
            />
            <ActionButton
              label="沈听澜合作（≥200，45天）"
              disabled={!shenOk || investAmount < 200 || state.silver < investAmount}
              onClick={() => setConfirmInvest('shen')}
            />
            <ActionButton
              label="地下钱庄（≥50，15天）"
              disabled={!xieOk || investAmount < 50 || state.silver < investAmount}
              onClick={() => setConfirmInvest('underground')}
            />
          </div>
          {!shenOk && <span className="text-xs" style={{ color: ANCIENT.secondary }}>沈听澜合作需好感≥40</span>}
          {!xieOk && <span className="text-xs" style={{ color: ANCIENT.secondary }}>地下钱庄需谢七登场且好感≥30</span>}
          {investments.length > 0 && (
            <div className="flex flex-col gap-1">
              <SectionLabel>持有投资（预期回报 / 到期日）</SectionLabel>
              {investments.map((inv) => (
                <div key={inv.id} className="rounded-md px-3 py-1.5 text-sm" style={{ backgroundColor: ANCIENT.background }}>
                  <span style={{ color: ANCIENT.secondary }}>
                    {INVEST_LABEL[inv.type]} {formatMoney(inv.amount)} · 预期 {(inv.expectedReturn * 100).toFixed(1)}% · {PERIOD_LABEL[inv.type]}后到期
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </AncientCard>

      <AncientCard title="跨店调拨">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs" style={{ color: ANCIENT.secondary }}>
            飞钱秒到账（3% 费）／现银 1-3 天（10% 被劫）：
          </span>
          <AmountInput value={investAmount} onChange={setInvestAmount} />
          <ActionButton
            label="飞钱调拨"
            disabled={!transferOk || state.feiqian < investAmount || investAmount <= 0}
            onClick={() => {
              const r = state.interShopTransfer(investAmount, true);
              onNote(r && r.ok ? `调拨成功：分店到账 ${r.actualAmount} 飞钱` : (r?.reason ?? '调拨失败'));
            }}
          />
          <ActionButton
            label="现银调拨"
            disabled={!transferOk || state.silver < investAmount || investAmount <= 0}
            onClick={() => setConfirmTransfer(true)}
          />
          {!transferOk && <span className="text-xs" style={{ color: ANCIENT.secondary }}>（需至少 2 家店铺）</span>}
        </div>
      </AncientCard>

      {/* 投资二次确认（朱砂红风险提示） */}
      {confirmInvest !== null && (
        <DangerConfirm
          title={`投资 · ${INVEST_LABEL[confirmInvest]}`}
          risk={`投入 ${formatMoney(investAmount)}：${INVEST_RISK[confirmInvest]}`}
          confirmLabel={`投入 ${formatMoney(investAmount)}`}
          onConfirm={() => {
            const r = state.invest(confirmInvest, investAmount);
            onNote(r && r.ok ? `已投入${INVEST_LABEL[confirmInvest]}` : (r?.reason ?? '投资失败'));
            if (r?.ok) pushActionFeedback('投资成功', 'success');
          }}
          onClose={() => setConfirmInvest(null)}
        />
      )}
      {/* 现银调拨二次确认（10% 被劫风险） */}
      {confirmTransfer && (
        <DangerConfirm
          title="现银调拨"
          risk={`调拨 ${formatMoney(investAmount)} 现银至分店，押送 1-3 天，途中有 10% 概率遭劫血本无归。`}
          confirmLabel="押送调拨"
          onConfirm={() => {
            const r = state.interShopTransfer(investAmount, false);
            onNote(r && r.ok ? (r.robbed ? '押送途中遭劫，血本无归！' : `调拨成功：分店到账 ${r.actualAmount} 现银`) : (r?.reason ?? '调拨失败'));
          }}
          onClose={() => setConfirmTransfer(false)}
        />
      )}
    </>
  );
}
