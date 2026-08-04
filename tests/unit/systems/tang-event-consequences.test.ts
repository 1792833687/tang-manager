/** 事件分支与连锁反应单测（地图与事件深化 模块二） */
import { describe, expect, it } from 'vitest';
import { addPendingConsequence, checkBehaviorTriggers, checkPendingConsequences, hasChosen, recordEvent } from '@/systems/tang-event-consequences';

function rngSeq(seq: number[]): () => number { let i = 0; return () => seq[i++ % seq.length]!; }

describe('recordEvent / hasChosen', () => {
  it('记录事件选择并判重', () => {
    const h = recordEvent([], 'neighbor-borrow', 'lend', 3, '借了粮');
    expect(h).toHaveLength(1);
    expect(hasChosen(h, 'neighbor-borrow', 'lend')).toBe(true);
    expect(hasChosen(h, 'neighbor-borrow', 'refuse')).toBe(false);
  });
});

describe('addPendingConsequence / checkPendingConsequences', () => {
  it('邻居借粮·借 → 7 天后还粮连锁', () => {
    const p = addPendingConsequence([], 'neighbor-borrow', 'lend', 5, rngSeq([0.5]));
    expect(p).toHaveLength(1);
    expect(p[0]!.consequenceEventId).toBe('neighbor-repay');
    expect(p[0]!.triggerDay).toBe(12);
    expect(p[0]!.effect?.reputation).toBe(5);
  });
  it('乞丐讨食·施舍 → 5% 概率 90 天后报恩', () => {
    expect(addPendingConsequence([], 'beggar-beg', 'give', 1, rngSeq([0]))).toHaveLength(1);
    expect(addPendingConsequence([], 'beggar-beg', 'give', 1, rngSeq([0.5]))).toHaveLength(0);
  });
  it('到期触发/未到期保留', () => {
    const p = addPendingConsequence([], 'neighbor-borrow', 'lend', 5, rngSeq([0.5]));
    const later = checkPendingConsequences(p, 11);
    expect(later.due).toHaveLength(0);
    expect(later.remaining).toHaveLength(1);
    const due = checkPendingConsequences(p, 12);
    expect(due.due).toHaveLength(1);
    expect(due.remaining).toHaveLength(0);
  });
});

describe('checkBehaviorTriggers（模块四 4.1）', () => {
  it('行为/库存/人际条件 → 候选事件', () => {
    const out = checkBehaviorTriggers({ day: 10, consecutiveFullReceptionDays: 5, daysSinceMindRead: 11, usedAllFiveMovesOnce: true, inventoryValue: 1500, maxItemStock: 60, noExpiryStreak: 8, xiaoerFavor: 55, harmonyStreak: 16, conflictStreak: 8 });
    expect(out).toContain('event-overwork');
    expect(out).toContain('event-rusty-insight');
    expect(out).toContain('event-thief-watch');
    expect(out).toContain('event-best-friends');
    expect(out).toContain('event-open-conflict');
    expect(out).toContain('event-favor-50');
  });
  it('条件不满足 → 无候选', () => {
    const out = checkBehaviorTriggers({ day: 1, consecutiveFullReceptionDays: 0, daysSinceMindRead: 1, usedAllFiveMovesOnce: false, inventoryValue: 100, maxItemStock: 5, noExpiryStreak: 1, xiaoerFavor: 10, harmonyStreak: 0, conflictStreak: 0 });
    expect(out).toHaveLength(0);
  });
});
