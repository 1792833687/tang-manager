/**
 * 掌柜通知中心（v1.0 打磨 TANG-POLISH-001 模块四；tang-notification）
 * 轻量 zustand 纯状态 store（不持久化、不参与数值裁决）：
 * - notifications：当前队列（最多 3 条排队，超出丢弃最旧）
 * - push：入队（type 5 种：info/success/warning/error/unlock；可带 onClick 跳转）
 * - dismiss：按 id 移除
 * 供 notification-toast.tsx（右上角 3s 自动消失）与解锁提示（unlock-toast）复用。
 */
'use client';
import { create } from 'zustand';

/** 通知类型：info 讯息 / success 成就 / warning 警示 / error 风险 / unlock 解锁 */
export type TangNotificationType = 'info' | 'success' | 'warning' | 'error' | 'unlock';

export interface TangNotification {
  id: string;
  type: TangNotificationType;
  title: string;
  content?: string;
  /** 点击跳转回调（可空） */
  onClick?: () => void;
}

interface TangNotificationState {
  notifications: TangNotification[];
  push: (n: Omit<TangNotification, 'id'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

/** 最多同时排队 3 条（超出丢弃最旧） */
export const MAX_TOASTS = 3;

let seq = 0;

export const useTangNotificationStore = create<TangNotificationState>((set) => ({
  notifications: [],
  push: (n) =>
    set((s) => {
      const id = `tang-notify-${Date.now()}-${seq++}`;
      const next = [...s.notifications, { ...n, id }];
      return { notifications: next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next };
    }),
  dismiss: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  clear: () => set({ notifications: [] }),
}));
