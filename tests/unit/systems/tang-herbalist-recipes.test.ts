/** 药铺·药方研发单测（产业系统 模块三 3.2） */
import { describe, expect, it } from 'vitest';
import { checkHerbalistLevelUp, patentLeak, setPatent, settleHerbResearch, startHerbResearch, symptomSalesBonus } from '@/systems/tang-herbalist-recipes';

function rngSeq(seq: number[]): () => number { let i = 0; return () => seq[i++ % seq.length]!; }

describe('startHerbResearch', () => {
  it('周期 2-7 天', () => {
    const j = startHerbResearch('汤剂', '失眠盗汗', 3, rngSeq([0.5]));
    expect(j.totalDays).toBeGreaterThanOrEqual(2);
    expect(j.totalDays).toBeLessThanOrEqual(7);
    expect(j.recipeName.length).toBeGreaterThan(0);
  });
});

describe('settleHerbResearch', () => {
  it('rng=0 → 成功出新药方', () => {
    const j = startHerbResearch('丸剂', '久咳不愈', 3, rngSeq([0.5]));
    const res = settleHerbResearch(j, rngSeq([0]));
    expect(res.ok).toBe(true);
    expect(res.recipe?.category).toBe('丸剂');
  });
  it('rng=0.7 → 改良；rng=0.99 → 失败', () => {
    const j = startHerbResearch('散剂', '跌打损伤', 3, rngSeq([0.5]));
    expect(settleHerbResearch(j, rngSeq([0.7])).improved).toBe(true);
    expect(settleHerbResearch(j, rngSeq([0.99])).ok).toBe(false);
  });
});

describe('独家秘方机制', () => {
  it('品质 ≥4 可设秘方，售价 +50%', () => {
    const recipe = { id: 'r1', name: '安神定志汤', category: '汤剂' as const, targetSymptom: '失眠盗汗', quality: 4, ingredients: [], price: 100, effectiveness: 80, isPatent: false };
    const res = setPatent(recipe);
    expect(res.ok).toBe(true);
    expect(res.recipe.isPatent).toBe(true);
    expect(res.recipe.price).toBe(150);
    expect(setPatent({ ...recipe, quality: 3 }).ok).toBe(false);
  });
  it('高品质药方药材销量 +50%；秘方泄露概率 20%', () => {
    expect(symptomSalesBonus({ isPatent: false, quality: 3 } as never)).toBe(0.5);
    expect(patentLeak(rngSeq([0]))).toBe(true);
    expect(patentLeak(rngSeq([0.5]))).toBe(false);
  });
});

describe('checkHerbalistLevelUp', () => {
  it('评分 + 治愈人数', () => {
    expect(checkHerbalistLevelUp(1, 1.6, 3)).toBe(true);
    expect(checkHerbalistLevelUp(1, 1.4, 3)).toBe(false);
  });
});
