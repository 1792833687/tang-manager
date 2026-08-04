/** 布庄·定制订单单测（产业系统 模块二 2.2） */
import { describe, expect, it } from 'vitest';
import { deliverCustomOrder, generateCustomOrder, gradeCustomOrder, officialUnlocked } from '@/systems/tang-clothier-custom-orders';

function rngSeq(seq: number[]): () => number { let i = 0; return () => seq[i++ % seq.length]!; }

describe('generateCustomOrder', () => {
  it('生成定制订单：类型/报酬/工期合理', () => {
    const o = generateCustomOrder('bridal', '王娘子', '丝绸', '华贵', rngSeq([0, 0, 0]));
    expect(o.type).toBe('bridal');
    expect(o.reward).toBeGreaterThanOrEqual(50);
    expect(o.totalDays).toBeGreaterThanOrEqual(3);
  });
});

describe('gradeCustomOrder / deliverCustomOrder', () => {
  it('匹配度分级：0.95 perfect / 0.5 flawed / 0.1 reject', () => {
    expect(gradeCustomOrder(0.95)).toBe('perfect');
    expect(gradeCustomOrder(0.6)).toBe('basic');
    expect(gradeCustomOrder(0.5)).toBe('flawed');
    expect(gradeCustomOrder(0.1)).toBe('reject');
  });
  it('完美交货：全额 + 满意度 +20；严重不符：拒收收益 0', () => {
    const o = generateCustomOrder('bridal', '王娘子', '丝绸', '华贵', rngSeq([0, 0, 0]));
    const perfect = deliverCustomOrder(o, 0.95, rngSeq([0]));
    expect(perfect.result.income).toBeGreaterThan(0);
    expect(perfect.result.satisfactionDelta).toBe(20);
    const bad = deliverCustomOrder(o, 0.1, rngSeq([0]));
    expect(bad.result.grade).toBe('reject');
    expect(bad.result.income).toBe(0);
  });
  it('官服定制 Lv3 解锁', () => {
    expect(officialUnlocked(2)).toBe(false);
    expect(officialUnlocked(3)).toBe(true);
  });
});
