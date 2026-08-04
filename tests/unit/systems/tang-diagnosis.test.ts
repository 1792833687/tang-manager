/**
 * 药铺坐诊（规格书模块二）验收测试 — 纯函数层
 * 覆盖：症状匹配 / 模糊提示随知识等级（误导项数量递减）/ 药方匹配度（含知识加成）/ 匹配档位。
 */
import { describe, expect, it } from 'vitest';
import { matchDiagnosis, generateSymptomHints, evaluatePrescription, matchTier, DIAGNOSES } from '@/systems/tang-diagnosis';

describe('matchDiagnosis 症状匹配', () => {
  it('已知症状 → 正确诊断；未知 → null', () => {
    expect(matchDiagnosis('恶寒发热，头项强痛，鼻塞流清涕')!.id).toBe('feng_han');
    expect(matchDiagnosis('完全没见过的症状')).toBeNull();
  });
  it('病症池覆盖四个诊治范围（Lv0-3）', () => {
    const levels = new Set(DIAGNOSES.map((d) => d.minLevel));
    expect(levels.has(0)).toBe(true);
    expect(levels.has(1)).toBe(true);
    expect(levels.has(2)).toBe(true);
    expect(levels.has(3)).toBe(true);
  });
});

describe('generateSymptomHints 模糊提示随知识等级', () => {
  const symptoms = '恶寒发热，头项强痛，鼻塞流清涕';
  it('Lv0（无医书）→ 2 个误导项', () => {
    const r = generateSymptomHints(symptoms, undefined, () => 0.5);
    expect(r.correctDiagnosis).toBe('feng_han');
    expect(r.hints.length).toBeGreaterThanOrEqual(3); // 2 正确 + 2 误导（可能合并重复）
  });
  it('Lv1（1-2 本）→ 1 个误导项', () => {
    const r = generateSymptomHints(symptoms, ['shanghan'], () => 0.5);
    // 正确 1 条 + 误导 1 条 = 2
    expect(r.hints.length).toBeGreaterThanOrEqual(2);
    expect(r.hints.length).toBeLessThanOrEqual(3);
  });
  it('Lv3（5 本全）→ 无误导项，提示为精确脉案', () => {
    const books = ['shanghan', 'jinkui', 'bencao', 'zhenjiu', 'qianjin'];
    const r = generateSymptomHints(symptoms, books, () => 0.5);
    expect(r.hints).toHaveLength(1); // 仅精确脉案
    expect(r.hints[0]).toContain('麻黄');
  });
  it('误导项数量随等级递减', () => {
    const countFalse = (books: string[] | undefined) => {
      const r = generateSymptomHints(symptoms, books, () => 0.5);
      return r.hints.filter((h) => h.includes('可能') || h.includes('怕是') || h.includes('似有') || h.includes('恐是') || h.includes('或许是')).length;
    };
    expect(countFalse(undefined)).toBeGreaterThan(countFalse(['shanghan']));
    expect(countFalse(['shanghan'])).toBeGreaterThan(countFalse(['shanghan', 'jinkui', 'bencao', 'zhenjiu', 'qianjin']));
  });
});

describe('evaluatePrescription 药方匹配度', () => {
  const correct = matchDiagnosis('恶寒发热，头项强痛，鼻塞流清涕');
  it('完全对症 → 高分（≥80）', () => {
    const m = evaluatePrescription(['mahuang', 'guizhi'], correct, undefined);
    expect(m).toBeGreaterThanOrEqual(80);
  });
  it('完全不对症 → 0', () => {
    expect(evaluatePrescription(['sanqi', 'baiji'], correct, undefined)).toBe(0);
  });
  it('知识加成：Lv2 起每级 +10', () => {
    const partial = evaluatePrescription(['mahuang'], correct, undefined); // 1/2 = 50
    const lv2 = evaluatePrescription(['mahuang'], correct, ['shanghan', 'jinkui', 'bencao']); // 50 + 10
    const lv3 = evaluatePrescription(['mahuang'], correct, ['shanghan', 'jinkui', 'bencao', 'zhenjiu', 'qianjin']); // 50 + 20
    expect(lv2).toBe(partial + 10);
    expect(lv3).toBe(partial + 20);
  });
});

describe('matchTier 档位', () => {
  it('≥80 great / 50-79 ok / <50 poor', () => {
    expect(matchTier(85)).toBe('great');
    expect(matchTier(60)).toBe('ok');
    expect(matchTier(40)).toBe('poor');
  });
});
