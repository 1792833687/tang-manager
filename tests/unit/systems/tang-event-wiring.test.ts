/**
 * 事件接线完整性测试（2026-08-05 P0 修复）
 * - checkBehaviorTriggers 返回的每个事件 id 都必须在 BEHAVIOR_EVENTS 中有定义（否则静默丢弃）
 * - 状态型新手引导仅在 playing 阶段触发（修复开局被 FIRST_GUEST 手札遮罩盖住身份面板的 bug）
 */
import { describe, expect, it } from 'vitest';
import { BEHAVIOR_EVENTS } from '@/config/tang-behavior-events';
import { checkBehaviorTriggers } from '@/systems/tang-event-consequences';
import { evaluateTutorialTriggers } from '@/systems/tang-tutorial-triggers';

describe('行为触发事件配置完整性', () => {
  it('checkBehaviorTriggers 所有候选 id 都有 BEHAVIOR_EVENTS 定义', () => {
    const cands = checkBehaviorTriggers({
      day: 30,
      consecutiveFullReceptionDays: 5,
      daysSinceMindRead: 11,
      usedAllFiveMovesOnce: true,
      inventoryValue: 1500,
      maxItemStock: 60,
      noExpiryStreak: 8,
      xiaoerFavor: 95,
      harmonyStreak: 16,
      conflictStreak: 8,
    });
    expect(cands.length).toBeGreaterThan(0);
    for (const id of cands) {
      expect(BEHAVIOR_EVENTS[id], `缺定义: ${id}`).toBeDefined();
    }
    // 关键事件都应有定义
    expect(BEHAVIOR_EVENTS['event-overwork']).toBeDefined();
    expect(BEHAVIOR_EVENTS['event-thief-watch']).toBeDefined();
    expect(BEHAVIOR_EVENTS['event-hoarding-inquiry']).toBeDefined();
    expect(BEHAVIOR_EVENTS['event-best-friends']).toBeDefined();
  });
});

describe('新手引导阶段守卫（P0 修复）', () => {
  const playingSnapshot = {
    phase: 'playing', day: 1, currentGuestIndex: 0, energy: 100, score: 1.5, reputation: 0, legacyDebt: 100,
    tutorialFlags: {}, hasNearExpiry: false, hasWeeklyTasks: false, hasEmployeeEvent: false,
  };
  it('playing 阶段 day=1 首位客人 → 触发 FIRST_GUEST', () => {
    const out = evaluateTutorialTriggers(playingSnapshot);
    expect(out).toContain('FIRST_GUEST');
  });
  it('identity 阶段（未开局）即便满足 day=1 条件也不触发（此前会误弹手札遮罩盖住开局面板）', () => {
    const out = evaluateTutorialTriggers({ ...playingSnapshot, phase: 'identity' });
    expect(out).not.toContain('FIRST_GUEST');
    expect(out).not.toContain('WELCOME');
    expect(out).toHaveLength(0);
  });
  it('shop-type / difficulty 阶段同样不触发', () => {
    for (const phase of ['shop-type', 'difficulty'] as const) {
      const out = evaluateTutorialTriggers({ ...playingSnapshot, phase });
      expect(out).toHaveLength(0);
    }
  });
});
