/**
 * TANG-POLISH-001 模块四：通知系统 — 排队/去重/清除验收测试
 *
 * 验证 points（stores/tang-notification.ts + components/notification-toast.tsx）：
 * 1. push 入队：id 自动生成、类型/标题/内容透传
 * 2. 最多 3 条排队：超出丢弃最旧（MAX_TOASTS=3）
 * 3. dismiss 按 id 移除
 * 4. clear 清空
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useTangNotificationStore, MAX_TOASTS } from '../../../src/stores/tang-notification';

describe('TANG-POLISH-001 模块四：通知系统', () => {
  beforeEach(() => {
    useTangNotificationStore.getState().clear();
  });

  it('push 入队：自动生成 id，字段透传', () => {
    const { push } = useTangNotificationStore.getState();
    push({ type: 'info', title: '测试通知', content: '内容' });
    const n = useTangNotificationStore.getState().notifications[0];
    expect(n).toBeDefined();
    expect(n.id).toMatch(/^tang-notify-/);
    expect(n.type).toBe('info');
    expect(n.title).toBe('测试通知');
    expect(n.content).toBe('内容');
  });

  it('最多 3 条排队：超出丢弃最旧', () => {
    const { push } = useTangNotificationStore.getState();
    push({ type: 'info', title: '第1条' });
    push({ type: 'success', title: '第2条' });
    push({ type: 'warning', title: '第3条' });
    push({ type: 'error', title: '第4条' });
    const list = useTangNotificationStore.getState().notifications;
    expect(list.length).toBe(MAX_TOASTS);
    expect(list.map((n) => n.title)).toEqual(['第2条', '第3条', '第4条']);
  });

  it('dismiss 按 id 移除', () => {
    const { push, dismiss } = useTangNotificationStore.getState();
    push({ type: 'info', title: '待移除' });
    const id = useTangNotificationStore.getState().notifications[0].id;
    dismiss(id);
    expect(useTangNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('clear 清空全部', () => {
    const { push, clear } = useTangNotificationStore.getState();
    push({ type: 'info', title: 'A' });
    push({ type: 'unlock', title: 'B' });
    clear();
    expect(useTangNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('onClick 透传（toast 点击跳转）', () => {
    const { push } = useTangNotificationStore.getState();
    let clicked = false;
    push({ type: 'unlock', title: '跳转', onClick: () => { clicked = true; } });
    const n = useTangNotificationStore.getState().notifications[0];
    expect(typeof n.onClick).toBe('function');
    n.onClick?.();
    expect(clicked).toBe(true);
  });
});
