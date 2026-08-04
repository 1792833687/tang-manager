/**
 * 招聘系统单测（tang-recruitment · Step 5a 2.2）
 * 覆盖：候选数量、类型权重落区间、技能 1-2 个、要价范围、10% 特殊员工（隐藏背景/缺陷）。
 */
import { describe, expect, it } from 'vitest';
import { HIDDEN_BACKGROUNDS, HIDDEN_FLAWS } from '@/config/tang-recruitment-config';
import { generateCandidate, generateCandidates } from '@/systems/tang-recruitment';

/** 序列 rng：依次弹出；耗尽后返回 0.5 */
const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

describe('generateCandidates · 数量', () => {
  it('count=2 生成 2 名、count=3 生成 3 名，均含完整字段', () => {
    const two = generateCandidates(2);
    expect(two).toHaveLength(2);
    const three = generateCandidates(3);
    expect(three).toHaveLength(3);
    for (const c of [...two, ...three]) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.gender).toMatch(/^(male|female)$/);
      expect(c.salary).toBeGreaterThanOrEqual(3);
      expect(c.skills.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('generateCandidate · 类型权重', () => {
  it('权重命中：rng<0.4 → waiter；0.4-0.5 → 技师类；0.7-0.9 → accountant；>0.9 → guard', () => {
    // rng=0.05 → roll 5（<40）→ waiter（无店型，无技师细分分支）
    expect(generateCandidate(seq(0.05)).type).toBe('waiter');
    // rng=0.45 → roll 45（40-50）→ 技师类（chef/tailor/pharmacist 之一）
    const tech = generateCandidate(seq(0.45, 0.5)).type;
    expect(['chef', 'tailor', 'pharmacist']).toContain(tech);
    // rng=0.8 → roll 80（70-90）→ accountant
    expect(generateCandidate(seq(0.8)).type).toBe('accountant');
    // rng=0.95 → roll 95（90-100）→ guard
    expect(generateCandidate(seq(0.95)).type).toBe('guard');
  });

  it('给定店型时技师类偏向匹配技师（jiulou → chef 50% 区间）', () => {
    // rng=0.45 → 技师分支；sub=0.2（<0.5）→ 匹配店型技师 chef
    expect(generateCandidate(seq(0.45, 0.2), 'jiulou').type).toBe('chef');
    // sub=0.6（≥0.5 且 <0.75）→ 另两类之一（tailor/pharmacist）
    expect(['tailor', 'pharmacist']).toContain(generateCandidate(seq(0.45, 0.6), 'jiulou').type);
  });

  it('类型权重统计落区间（2000 样本：waiter≈40%、技师合计≈30%、accountant≈20%、guard≈10%）', () => {
    const counts: Record<string, number> = { waiter: 0, technician: 0, accountant: 0, guard: 0 };
    for (let i = 0; i < 2000; i++) {
      const t = generateCandidate(Math.random, 'jiulou').type;
      if (t === 'waiter') counts.waiter!++;
      else if (t === 'chef' || t === 'tailor' || t === 'pharmacist') counts.technician!++;
      else if (t === 'accountant') counts.accountant!++;
      else counts.guard!++;
    }
    expect(counts.waiter! / 2000).toBeGreaterThan(0.35);
    expect(counts.waiter! / 2000).toBeLessThan(0.45);
    expect(counts.technician! / 2000).toBeGreaterThan(0.25);
    expect(counts.technician! / 2000).toBeLessThan(0.35);
    expect(counts.accountant! / 2000).toBeGreaterThan(0.15);
    expect(counts.accountant! / 2000).toBeLessThan(0.25);
    expect(counts.guard! / 2000).toBeGreaterThan(0.05);
    expect(counts.guard! / 2000).toBeLessThan(0.15);
  });
});

describe('generateCandidate · 技能数量', () => {
  it('技能第 2 个判定 <0.05 → 2 个；否则 1 个', () => {
    // 第 5 个 rng（secondCheck）=0.01 → 2 技能
    const two = generateCandidate(seq(0.05, 0.9, 0.1, 0.1, 0.01, 0.9));
    expect(two.skills).toHaveLength(2);
    expect(two.skills[0]!.id).not.toBe(two.skills[1]!.id);
    // secondCheck=0.5 → 1 技能
    const one = generateCandidate(seq(0.05, 0.9, 0.1, 0.1, 0.5));
    expect(one.skills).toHaveLength(1);
  });

  it('技能均与员工类型匹配（requiresType 含该类型或通用）', () => {
    const c = generateCandidate(seq(0.05, 0.9, 0.1, 0.1, 0.5), 'jiulou');
    for (const sk of c.skills) {
      if (sk.requiresType) {
        expect(sk.requiresType).toContain(c.type);
      }
    }
  });
});

describe('generateCandidate · 要价范围', () => {
  it('基础要价 = 3 + rng*12（rng=0.5 → 9 两）；多技能/特殊上浮', () => {
    const base = generateCandidate(seq(0.05, 0.9, 0.1, 0.1, 0.5, 0.5, 0.5));
    expect(base.salary).toBe(9);
    // 特殊员工（isSpecial rng=0.01）→ +2 两 → 11
    const special = generateCandidate(seq(0.05, 0.9, 0.1, 0.1, 0.5, 0.5, 0.01, 0.1, 0.2));
    expect(special.salary).toBe(11);
  });

  it('要价始终在 [3, 20] 区间（含技能/特殊上浮）', () => {
    for (let i = 0; i < 300; i++) {
      const c = generateCandidate(Math.random);
      expect(c.salary).toBeGreaterThanOrEqual(3);
      expect(c.salary).toBeLessThanOrEqual(20);
    }
  });
});

describe('generateCandidate · 特殊员工', () => {
  it('10% 概率 isSpecial=true 且带 hiddenBackground/hiddenFlaw', () => {
    const special = generateCandidate(seq(0.05, 0.9, 0.1, 0.1, 0.5, 0.5, 0.01, 0.1, 0.2));
    expect(special.isSpecial).toBe(true);
    expect(special.hiddenBackground).toBeTruthy();
    expect(special.hiddenFlaw).toBeTruthy();
    expect(HIDDEN_BACKGROUNDS).toContain(special.hiddenBackground);
    expect(HIDDEN_FLAWS).toContain(special.hiddenFlaw);
  });

  it('非特殊员工无隐藏背景/缺陷', () => {
    const normal = generateCandidate(seq(0.05, 0.9, 0.1, 0.1, 0.5, 0.5, 0.5));
    expect(normal.isSpecial).toBe(false);
    expect(normal.hiddenBackground).toBeUndefined();
    expect(normal.hiddenFlaw).toBeUndefined();
  });

  it('特殊员工占比统计 ≈10%（500 样本落 [0.05, 0.18]）', () => {
    let special = 0;
    for (let i = 0; i < 500; i++) {
      if (generateCandidate(Math.random).isSpecial) special++;
    }
    expect(special / 500).toBeGreaterThan(0.05);
    expect(special / 500).toBeLessThan(0.18);
  });
});
