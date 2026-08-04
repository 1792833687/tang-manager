/**
 * 钱庄面板（Step 5b 模块一/二/四/六）— 主容器（v1.0 打磨：二级操作统一 modal-container）
 * - 三货币横排条状（现银/飞钱/信用）点击展开详情；
 * - 四个二级入口按钮：兑换 / 存取款 / 抵押借贷 / 投资（各自弹统一卷轴卡弹窗）；
 * - 兑换（现银↔飞钱 5% 手续费）+ 存款（月息 0.5%，优惠翻倍）+ 存款列表（可取款）；
 * - 借贷（BankLoanSection）/ 投资 + 跨店调拨（BankInvestSection）；操作按钮小号横排。
 * 铁律：本面板只调 store 纯函数 action，不直接裁决数值。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { getCreditTier } from '@/systems/tang-credit';
import { ANCIENT } from '@/theme/tokens';
import { formatMoney } from '@/lib/format-money';
import { pushActionFeedback } from './action-feedback';
import { AncientCard } from './ancient-card';
import { BankInvestSection } from './bank-invest-section';
import { BankLoanSection } from './bank-loan-section';
import { ActionButton, AmountInput, SectionLabel } from './bank-ui';
import { ModalContainer } from './modal-container';

type CurrencyBar = 'silver' | 'feiqian' | 'credit' | null;
type BankSub = 'exchange' | 'deposit' | 'loan' | 'invest' | null;

export function BankPanel(): React.ReactElement {
  const state = useTangManagerStore();
  const tier = getCreditTier(state.credit);

  const [exAmount, setExAmount] = useState(50);
  const [depAmount, setDepAmount] = useState(50);
  const [msg, setMsg] = useState('');
  const [openBar, setOpenBar] = useState<CurrencyBar>('silver');
  const [sub, setSub] = useState<BankSub>(null);

  const note = (text: string): void => setMsg(text);
  const deposits = state.deposits ?? [];

  return (
    <div className="grid gap-2">
      {/* 三货币横排条状：点击展开详情 */}
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" onClick={() => setOpenBar(openBar === 'silver' ? null : 'silver')} className="rounded-md px-2 py-1.5 text-left" style={{ backgroundColor: openBar === 'silver' ? ANCIENT.primary : ANCIENT.card, border: `1px solid ${openBar === 'silver' ? ANCIENT.primary : ANCIENT.border}` }}>
          <div className="text-[11px]" style={{ color: openBar === 'silver' ? '#FFF' : ANCIENT.secondary }}>现银</div>
          <div className="text-sm font-bold" style={{ color: openBar === 'silver' ? '#FFF' : ANCIENT.primary }}>{formatMoney(state.silver)}</div>
        </button>
        <button type="button" onClick={() => setOpenBar(openBar === 'feiqian' ? null : 'feiqian')} className="rounded-md px-2 py-1.5 text-left" style={{ backgroundColor: openBar === 'feiqian' ? ANCIENT.border : ANCIENT.card, border: `1px solid ${openBar === 'feiqian' ? ANCIENT.border : ANCIENT.border}` }}>
          <div className="text-[11px]" style={{ color: openBar === 'feiqian' ? '#FFF' : ANCIENT.secondary }}>飞钱</div>
          <div className="text-sm font-bold" style={{ color: openBar === 'feiqian' ? '#FFF' : ANCIENT.text }}>{formatMoney(state.feiqian)}</div>
        </button>
        <button type="button" onClick={() => setOpenBar(openBar === 'credit' ? null : 'credit')} className="rounded-md px-2 py-1.5 text-left" style={{ backgroundColor: openBar === 'credit' ? ANCIENT.accent : ANCIENT.card, border: `1px solid ${openBar === 'credit' ? ANCIENT.accent : ANCIENT.border}` }}>
          <div className="text-[11px]" style={{ color: openBar === 'credit' ? '#FFF' : ANCIENT.secondary }}>信用</div>
          <div className="text-sm font-bold" style={{ color: openBar === 'credit' ? '#FFF' : ANCIENT.secondary }}>{state.credit} · {tier.name}</div>
        </button>
      </div>
      {/* 展开详情 */}
      {openBar === 'silver' && (
        <div className="rounded-md px-2 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          <SectionLabel>现银详情</SectionLabel>
          <p style={{ color: ANCIENT.text }}>现银 {formatMoney(state.silver)} · 旧债 {formatMoney(state.legacyDebt)} · 月息 {formatMoney(state.monthlyInterest)}/月。可兑换飞钱、存款取息、借贷投资。</p>
        </div>
      )}
      {openBar === 'feiqian' && (
        <div className="rounded-md px-2 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          <SectionLabel>飞钱详情</SectionLabel>
          <p style={{ color: ANCIENT.text }}>飞钱 {formatMoney(state.feiqian)}（1 贯 = 1 两，等值）。专用于远程调拨/跨店，秒到账 3% 手续费。</p>
        </div>
      )}
      {openBar === 'credit' && (
        <div className="rounded-md px-2 py-1.5 text-xs" style={{ backgroundColor: ANCIENT.background, border: `1px solid ${ANCIENT.border}` }}>
          <SectionLabel>信用详情</SectionLabel>
          <p style={{ color: ANCIENT.text }}>档位「{tier.name}」（{tier.min}-{tier.max}）。特权：{tier.privileges.join('；')}。</p>
        </div>
      )}

      {/* 四个二级入口（v1.0：统一弹窗） */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <button type="button" onClick={() => setSub('exchange')} className="rounded-md px-2 py-2 text-xs font-bold tracking-widest text-white" style={{ backgroundColor: ANCIENT.primary }}>兑换</button>
        <button type="button" onClick={() => setSub('deposit')} className="rounded-md px-2 py-2 text-xs font-bold tracking-widest text-white" style={{ backgroundColor: ANCIENT.secondary }}>存取款</button>
        <button type="button" onClick={() => setSub('loan')} className="rounded-md px-2 py-2 text-xs font-bold tracking-widest text-white" style={{ backgroundColor: ANCIENT.border }}>抵押借贷</button>
        <button type="button" onClick={() => setSub('invest')} className="rounded-md px-2 py-2 text-xs font-bold tracking-widest text-white" style={{ backgroundColor: ANCIENT.gold, color: '#2C2C2C' }}>投资</button>
      </div>

      {/* 兑换弹窗 */}
      {sub === 'exchange' && (
        <ModalContainer title="兑换" onClose={() => setSub(null)}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px]" style={{ color: ANCIENT.secondary }}>兑换（手续费 5%）：</span>
              <AmountInput value={exAmount} onChange={setExAmount} />
              <ActionButton label="现银→飞钱" disabled={state.silver < exAmount || exAmount <= 0} onClick={() => { const r = state.exchangeCurrency('silver_to_feiqian', exAmount); note(r && r.ok ? `兑换成功：到账 ${formatMoney(r.actualAmount)} 飞钱（手续费 ${formatMoney(r.fee)}）` : (r?.reason ?? '兑换失败')); if (r?.ok) pushActionFeedback('兑换成功', 'success'); }} />
              <ActionButton label="飞钱→现银" disabled={state.feiqian < exAmount || exAmount <= 0} onClick={() => { const r = state.exchangeCurrency('feiqian_to_silver', exAmount); note(r && r.ok ? `兑换成功：到账 ${formatMoney(r.actualAmount)} 现银（手续费 ${formatMoney(r.fee)}）` : (r?.reason ?? '兑换失败')); if (r?.ok) pushActionFeedback('兑换成功', 'success'); }} />
            </div>
            {msg && <div className="rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.text }}>{msg}</div>}
          </div>
        </ModalContainer>
      )}

      {/* 存取款弹窗 */}
      {sub === 'deposit' && (
        <ModalContainer title="存取款" onClose={() => setSub(null)}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px]" style={{ color: ANCIENT.secondary }}>存款（月息 0.5%{state.depositRateBoostDays ? '，优惠翻倍' : ''}）：</span>
              <AmountInput value={depAmount} onChange={setDepAmount} />
              <ActionButton label="存入钱庄" disabled={state.silver < depAmount || depAmount <= 0} onClick={() => { const r = state.depositToBank(depAmount); note(r && r.ok ? '存款成功' : (r?.reason ?? '存款失败')); }} />
            </div>
            {deposits.length > 0 && (
              <div className="flex flex-col gap-1">
                <SectionLabel>我的存款</SectionLabel>
                {deposits.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-md px-2 py-1 text-xs" style={{ backgroundColor: ANCIENT.background }}>
                    <span style={{ color: ANCIENT.secondary }}>存 {formatMoney(d.amount)} · 第 {d.depositDay} 日 · 已计息 {formatMoney(d.interestAccrued ?? 0)}</span>
                    <ActionButton subtle label="取出" onClick={() => { const r = state.withdrawFromBank(d.id); note(r ? `取出 ${formatMoney(r.total)}（本金 ${formatMoney(r.principal)} + 利息 ${formatMoney(r.interest)}）` : '取款失败'); if (r) pushActionFeedback('取款成功', 'success'); }} />
                  </div>
                ))}
              </div>
            )}
            {msg && <div className="rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.text }}>{msg}</div>}
          </div>
        </ModalContainer>
      )}

      {/* 抵押借贷弹窗 */}
      {sub === 'loan' && (
        <ModalContainer title="抵押借贷" onClose={() => setSub(null)} showConfirm={false}>
          <BankLoanSection onNote={note} />
          {msg && <div className="mt-2 rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.text }}>{msg}</div>}
        </ModalContainer>
      )}

      {/* 投资弹窗 */}
      {sub === 'invest' && (
        <ModalContainer title="投资" onClose={() => setSub(null)} showConfirm={false}>
          <BankInvestSection onNote={note} />
          {msg && <div className="mt-2 rounded px-3 py-2 text-xs" style={{ backgroundColor: ANCIENT.card, border: `1px solid ${ANCIENT.gold}`, color: ANCIENT.text }}>{msg}</div>}
        </ModalContainer>
      )}
    </div>
  );
}
