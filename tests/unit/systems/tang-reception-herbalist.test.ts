/**
 * 药铺问诊开方接待单测（模块一 1.3 / 模块七）
 * 覆盖：症状匹配、主药对症、把脉修正、辅药/药引/服药建议加成、谢礼/纠纷概率。
 */
import { describe, expect, it } from 'vitest';
import { matchSymptom } from '@/config/tang-reception-content';
import {
  evaluateHerbalistPrescription,
  handleHerbalistReception,
  mainHerbMatches,
} from '@/systems/tang-reception-herbalist';
import type { Guest } from '@/types/tang-manager';
import type { HerbalistPlan } from '@/systems/tang-reception-herbalist';

function rngSeq(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length]!;
}

function makeGuest(overrides: Partial<Guest> = {}): Guest {
  return {
    id: 'g3',
    name: '刘婆婆',
    type: 'normal',
    description: '我家老母亲咳了半个月了，吃了好几副药都不见好。',
    baseConsumption: 5,
    handled: false,
    ...overrides,
  };
}

describe('matchSymptom（症状匹配）', () => {
  it('关键词 → 症状', () => {
    expect(matchSymptom('失眠多梦盗汗').id).toBe('insomnia');
    expect(matchSymptom('咳了半个月').id).toBe('cough');
    expect(matchSymptom('被马车撞了腿肿').id).toBe('injury');
    expect(matchSymptom('身子虚想调理').id).toBe('weakness');
  });
});

describe('mainHerbMatches / evaluateHerbalistPrescription', () => {
  const cough = matchSymptom('咳了半个月');
  it('主药对症 → matched，收益 ×1.2~1.4，满意度 +15', () => {
    expect(mainHerbMatches('gancao', cough)).toBe(true);
    const r = evaluateHerbalistPrescription('gancao', cough, false, rngSeq([0]));
    expect(r.matched).toBe(true);
    expect(r.incomeMul).toBe(1.2);
    expect(r.satisfactionDelta).toBe(15);
  });
  it('主药不对症 → matched false，收益 ×0.7~0.85', () => {
    const r = evaluateHerbalistPrescription('renshen', cough, false, rngSeq([0]));
    expect(r.matched).toBe(false);
    expect(r.incomeMul).toBe(0.7);
  });
  it('把脉可 30% 修正误判（rng<0.3 → 精准诊断）', () => {
    const r = evaluateHerbalistPrescription('renshen', cough, true, rngSeq([0]));
    expect(r.matched).toBe(true);
    const r2 = evaluateHerbalistPrescription('renshen', cough, true, rngSeq([0.5]));
    expect(r2.matched).toBe(false);
  });
});

describe('handleHerbalistReception（完整流程）', () => {
  it('对症：review good、收入上浮、辅药/药引加成', () => {
    const plan: HerbalistPlan = { shop: 'yaopu', mainHerbId: 'gancao', adjuvantIds: ['chuanbei'], guideId: 'shengjiang' };
    const res = handleHerbalistReception(makeGuest(), plan, { baseConsumption: 5, guestType: 'normal' }, rngSeq([0.5, 0.5, 0.5]));
    expect(res.ok).toBe(true);
    expect(res.review).toBe('good');
    expect(res.satisfactionDelta).toBeGreaterThanOrEqual(15 + 5 + 3);
  });
  it('把脉：精力 -5；服药建议：满意度 +5', () => {
    const plan: HerbalistPlan = { shop: 'yaopu', mainHerbId: 'gancao', adjuvantIds: [], pulseUsed: true, adviceGiven: true };
    const res = handleHerbalistReception(makeGuest(), plan, { baseConsumption: 5, guestType: 'normal' }, rngSeq([0.5, 0.5, 0.5]));
    expect(res.energyConsumed).toBe(5);
    expect(res.satisfactionDelta).toBeGreaterThanOrEqual(15 + 5);
  });
  it('不对症：review bad、收入下降、低概率纠纷', () => {
    const plan: HerbalistPlan = { shop: 'yaopu', mainHerbId: 'danggui', adjuvantIds: [] };
    const res = handleHerbalistReception(makeGuest(), plan, { baseConsumption: 5, guestType: 'normal' }, rngSeq([0.5, 0, 0]));
    expect(res.ok).toBe(false);
    expect(res.review).toBe('bad');
    expect(res.incomeMultiplier).toBeLessThanOrEqual(0.85);
    expect(res.flags?.medicalDispute).toBe(true);
  });
  it('疗效好 + rng<0.3 → 痊愈后送谢礼', () => {
    const plan: HerbalistPlan = { shop: 'yaopu', mainHerbId: 'gancao', adjuvantIds: [] };
    const res = handleHerbalistReception(makeGuest(), plan, { baseConsumption: 5, guestType: 'normal' }, rngSeq([0.5, 0, 0]));
    expect(res.flags?.thankYouGift).toBe(true);
  });
});
