/**
 * 预购订单面板（TANG-TRF-001 模块二；用户 2.6 逐字）
 * 接待面板「预购订单」标签页：
 * - 进行中列表按 deadline 排序；来源标签色（随机灰/沈氏金/谢七蓝/势力红）
 * - 需求清单 + 备货进度条；倒计时（≤2 天标红）；建议备货提示；定金/尾款
 * - 操作：待应「接下订单」/ 已接下「预留货品」/ 货齐「交货」（货齐才可点）
 * - 逾期红框；已交付子标签
 * 铁律：只调用 store action + 纯函数展示，不持有游戏状态。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { getOrderProgress, getSuggestedPrepTime, isOrderReady } from '@/systems/tang-preorder';
import { ANCIENT } from '@/theme/tokens';
import type { PreOrder, PreOrderSource } from '@/types/tang-manager';
import { formatMoney } from '@/lib/format-money';
import { triggerTutorial } from '@/systems/tang-tutorial-triggers';
import { pushActionFeedback } from './action-feedback';

const SOURCE_LABEL: Record<PreOrderSource, string> = {
  random: '大客',
  shen: '沈氏',
  xie: '谢七',
  faction: '势力',
};

/** 来源标签色（用户 2.6：随机灰/沈氏金/谢七蓝/势力红） */
const SOURCE_COLOR: Record<PreOrderSource, string> = {
  random: '#8A8A8A',
  shen: '#D4A843',
  xie: '#3B6FB6',
  faction: '#C0392B',
};

const STATUS_LABEL: Record<PreOrder['status'], string> = {
  pending: '待应',
  accepted: '已接下',
  ready: '货已备齐',
  delivered: '已交货',
  overdue: '逾期',
};

