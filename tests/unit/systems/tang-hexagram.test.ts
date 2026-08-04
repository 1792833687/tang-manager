/**
 * 手札占候单测（TANG-ADD-001 模块一）
 * 覆盖：8 卦全量抽取、效果应用 8 类修正、谦卦无效果、null 卦象原样。
 */
import { describe, expect, it } from 'vitest';
import { HEXAGRAMS } from '@/config/tang-hexagrams';
import { applyHexagramEffect, drawHexagram } from '@/systems/tang-hexagram';
import type { Hexagram } from '@/types/tang-manager';

const seq =
  (...values: number[]): (() => number) =>
  () => {
    const v = values.shift();
    return v ?? 0.5;
  };

/** 取卦辅助：按 id 取卦 */
function hexById(id: string): Hexagram {
  const h = HEXAGRAMS.find((x) => x.id === id);
  if (!h) throw new Error(`卦象不存在: ${id}`);
  return h;
}

describe('drawHexagram · 抽取', () => {
  it('八卦全量 8 卦，id/judgment/effect/description 齐全', () => {
    expect(HEXAGRAMS).toHaveLength(8);
    const ids = HEXAGRAMS.map((h) => h.id);
    expect(ids).toEqual(['tai', 'qian', 'zhen', 'xun', 'kan', 'li', 'gen', 'dui']);
    for (const h of HEXAGRAMS) {
      expect(h.judgment).toBeTruthy();
      expect(h.description).toBeTruthy();
      expect(h.effect.type).toBeTruthy();
      expect(h.tagColor).toBeTruthy();
    }
  });

  it('rng=0 → 泰卦；rng 接近 1 → 兑卦', () => {
    expect(drawHexagram(() => 0).id).toBe('tai');
    expect(drawHexagram(() => 0.99).id).toBe('dui');
  });

  it('8 卦占断与效果类型逐字匹配', () => {
    expect(hexById('tai').judgment).toBe('大吉');
    expect(hexById('tai').effect).toEqual({ type: 'income_multiplier', value: 1.15 });
    expect(hexById('qian').judgment).toBe('平稳');
    expect(hexById('qian').effect.type).toBe('none');
    expect(hexById('zhen').judgment).toBe('波动');
    expect(hexById('xun').effect.type).toBe('cost_reduction');
    expect(hexById('kan').effect.type).toBe('event_double');
    expect(hexById('li').effect.type).toBe('big_order_bonus');
    expect(hexById('gen').effect.type).toBe('patience_decay_double');
    expect(hexById('dui').effect.type).toBe('praise_bonus');
  });
});

describe('applyHexagramEffect · 效果应用', () => {
  it('泰卦 大吉：收益 ×1.15', () => {
    const ctx = applyHexagramEffect(hexById('tai'), { baseIncome: 100 });
    expect(ctx.baseIncome).toBeCloseTo(115, 5);
  });

  it('震卦 波动：客消 ±20%（rng<0.5 减、≥0.5 加）', () => {
    const down = applyHexagramEffect(hexById('zhen'), { guestIncome: 100 }, () => 0.2);
    expect(down.guestIncome).toBeCloseTo(80, 5);
    const up = applyHexagramEffect(hexById('zhen'), { guestIncome: 100 }, () => 0.8);
    expect(up.guestIncome).toBeCloseTo(120, 5);
  });

  it('巽卦 顺风：采买 ×0.9', () => {
    const ctx = applyHexagramEffect(hexById('xun'), { procurementCost: 100 });
    expect(ctx.procurementCost).toBeCloseTo(90, 5);
  });

  it('坎卦 坎坷：事件概率 ×2', () => {
    const ctx = applyHexagramEffect(hexById('kan'), { eventChance: 1 });
    expect(ctx.eventChance).toBeCloseTo(2, 5);
  });

  it('离卦 火爆：大单 +30%', () => {
    const ctx = applyHexagramEffect(hexById('li'), { bigOrderIncome: 100 });
    expect(ctx.bigOrderIncome).toBeCloseTo(130, 5);
  });

  it('艮卦 阻滞：耐心衰减 ×2', () => {
    const ctx = applyHexagramEffect(hexById('gen'), { patienceDecay: 30 });
    expect(ctx.patienceDecay).toBeCloseTo(60, 5);
  });

  it('兑卦 口福：夸奖概率 +20%', () => {
    const ctx = applyHexagramEffect(hexById('dui'), { praiseChance: 0 });
    expect(ctx.praiseChance).toBeCloseTo(0.2, 5);
  });

  it('谦卦 平稳：无效果原样返回', () => {
    const ctx = applyHexagramEffect(hexById('qian'), { baseIncome: 100, guestIncome: 50 });
    expect(ctx.baseIncome).toBe(100);
    expect(ctx.guestIncome).toBe(50);
  });

  it('无卦象（null/undefined）：原样返回', () => {
    expect(applyHexagramEffect(null, { baseIncome: 100 }).baseIncome).toBe(100);
    expect(applyHexagramEffect(undefined, { baseIncome: 100 }).baseIncome).toBe(100);
  });
});
