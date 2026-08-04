/**
 * 陆家遗命单测（TANG-ADD-001 模块四）
 * 覆盖：4 遗命触发条件、前置完成推进、完成判定、奖励解锁下一个。
 */
import { describe, expect, it } from 'vitest';
import { LEGACY_QUESTS } from '@/config/tang-legacy-quests';
import {
  checkLegacyQuestCompletion,
  checkLegacyQuestTrigger,
  legacyQuestTriggerMet,
} from '@/systems/tang-legacy-quests';
import type { LegacyQuestState } from '@/systems/tang-legacy-quests';

const baseState: LegacyQuestState = {
  day: 120,
  silver: 10000,
  reputation: 600,
  legacyDebt: 0,
  factionRelationship: 80,
  clueIds: ['persian_jade'],
  visitedNodes: ['sang_yuan'],
  hasGoneBroke: false,
  completedLegacyQuests: [],
  activeLegacyQuestId: null,
};

describe('legacyQuestTriggerMet · 触发条件', () => {
  it('赎回西市分号：金<5000 或声望<400 不满足', () => {
    const quest = LEGACY_QUESTS.find((q) => q.id === 'legacy-west-shop')!;
    expect(legacyQuestTriggerMet(quest, { ...baseState, silver: 4999 })).toBe(false);
    expect(legacyQuestTriggerMet(quest, { ...baseState, reputation: 399 })).toBe(false);
    expect(legacyQuestTriggerMet(quest, { ...baseState, silver: 5000, reputation: 400 })).toBe(true);
  });

  it('寻找波斯故人：无 persian_jade 线索或西市<60 不满足', () => {
    const quest = LEGACY_QUESTS.find((q) => q.id === 'legacy-persian')!;
    expect(legacyQuestTriggerMet(quest, { ...baseState, clueIds: [] })).toBe(false);
    expect(legacyQuestTriggerMet(quest, { ...baseState, factionRelationship: 59 })).toBe(false);
    expect(legacyQuestTriggerMet(quest, { ...baseState, clueIds: ['persian_jade'], factionRelationship: 60 })).toBe(true);
  });

  it('三年之约：day<90 或破产过不满足', () => {
    const quest = LEGACY_QUESTS.find((q) => q.id === 'legacy-three-years')!;
    expect(legacyQuestTriggerMet(quest, { ...baseState, day: 89 })).toBe(false);
    expect(legacyQuestTriggerMet(quest, { ...baseState, hasGoneBroke: true })).toBe(false);
    expect(legacyQuestTriggerMet(quest, { ...baseState, day: 90, hasGoneBroke: false })).toBe(true);
  });
});

describe('checkLegacyQuestTrigger · 清晨触发', () => {
  it('全条件满足 → 返回首个未完成遗命（赎回西市分号）', () => {
    const quest = checkLegacyQuestTrigger(baseState);
    expect(quest?.id).toBe('legacy-west-shop');
  });

  it('已有激活遗命 → 不触发新遗命', () => {
    const quest = checkLegacyQuestTrigger({ ...baseState, activeLegacyQuestId: 'legacy-west-shop' });
    expect(quest).toBeNull();
  });

  it('已完成的遗命跳过：完成 west-shop 后 → 下一个是 persian', () => {
    const state: LegacyQuestState = { ...baseState, completedLegacyQuests: ['legacy-west-shop'] };
    const quest = checkLegacyQuestTrigger(state);
    expect(quest?.id).toBe('legacy-persian');
  });

  it('前置未满足（west-shop 未完成且条件未达成）→ 后续遗命均不提前触发', () => {
    // silver=0 使 west-shop 无法触发；persian/sang-yuan/three-years 的自身条件虽满足，
    // 但 requiresQuest 前置未完成 → 全部跳过 → null
    const state: LegacyQuestState = { ...baseState, silver: 0, reputation: 0 };
    const quest = checkLegacyQuestTrigger(state);
    expect(quest).toBeNull();
  });

  it('前置链推进：west-shop 完成后 → 下一个是 persian（即使自身条件早满足）', () => {
    const state: LegacyQuestState = { ...baseState, completedLegacyQuests: ['legacy-west-shop'] };
    const quest = checkLegacyQuestTrigger(state);
    expect(quest?.id).toBe('legacy-persian');
  });

  it('条件不满足 → 返回 null', () => {
    const quest = checkLegacyQuestTrigger({ ...baseState, day: 1, silver: 0, reputation: 0, visitedNodes: [], clueIds: [] });
    expect(quest).toBeNull();
  });
});

describe('checkLegacyQuestCompletion · 完成推进', () => {
  it('当前激活遗命条件达成 → 返回完成', () => {
    const active = LEGACY_QUESTS.find((q) => q.id === 'legacy-west-shop')!;
    const done = checkLegacyQuestCompletion(baseState, active);
    expect(done?.id).toBe('legacy-west-shop');
  });

  it('无激活遗命 → null', () => {
    expect(checkLegacyQuestCompletion(baseState, null)).toBeNull();
    expect(checkLegacyQuestCompletion(baseState, undefined)).toBeNull();
  });

  it('未达成 → null', () => {
    const active = LEGACY_QUESTS.find((q) => q.id === 'legacy-west-shop')!;
    expect(checkLegacyQuestCompletion({ ...baseState, silver: 100 }, active)).toBeNull();
  });

  it('已完成的遗命不重复完成', () => {
    const active = LEGACY_QUESTS.find((q) => q.id === 'legacy-west-shop')!;
    const done = checkLegacyQuestCompletion({ ...baseState, completedLegacyQuests: ['legacy-west-shop'] }, active);
    expect(done).toBeNull();
  });
});

describe('遗命配置 · 奖励与推进', () => {
  it('4 遗命全量：reward 与 nextQuest 逐字', () => {
    expect(LEGACY_QUESTS).toHaveLength(4);
    const map = Object.fromEntries(LEGACY_QUESTS.map((q) => [q.id, q]));
    expect(map['legacy-west-shop']!.reward.unlockShop).toBe(true);
    expect(map['legacy-west-shop']!.reward.unlockSign).toBe(true);
    expect(map['legacy-west-shop']!.nextQuest).toBe('legacy-persian');
    expect(map['legacy-persian']!.reward.specialRoute).toBe(true);
    expect(map['legacy-persian']!.reward.rareGoods).toBe(true);
    expect(map['legacy-sang-yuan']!.reward.silkSelfProduce).toBe(true);
    expect(map['legacy-three-years']!.reward.shenInvite).toBe(true);
    expect(map['legacy-three-years']!.reward.reputation).toBe(100);
  });
});
