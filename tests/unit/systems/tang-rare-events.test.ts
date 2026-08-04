/**
 * 意外之喜单测（TANG-ADD-001 模块二）
 * 覆盖：6 事件条件、概率判定、已触发跳过、坎卦事件概率×2 接线。
 */
import { describe, expect, it } from 'vitest';
import { RARE_EVENTS } from '@/config/tang-rare-events';
import { checkRareEvents, rareEventMeetsCondition } from '@/systems/tang-rare-events';
import type { RareEventState } from '@/systems/tang-rare-events';

const baseState: RareEventState = {
  reputation: 300,
  day: 120,
  legacyDebt: 0,
  factionRelationship: 80,
  xieQiFavor: 30,
  completedRareEvents: [],
};

describe('rareEventMeetsCondition · 条件判定', () => {
  it('微服私访：声望 <200 不满足；≥200 满足', () => {
    const ev = RARE_EVENTS.find((e) => e.id === 'wei-fu-si-fang')!;
    expect(rareEventMeetsCondition(ev, { ...baseState, reputation: 199 })).toBe(false);
    expect(rareEventMeetsCondition(ev, { ...baseState, reputation: 200 })).toBe(true);
  });

  it('胡商献宝：西市关系 <40 不满足', () => {
    const ev = RARE_EVENTS.find((e) => e.id === 'hu-shang-xian-bao')!;
    expect(rareEventMeetsCondition(ev, { ...baseState, factionRelationship: 39 })).toBe(false);
    expect(rareEventMeetsCondition(ev, { ...baseState, factionRelationship: 40 })).toBe(true);
  });

  it('街头偶遇：谢七未登场（xieQiFavor=0）不满足', () => {
    const ev = RARE_EVENTS.find((e) => e.id === 'jie-tou-ou-yu')!;
    expect(rareEventMeetsCondition(ev, { ...baseState, xieQiFavor: 0 })).toBe(false);
    expect(rareEventMeetsCondition(ev, { ...baseState, xieQiFavor: 1 })).toBe(true);
  });

  it('夜半来客：day<90 或负债>0 不满足', () => {
    const ev = RARE_EVENTS.find((e) => e.id === 'ye-ban-lai-ke')!;
    expect(rareEventMeetsCondition(ev, { ...baseState, day: 89 })).toBe(false);
    expect(rareEventMeetsCondition(ev, { ...baseState, legacyDebt: 1 })).toBe(false);
    expect(rareEventMeetsCondition(ev, { ...baseState, day: 90, legacyDebt: 0 })).toBe(true);
  });
});

describe('checkRareEvents · 概率与去重', () => {
  it('条件全满足 + rng=0（全命中）→ 返回 6 事件', () => {
    const triggered = checkRareEvents(baseState, () => 0);
    expect(triggered.length).toBe(6);
    expect(triggered.map((e) => e.id)).toEqual(RARE_EVENTS.map((e) => e.id));
  });

  it('已触发跳过：completedRareEvents 记录后不再触发', () => {
    const done = RARE_EVENTS.map((e) => e.triggeredKey);
    const triggered = checkRareEvents({ ...baseState, completedRareEvents: done }, () => 0);
    expect(triggered.length).toBe(0);
  });

  it('条件不满足跳过：声望低只触发无声望要求的（天降祥瑞等按 day）', () => {
    const state: RareEventState = { ...baseState, reputation: 0, factionRelationship: 0, xieQiFavor: 0, day: 90 };
    const triggered = checkRareEvents(state, () => 0);
    const ids = triggered.map((e) => e.id);
    expect(ids).toContain('gu-ren-zhi-hou');
    expect(ids).toContain('tian-jiang-xiang-rui');
    expect(ids).not.toContain('wei-fu-si-fang');
    expect(ids).not.toContain('hu-shang-xian-bao');
    expect(ids).not.toContain('jie-tou-ou-yu');
  });

  it('坎卦事件概率×2：hexagramEventChance=2 时 chance×2 命中（如微服 2%→4%）', () => {
    // 微服私访 chance=0.02：rng=0.03 时默认不命中、×2 后命中
    const state: RareEventState = { ...baseState, completedRareEvents: ['rare-hu-shang-xian-bao', 'rare-gu-ren-zhi-hou', 'rare-tian-jiang-xiang-rui', 'rare-jie-tou-ou-yu', 'rare-ye-ban-lai-ke'] };
    const defaultHit = checkRareEvents(state, () => 0.03);
    expect(defaultHit.some((e) => e.id === 'wei-fu-si-fang')).toBe(false);
    const doubleHit = checkRareEvents({ ...state, hexagramEventChance: 2 }, () => 0.03);
    expect(doubleHit.some((e) => e.id === 'wei-fu-si-fang')).toBe(true);
  });

  it('chance×倍率封顶 1：不会超概率触发', () => {
    const triggered = checkRareEvents(baseState, () => 0.99);
    expect(triggered.length).toBe(0); // 全部 chance <1，rng=0.99 都不命中
  });
});
