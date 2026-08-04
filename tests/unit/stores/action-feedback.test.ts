/**
 * 操作结果浮层 store 单测（内容深化模块三；action-feedback）
 * 覆盖：push 入队、类型默认 success、自动 1.5s 移除、同屏最多 3 条。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useActionFeedbackStore, pushActionFeedback } from '@/components/action-feedback';

describe('action-feedback store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useActionFeedbackStore.setState({ items: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('push 入队并默认 success 类型', () => {
    pushActionFeedback('已采买');
    const items = useActionFeedbackStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]?.msg).toBe('已采买');
    expect(items[0]?.type).toBe('success');
  });

  it('可指定 warning 类型（红色警示）', () => {
    pushActionFeedback('已遣散', 'warning');
    expect(useActionFeedbackStore.getState().items[0]?.type).toBe('warning');
  });

  it('1.5s 后自动移除', () => {
    pushActionFeedback('已采买');
    expect(useActionFeedbackStore.getState().items).toHaveLength(1);
    vi.advanceTimersByTime(1499);
    expect(useActionFeedbackStore.getState().items).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useActionFeedbackStore.getState().items).toHaveLength(0);
  });

  it('同屏最多保留 3 条（丢弃最旧）', () => {
    pushActionFeedback('一');
    pushActionFeedback('二');
    pushActionFeedback('三');
    pushActionFeedback('四');
    const items = useActionFeedbackStore.getState().items;
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.msg)).toEqual(['二', '三', '四']);
  });
});
