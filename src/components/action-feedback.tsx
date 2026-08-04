/**
 * 操作结果浮层（内容深化模块三；action-feedback）
 * 轻量方案：zustand 微型 store + 全局浮动层（非弹窗）——
 * 主要操作完成后调用 pushActionFeedback('已采买','success')，
 * 在操作区上方居中浮现文字，opacity 0→1 + translateY(-5px) 入场，
 * 停留 1.5s 后淡出；绿色正向 / 朱砂红警示。
 * 不持有游戏状态、不参与数值裁决；纯展示。挂载点：scripts/tang-manager/page.tsx。
 */
'use client';
import { create } from 'zustand';
import { ANCIENT } from '@/theme/tokens';

export type ActionFeedbackType = 'success' | 'warning';

interface FeedbackItem {
  id: number;
  msg: string;
  type: ActionFeedbackType;
}

interface ActionFeedbackState {
  items: FeedbackItem[];
  push: (msg: string, type?: ActionFeedbackType) => void;
  dismiss: (id: number) => void;
}

/** 停留 1.5s 后淡出（af-out 于 1.2s 启动、0.3s 结束） */
const DURATION = 1500;
let seq = 0;

export const useActionFeedbackStore = create<ActionFeedbackState>((set) => ({
  items: [],
  push: (msg, type = 'success') => {
    const id = ++seq;
    // 同屏最多保留 3 条（丢弃最旧），避免浮层堆叠
    set((s) => ({ items: [...s.items.slice(-2), { id, msg, type }] }));
    window.setTimeout(() => {
      set((s) => ({ items: s.items.filter((it) => it.id !== id) }));
    }, DURATION);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
}));

/** 便捷函数：组件 onClick 后直接调用（无需订阅） */
export function pushActionFeedback(msg: string, type: ActionFeedbackType = 'success'): void {
  useActionFeedbackStore.getState().push(msg, type);
}

/** React hook：返回 { push }，供组件内使用 */
export function useActionFeedback(): { push: (msg: string, type?: ActionFeedbackType) => void } {
  return { push: useActionFeedbackStore((s) => s.push) };
}

const TYPE_COLOR: Record<ActionFeedbackType, string> = {
  success: ANCIENT.primary, // 竹青（正向）
  warning: ANCIENT.accent, // 朱砂（警示）
};

/** 全局浮动层：挂在掌柜主页面；操作区上方居中 */
export function ActionFeedback(): React.ReactElement {
  const items = useActionFeedbackStore((s) => s.items);
  if (items.length === 0) return <></>;
  return (
    <div className="pointer-events-none fixed left-1/2 top-24 z-[85] flex -translate-x-1/2 flex-col items-center gap-1">
      {items.map((it) => (
        <div
          key={it.id}
          className="rounded-lg px-4 py-1.5 text-sm font-bold tracking-[0.2em]"
          style={{
            backgroundColor: ANCIENT.card,
            border: `1px solid ${TYPE_COLOR[it.type]}`,
            color: TYPE_COLOR[it.type],
            boxShadow: `0 0 0 1px ${ANCIENT.gold} inset`,
            animation: 'af-in 0.2s ease-out, af-out 0.3s ease-in 1.2s forwards',
            fontFamily: 'var(--font-ancient-serif)',
          }}
        >
          {it.msg}
        </div>
      ))}
    </div>
  );
}
