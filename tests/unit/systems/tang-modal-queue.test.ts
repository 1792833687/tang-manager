/**
 * 弹窗队列（打烊结算修复规格书模块一）验收测试
 * 覆盖：入队自动按优先级排序（结算<事件<成就<月度<卦象<要务）/ 同优先级保序 / 出队 / 清空。
 */
import { describe, expect, it } from 'vitest';
import { enqueueModal, dequeueModal, peekModal, clearModalQueue, makeModal } from '@/systems/tang-modal-queue';

describe('makeModal / 优先级', () => {
  it('默认优先级：结算1 < 事件2 < 成就3 < 月度4 < 卦象5 < 要务6', () => {
    expect(makeModal('settlement').priority).toBe(1);
    expect(makeModal('event').priority).toBe(2);
    expect(makeModal('achievement').priority).toBe(3);
    expect(makeModal('monthly_review').priority).toBe(4);
    expect(makeModal('hexagram').priority).toBe(5);
    expect(makeModal('daily_task').priority).toBe(6);
  });
});

describe('enqueueModal 排序', () => {
  it('乱序入队 → 按优先级升序（结算最先）', () => {
    let q: unknown[] = [];
    q = enqueueModal(q, makeModal('hexagram'));
    q = enqueueModal(q, makeModal('event'));
    q = enqueueModal(q, makeModal('settlement'));
    q = enqueueModal(q, makeModal('daily_task'));
    expect(peekModal(q)!.type).toBe('settlement');
    expect(q.map((m) => (m as { type: string }).type)).toEqual(['settlement', 'event', 'hexagram', 'daily_task']);
  });
  it('同优先级保序（事件后入的在先入之后）', () => {
    let q: unknown[] = [];
    q = enqueueModal(q, makeModal('event'));
    q = enqueueModal(q, makeModal('event'));
    expect(q.map((m) => (m as { id: string }).id)).toHaveLength(2);
    expect(peekModal(q)!.type).toBe('event');
  });
});

describe('dequeueModal / clearModalQueue', () => {
  it('出队返回队首与剩余', () => {
    let q: unknown[] = [makeModal('settlement'), makeModal('hexagram')];
    const { item, rest } = dequeueModal(q);
    expect(item!.type).toBe('settlement');
    expect(rest).toHaveLength(1);
    expect((rest[0] as { type: string }).type).toBe('hexagram');
  });
  it('空队列出队 → null', () => {
    const { item, rest } = dequeueModal([]);
    expect(item).toBeNull();
    expect(rest).toHaveLength(0);
  });
  it('清空 → []', () => {
    expect(clearModalQueue()).toEqual([]);
  });
});
