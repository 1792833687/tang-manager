/**
 * 钱庄面板 — 借贷区（Step 5b 模块二/三）
 * 抵押借贷（月息 2%）/ 高利贷（月息 10%，需谢七登场）+ 贷款列表（可还款）。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { pushActionFeedback } from './action-feedback';
import { AncientCard } from './ancient-card';
import { ActionButton, AmountInput, SectionLabel } from './bank-ui';
import { DangerConfirm } from './danger-confirm';

export function BankLoanSection({ onNote }: { onNote: (text: string) => void }): React.ReactElement {
  const state = useTangManagerStore();
  const [loanAmount, setLoanAmount] = useState(100);
  const [confirm, setConfirm] = useState<'mortgage' | 'usury' | null>(null);
  const xieOk = state.xieQiFavor > 0;
  const activeLoans = (state.loans ?? []).filter((l) => l.status !== 'paid');
  // 内容深化 TANG-CONT-D 模块八：循环借贷 offer
  const revolvingOffer = state.revolvingLoanOffer;

  return (
    <AncientCard title="借贷">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <AmountInput value={loanAmount} onChange={setLoanAmount} />
          <ActionButton
            label="抵押借贷（月息 2%）"
            disabled={loanAmount <= 0}
            onClick={() => setConfirm('mortgage')}
          />
          <ActionButton
            label="高利贷（月息 10%）"
            disabled={!xieOk || loanAmount <= 0}
            onClick={() => setConfirm('usury')}
          />
          {!xieOk && <span className="text-xs" style={{ color: ANCIENT.accent }}>（需谢七登场）</span>}
        </div>
        {/* 内容深化 TANG-CONT-D 模块八：循环借贷 offer（还清抵押贷款后钱庄提供；可拒绝不影响关系） */}
        {revolvingOffer && (
          <div className="rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.gold}` }}>
            <div style={{ color: ANCIENT.text }}>
              钱庄掌柜捋着胡子：「掌柜的信用好，本庄愿再借 {formatMoney(revolvingOffer.amount)} 两，月息 {(revolvingOffer.interestRate * 100).toFixed(0)}%。」
            </div>
            <div className="mt-2 flex gap-2">
              <ActionButton
                subtle
                label="借了"
                onClick={() => {
                  const r = state.acceptRevolvingLoan();
                  onNote(r && r.ok ? `循环借贷：借到 ${formatMoney(r.loan?.amount ?? 0)}（月息 ${Math.round((r.loan?.interestRate ?? 0) * 100)}%）` : (r?.reason ?? '借贷失败'));
                  if (r?.ok) pushActionFeedback('循环借贷成功', 'success');
                }}
              />
              <ActionButton
                subtle
                label="作罢"
                onClick={() => {
                  state.declineRevolvingLoan();
                  onNote('你婉拒了钱庄的循环借贷，掌柜笑着点点头，并不见怪。');
                }}
              />
            </div>
          </div>
        )}
        {activeLoans.length > 0 && (
          <div className="flex flex-col gap-1">
            <SectionLabel>我的贷款</SectionLabel>
            {activeLoans.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm" style={{ backgroundColor: ANCIENT.background }}>
                <span style={{ color: ANCIENT.secondary }}>
                  {l.type === 'usury' ? '高利贷' : '抵押借贷'} {formatMoney(l.amount)} · 月息 {(l.interestRate * 100).toFixed(0)}%
                  {l.overdueMonths ? ` · 逾期 ${l.overdueMonths} 月` : ''}
                </span>
                <ActionButton
                  subtle
                  label="还款"
                  onClick={() => {
                    const r = state.repayLoan(l.id);
                    onNote(r && r.ok ? `还清 ${formatMoney(r.total)}（本金 ${formatMoney(r.principal)} + 利息 ${formatMoney(r.interest)}）` : (r?.reason ?? '还款失败'));
                    if (r?.ok) pushActionFeedback('还款完成', 'success');
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 抵押借贷二次确认（朱砂红风险提示） */}
      {confirm === 'mortgage' && (
        <DangerConfirm
          title="抵押借贷"
          risk={`借 ${formatMoney(loanAmount)}，月息 2%（${formatMoney(loanAmount * 0.02)}/月）。以「店铺」为抵押，逾期将被没收。不可撤销，请慎重。`}
          onConfirm={() => {
            const r = state.takeMortgageLoan(loanAmount, 'shop');
            onNote(r && r.ok ? `借到 ${formatMoney(r.loan?.amount ?? 0)}（抵押：店铺）` : (r?.reason ?? '借贷失败'));
            if (r?.ok) pushActionFeedback('借贷成功', 'success');
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {/* 高利贷二次确认（朱砂红风险提示） */}
      {confirm === 'usury' && (
        <DangerConfirm
          title="高利贷"
          risk={`借 ${formatMoney(loanAmount)}，月息 10%（${formatMoney(loanAmount * 0.1)}/月），利滚利极快。逾期将被谢七讨债，不可撤销，请慎重。`}
          confirmLabel="借高利贷"
          onConfirm={() => {
            const r = state.takeUsuryLoan(loanAmount);
            onNote(r && r.ok ? `谢七替你搭线，借到 ${formatMoney(r.loan?.amount ?? 0)}` : (r?.reason ?? '借贷失败'));
            if (r?.ok) pushActionFeedback('借贷成功', 'success');
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </AncientCard>
  );
}
