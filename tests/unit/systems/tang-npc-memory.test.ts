/**
 * NPC 双向情绪与秘密系统（v1.2 规格书模块二）验收测试
 * 覆盖：行为记忆（保留 5 条/连续计数）/ 秘密发现态度（按好感）/ 底线暴跌 / 墙头草 / 人脉链。
 */
import { describe, expect, it } from 'vitest';
import { recordInteraction, consecutiveActionCount, interactionEffects, onSecretDiscovered, onBottomLineCrossed, checkFenceSitter, standReward, referralBoost, NPC_BOTTOM_LINES } from '@/systems/tang-npc-memory';

describe('recordInteraction / consecutiveActionCount', () => {
  it('保留最近 5 条', () => {
    let list: unknown[] = [];
    for (let i = 0; i < 7; i++) list = recordInteraction(list, { day: i, actionType: 'gift_given', description: 'g' + i });
    expect(list).toHaveLength(5);
    expect((list[list.length - 1] as { description: string }).description).toBe('g6');
  });
  it('连续同类计数', () => {
    const list = [
      { day: 1, actionType: 'request_refused', description: 'a' },
      { day: 2, actionType: 'request_refused', description: 'b' },
      { day: 3, actionType: 'request_refused', description: 'c' },
    ];
    expect(consecutiveActionCount(list, 'request_refused')).toBe(3);
    expect(consecutiveActionCount(list, 'advice_taken')).toBe(0);
  });
  it('连续 3 次拒绝 → 好感上限降低；连续 3 次采纳 → 好感增益提升', () => {
    const refused = [
      { day: 1, actionType: 'request_refused', description: '' },
      { day: 2, actionType: 'request_refused', description: '' },
      { day: 3, actionType: 'request_refused', description: '' },
    ];
    const adopted = [
      { day: 1, actionType: 'advice_taken', description: '' },
      { day: 2, actionType: 'advice_taken', description: '' },
      { day: 3, actionType: 'advice_taken', description: '' },
    ];
    expect(interactionEffects(refused, 10).favorCapReduced).toBe(true);
    expect(interactionEffects(adopted, 10).favorGainBoosted).toBe(true);
  });
});

describe('onSecretDiscovered 秘密发现态度', () => {
  it('好感≥70 → trust +10；40-69 → wary -5；<40 → hostile -20', () => {
    expect(onSecretDiscovered(80).reaction).toBe('trust');
    expect(onSecretDiscovered(80).favorDelta).toBe(10);
    expect(onSecretDiscovered(50).reaction).toBe('wary');
    expect(onSecretDiscovered(50).favorDelta).toBe(-5);
    expect(onSecretDiscovered(20).reaction).toBe('hostile');
    expect(onSecretDiscovered(20).favorDelta).toBe(-20);
  });
});

describe('底线 / 墙头草 / 人脉链', () => {
  it('每个 NPC 有 1-2 条底线（规格书 2.4）', () => {
    for (const id of ['shen-tinglan', 'xie-qi', 'su_daniang', 'cheng-zhanggui', 'lu_bo']) {
      expect(NPC_BOTTOM_LINES[id].length).toBeGreaterThanOrEqual(1);
    }
  });
  it('触碰底线 → 好感暴跌 30-50', () => {
    const r = onBottomLineCrossed(() => 0.5);
    expect(r.favorDelta).toBeLessThanOrEqual(-30);
    expect(r.favorDelta).toBeGreaterThanOrEqual(-50);
  });
  it('墙头草：双高好感 → true；站队奖励 +15；人脉链苏大娘≥60 → 程掌柜 +3', () => {
    expect(checkFenceSitter(75, 75)).toBe(true);
    expect(checkFenceSitter(75, 50)).toBe(false);
    expect(standReward(10)).toBe(15);
    expect(referralBoost(65)).toBe(3);
    expect(referralBoost(40)).toBe(0);
  });
});
