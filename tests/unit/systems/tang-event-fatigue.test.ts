/** 事件疲劳度单测（地图与事件深化 模块四 4.2） */
import { describe, expect, it } from 'vitest';
import { canTriggerEvent, createEventFatigue, recordTrigger, resetConsecutive } from '@/systems/tang-event-fatigue';

describe('canTriggerEvent', () => {
  it('30 天冷却：同事件 30 天内不再触发', () => {
    let f = createEventFatigue();
    f = recordTrigger(f, 'e1', 'random', 5, false);
    expect(canTriggerEvent('e1', 'random', f, 6, false)).toBe(false);
    expect(canTriggerEvent('e1', 'random', f, 35, false)).toBe(true);
  });
  it('同类别 7 天内最多 2 次', () => {
    let f = createEventFatigue();
    f = recordTrigger(f, 'a', 'cat', 1, false);
    f = recordTrigger(f, 'b', 'cat', 2, false);
    expect(canTriggerEvent('c', 'cat', f, 3, false)).toBe(false);
    expect(canTriggerEvent('c', 'cat', f, 10, false)).toBe(true);
  });
  it('连续 3 天触发后第 4 天强制休息', () => {
    let f = createEventFatigue();
    f = recordTrigger(f, 'a', 'c1', 1, false);
    f = recordTrigger(f, 'b', 'c2', 2, false);
    f = recordTrigger(f, 'c', 'c3', 3, false);
    expect(canTriggerEvent('d', 'c4', f, 4, false)).toBe(false);
    expect(canTriggerEvent('d', 'c4', resetConsecutive(f), 4, false)).toBe(true);
  });
  it('一次性事件触发后不再重复', () => {
    let f = createEventFatigue();
    f = recordTrigger(f, 'once', 'cat', 1, true);
    expect(canTriggerEvent('once', 'cat', f, 100, true)).toBe(false);
  });
});
