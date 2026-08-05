/**
 * 《我在唐朝当掌柜》弹窗队列管理器（2026-08-05 · 打烊结算修复规格书模块一）
 * 目的：打烊时结算/事件/成就/月度总结/次日卦象/要务不再堆叠，按优先级逐一弹出。
 * 纯函数：入队自动按 priority 升序（数值小先弹）；同优先级按入队顺序（稳定）。
 */
export type ModalType = 'settlement' | 'event' | 'achievement' | 'monthly_review' | 'hexagram' | 'daily_task';

export interface ModalItem {
  id: string;
  type: ModalType;
  /** 越小越先弹出 */
  priority: number;
  /** 弹窗所需数据（按 type 读取 store 字段） */
  data?: unknown;
  title?: string;
}

/** 弹窗优先级定义（规格书 1.2） */
export const MODAL_PRIORITY: Record<ModalType, number> = {
  settlement: 1,
  event: 2,
  achievement: 3,
  monthly_review: 4,
  hexagram: 5,
  daily_task: 6,
};

let seq = 0;
function nextId(type: ModalType): string {
  seq += 1;
  return `modal-${type}-${seq}`;
}

/** 构造弹窗项（自动带 id 与默认优先级） */
export function makeModal(type: ModalType, data?: unknown, title?: string): ModalItem {
  return { id: nextId(type), type, priority: MODAL_PRIORITY[type], data, title };
}

/** 入队并稳定排序（priority 升序；同优先级保序） */
export function enqueueModal(list: readonly ModalItem[], item: ModalItem): ModalItem[] {
  const next = [...list, item];
  next.sort((a, b) => (a.priority === b.priority ? 0 : a.priority - b.priority));
  return next;
}

/** 队首（不移除） */
export function peekModal(list: readonly ModalItem[]): ModalItem | null {
  return list.length > 0 ? list[0]! : null;
}

/** 出队：返回 [队首, 剩余队列] */
export function dequeueModal(list: readonly ModalItem[]): { item: ModalItem | null; rest: ModalItem[] } {
  if (list.length === 0) return { item: null, rest: [] };
  return { item: list[0]!, rest: list.slice(1) };
}

/** 清空 */
export function clearModalQueue(): ModalItem[] {
  return [];
}