function OrderCard({ order }: { order: PreOrder }): React.ReactElement {
  const shopItems = useTangManagerStore((s) => s.shopItems);
  const day = useTangManagerStore((s) => s.day);
  const acceptPreOrder = useTangManagerStore((s) => s.acceptPreOrder);
  const reserveGoods = useTangManagerStore((s) => s.reserveGoods);
  const deliverOrder = useTangManagerStore((s) => s.deliverOrder);

  const progress = getOrderProgress(order);
  const ready = isOrderReady(order);
  const daysLeft = order.deadline - day;
  const isOverdue = order.status === 'overdue';
  const countdownLabel = isOverdue ? '已逾期' : daysLeft <= 0 ? '今日到期' : `余 ${daysLeft} 日`;
  const countdownRed = daysLeft <= 2 && !isOverdue;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl p-3"
      style={{
        backgroundColor: ANCIENT.card,
        border: `1px solid ${isOverdue ? ANCIENT.accent : ANCIENT.border}`,
        boxShadow: isOverdue ? `0 0 0 1px ${ANCIENT.accent} inset` : 'none',
      }}
    >
      {/* 头部：来源标签 + 客人 + 状态 + 倒计时 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded px-1.5 py-0.5 font-bold text-white" style={{ backgroundColor: SOURCE_COLOR[order.source] }}>
          {SOURCE_LABEL[order.source]}
        </span>
        <span className="font-semibold" style={{ color: ANCIENT.text }}>{order.guestName}</span>
        {order.guestIdentity && <span className="text-[10px]" style={{ color: ANCIENT.secondary }}>{order.guestIdentity}</span>}
        <span className="ml-auto flex items-center gap-2">
          <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: ANCIENT.background, color: ANCIENT.border }}>
            {STATUS_LABEL[order.status]}
          </span>
          <span className="font-bold" style={{ color: countdownRed || isOverdue ? ANCIENT.accent : ANCIENT.text }}>
            {countdownLabel}
          </span>
        </span>
      </div>

      {/* 需求清单 + 进度 */}
      <div className="flex flex-col gap-1">
        {order.items.map((it) => {
          const prep = getSuggestedPrepTime(order, it, shopItems);
          return (
            <div key={it.itemId} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between text-xs" style={{ color: ANCIENT.text }}>
                <span>{it.itemName} × {it.quantity}</span>
                <span style={{ color: ANCIENT.secondary }}>已留 {it.reserved}/{it.quantity}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: ANCIENT.border }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${it.quantity > 0 ? Math.min(100, Math.round((it.reserved / it.quantity) * 100)) : 0}%`,
                    backgroundColor: it.reserved >= it.quantity ? ANCIENT.primary : ANCIENT.gold,
                  }}
                />
              </div>
              <span className="text-[10px]" style={{ color: ANCIENT.secondary }}>{prep}</span>
            </div>
          );
        })}
      </div>

      {/* 金额 */}
      <div className="flex flex-wrap gap-x-4 text-xs" style={{ color: ANCIENT.secondary }}>
        <span>定金 {formatMoney(order.deposit)}</span>
        <span>尾款 {formatMoney(order.finalPayment)}</span>
        <span className="font-bold" style={{ color: ANCIENT.accent }}>总价 {formatMoney(order.totalValue)}</span>
      </div>

      {/* 叙事 */}
      {order.narrative && (
        <p className="text-xs leading-relaxed tracking-wide" style={{ color: ANCIENT.secondary }}>
          {order.narrative}
        </p>
      )}

      {/* 操作 */}
      <div className="flex gap-2">
        {order.status === 'pending' && (
          <button
            type="button"
            onClick={() => { acceptPreOrder(order.id); pushActionFeedback('接单成功', 'success'); triggerTutorial('FIRST_PREORDER'); }}
            className="flex-1 rounded-lg px-3 py-1.5 text-xs font-bold tracking-widest"
            style={{ backgroundColor: ANCIENT.primary, color: '#FFFFFF' }}
          >
            接下订单（收定金 {formatMoney(order.deposit)}）
          </button>
        )}
        {(order.status === 'accepted' || order.status === 'ready') && (
          <button
            type="button"
            onClick={() => reserveGoods(order.id)}
            className="flex-1 rounded-lg px-3 py-1.5 text-xs font-bold tracking-widest"
            style={{ backgroundColor: ANCIENT.secondary, color: '#FFFFFF' }}
          >
            预留货品
          </button>
        )}
        {order.status === 'ready' && (
          <button
            type="button"
            disabled={!ready}
            onClick={() => deliverOrder(order.id)}
            className="flex-1 rounded-lg px-3 py-1.5 text-xs font-bold tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: ANCIENT.gold, color: '#FFFFFF' }}
          >
            交货（收尾款 {formatMoney(order.finalPayment)}）
          </button>
        )}
        {order.status === 'overdue' && (
          <span className="flex-1 text-center text-xs font-bold tracking-widest" style={{ color: ANCIENT.accent }}>
            违约 · 已罚定金
          </span>
        )}
      </div>

      {order.status === 'accepted' && (
        <span className="text-[10px] text-right" style={{ color: ANCIENT.secondary }}>
          整体进度 {progress.reserved}/{progress.required}（还差 {progress.remaining}）
        </span>
      )}
    </div>
  );
}

export function PreorderPanel(): React.ReactElement {
  const preOrders = useTangManagerStore((s) => s.preOrders ?? []);
  const [tab, setTab] = useState<'active' | 'delivered'>('active');

  const active = preOrders
    .filter((o) => o.status !== 'delivered' && o.status !== 'overdue')
    .sort((a, b) => a.deadline - b.deadline);
  const overdue = preOrders.filter((o) => o.status === 'overdue').sort((a, b) => a.deadline - b.deadline);
  const delivered = preOrders.filter((o) => o.status === 'delivered').sort((a, b) => b.acceptedDay - a.acceptedDay);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 text-xs tracking-widest">
        <button
          type="button"
          onClick={() => setTab('active')}
          className="rounded-lg px-3 py-1.5"
          style={{
            backgroundColor: tab === 'active' ? ANCIENT.primary : ANCIENT.card,
            color: tab === 'active' ? '#FFFFFF' : ANCIENT.text,
            border: `1px solid ${ANCIENT.border}`,
          }}
        >
          进行中（{active.length + overdue.length}）
        </button>
        <button
          type="button"
          onClick={() => setTab('delivered')}
          className="rounded-lg px-3 py-1.5"
          style={{
            backgroundColor: tab === 'delivered' ? ANCIENT.primary : ANCIENT.card,
            color: tab === 'delivered' ? '#FFFFFF' : ANCIENT.text,
            border: `1px solid ${ANCIENT.border}`,
          }}
        >
          已交付（{delivered.length}）
        </button>
      </div>

      {tab === 'active' ? (
        active.length === 0 && overdue.length === 0 ? (
          <p className="rounded-xl p-4 text-sm tracking-widest" style={{ backgroundColor: ANCIENT.card, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
            尚无预购订单。大单贵客登门时，约两成会转为预购。
          </p>
        ) : (
          <>
            {active.map((o) => <OrderCard key={o.id} order={o} />)}
            {overdue.map((o) => <OrderCard key={o.id} order={o} />)}
          </>
        )
      ) : delivered.length === 0 ? (
        <p className="rounded-xl p-4 text-sm tracking-widest" style={{ backgroundColor: ANCIENT.card, color: ANCIENT.secondary, border: `1px solid ${ANCIENT.border}` }}>
          尚未交付过预购订单。
        </p>
      ) : (
        delivered.map((o) => <OrderCard key={o.id} order={o} />)
      )}
    </div>
  );
}
