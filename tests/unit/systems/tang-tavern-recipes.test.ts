/** 酒楼·新菜研发单测（产业系统 模块一 1.1） */
import { describe, expect, it } from 'vitest';
import { canSetSignature, checkTavernLevelUp, maxSignatures, signaturePrice, settleTavernResearch, startTavernResearch } from '@/systems/tang-tavern-recipes';

function rngSeq(seq: number[]): () => number { let i = 0; return () => seq[i++ % seq.length]!; }

describe('startTavernResearch', () => {
  it('生成研发任务：周期 1-5 天、成功率随厨师技能提升', () => {
    const j1 = startTavernResearch('荤菜', 1, 2, rngSeq([0.5, 0]));
    expect(j1.totalDays).toBeGreaterThanOrEqual(1);
    expect(j1.totalDays).toBeLessThanOrEqual(5);
    expect(j1.successRate).toBeGreaterThan(0.7);
    const j2 = startTavernResearch('荤菜', 5, 2, rngSeq([0.5, 0]));
    expect(j2.successRate).toBeGreaterThan(j1.successRate);
  });
});

describe('settleTavernResearch', () => {
  it('rng=0 → 大成功（招牌菜）', () => {
    const job = startTavernResearch('荤菜', 3, 2, rngSeq([0.5, 0]));
    const res = settleTavernResearch(job, rngSeq([0]));
    expect(res.grand).toBe(true);
    expect(res.dish?.isSignature).toBe(true);
  });
  it('rng=0.5 → 成功（普通新菜）', () => {
    const job = startTavernResearch('素菜', 3, 2, rngSeq([0.5, 0]));
    const res = settleTavernResearch(job, rngSeq([0.5]));
    expect(res.ok).toBe(true);
    expect(res.dish?.isSignature).toBe(false);
  });
  it('rng 极高 → 失败（研发经验）', () => {
    const job = startTavernResearch('汤品', 1, 1, rngSeq([0.5, 0]));
    const res = settleTavernResearch(job, rngSeq([0.99]));
    expect(res.ok).toBe(false);
    expect(res.experience).toBe(true);
  });
});

describe('招牌菜机制', () => {
  it('上限：默认 3 道，Lv3 起 4 道', () => {
    expect(maxSignatures(1)).toBe(3);
    expect(maxSignatures(3)).toBe(4);
  });
  it('canSetSignature 受上限约束', () => {
    const dishes = Array.from({ length: 3 }, (_, i) => ({ id: `d${i}`, name: `菜${i}`, category: '荤菜' as const, quality: 3, cost: 10, price: 20, popularity: 50, isSignature: true, ingredients: [], bonus: '' }));
    expect(canSetSignature(dishes, 1)).toBe(false);
    expect(canSetSignature(dishes, 3)).toBe(true);
  });
  it('招牌菜售价上浮 30%', () => {
    expect(signaturePrice(100)).toBe(130);
  });
});

describe('checkTavernLevelUp', () => {
  it('Lv1→2：评分 ≥1.5 且宴席 ≥2', () => {
    expect(checkTavernLevelUp(1, 1.6, 2)).toBe(true);
    expect(checkTavernLevelUp(1, 1.4, 2)).toBe(false);
    expect(checkTavernLevelUp(1, 1.6, 1)).toBe(false);
  });
  it('最高级不再升级', () => {
    expect(checkTavernLevelUp(5, 5, 999)).toBe(false);
  });
});
