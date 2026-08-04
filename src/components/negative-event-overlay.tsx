/**
 * 负反馈事件浮层（内容深化 TANG-CONT-D 模块七/八）
 * 统一承载三类事件（按优先级展示）：
 * - pendingNegativeEvents[0]：负反馈系统事件（树大招风/集体涨薪/灾害/背叛/意外损失）
 * - framedOpen：被栽赃（京兆府差人登门；评分≥3.0 概率触发）
 * - shenDebtMomentOpen：沈听澜人情债关键时机
 * 选择后展示后果文案，点「继续」进入下一条或关闭。
 * 纯展示 + 调 store 接线；不持有游戏状态。
 */
'use client';
import { useState } from 'react';
import { useTangManagerStore } from '@/stores/tang-manager';
import { ANCIENT } from '@/theme/tokens';
import { AncientCard } from './ancient-card';

/** 单事件通用展示（选项 → 后果 → 继续） */
function ChoiceFlow({
  title,
  description,
  options,
  onResolve,
}: {
  title: string;
  description: string;
  options: { id: string; label: string }[];
  onResolve: (id: string) => string;
}): React.ReactElement {
  const [resolved, setResolved] = useState<{ label: string; consequence: string } | null>(null);
  if (resolved) {
    return (
      <AncientCard accent={ANCIENT.accent} title={title}>
        <p className="text-sm leading-relaxed" style={{ color: ANCIENT.text }}>
          {resolved.consequence}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setResolved(null)}
            className="rounded-lg px-6 py-2 text-sm font-bold tracking-[0.3em]"
            style={{ backgroundColor: ANCIENT.gold, color: '#FFFFFF' }}
          >
            继续
          </button>
        </div>
      </AncientCard>
    );
  }
  return (
    <AncientCard accent={ANCIENT.accent} title={title}>
      <p className="text-sm leading-relaxed tracking-wide" style={{ color: ANCIENT.text }}>
        {description}
      </p>
      <div className="mt-5 flex flex-col gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              const consequence = onResolve(opt.id);
              setResolved({ label: opt.label, consequence });
            }}
            className="min-h-11 rounded-lg px-4 py-2.5 text-sm font-bold tracking-[0.2em] transition-transform active:scale-[0.97] hover:opacity-85"
            style={{ backgroundColor: ANCIENT.accent, color: '#FFFFFF' }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </AncientCard>
  );
}

export function NegativeEventOverlay(): React.ReactElement | null {
  const pendingNegativeEvents = useTangManagerStore((s) => s.pendingNegativeEvents ?? []);
  const framedOpen = useTangManagerStore((s) => s.framedOpen);
  const shenDebtMomentOpen = useTangManagerStore((s) => s.shenDebtMomentOpen);
  const resolveNegativeEvent = useTangManagerStore((s) => s.resolveNegativeEvent);
  const resolveFramedMoment = useTangManagerStore((s) => s.resolveFramedMoment);
  const resolveShenDebtMoment = useTangManagerStore((s) => s.resolveShenDebtMoment);
  const dismissNegativeEvent = useTangManagerStore((s) => s.dismissNegativeEvent);

  const neg = pendingNegativeEvents[0] ?? null;
  if (neg) {
    return (
      <ChoiceFlow
        title={neg.title}
        description={neg.description}
        options={neg.options.map((o) => ({ id: o.id, label: o.label }))}
        onResolve={(optId) => {
          const r = resolveNegativeEvent(neg.id, optId);
          if (r) return r.message;
          dismissNegativeEvent(neg.id);
          return '此事暂且搁置。';
        }}
      />
    );
  }
  if (framedOpen) {
    return (
      <ChoiceFlow
        title="京兆府差人登门"
        description="你正盘账，忽闻门外一阵急促的马蹄。京兆府两名差役翻身下马，面色不善：「陆掌柜，有人递了状子，说你以次充好、哄抬物价，请随我们走一趟问话。」"
        options={[
          { id: 'evidence', label: '找证据对质' },
          { id: 'payoff', label: '花钱摆平' },
          { id: 'deny', label: '死不认账' },
        ]}
        onResolve={(optId) => {
          const r = resolveFramedMoment(optId as 'evidence' | 'payoff' | 'deny');
          return r?.message ?? '府衙一行，暂且按下。';
        }}
      />
    );
  }
  if (shenDebtMomentOpen) {
    return (
      <ChoiceFlow
        title="沈听澜要你还人情"
        description="这一日，沈听澜亲自登门，品着茶慢悠悠开口：「陆掌柜，当日我替你周转的那笔人情，如今该还了吧？」他放下茶盏，目光却不容拒绝。"
        options={[
          { id: 'concede', label: '让出一笔生意' },
          { id: 'break_xie', label: '中断谢七合作' },
          { id: 'align', label: '站队沈听澜' },
          { id: 'refuse', label: '婉言推拒' },
        ]}
        onResolve={(optId) => {
          const r = resolveShenDebtMoment(optId as 'concede' | 'break_xie' | 'align' | 'refuse');
          return r?.message ?? '人情之事，暂且搁置。';
        }}
      />
    );
  }
  return null;
}
