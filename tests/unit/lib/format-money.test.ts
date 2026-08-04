/**
 * formatMoney 工具函数单测（内容深化模块九）
 * 覆盖：正数/负数/零取整、"两"后缀、负数符号、非有限值兜底。
 */
import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyRaw } from '@/lib/format-money';

describe('formatMoney', () => {
  it('整数直接加「两」后缀', () => {
    expect(formatMoney(50)).toBe('50两');
    expect(formatMoney(0)).toBe('0两');
  });

  it('正数按四舍五入取整', () => {
    expect(formatMoney(50.4)).toBe('50两');
    expect(formatMoney(50.5)).toBe('51两');
    expect(formatMoney(50.6)).toBe('51两');
  });

  it('负数显示负号并取整', () => {
    expect(formatMoney(-49.6)).toBe('-50两');
    expect(formatMoney(-10.2)).toBe('-10两');
  });

  it('负零（-0.4）归零为「0两」', () => {
    expect(formatMoney(-0.4)).toBe('0两');
  });

  it('非有限值兜底为 0，避免 NaN两', () => {
    expect(formatMoney(Number.NaN)).toBe('0两');
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe('0两');
  });
});

describe('formatMoneyRaw', () => {
  it('返回取整后的数字（供计算展示）', () => {
    expect(formatMoneyRaw(50.4)).toBe(50);
    expect(formatMoneyRaw(50.6)).toBe(51);
    expect(formatMoneyRaw(-49.6)).toBe(-50);
    expect(formatMoneyRaw(0)).toBe(0);
  });

  it('与 formatMoney 同一口径', () => {
    expect(formatMoney(formatMoneyRaw(123.45))).toBe('123两');
    expect(formatMoneyRaw(Number.NaN)).toBe(0);
  });
});
