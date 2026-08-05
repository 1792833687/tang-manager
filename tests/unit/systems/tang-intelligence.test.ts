/**
 * 市井情报系统（v1.2 规格书模块一）验收测试
 * 覆盖：分级生成（坊间/商会/地下按声望与好感）/ 打探验证（提升准确度或失败）/ 来源可信度升降 / 过期判定。
 */
import { describe, expect, it } from 'vitest';
import { generateDailyIntelligence, generateIntelligence, investigateIntelligence, updateSourceReliability, isIntelligenceExpired, intelligenceDaysLeft } from '@/systems/tang-intelligence';
import { INTELLIGENCE_TIERS, SOURCE_INITIAL_RELIABILITY } from '@/config/tang-intelligence-tier';

const seq = (...v: number[]) => { let i = 0; return () => v[Math.min(i++, v.length - 1)] ?? 0.5; };

describe('generateDailyIntelligence 分级生成', () => {
  it('低声望/低好感 → 仅坊间闲谈（1-2 条 tier1）', () => {
    const list = generateDailyIntelligence({ day: 5, reputation: 50, xieQiFavor: 0 }, seq(0.9));
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.every((i) => i.tier === 1)).toBe(true);
  });
  it('声望≥300 → 追加商会情报（tier2）', () => {
    const list = generateDailyIntelligence({ day: 60, reputation: 320, xieQiFavor: 0 }, seq(0.9));
    expect(list.some((i) => i.tier === 2)).toBe(true);
  });
  it('谢七好感≥50 → 追加地下消息（tier3）', () => {
    const list = generateDailyIntelligence({ day: 60, reputation: 50, xieQiFavor: 60 }, seq(0.9));
    expect(list.some((i) => i.tier === 3)).toBe(true);
  });
  it('情报带来源/有效期/预测变动', () => {
    const i = generateIntelligence(1, { day: 5, reputation: 0, xieQiFavor: 0 }, seq(0.5));
    expect(i.expiryDay).toBeGreaterThan(5);
    expect(i.sourceReliability).toBeGreaterThan(0);
    expect(i.actionable).toBe(true);
  });
});

describe('investigateIntelligence 打探验证', () => {
  it('打探后 investigated=true，准确度由来源可信度决定', () => {
    const i = generateIntelligence(1, { day: 1, reputation: 0, xieQiFavor: 0 }, seq(0.5));
    const r = investigateIntelligence(i, () => 0.9); // 高 rng → 不失败
    expect(r.investigated).toBe(true);
    expect(r.intel.investigated).toBe(true);
  });
  it('低 rng → 打探失败（存疑）', () => {
    const i = generateIntelligence(1, { day: 1, reputation: 0, xieQiFavor: 0 }, seq(0.5));
    const r = investigateIntelligence(i, () => 0.01);
    expect(r.failed).toBe(true);
  });
});

describe('updateSourceReliability 来源可信度', () => {
  it('验证准确 +0.1（上限 0.95）；不准确 -0.15（下限 0.2）', () => {
    expect(updateSourceReliability(0.6, true)).toBeCloseTo(0.7);
    expect(updateSourceReliability(0.9, true)).toBeCloseTo(0.95);
    expect(updateSourceReliability(0.6, false)).toBeCloseTo(0.45);
    expect(updateSourceReliability(0.3, false)).toBeCloseTo(0.2);
  });
  it('来源初始可信度符合规格（苏大娘0.6/程掌柜0.7/谢七0.8/市井0.4）', () => {
    expect(SOURCE_INITIAL_RELIABILITY['苏大娘']).toBe(0.6);
    expect(SOURCE_INITIAL_RELIABILITY['程掌柜']).toBe(0.7);
    expect(SOURCE_INITIAL_RELIABILITY['谢七']).toBe(0.8);
    expect(SOURCE_INITIAL_RELIABILITY['市井偶闻']).toBe(0.4);
  });
});

describe('过期判定', () => {
  it('day > expiryDay → 过期；剩余天数正确', () => {
    const i = { ...generateIntelligence(1, { day: 10, reputation: 0, xieQiFavor: 0 }, seq(0.5)), expiryDay: 13 };
    expect(isIntelligenceExpired(i, 12)).toBe(false);
    expect(isIntelligenceExpired(i, 14)).toBe(true);
    expect(intelligenceDaysLeft(i, 11)).toBe(2);
  });
  it('tier 有效天数区间符合规格（1-3天/2-5天/3-7天）', () => {
    expect(INTELLIGENCE_TIERS[1].validityRange[0]).toBeLessThanOrEqual(3);
    expect(INTELLIGENCE_TIERS[3].validityRange[1]).toBeGreaterThanOrEqual(5);
  });
});
